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
