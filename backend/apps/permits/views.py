from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import (
    accessible_organization_ids,
    can_approve_permits,
    can_control_permits,
    is_active_member,
)
from .models import Permit, ShiftHandover
from .serializers import (
    PermitActivateActionSerializer,
    PermitCancelActionSerializer,
    PermitCloseActionSerializer,
    PermitCreateSerializer,
    PermitDetailSerializer,
    PermitListSerializer,
    PermitRejectActionSerializer,
    PermitReviewActionSerializer,
    PermitSuspendActionSerializer,
    ShiftHandoverAcknowledgeActionSerializer,
    ShiftHandoverCreateSerializer,
    ShiftHandoverSerializer,
)
from .services import (
    acknowledge_shift_handover,
    approve_permit,
    cancel_permit,
    close_permit,
    complete_work,
    create_shift_handover,
    get_outstanding_safety_summary,
    reject_permit,
    request_permit,
    resume_permit,
    review_permit,
    suspend_permit,
    verify_controls_and_activate,
)


def get_accessible_permit_or_404(pk: int, user) -> Permit:
    try:
        permit = (
            Permit.objects.select_related(
                "organization",
                "workplace",
                "requester",
                "responsible_supervisor",
                "approver",
                "closed_by",
                "controls_verified_by",
            )
            .prefetch_related("related_hazards", "attachments")
            .get(pk=pk)
        )
    except Permit.DoesNotExist:
        raise NotFound("مجوز کار مورد نظر یافت نشد.")

    if not user.is_platform_admin and not is_active_member(user, permit.organization_id):
        raise PermissionDenied("شما به اطلاعات این مجوز کار دسترسی ندارید.")

    return permit


def get_accessible_handover_or_404(pk: int, user) -> ShiftHandover:
    try:
        handover = (
            ShiftHandover.objects.select_related(
                "organization",
                "workplace",
                "outgoing_supervisor",
                "incoming_supervisor",
                "acknowledged_by",
            )
            .prefetch_related("active_permits")
            .get(pk=pk)
        )
    except ShiftHandover.DoesNotExist:
        raise NotFound("صورت‌جلسه تحویل شیفت یافت نشد.")

    if not user.is_platform_admin and not is_active_member(user, handover.organization_id):
        raise PermissionDenied("شما دسترسی به این صورت‌جلسه تحویل شیفت ندارید.")

    return handover


class PermitListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PermitCreateSerializer
        return PermitListSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_platform_admin:
            qs = Permit.objects.all()
        else:
            org_ids = accessible_organization_ids(user)
            qs = Permit.objects.filter(organization_id__in=org_ids)

        # Filters
        org_id = self.request.query_params.get("organization")
        if org_id and org_id.isdigit():
            qs = qs.filter(organization_id=int(org_id))

        workplace_id = self.request.query_params.get("workplace")
        if workplace_id and workplace_id.isdigit():
            qs = qs.filter(workplace_id=int(workplace_id))

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        permit_type = self.request.query_params.get("permit_type")
        if permit_type:
            qs = qs.filter(permit_type=permit_type)

        search = self.request.query_params.get("search")
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(reference_code__icontains=search)
                | Q(description__icontains=search)
                | Q(work_area__icontains=search)
                | Q(equipment_involved__icontains=search)
            )

        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(valid_from__date__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(valid_until__date__lte=date_to)

        return qs.select_related("organization", "workplace", "requester", "approver").distinct()

    def perform_create(self, serializer):
        user = self.request.user
        data = serializer.validated_data
        org = data["organization"]

        try:
            instance = request_permit(
                organization=org,
                requester=user,
                data=data,
            )
            serializer.instance = instance
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class PermitDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PermitDetailSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_platform_admin:
            return Permit.objects.all()
        org_ids = accessible_organization_ids(user)
        return Permit.objects.filter(organization_id__in=org_ids)

    def perform_destroy(self, instance):
        user = self.request.user
        if not can_approve_permits(user, instance.organization_id):
            raise PermissionDenied("تنها مدیران سازمان مجاز به حذف پرونده مجوز هستند.")
        instance.delete()


class PermitReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        permit = get_accessible_permit_or_404(pk, request.user)
        serializer = PermitReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = review_permit(
                permit=permit,
                user=request.user,
                status_choice=serializer.validated_data["status"],
                review_notes=serializer.validated_data.get("review_notes", ""),
            )
            return Response(PermDetailResponse(updated, request))
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class PermitApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        permit = get_accessible_permit_or_404(pk, request.user)
        notes = request.data.get("notes", "")

        try:
            updated = approve_permit(permit=permit, user=request.user, notes=notes)
            return Response(PermDetailResponse(updated, request))
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class PermitActivateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        permit = get_accessible_permit_or_404(pk, request.user)
        serializer = PermitActivateActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = verify_controls_and_activate(
                permit=permit,
                user=request.user,
                gas_results=serializer.validated_data.get("gas_testing_results", ""),
                loto_details=serializer.validated_data.get("isolation_loto_details", ""),
            )
            return Response(PermDetailResponse(updated, request))
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class PermitSuspendView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        permit = get_accessible_permit_or_404(pk, request.user)
        serializer = PermitSuspendActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = suspend_permit(
                permit=permit,
                user=request.user,
                reason=serializer.validated_data["reason"],
            )
            return Response(PermDetailResponse(updated, request))
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class PermitResumeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        permit = get_accessible_permit_or_404(pk, request.user)

        try:
            updated = resume_permit(permit=permit, user=request.user)
            return Response(PermDetailResponse(updated, request))
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class PermitCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        permit = get_accessible_permit_or_404(pk, request.user)

        try:
            updated = complete_work(permit=permit, user=request.user)
            return Response(PermDetailResponse(updated, request))
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class PermitCloseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        permit = get_accessible_permit_or_404(pk, request.user)
        serializer = PermitCloseActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = close_permit(
                permit=permit,
                user=request.user,
                closure_summary=serializer.validated_data["closure_summary"],
            )
            return Response(PermDetailResponse(updated, request))
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class PermitRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        permit = get_accessible_permit_or_404(pk, request.user)
        serializer = PermitRejectActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = reject_permit(
                permit=permit,
                user=request.user,
                reason=serializer.validated_data["reason"],
            )
            return Response(PermDetailResponse(updated, request))
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class PermitCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        permit = get_accessible_permit_or_404(pk, request.user)
        serializer = PermitCancelActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = cancel_permit(
                permit=permit,
                user=request.user,
                reason=serializer.validated_data.get("reason", ""),
            )
            return Response(PermDetailResponse(updated, request))
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class PermitSummaryStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.is_platform_admin:
            qs = Permit.objects.all()
        else:
            org_ids = accessible_organization_ids(user)
            qs = Permit.objects.filter(organization_id__in=org_ids)

        org_id = request.query_params.get("organization")
        if org_id and org_id.isdigit():
            qs = qs.filter(organization_id=int(org_id))

        now = timezone.now()
        total = qs.count()
        active = qs.filter(status=Permit.Status.ACTIVE).count()
        suspended = qs.filter(status=Permit.Status.SUSPENDED).count()
        requested = qs.filter(status=Permit.Status.REQUESTED).count()
        approved = qs.filter(status=Permit.Status.APPROVED).count()
        closed = qs.filter(status=Permit.Status.CLOSED).count()
        expired = qs.filter(
            valid_until__lt=now
        ).exclude(status__in=[Permit.Status.CLOSED, Permit.Status.COMPLETED]).count()

        by_type_qs = qs.values("permit_type").annotate(count=Count("id"))
        by_type = {item["permit_type"]: item["count"] for item in by_type_qs}

        by_status_qs = qs.values("status").annotate(count=Count("id"))
        by_status = {item["status"]: item["count"] for item in by_status_qs}

        return Response({
            "total_permits": total,
            "active_count": active,
            "suspended_count": suspended,
            "requested_count": requested,
            "approved_count": approved,
            "closed_count": closed,
            "expired_count": expired,
            "by_type": by_type,
            "by_status": by_status,
        })


def PermDetailResponse(permit: Permit, request):
    serializer = PermitDetailSerializer(permit, context={"request": request})
    return serializer.data


# =========================================================
# Shift Handover Views
# =========================================================

class ShiftHandoverListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ShiftHandoverCreateSerializer
        return ShiftHandoverSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_platform_admin:
            qs = ShiftHandover.objects.all()
        else:
            org_ids = accessible_organization_ids(user)
            qs = ShiftHandover.objects.filter(organization_id__in=org_ids)

        org_id = self.request.query_params.get("organization")
        if org_id and org_id.isdigit():
            qs = qs.filter(organization_id=int(org_id))

        workplace_id = self.request.query_params.get("workplace")
        if workplace_id and workplace_id.isdigit():
            qs = qs.filter(workplace_id=int(workplace_id))

        shift_type = self.request.query_params.get("shift_type")
        if shift_type:
            qs = qs.filter(shift_type=shift_type)

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        return qs.select_related(
            "organization",
            "workplace",
            "outgoing_supervisor",
            "incoming_supervisor",
            "acknowledged_by",
        ).prefetch_related("active_permits").distinct()

    def perform_create(self, serializer):
        user = self.request.user
        data = serializer.validated_data
        org = data["organization"]

        try:
            instance = create_shift_handover(
                organization=org,
                user=user,
                data=data,
            )
            serializer.instance = instance
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class ShiftHandoverDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ShiftHandoverSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_platform_admin:
            return ShiftHandover.objects.all()
        org_ids = accessible_organization_ids(user)
        return ShiftHandover.objects.filter(organization_id__in=org_ids)


class ShiftHandoverAcknowledgeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        handover = get_accessible_handover_or_404(pk, request.user)
        serializer = ShiftHandoverAcknowledgeActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = acknowledge_shift_handover(
                handover=handover,
                user=request.user,
                notes=serializer.validated_data.get("acknowledgement_notes", ""),
            )
            return Response(ShiftHandoverSerializer(updated, context={"request": request}).data)
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class ShiftHandoverSafetySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        org_id = request.query_params.get("organization")
        if not org_id or not org_id.isdigit():
            org_ids = list(accessible_organization_ids(user))
            if not org_ids:
                return Response({})
            org_id = org_ids[0]
        else:
            org_id = int(org_id)

        if not user.is_platform_admin and not is_active_member(user, org_id):
            raise PermissionDenied("عدم دسترسی به اطلاعات سازمان انتخاب‌شده.")

        workplace_id = request.query_params.get("workplace")
        wp_id = int(workplace_id) if workplace_id and workplace_id.isdigit() else None

        summary = get_outstanding_safety_summary(organization_id=org_id, workplace_id=wp_id)
        return Response(summary)
