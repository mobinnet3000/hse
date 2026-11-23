from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.core.access import accessible_organization_ids, membership_role
from apps.organizations.models import Membership
from .models import AuditEvent
from .serializers import AuditEventSerializer

AUDIT_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
    Membership.Roles.READ_ONLY_AUDITOR,
}


class AuditEventListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.is_platform_admin:
            org_ids = None
        else:
            org_ids = [
                org_id for org_id in accessible_organization_ids(request.user)
                if membership_role(request.user, org_id) in AUDIT_ROLES
            ]
            if not org_ids:
                return Response([], status=status.HTTP_200_OK)

        queryset = AuditEvent.objects.select_related("organization", "actor").all()
        if org_ids is not None:
            queryset = queryset.filter(organization_id__in=org_ids)

        organization_id = request.query_params.get("organization")
        if organization_id:
            try:
                organization_id = int(organization_id)
                if org_ids is not None and organization_id not in org_ids:
                    return Response({"error": {"code": "not_found", "message": "موردی یافت نشد."}}, status=404)
                queryset = queryset.filter(organization_id=organization_id)
            except ValueError:
                return Response({"error": {"code": "invalid_parameter", "message": "شناسه سازمان نامعتبر است."}}, status=400)

        action = request.query_params.get("action")
        if action:
            queryset = queryset.filter(action=action)

        entity_type = request.query_params.get("entity_type")
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)

        date_from = request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        # Pagination support if page param is requested
        if request.query_params.get("page"):
            paginator = PageNumberPagination()
            page = paginator.paginate_queryset(queryset, request)
            if page is not None:
                serializer = AuditEventSerializer(page, many=True)
                return paginator.get_paginated_response(serializer.data)

        return Response(AuditEventSerializer(queryset[:100], many=True).data)

from .models import AuditPlan, AuditFinding
from .serializers import AuditPlanSerializer, AuditFindingSerializer
from apps.core.events import EventBus, Events
from django.shortcuts import get_object_or_404


class AuditPlanListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_ids = accessible_organization_ids(request.user)
        queryset = AuditPlan.objects.filter(organization_id__in=org_ids)
        org_param = request.query_params.get("organization")
        if org_param and org_param.isdigit():
            queryset = queryset.filter(organization_id=int(org_param))
        serializer = AuditPlanSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        org_ids = accessible_organization_ids(request.user)
        org_id = request.data.get("organization")
        if not org_id or int(org_id) not in org_ids:
            if len(org_ids) == 1:
                org_id = list(org_ids)[0]
            else:
                return Response({"error": "شناسه سازمان معتبر نیست."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = AuditPlanSerializer(data=request.data)
        if serializer.is_valid():
            instance = serializer.save(organization_id=org_id)
            if instance.status == AuditPlan.Status.COMPLETED:
                EventBus.publish(Events.AUDIT_COMPLETED, {
                    "audit_code": instance.audit_code,
                    "title": instance.title,
                    "standard": instance.audit_standard,
                }, user_id=request.user.id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AuditPlanDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        org_ids = accessible_organization_ids(request.user)
        plan = get_object_or_404(AuditPlan, pk=pk, organization_id__in=org_ids)
        return Response(AuditPlanSerializer(plan).data)

    def patch(self, request, pk):
        org_ids = accessible_organization_ids(request.user)
        plan = get_object_or_404(AuditPlan, pk=pk, organization_id__in=org_ids)
        old_status = plan.status
        serializer = AuditPlanSerializer(plan, data=request.data, partial=True)
        if serializer.is_valid():
            instance = serializer.save()
            if old_status != AuditPlan.Status.COMPLETED and instance.status == AuditPlan.Status.COMPLETED:
                EventBus.publish(Events.AUDIT_COMPLETED, {
                    "audit_code": instance.audit_code,
                    "title": instance.title,
                    "standard": instance.audit_standard,
                }, user_id=request.user.id)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AuditFindingListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_ids = accessible_organization_ids(request.user)
        queryset = AuditFinding.objects.filter(audit_plan__organization_id__in=org_ids)
        plan_id = request.query_params.get("audit_plan")
        if plan_id and plan_id.isdigit():
            queryset = queryset.filter(audit_plan_id=int(plan_id))
        serializer = AuditFindingSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        org_ids = accessible_organization_ids(request.user)
        plan_id = request.data.get("audit_plan")
        plan = get_object_or_404(AuditPlan, pk=plan_id, organization_id__in=org_ids)
        serializer = AuditFindingSerializer(data=request.data)
        if serializer.is_valid():
            finding = serializer.save()
            if finding.finding_type in [AuditFinding.FindingType.MAJOR_NC, AuditFinding.FindingType.MINOR_NC]:
                EventBus.publish(Events.AUDIT_NONCONFORMITY_FOUND, {
                    "audit_code": plan.audit_code,
                    "finding_type": finding.finding_type,
                    "clause": finding.standard_clause,
                    "description": finding.description[:100],
                }, user_id=request.user.id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
