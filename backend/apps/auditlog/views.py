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
