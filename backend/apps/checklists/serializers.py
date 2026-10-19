from rest_framework import serializers

from .models import Checklist, ChecklistItem


class ChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItem
        fields = ["id", "checklist", "order", "text", "is_required"]
        read_only_fields = ["checklist"]


class ChecklistSerializer(serializers.ModelSerializer):
    items = ChecklistItemSerializer(many=True, read_only=True)

    class Meta:
        model = Checklist
        fields = [
            "id",
            "organization",
            "title",
            "description",
            "is_active",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["organization", "created_at", "updated_at"]
