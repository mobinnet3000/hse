from rest_framework import serializers

from .models import Scaffold, ScaffoldInspection, ScaffoldTagLog


class ScaffoldTagLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source="changed_by.get_full_name", read_only=True)
    previous_tag_display = serializers.CharField(source="get_previous_tag_display", read_only=True)
    new_tag_display = serializers.CharField(source="get_new_tag_display", read_only=True)

    class Meta:
        model = ScaffoldTagLog
        fields = [
            "id",
            "scaffold",
            "previous_tag",
            "previous_tag_display",
            "new_tag",
            "new_tag_display",
            "changed_by",
            "changed_by_name",
            "reason",
            "valid_until",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ScaffoldInspectionSerializer(serializers.ModelSerializer):
    result_tag_display = serializers.CharField(source="get_result_tag_display", read_only=True)
    non_conformity_desc = serializers.CharField(source="non_conformity.description", read_only=True)

    class Meta:
        model = ScaffoldInspection
        fields = [
            "id",
            "scaffold",
            "inspection_date",
            "inspector",
            "inspector_name",
            "result_tag",
            "result_tag_display",
            "validity_days",
            "base_plates_ok",
            "bracing_ok",
            "guardrails_ok",
            "toeboards_ok",
            "planks_decking_ok",
            "ties_anchors_ok",
            "ladder_access_ok",
            "findings",
            "restrictions_notes",
            "non_conformity",
            "non_conformity_desc",
            "is_synthetic",
            "created_at",
        ]
        read_only_fields = ["id", "non_conformity", "created_at"]


class ScaffoldSerializer(serializers.ModelSerializer):
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    contractor_name = serializers.CharField(source="contractor.name", read_only=True)
    scaffold_type_display = serializers.CharField(source="get_scaffold_type_display", read_only=True)
    load_duty_display = serializers.CharField(source="get_load_duty_display", read_only=True)
    tag_status_display = serializers.CharField(source="get_tag_status_display", read_only=True)
    is_inspection_overdue = serializers.BooleanField(read_only=True)
    is_usable_for_work = serializers.BooleanField(read_only=True)
    recent_inspections = ScaffoldInspectionSerializer(source="inspections", many=True, read_only=True)

    class Meta:
        model = Scaffold
        fields = [
            "id",
            "workplace",
            "workplace_name",
            "tag_number",
            "scaffold_type",
            "scaffold_type_display",
            "load_duty",
            "load_duty_display",
            "location_details",
            "height_meters",
            "length_meters",
            "width_meters",
            "contractor",
            "contractor_name",
            "erected_by",
            "erection_date",
            "intended_use",
            "tag_status",
            "tag_status_display",
            "current_tag_valid_until",
            "yellow_restrictions",
            "inspection_interval_days",
            "last_inspection_date",
            "next_inspection_due",
            "is_inspection_overdue",
            "is_usable_for_work",
            "recent_inspections",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "is_inspection_overdue",
            "is_usable_for_work",
            "last_inspection_date",
            "next_inspection_due",
            "current_tag_valid_until",
            "created_at",
            "updated_at",
        ]
