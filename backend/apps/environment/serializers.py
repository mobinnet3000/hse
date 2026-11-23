from rest_framework import serializers

from .models import (
    EnvironmentalAspect,
    EnvironmentalThreshold,
    OccupationalHygieneRecord,
    WasteRecord,
    WastewaterEmissionRecord,
    ChemicalItem,
    EmergencyScenario,
    EmergencyDrill,
    EmergencyResource,
    ResourceConsumptionRecord,
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


class ChemicalItemSerializer(serializers.ModelSerializer):
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    hazard_classification_display = serializers.CharField(source="get_hazard_classification_display", read_only=True)

    class Meta:
        model = ChemicalItem
        fields = [
            "id",
            "organization",
            "workplace",
            "workplace_name",
            "name",
            "cas_number",
            "un_number",
            "hazard_classification",
            "hazard_classification_display",
            "ghs_symbols",
            "storage_location",
            "current_stock",
            "unit",
            "compatibility_group",
            "sds_document_url",
            "ppe_requirements",
            "exposure_limit_oel",
            "fire_extinguishing_method",
            "spill_response_procedure",
            "is_active",
            "traceability_chain_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "traceability_chain_id", "created_at", "updated_at"]


class EmergencyScenarioSerializer(serializers.ModelSerializer):
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    severity_tier_display = serializers.CharField(source="get_severity_tier_display", read_only=True)
    commander_name = serializers.CharField(source="emergency_commander.get_full_name", read_only=True)

    class Meta:
        model = EmergencyScenario
        fields = [
            "id",
            "organization",
            "workplace",
            "workplace_name",
            "title",
            "severity_tier",
            "severity_tier_display",
            "muster_point",
            "evacuation_route",
            "erp_summary",
            "emergency_commander",
            "commander_name",
            "is_active",
            "traceability_chain_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "traceability_chain_id", "created_at", "updated_at"]


class EmergencyDrillSerializer(serializers.ModelSerializer):
    scenario_title = serializers.CharField(source="scenario.title", read_only=True)
    success_rating_display = serializers.CharField(source="get_success_rating_display", read_only=True)

    class Meta:
        model = EmergencyDrill
        fields = [
            "id",
            "organization",
            "scenario",
            "scenario_title",
            "drill_date",
            "response_time_minutes",
            "target_response_time_minutes",
            "participants_count",
            "success_rating",
            "success_rating_display",
            "identified_gaps",
            "lessons_learned",
            "related_capa",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class EmergencyResourceSerializer(serializers.ModelSerializer):
    resource_type_display = serializers.CharField(source="get_resource_type_display", read_only=True)
    readiness_status_display = serializers.CharField(source="get_readiness_status_display", read_only=True)

    class Meta:
        model = EmergencyResource
        fields = [
            "id",
            "organization",
            "resource_type",
            "resource_type_display",
            "title",
            "quantity",
            "location",
            "readiness_status",
            "readiness_status_display",
            "notes",
        ]
        read_only_fields = ["id"]


class ResourceConsumptionSerializer(serializers.ModelSerializer):
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    resource_type_display = serializers.CharField(source="get_resource_type_display", read_only=True)

    class Meta:
        model = ResourceConsumptionRecord
        fields = [
            "id",
            "organization",
            "workplace",
            "workplace_name",
            "record_date",
            "resource_type",
            "resource_type_display",
            "quantity",
            "carbon_equivalent_kg",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
