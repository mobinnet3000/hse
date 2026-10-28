from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import TenantRequiredPermission
from apps.organizations.models import Membership
from .models import PSSRChecklistItem, PSSROutstandingAction, PSSRReview
from .serializers import (
    PSSRApprovalActionSerializer,
    PSSRChecklistItemSerializer,
    PSSROutstandingActionSerializer,
    PSSRReviewDetailSerializer,
    PSSRReviewListSerializer,
)
from .services import (
    PSSRSafetyError,
    approve_pssr_review,
    populate_default_checklist,
    reject_pssr_review,
)


def _get_user_organization(user):
    membership = Membership.objects.filter(user=user, is_active=True).first()
    return membership.organization if membership else None


class PSSRReviewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, TenantRequiredPermission]

    def get_serializer_class(self):
        if self.action in ["retrieve", "create", "update", "partial_update"]:
            return PSSRReviewDetailSerializer
        return PSSRReviewListSerializer

    def get_queryset(self):
        user = self.request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        queryset = PSSRReview.objects.filter(organization_id__in=org_ids).select_related(
            "workplace", "leader", "approver"
        )

        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        workplace_param = self.request.query_params.get("workplace")
        if workplace_param:
            queryset = queryset.filter(workplace_id=workplace_param)

        return queryset

    def perform_create(self, serializer):
        org = _get_user_organization(self.request.user)
        instance = serializer.save(organization=org, leader=self.request.user)
        # Auto populate standard checklist
        populate_default_checklist(instance)

    @action(detail=True, methods=["post"])
    def initialize_checklist(self, request, pk=None):
        pssr = self.get_object()
        populate_default_checklist(pssr)
        return Response(PSSRReviewDetailSerializer(pssr).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        pssr = self.get_object()
        serializer = PSSRApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notes = serializer.validated_data.get("signoff_notes", "")
        try:
            approved = approve_pssr_review(pssr, request.user, notes)
            return Response(PSSRReviewDetailSerializer(approved).data)
        except PSSRSafetyError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        pssr = self.get_object()
        serializer = PSSRApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get("rejection_reason", "")
        try:
            rejected = reject_pssr_review(pssr, request.user, reason)
            return Response(PSSRReviewDetailSerializer(rejected).data)
        except PSSRSafetyError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.get_queryset()
        total = qs.count()
        approved = qs.filter(status=PSSRReview.Status.APPROVED).count()
        in_progress = qs.filter(status=PSSRReview.Status.IN_PROGRESS).count()
        action_pending = qs.filter(status=PSSRReview.Status.ACTION_ITEMS_PENDING).count()
        draft = qs.filter(status=PSSRReview.Status.DRAFT).count()

        return Response({
            "total_reviews": total,
            "approved_reviews": approved,
            "in_progress_reviews": in_progress,
            "action_pending_reviews": action_pending,
            "draft_reviews": draft,
        })


class PSSRChecklistItemViewSet(viewsets.ModelViewSet):
    serializer_class = PSSRChecklistItemSerializer
    permission_classes = [IsAuthenticated, TenantRequiredPermission]

    def get_queryset(self):
        user = self.request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        return PSSRChecklistItem.objects.filter(pssr__organization_id__in=org_ids)

    def perform_update(self, serializer):
        serializer.save(verified_by=self.request.user)


class PSSROutstandingActionViewSet(viewsets.ModelViewSet):
    serializer_class = PSSROutstandingActionSerializer
    permission_classes = [IsAuthenticated, TenantRequiredPermission]

    def get_queryset(self):
        user = self.request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        return PSSROutstandingAction.objects.filter(pssr__organization_id__in=org_ids)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        action_item = self.get_object()
        notes = request.data.get("resolution_notes", "")
        action_item.status = PSSROutstandingAction.ActionStatus.RESOLVED
        action_item.resolution_notes = notes
        action_item.resolved_by = request.user
        action_item.resolved_at = timezone.now()
        action_item.save()
        return Response(PSSROutstandingActionSerializer(action_item).data)
