from rest_framework import serializers

from .models import NonConformity


class NonConformitySerializer(serializers.ModelSerializer):
    severity_display = serializers.CharField(source="get_severity_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)
    corrective_action_count = serializers.SerializerMethodField()

    class Meta:
        model = NonConformity
        fields = [
            "id",
            "organization",
            "workplace",
            "inspection",
            "inspection_response",
            "description",
            "severity",
            "severity_display",
            "source",
            "source_display",
            "responsible",
            "status",
            "status_display",
            "evidence_text",
            "corrective_action_count",
            "closed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "organization",
            "inspection_response",
            "source",
            "status",
            "closed_at",
            "created_at",
            "updated_at",
        ]

    def get_corrective_action_count(self, obj):
        return obj.corrective_actions.count()

