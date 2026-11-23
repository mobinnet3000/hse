from rest_framework import serializers
from .models import AuditEvent
from .services import sanitize_details


class AuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "organization",
            "organization_name",
            "actor",
            "actor_username",
            "action",
            "entity_type",
            "entity_id",
            "details",
            "created_at",
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if "details" in data:
            data["details"] = sanitize_details(data["details"])
        return data

from .models import AuditPlan, AuditFinding


class AuditFindingSerializer(serializers.ModelSerializer):
    finding_type_display = serializers.CharField(source="get_finding_type_display", read_only=True)
    audit_code = serializers.CharField(source="audit_plan.audit_code", read_only=True)

    class Meta:
        model = AuditFinding
        fields = [
            "id",
            "audit_plan",
            "audit_code",
            "finding_type",
            "finding_type_display",
            "standard_clause",
            "description",
            "evidence",
            "related_capa",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class AuditPlanSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    lead_auditor_name = serializers.CharField(source="lead_auditor.get_full_name", read_only=True)
    findings_count = serializers.IntegerField(source="findings.count", read_only=True)

    class Meta:
        model = AuditPlan
        fields = [
            "id",
            "organization",
            "audit_code",
            "title",
            "audit_standard",
            "planned_date",
            "lead_auditor",
            "lead_auditor_name",
            "status",
            "status_display",
            "scope_summary",
            "executive_summary",
            "findings_count",
            "traceability_chain_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "audit_code", "traceability_chain_id", "created_at", "updated_at"]
