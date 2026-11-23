from rest_framework import serializers
from .models import HSEStrategicGoal, HSEBudgetProgram, HSEIndicatorConfig


class HSEStrategicGoalSerializer(serializers.ModelSerializer):
    pillar_display = serializers.CharField(source="get_pillar_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = HSEStrategicGoal
        fields = [
            "id",
            "organization",
            "fiscal_year",
            "title",
            "pillar",
            "pillar_display",
            "target_metric",
            "baseline_value",
            "target_value",
            "current_value",
            "unit",
            "deadline",
            "priority",
            "priority_display",
            "status",
            "status_display",
            "action_plan_summary",
            "traceability_chain_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "traceability_chain_id", "created_at", "updated_at"]


class HSEBudgetProgramSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    utilization_percentage = serializers.FloatField(read_only=True)

    class Meta:
        model = HSEBudgetProgram
        fields = [
            "id",
            "organization",
            "fiscal_year",
            "program_name",
            "category",
            "category_display",
            "allocated_amount",
            "spent_amount",
            "utilization_percentage",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "utilization_percentage", "created_at"]
