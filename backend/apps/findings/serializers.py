from rest_framework import serializers
from .models import AnomalyEvidence, NonConformity


class AnomalyEvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnomalyEvidence
        fields = ["id", "file", "caption", "uploaded_at"]


class NonConformitySerializer(serializers.ModelSerializer):
    severity_display = serializers.CharField(source="get_severity_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)
    anomaly_type_display = serializers.CharField(source="get_anomaly_type_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    equipment_name = serializers.CharField(source="equipment.name", read_only=True, default=None)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True, default=None)
    responsible_name = serializers.CharField(source="responsible.get_full_name", read_only=True, default=None)
    corrective_action_count = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    evidences = AnomalyEvidenceSerializer(many=True, read_only=True)

    class Meta:
        model = NonConformity
        fields = [
            "id",
            "organization",
            "workplace",
            "workplace_name",
            "equipment",
            "equipment_name",
            "inspection",
            "inspection_response",
            "reference_number",
            "description",
            "anomaly_type",
            "anomaly_type_display",
            "severity",
            "severity_display",
            "priority",
            "priority_display",
            "source",
            "source_display",
            "reporter_name",
            "location_details",
            "department",
            "risk_score",
            "immediate_containment",
            "target_deadline",
            "is_overdue",
            "responsible",
            "responsible_name",
            "status",
            "status_display",
            "evidence_text",
            "evidences",
            "corrective_action_count",
            "reopened_count",
            "reopened_reason",
            "is_synthetic",
            "closed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "organization",
            "inspection_response",
            "reference_number",
            "is_overdue",
            "source",
            "status",
            "closed_at",
            "created_at",
            "updated_at",
        ]

    def get_corrective_action_count(self, obj):
        return obj.corrective_actions.count()
