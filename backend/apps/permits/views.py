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
    is_active_member,
)
from .models import Permit, ShiftHandover, SIMOPSConflict
from .serializers import (
    PermitActivateActionSerializer,
    PermitCancelActionSerializer,
    PermitCloseActionSerializer,
    PermitCreateSerializer,
    PermitDetailSerializer,
    PermitListSerializer,
    PermitRejectActionSerializer,
    PermitResumeActionSerializer,
    PermitReviewActionSerializer,
    PermitSuspendActionSerializer,
    ShiftHandoverAcknowledgeActionSerializer,
    ShiftHandoverCreateSerializer,
    ShiftHandoverSerializer,
    SIMOPSConflictSerializer,
    SIMOPSOverrideActionSerializer,
)
from .services import (
    acknowledge_shift_handover,
    approve_permit,
    cancel_permit,
    check_permit_gatekeeper_prerequisites,
    close_permit,
    complete_work,
    create_shift_handover,
    get_outstanding_safety_summary,
    override_simops_conflict,
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
            .prefetch_related("related_hazards", "attachments", "assigned_employees")
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
            now = timezone.now()
            open_expirable_statuses = [
                Permit.Status.REQUESTED,
                Permit.Status.UNDER_REVIEW,
                Permit.Status.APPROVED,
                Permit.Status.ACTIVE,
                Permit.Status.SUSPENDED,
            ]
            if status_param == Permit.Status.ACTIVE:
                qs = qs.filter(status=Permit.Status.ACTIVE, valid_until__gt=now)
            elif status_param == Permit.Status.APPROVED:
                qs = qs.filter(status=Permit.Status.APPROVED, valid_until__gt=now)
            elif status_param == Permit.Status.SUSPENDED:
                qs = qs.filter(status=Permit.Status.SUSPENDED, valid_until__gt=now)
            elif status_param == Permit.Status.EXPIRED:
                qs = qs.filter(
                    Q(status=Permit.Status.EXPIRED)
                    | Q(
                        status__in=open_expirable_statuses,
                        valid_until__lte=now,
                    )
                )
            else:
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


class PermitDetailView(generics.RetrieveAPIView):
    """Read-only permit detail.

    All state changes must go through the explicit workflow action endpoints so
    that role checks, control verification, separation of duties and audit
    logging cannot be bypassed with a PATCH/PUT request.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = PermitDetailSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_platform_admin:
            return Permit.objects.all()
        org_ids = accessible_organization_ids(user)
        return Permit.objects.filter(organization_id__in=org_ids)


class PermitCompetencyStatusView(APIView):
    """Read-only competency breakdown used by the PTW detail UI."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        permit = get_accessible_permit_or_404(pk, request.user)
        from apps.workforce.services import validate_permit_competencies

        return Response(validate_permit_competencies(permit))


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
        serializer = PermitResumeActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resumption_notes = serializer.validated_data.get("resumption_notes", "")

        try:
            updated = resume_permit(permit=permit, user=request.user, resumption_notes=resumption_notes)
            return Response(PermDetailResponse(updated, request))
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class PermitGatekeeperCheckView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        permit = get_accessible_permit_or_404(pk, request.user)
        checks = check_permit_gatekeeper_prerequisites(permit)
        return Response(checks)


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
        active = qs.filter(status=Permit.Status.ACTIVE, valid_until__gt=now).count()
        suspended = qs.filter(status=Permit.Status.SUSPENDED, valid_until__gt=now).count()
        requested = qs.filter(status=Permit.Status.REQUESTED, valid_until__gt=now).count()
        approved = qs.filter(status=Permit.Status.APPROVED, valid_until__gt=now).count()
        closed = qs.filter(status=Permit.Status.CLOSED).count()
        expired = qs.filter(
            Q(status=Permit.Status.EXPIRED)
            | Q(
                status__in=[
                    Permit.Status.REQUESTED,
                    Permit.Status.UNDER_REVIEW,
                    Permit.Status.APPROVED,
                    Permit.Status.ACTIVE,
                    Permit.Status.SUSPENDED,
                ],
                valid_until__lte=now,
            )
        ).count()

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


class SIMOPSConflictListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SIMOPSConflictSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_platform_admin:
            qs = SIMOPSConflict.objects.all()
        else:
            org_ids = accessible_organization_ids(user)
            qs = SIMOPSConflict.objects.filter(organization_id__in=org_ids)

        workplace_id = self.request.query_params.get("workplace")
        if workplace_id and workplace_id.isdigit():
            qs = qs.filter(workplace_id=int(workplace_id))

        severity = self.request.query_params.get("severity")
        if severity:
            qs = qs.filter(severity=severity)

        return qs.select_related("permit_a", "permit_b", "workplace", "override_by")


class SIMOPSConflictOverrideView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            conflict = SIMOPSConflict.objects.select_related("organization", "permit_a", "permit_b").get(pk=pk)
        except SIMOPSConflict.DoesNotExist:
            raise NotFound("تعارض همزمانی مورد نظر یافت نشد.")

        if not request.user.is_platform_admin and not is_active_member(request.user, conflict.organization_id):
            raise PermissionDenied("دسترسی به این تعارض سازمانی ندارید.")

        serializer = SIMOPSOverrideActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = override_simops_conflict(
                conflict=conflict,
                user=request.user,
                reason=serializer.validated_data["reason"],
            )
            return Response(SIMOPSConflictSerializer(updated).data)
        except DjangoValidationError as exc:
            raise ValidationError(exc.message if hasattr(exc, "message") else exc.messages)


class SIMOPSRadarView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.is_platform_admin:
            permits_qs = Permit.objects.all()
            conflicts_qs = SIMOPSConflict.objects.all()
        else:
            org_ids = accessible_organization_ids(user)
            permits_qs = Permit.objects.filter(organization_id__in=org_ids)
            conflicts_qs = SIMOPSConflict.objects.filter(organization_id__in=org_ids)

        workplace_id = request.query_params.get("workplace")
        if workplace_id and workplace_id.isdigit():
            permits_qs = permits_qs.filter(workplace_id=int(workplace_id))
            conflicts_qs = conflicts_qs.filter(workplace_id=int(workplace_id))

        now = timezone.now()
        active_permits = permits_qs.filter(
            status__in=[Permit.Status.APPROVED, Permit.Status.ACTIVE, Permit.Status.SUSPENDED],
            valid_until__gt=now,
        ).select_related("workplace", "requester", "responsible_supervisor", "contractor")

        # Group by workplace
        radar_by_workplace = {}
        for p in active_permits:
            wp_key = p.workplace.name if p.workplace else "نامشخص"
            if wp_key not in radar_by_workplace:
                radar_by_workplace[wp_key] = {
                    "workplace_id": p.workplace_id,
                    "workplace_name": wp_key,
                    "permits_count": 0,
                    "permits": [],
                }
            radar_by_workplace[wp_key]["permits_count"] += 1
            radar_by_workplace[wp_key]["permits"].append({
                "id": p.id,
                "reference_code": p.reference_code,
                "title": p.title,
                "permit_type": p.permit_type,
                "permit_type_display": p.get_permit_type_display(),
                "status": p.effective_status,
                "status_display": p.get_status_display(),
                "work_area": p.work_area,
                "contractor_name": p.contractor.name if p.contractor else None,
                "valid_from": p.valid_from,
                "valid_until": p.valid_until,
                "simops_override_approved": p.simops_override_approved,
            })

        conflicts = conflicts_qs.filter(is_resolved=False).select_related(
            "permit_a", "permit_b", "workplace"
        )[:50]

        return Response({
            "generated_at": now,
            "total_active_planned_permits": active_permits.count(),
            "unresolved_conflicts_count": conflicts.count(),
            "workplaces": list(radar_by_workplace.values()),
            "active_conflicts": SIMOPSConflictSerializer(conflicts, many=True).data,
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
