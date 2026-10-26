from rest_framework import serializers

from .models import (
    EnvironmentalAspect,
    EnvironmentalThreshold,
    OccupationalHygieneRecord,
    WasteRecord,
    WastewaterEmissionRecord,
)


class EnvironmentalThresholdSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    limit_type_display = serializers.CharField(source="get_limit_type_display", read_only=True)

    class Meta:
        model = EnvironmentalThreshold
        fields = [
            "id",
            "name",
            "category",
            "category_display",
            "parameter",
            "limit_type",
            "limit_type_display",
            "limit_value",
            "min_value",
            "unit",
            "standard_reference",
            "is_active",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class EnvironmentalAspectSerializer(serializers.ModelSerializer):
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    condition_display = serializers.CharField(source="get_condition_display", read_only=True)

    class Meta:
        model = EnvironmentalAspect
        fields = [
            "id",
            "workplace",
            "workplace_name",
            "activity_or_process",
            "aspect",
            "impact",
            "condition",
            "condition_display",
            "severity_score",
            "probability_score",
            "significance_score",
            "is_significant",
            "control_measures",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "significance_score", "is_significant", "created_at", "updated_at"]


class WasteRecordSerializer(serializers.ModelSerializer):
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    contractor_name = serializers.CharField(source="contractor.name", read_only=True)
    waste_type_display = serializers.CharField(source="get_waste_type_display", read_only=True)
    unit_display = serializers.CharField(source="get_unit_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = WasteRecord
        fields = [
            "id",
            "workplace",
            "workplace_name",
            "waste_name",
            "waste_type",
            "waste_type_display",
            "quantity",
            "unit",
            "unit_display",
            "storage_location",
            "generation_date",
            "status",
            "status_display",
            "consignment_number",
            "contractor",
            "contractor_name",
            "disposal_facility",
            "disposal_method",
            "disposal_date",
            "notes",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class WastewaterEmissionRecordSerializer(serializers.ModelSerializer):
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    threshold_name = serializers.CharField(source="threshold.name", read_only=True)
    non_conformity_desc = serializers.CharField(source="non_conformity.description", read_only=True)

    class Meta:
        model = WastewaterEmissionRecord
        fields = [
            "id",
            "workplace",
            "workplace_name",
            "sampling_point",
            "category",
            "category_display",
            "sample_date",
            "parameter",
            "measured_value",
            "unit",
            "threshold",
            "threshold_name",
            "standard_limit",
            "is_exceedance",
            "laboratory_name",
            "test_report_number",
            "non_conformity",
            "non_conformity_desc",
            "notes",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "standard_limit", "is_exceedance", "non_conformity", "created_at", "updated_at"]


class OccupationalHygieneRecordSerializer(serializers.ModelSerializer):
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    threshold_name = serializers.CharField(source="threshold.name", read_only=True)
    assessment_result_display = serializers.CharField(source="get_assessment_result_display", read_only=True)
    non_conformity_desc = serializers.CharField(source="non_conformity.description", read_only=True)

    class Meta:
        model = OccupationalHygieneRecord
        fields = [
            "id",
            "workplace",
            "workplace_name",
            "category",
            "category_display",
            "location_details",
            "survey_date",
            "surveyor_name",
            "measured_value",
            "unit",
            "threshold",
            "threshold_name",
            "standard_limit",
            "is_exceedance",
            "assessment_result",
            "assessment_result_display",
            "control_recommendation",
            "non_conformity",
            "non_conformity_desc",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "standard_limit", "is_exceedance", "assessment_result", "non_conformity", "created_at", "updated_at"]
