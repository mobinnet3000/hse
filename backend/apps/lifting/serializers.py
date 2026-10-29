from rest_framework import serializers
from .models import CraneSpecification, LiftApprovalLog, LiftingPlan


class CraneSpecificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CraneSpecification
        fields = [
            "id",
            "organization",
            "model_name",
            "manufacturer",
            "max_capacity_tonnes",
            "boom_length_min_m",
            "boom_length_max_m",
            "equipment",
            "load_chart_data",
            "is_active",
            "is_synthetic",
            "created_at",
        ]
        read_only_fields = ["id", "organization", "created_at"]

    def validate_equipment(self, value):
        request = self.context.get("request")
        if request and hasattr(request, "user") and value:
            from apps.organizations.models import Membership
            user_org_ids = Membership.objects.filter(
                user=request.user, is_active=True
            ).values_list("organization_id", flat=True)
            if value.organization_id not in user_org_ids:
                raise serializers.ValidationError("تجهیز انتخاب‌شده متعلق به سازمان جاری نیست.")
        return value


class LiftApprovalLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)

    class Meta:
        model = LiftApprovalLog
        fields = ["id", "user", "user_name", "action", "notes", "created_at"]


class LiftingPlanSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.get_full_name", read_only=True)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    crane_model = serializers.CharField(source="crane.model_name", read_only=True)
    approval_logs = LiftApprovalLogSerializer(many=True, read_only=True)

    class Meta:
        model = LiftingPlan
        fields = [
            "id",
            "organization",
            "workplace",
            "workplace_name",
            "plan_number",
            "title",
            "description",
            "category",
            "planned_date",
            "lift_supervisor",
            "rigger_name",
            "operator_name",
            "crane",
            "crane_model",
            "boom_length_m",
            "lift_radius_m",
            "crane_capacity_at_radius_kg",
            "crane_utilization_pct",
            "load_description",
            "load_weight_kg",
            "rigging_hardware_weight_kg",
            "hook_block_weight_kg",
            "total_gross_weight_kg",
            "sling_type",
            "num_sling_legs",
            "sling_angle_to_horizontal_deg",
            "tension_per_leg_kg",
            "sling_rated_wll_kg",
            "shackle_rated_wll_kg",
            "outrigger_pad_area_sqm",
            "ground_bearing_pressure_kpa",
            "allowable_ground_pressure_kpa",
            "wind_speed_limit_mps",
            "exclusion_zone_radius_m",
            "permit",
            "status",
            "created_by",
            "created_by_name",
            "reviewed_by",
            "approved_by",
            "approved_by_name",
            "approval_notes",
            "rejection_reason",
            "pre_lift_checklist",
            "approval_logs",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "status",
            "created_by",
            "reviewed_by",
            "approved_by",
            "approval_notes",
            "rejection_reason",
            "total_gross_weight_kg",
            "tension_per_leg_kg",
            "crane_utilization_pct",
            "ground_bearing_pressure_kpa",
            "created_at",
            "updated_at",
        ]

    def _get_user_org_ids(self):
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            from apps.organizations.models import Membership
            return set(Membership.objects.filter(
                user=request.user, is_active=True
            ).values_list("organization_id", flat=True))
        return set()

    def validate_workplace(self, value):
        org_ids = self._get_user_org_ids()
        if org_ids and value and value.organization_id not in org_ids:
            raise serializers.ValidationError("کارگاه انتخاب‌شده متعلق به سازمان جاری نیست.")
        return value

    def validate_crane(self, value):
        org_ids = self._get_user_org_ids()
        if org_ids and value and value.organization_id not in org_ids:
            raise serializers.ValidationError("جرثقیل انتخاب‌شده متعلق به سازمان جاری نیست.")
        return value

    def validate_permit(self, value):
        org_ids = self._get_user_org_ids()
        if org_ids and value and value.organization_id not in org_ids:
            raise serializers.ValidationError("مجوز کار انتخاب‌شده متعلق به سازمان جاری نیست.")
        return value


class LiftingPlanActionSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    rejection_reason = serializers.CharField(required=False, allow_blank=True, default="")
