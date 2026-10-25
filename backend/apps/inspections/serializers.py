from rest_framework import serializers

from .models import Inspection, InspectionResponse


class InspectionResponseSerializer(serializers.ModelSerializer):
    result_display = serializers.CharField(source="get_result_display", read_only=True)

    class Meta:
        model = InspectionResponse
        fields = [
            "id",
            "inspection",
            "item",
            "item_text",
            "is_required",
            "order",
            "result",
            "result_display",
            "notes",
        ]
        read_only_fields = ["inspection", "item", "item_text", "is_required", "order"]


class InspectionSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    checklist_title = serializers.CharField(source="checklist.title", read_only=True)
    equipment_name = serializers.CharField(source="equipment.name", read_only=True, default=None)
    total_responses = serializers.SerializerMethodField()
    answered_responses = serializers.SerializerMethodField()

    class Meta:
        model = Inspection
        fields = [
            "id",
            "organization",
            "workplace",
            "equipment",
            "equipment_name",
            "checklist",
            "checklist_title",
            "title",
            "inspector",
            "scheduled_at",
            "performed_at",
            "completed_at",
            "status",
            "status_display",
            "notes",
            "total_responses",
            "answered_responses",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "organization",
            "status",
            "performed_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]

    def get_total_responses(self, obj):
        return obj.responses.count()

    def get_answered_responses(self, obj):
        return obj.responses.exclude(result="").count()


class InspectionDetailSerializer(InspectionSerializer):
    responses = InspectionResponseSerializer(many=True, read_only=True)

    class Meta(InspectionSerializer.Meta):
        fields = InspectionSerializer.Meta.fields + ["responses"]


