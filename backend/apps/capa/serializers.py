from rest_framework import serializers

from .models import CorrectiveAction


class CorrectiveActionSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CorrectiveAction
        fields = [
            "id",
            "organization",
            "non_conformity",
            "description",
            "responsible",
            "due_date",
            "status",
            "status_display",
            "result_text",
            "effectiveness_verified",
            "verified_by",
            "verified_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "organization",
            "status",
            "effectiveness_verified",
            "verified_by",
            "verified_at",
            "created_at",
            "updated_at",
        ]
