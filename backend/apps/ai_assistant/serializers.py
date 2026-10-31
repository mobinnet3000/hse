from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from apps.checklists.models import Checklist
from apps.organizations.models import Organization
from apps.workplaces.models import Workplace
from .models import AIAssessment, AIGenerationLog


class AIGenerationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIGenerationLog
        fields = [
            "id",
            "provider",
            "model",
            "status_code",
            "duration_ms",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
            "request_id",
            "is_success",
            "error_message",
            "created_at",
        ]
        read_only_fields = fields


class AIAssessmentListSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    hazards_count = serializers.SerializerMethodField()
    checklist_items_count = serializers.SerializerMethodField()
    generated_checklist_id = serializers.IntegerField(source="generated_checklist.id", read_only=True)

    class Meta:
        model = AIAssessment
        fields = [
            "id",
            "organization",
            "organization_name",
            "workplace",
            "workplace_name",
            "created_by",
            "created_by_name",
            "title",
            "status",
            "status_display",
            "analysis_version",
            "ai_model",
            "hazards_count",
            "checklist_items_count",
            "generated_checklist_id",
            "approved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_hazards_count(self, obj: AIAssessment) -> int:
        if isinstance(obj.analysis_result, dict):
            return len(obj.analysis_result.get("hazards", []))
        return 0

    def get_checklist_items_count(self, obj: AIAssessment) -> int:
        if isinstance(obj.checklist_draft, dict):
            sections = obj.checklist_draft.get("sections", [])
            total = 0
            for sec in sections:
                total += len(sec.get("items", []))
            return total
        return 0


class AIAssessmentDetailSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.get_full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    generation_logs = AIGenerationLogSerializer(many=True, read_only=True)
    generated_checklist_title = serializers.CharField(source="generated_checklist.title", read_only=True)

    class Meta:
        model = AIAssessment
        fields = [
            "id",
            "organization",
            "organization_name",
            "workplace",
            "workplace_name",
            "created_by",
            "created_by_name",
            "title",
            "status",
            "status_display",
            "analysis_version",
            "input_data",
            "analysis_result",
            "checklist_draft",
            "ai_model",
            "provider_metadata",
            "error_message",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "approval_notes",
            "generated_checklist",
            "generated_checklist_title",
            "generation_logs",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization_name",
            "workplace_name",
            "created_by_name",
            "approved_by_name",
            "status_display",
            "generation_logs",
            "created_at",
            "updated_at",
        ]


class AIAssessmentCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAssessment
        fields = [
            "id",
            "organization",
            "workplace",
            "title",
            "input_data",
        ]

    def validate(self, attrs):
        org = attrs.get("organization") or getattr(self.instance, "organization", None)
        wp = attrs.get("workplace")
        if wp and org and wp.organization_id != org.id:
            raise serializers.ValidationError({"workplace": "محل کار انتخاب شده متعلق به این سازمان نیست."})
        return attrs


class AIAssessmentApprovalSerializer(serializers.Serializer):
    approval_notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    confirmed_reviewed = serializers.BooleanField(required=True)

    def validate_confirmed_reviewed(self, value):
        if not value:
            raise serializers.ValidationError("تأییدیه بررسی تخصصی و مسئولیت محتوای چک‌لیست الزامی است.")
        return value


class ChecklistDraftUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, max_length=250)
    description = serializers.CharField(required=False, allow_blank=True)
    sections = serializers.ListField(child=serializers.DictField(), required=True)
