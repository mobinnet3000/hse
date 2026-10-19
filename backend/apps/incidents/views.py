from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q, Sum
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.capa.models import CorrectiveAction
from apps.core.access import (
    accessible_organization_ids,
    can_manage_incidents,
    is_active_member,
)
from .models import Incident, IncidentAttachment
from .serializers import (
    IncidentAttachmentSerializer,
    IncidentCloseActionSerializer,
    IncidentCreateSerializer,
    IncidentDetailSerializer,
    IncidentInvestigationActionSerializer,
    IncidentLinkCapaActionSerializer,
    IncidentListSerializer,
    IncidentReopenActionSerializer,
    IncidentReviewActionSerializer,
)
from .services import (
    close_incident,
    link_corrective_action_to_incident,
    record_investigation,
    reopen_incident,
    report_incident,
    review_incident,
)


def get_accessible_incident_or_404(pk: int, user) -> Incident:
    try:
        incident = (
            Incident.objects.select_related("organization", "workplace", "reported_by", "assigned_investigator")
            .prefetch_related("related_corrective_actions", "attachments")
            .get(pk=pk)
        )
    except Incident.DoesNotExist:
        raise NotFound("حادثه مورد نظر یافت نشد.")

    if not user.is_platform_admin and not is_active_member(user, incident.organization_id):
        raise PermissionDenied("شما دسترسی به اطلاعات این حادثه را ندارید.")

    return incident


class IncidentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return IncidentCreateSerializer
        return IncidentListSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_platform_admin:
            qs = Incident.objects.all()
        else:
            org_ids = accessible_organization_ids(user)
            qs = Incident.objects.filter(organization_id__in=org_ids)

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

        severity = self.request.query_params.get("severity")
        if severity:
            qs = qs.filter(severity=severity)

        incident_type = self.request.query_params.get("incident_type")
        if incident_type:
            qs = qs.filter(incident_type=incident_type)

        search = self.request.query_params.get("search")
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(location_details__icontains=search)
                | Q(root_cause__icontains=search)
            )

        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(occurred_at__date__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(occurred_at__date__lte=date_to)

        return qs.select_related("organization", "workplace", "reported_by", "assigned_investigator").distinct()

    def perform_create(self, serializer):
        user = self.request.user
        data = serializer.validated_data
        org = data["organization"]

        try:
            instance = report_incident(
                organization=org,
                reported_by=user,
                data=data,
            )
            serializer.instance = instance
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class IncidentDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IncidentDetailSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_platform_admin:
            return Incident.objects.all()
        org_ids = accessible_organization_ids(user)
        return Incident.objects.filter(organization_id__in=org_ids)

    def perform_destroy(self, instance):
        user = self.request.user
        if not can_manage_incidents(user, instance.organization_id):
            raise PermissionDenied("تنها مدیران سازمان مجاز به حذف پرونده حادثه هستند.")
        instance.delete()


class IncidentReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        incident = get_accessible_incident_or_404(pk, user)

        serializer = IncidentReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        investigator = None
        investigator_id = serializer.validated_data.get("assigned_investigator_id")
        if investigator_id:
            try:
                investigator = User.objects.get(pk=investigator_id)
            except User.DoesNotExist:
                raise ValidationError({"assigned_investigator_id": "کاربر کارشناس بررسی‌کننده یافت نشد."})

        try:
            updated = review_incident(
                incident=incident,
                reviewer=user,
                review_notes=serializer.validated_data["review_notes"],
                assigned_investigator=investigator,
                next_status=serializer.validated_data.get("next_status"),
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)

        return Response(IncidentDetailSerializer(updated, context={"request": request}).data)


class IncidentInvestigateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        incident = get_accessible_incident_or_404(pk, user)

        serializer = IncidentInvestigationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = record_investigation(
                incident=incident,
                investigator=user,
                root_cause=serializer.validated_data["root_cause"],
                contributing_factors=serializer.validated_data.get("contributing_factors", ""),
                immediate_actions_taken=serializer.validated_data.get("immediate_actions_taken", ""),
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)

        return Response(IncidentDetailSerializer(updated, context={"request": request}).data)


class IncidentLinkCapaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        incident = get_accessible_incident_or_404(pk, user)

        serializer = IncidentLinkCapaActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        capa_id = serializer.validated_data["corrective_action_id"]
        try:
            capa = CorrectiveAction.objects.get(pk=capa_id, organization_id=incident.organization_id)
        except CorrectiveAction.DoesNotExist:
            raise ValidationError({"corrective_action_id": "اقدام اصلاحی در این سازمان یافت نشد."})

        try:
            updated = link_corrective_action_to_incident(
                incident=incident,
                actor=user,
                corrective_action=capa,
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)

        return Response(IncidentDetailSerializer(updated, context={"request": request}).data)


class IncidentCloseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        incident = get_accessible_incident_or_404(pk, user)

        serializer = IncidentCloseActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = close_incident(
                incident=incident,
                user=user,
                closure_notes=serializer.validated_data["closure_notes"],
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)

        return Response(IncidentDetailSerializer(updated, context={"request": request}).data)


class IncidentReopenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        incident = get_accessible_incident_or_404(pk, user)

        serializer = IncidentReopenActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = reopen_incident(
                incident=incident,
                user=user,
                reopen_reason=serializer.validated_data["reopen_reason"],
            )
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)

        return Response(IncidentDetailSerializer(updated, context={"request": request}).data)


class IncidentSummaryStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.is_platform_admin:
            qs = Incident.objects.all()
        else:
            org_ids = accessible_organization_ids(user)
            qs = Incident.objects.filter(organization_id__in=org_ids)

        org_id = request.query_params.get("organization")
        if org_id and org_id.isdigit():
            qs = qs.filter(organization_id=int(org_id))

        total = qs.count()
        incidents_count = qs.filter(incident_type=Incident.IncidentType.INCIDENT).count()
        near_misses_count = qs.filter(incident_type=Incident.IncidentType.NEAR_MISS).count()
        unsafe_acts_count = qs.filter(incident_type=Incident.IncidentType.UNSAFE_ACT).count()
        unsafe_conditions_count = qs.filter(incident_type=Incident.IncidentType.UNSAFE_CONDITION).count()

        open_investigations = qs.filter(
            status__in=[
                Incident.Status.REPORTED,
                Incident.Status.UNDER_REVIEW,
                Incident.Status.UNDER_INVESTIGATION,
                Incident.Status.ACTION_REQUIRED,
                Incident.Status.AWAITING_VERIFICATION,
                Incident.Status.REOPENED,
            ]
        ).count()
        closed_count = qs.filter(status=Incident.Status.CLOSED).count()

        agg = qs.aggregate(
            total_injuries=Sum("injury_count"),
            total_lost_days=Sum("lost_time_days"),
        )

        return Response({
            "total": total,
            "incidents": incidents_count,
            "near_misses": near_misses_count,
            "unsafe_acts": unsafe_acts_count,
            "unsafe_conditions": unsafe_conditions_count,
            "open_investigations": open_investigations,
            "closed": closed_count,
            "total_injuries": agg.get("total_injuries") or 0,
            "total_lost_days": agg.get("total_lost_days") or 0,
        })
