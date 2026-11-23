from rest_framework import serializers
from apps.moc.models import ChangeRequest


class ChangeRequestListSerializer(serializers.ModelSerializer):
    change_type_display = serializers.CharField(source="get_change_type_display", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    requested_by_name = serializers.CharField(source="requested_by.get_full_name", read_only=True)

    class Meta:
        model = ChangeRequest
        fields = [
            "id",
            "organization",
            "workplace",
            "moc_number",
            "title",
            "change_type",
            "change_type_display",
            "category",
            "category_display",
            "status",
            "status_display",
            "risk_assessment_required",
            "risk_assessed",
            "risk_approved",
            "requested_by",
            "requested_by_name",
            "created_at",
            "project_name",
            "site_location",
            "area",
            "traceability_chain_id",
        ]


class ChangeRequestDetailSerializer(serializers.ModelSerializer):
    change_type_display = serializers.CharField(source="get_change_type_display", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    requested_by_name = serializers.CharField(source="requested_by.get_full_name", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.get_full_name", read_only=True)
    risk_assessor_name = serializers.CharField(source="risk_assessor.get_full_name", read_only=True)
    related_equipment_name = serializers.CharField(source="related_equipment.name", read_only=True)
    related_risk_register_code = serializers.CharField(source="related_risk_register.register_code", read_only=True)

    class Meta:
        model = ChangeRequest
        fields = "__all__"


class ChangeRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChangeRequest
        fields = [
            "id",
            "organization",
            "workplace",
            "title",
            "change_type",
            "category",
            "reason_for_change",
            "description",
            "scope_of_work",
            "temporary_expiry_date",
            "related_equipment",
            "related_risk_register",
            "risk_assessment_required",
            "pre_implementation_checklist",
            "document_revision_required",
            "revised_documents_ref",
            "training_required",
            "training_details",
            "project_name",
            "site_location",
            "area",
            "contractor_name",
        ]


class MOCRiskAssessmentSerializer(serializers.Serializer):
    risk_notes = serializers.CharField(required=True)
    is_approved = serializers.BooleanField(default=True)
    risk_register_id = serializers.UUIDField(required=False, allow_null=True)


class MOCCloseSerializer(serializers.Serializer):
    closure_notes = serializers.CharField(required=False, allow_blank=True)
