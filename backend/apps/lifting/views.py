from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import TenantRequiredPermission
from apps.organizations.models import Membership
from .models import CraneSpecification, LiftingPlan
from .serializers import (
    CraneSpecificationSerializer,
    LiftingPlanActionSerializer,
    LiftingPlanSerializer,
)
from .services import (
    LiftingSafetyError,
    approve_lifting_plan,
    reject_lifting_plan,
    submit_lifting_plan,
    supersede_lifting_plan,
)


def _get_user_organization(user):
    membership = Membership.objects.filter(user=user, is_active=True).first()
    return membership.organization if membership else None


class CraneSpecificationViewSet(viewsets.ModelViewSet):
    serializer_class = CraneSpecificationSerializer
    permission_classes = [IsAuthenticated, TenantRequiredPermission]

    def get_queryset(self):
        user = self.request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        return CraneSpecification.objects.filter(organization_id__in=org_ids)

    def perform_create(self, serializer):
        org = _get_user_organization(self.request.user)
        serializer.save(organization=org)


class LiftingPlanViewSet(viewsets.ModelViewSet):
    serializer_class = LiftingPlanSerializer
    permission_classes = [IsAuthenticated, TenantRequiredPermission]

    def get_queryset(self):
        user = self.request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        queryset = LiftingPlan.objects.filter(organization_id__in=org_ids).select_related(
            "workplace", "crane", "created_by", "approved_by"
        )

        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        category_param = self.request.query_params.get("category")
        if category_param:
            queryset = queryset.filter(category=category_param)

        workplace_param = self.request.query_params.get("workplace")
        if workplace_param:
            queryset = queryset.filter(workplace_id=workplace_param)

        return queryset

    def perform_create(self, serializer):
        org = _get_user_organization(self.request.user)
        instance = serializer.save(organization=org, created_by=self.request.user)
        instance.recalculate_engineering_parameters()
        instance.save()

    def perform_update(self, serializer):
        instance = serializer.save()
        instance.recalculate_engineering_parameters()
        instance.save()

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        plan = self.get_object()
        try:
            updated = submit_lifting_plan(plan, request.user)
            return Response(LiftingPlanSerializer(updated).data)
        except LiftingSafetyError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        plan = self.get_object()
        action_serializer = LiftingPlanActionSerializer(data=request.data)
        action_serializer.is_valid(raise_exception=True)
        notes = action_serializer.validated_data.get("notes", "")
        try:
            updated = approve_lifting_plan(plan, request.user, notes)
            return Response(LiftingPlanSerializer(updated).data)
        except LiftingSafetyError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        plan = self.get_object()
        action_serializer = LiftingPlanActionSerializer(data=request.data)
        action_serializer.is_valid(raise_exception=True)
        reason = action_serializer.validated_data.get("rejection_reason", "")
        try:
            updated = reject_lifting_plan(plan, request.user, reason)
            return Response(LiftingPlanSerializer(updated).data)
        except LiftingSafetyError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def supersede(self, request, pk=None):
        plan = self.get_object()
        action_serializer = LiftingPlanActionSerializer(data=request.data)
        action_serializer.is_valid(raise_exception=True)
        reason = action_serializer.validated_data.get("notes", "")
        updated = supersede_lifting_plan(plan, request.user, reason)
        return Response(LiftingPlanSerializer(updated).data)

    @action(detail=True, methods=["get"])
    def simulation_data(self, request, pk=None):
        """Generates geometry coordinates for visual 2D simulation rendering in frontend."""
        plan = self.get_object()
        plan.recalculate_engineering_parameters()

        # Canvas model coordinates: Origin at crane center (0,0)
        radius = plan.lift_radius_m
        boom_len = plan.boom_length_m
        # Boom angle alpha = acos(radius / boom_length) if radius <= boom_length
        boom_angle_deg = 60.0
        if 0 < radius <= boom_len:
            import math
            boom_angle_deg = round(math.degrees(math.acos(radius / boom_len)), 1)

        sim = {
            "plan_number": plan.plan_number,
            "title": plan.title,
            "crane_model": plan.crane.model_name if plan.crane else "جرثقیل بوم‌تلسکوپی",
            "lift_radius_m": radius,
            "boom_length_m": boom_len,
            "boom_angle_deg": boom_angle_deg,
            "tip_height_m": round(boom_len * math.sin(math.radians(boom_angle_deg)), 1) if radius <= boom_len else boom_len,
            "gross_weight_tonnes": round(plan.total_gross_weight_kg / 1000.0, 2),
            "capacity_at_radius_tonnes": round(plan.crane_capacity_at_radius_kg / 1000.0, 2),
            "utilization_pct": plan.crane_utilization_pct,
            "is_critical": plan.category in [LiftingPlan.LiftCategory.CRITICAL, LiftingPlan.LiftCategory.TANDEM],
            "exclusion_zone_radius_m": plan.exclusion_zone_radius_m,
            "outrigger_span_m": 7.0,  # Standard outrigger width
            "ground_pressure_kpa": plan.ground_bearing_pressure_kpa,
            "allowable_ground_pressure_kpa": plan.allowable_ground_pressure_kpa,
        }
        return Response(sim)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.get_queryset()
        total = qs.count()
        approved = qs.filter(status=LiftingPlan.Status.APPROVED).count()
        under_review = qs.filter(status=LiftingPlan.Status.UNDER_REVIEW).count()
        critical = qs.filter(
            Q(category=LiftingPlan.LiftCategory.CRITICAL) | Q(category=LiftingPlan.LiftCategory.TANDEM)
        ).count()
        rejected = qs.filter(status=LiftingPlan.Status.REJECTED).count()

        return Response({
            "total_plans": total,
            "approved_plans": approved,
            "under_review_plans": under_review,
            "critical_plans": critical,
            "rejected_plans": rejected,
        })
