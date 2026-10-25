from rest_framework import serializers

from apps.accounts.models import User
from apps.capa.models import CorrectiveAction
from apps.capa.serializers import CorrectiveActionSerializer
from apps.core.access import can_investigate_incident, can_manage_incidents, is_active_member
from apps.organizations.models import Organization
from apps.risks.models import Hazard
from apps.workplaces.models import Workplace
from .models import Incident, IncidentAttachment


class IncidentAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = IncidentAttachment
        fields = [
            "id",
            "incident",
            "title",
            "attachment_type",
            "file_url",
            "description",
            "uploaded_by",
            "uploaded_by_name",
            "uploaded_at",
        ]
        read_only_fields = ["uploaded_by", "uploaded_at"]

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by:
            return None
        return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.username


class IncidentListSerializer(serializers.ModelSerializer):
    incident_type_display = serializers.CharField(source="get_incident_type_display", read_only=True)
    severity_display = serializers.CharField(source="get_severity_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True, default=None)
    equipment_name = serializers.CharField(source="equipment.name", read_only=True, default=None)
    reported_by_name = serializers.SerializerMethodField()
    assigned_investigator_name = serializers.SerializerMethodField()
    capa_count = serializers.IntegerField(source="related_corrective_actions.count", read_only=True)

    class Meta:
        model = Incident
        fields = [
            "id",
            "organization",
            "organization_name",
            "workplace",
            "workplace_name",
            "equipment",
            "equipment_name",
            "title",
            "incident_type",
            "incident_type_display",
            "severity",
            "severity_display",
            "status",
            "status_display",
            "occurred_at",
            "reported_by",
            "reported_by_name",
            "assigned_investigator",
            "assigned_investigator_name",
            "injury_count",
            "lost_time_days",
            "property_damage_cost",
            "capa_count",
            "is_synthetic",
            "created_at",
        ]

    def get_reported_by_name(self, obj):
        if not obj.reported_by:
            return None
        return f"{obj.reported_by.first_name} {obj.reported_by.last_name}".strip() or obj.reported_by.username

    def get_assigned_investigator_name(self, obj):
        if not obj.assigned_investigator:
            return None
        return f"{obj.assigned_investigator.first_name} {obj.assigned_investigator.last_name}".strip() or obj.assigned_investigator.username


class IncidentDetailSerializer(serializers.ModelSerializer):
    incident_type_display = serializers.CharField(source="get_incident_type_display", read_only=True)
    severity_display = serializers.CharField(source="get_severity_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True, default=None)
    equipment_name = serializers.CharField(source="equipment.name", read_only=True, default=None)
    reported_by_name = serializers.SerializerMethodField()
    assigned_investigator_name = serializers.SerializerMethodField()
    related_hazard_title = serializers.CharField(source="related_hazard.title", read_only=True, default=None)
    related_corrective_actions = CorrectiveActionSerializer(many=True, read_only=True)
    attachments = IncidentAttachmentSerializer(many=True, read_only=True)

    can_review = serializers.SerializerMethodField()
    can_investigate = serializers.SerializerMethodField()
    can_close = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = [
            "id",
            "organization",
            "organization_name",
            "workplace",
            "workplace_name",
            "equipment",
            "equipment_name",
            "title",
            "incident_type",
            "incident_type_display",
            "severity",
            "severity_display",
            "status",
            "status_display",
            "occurred_at",
            "reported_at",
            "reported_by",
            "reported_by_name",
            "assigned_investigator",
            "assigned_investigator_name",
            "location_details",
            "description",
            "immediate_actions_taken",
            "injury_count",
            "lost_time_days",
            "environmental_impact",
            "property_damage_cost",
            "root_cause",
            "contributing_factors",
            "investigation_completed_at",
            "review_notes",
            "closure_notes",
            "reopen_reason",
            "related_hazard",
            "related_hazard_title",
            "related_corrective_actions",
            "attachments",
            "is_synthetic",
            "can_review",
            "can_investigate",
            "can_close",
            "created_at",
            "updated_at",
            "closed_at",
        ]

    def get_reported_by_name(self, obj):
        if not obj.reported_by:
            return None
        return f"{obj.reported_by.first_name} {obj.reported_by.last_name}".strip() or obj.reported_by.username

    def get_assigned_investigator_name(self, obj):
        if not obj.assigned_investigator:
            return None
        return f"{obj.assigned_investigator.first_name} {obj.assigned_investigator.last_name}".strip() or obj.assigned_investigator.username

    def get_can_review(self, obj):
        user = self.context.get("request", None) and self.context["request"].user
        return bool(user and can_manage_incidents(user, obj.organization_id))

    def get_can_investigate(self, obj):
        user = self.context.get("request", None) and self.context["request"].user
        return bool(user and can_investigate_incident(user, obj))

    def get_can_close(self, obj):
        user = self.context.get("request", None) and self.context["request"].user
        return bool(user and can_manage_incidents(user, obj.organization_id))


class IncidentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = [
            "id",
            "organization",
            "workplace",
            "equipment",
            "title",
            "incident_type",
            "severity",
            "status",
            "occurred_at",
            "location_details",
            "description",
            "immediate_actions_taken",
            "injury_count",
            "lost_time_days",
            "environmental_impact",
            "property_damage_cost",
            "related_hazard",
            "is_synthetic",
        ]
        read_only_fields = ["id", "status"]

    def validate(self, attrs):
        org = attrs.get("organization")
        request = self.context.get("request")
        user = request.user if request else None

        if not org or not org.is_active:
            raise serializers.ValidationError({"organization": "سازمان معتبر انتخاب نشده است."})

        if user and not user.is_platform_admin and not is_active_member(user, org.id):
            raise serializers.ValidationError({"organization": "شما عضو فعال این سازمان نیستید."})

        workplace = attrs.get("workplace")
        if workplace and workplace.organization_id != org.id:
            raise serializers.ValidationError({"workplace": "محل کار باید متعلق به همان سازمان باشد."})

        hazard = attrs.get("related_hazard")
        if hazard and hazard.organization_id != org.id:
            raise serializers.ValidationError({"related_hazard": "مخاطره انتخاب‌شده متعلق به این سازمان نیست."})

        equipment = attrs.get("equipment")
        if equipment and equipment.organization_id != org.id:
            raise serializers.ValidationError({"equipment": "تجهیز انتخاب‌شده متعلق به این سازمان نیست."})
        if equipment and workplace and equipment.workplace_id and equipment.workplace_id != workplace.id:
            raise serializers.ValidationError({"equipment": "تجهیز انتخاب‌شده در این محل استقرار ندارد."})

        title = attrs.get("title", "").strip()
        if not title:
            raise serializers.ValidationError({"title": "عنوان حادثه الزامی است."})

        description = attrs.get("description", "").strip()
        if not description:
            raise serializers.ValidationError({"description": "شرح حادثه الزامی است."})

        return attrs


class IncidentReviewActionSerializer(serializers.Serializer):
    review_notes = serializers.CharField(required=True, allow_blank=False)
    assigned_investigator_id = serializers.IntegerField(required=False, allow_null=True)
    next_status = serializers.ChoiceField(
        choices=[
            Incident.Status.UNDER_REVIEW,
            Incident.Status.UNDER_INVESTIGATION,
            Incident.Status.ACTION_REQUIRED,
            Incident.Status.CLOSED,
        ],
        required=False,
    )


class IncidentInvestigationActionSerializer(serializers.Serializer):
    root_cause = serializers.CharField(required=True, allow_blank=False)
    contributing_factors = serializers.CharField(required=False, allow_blank=True, default="")
    immediate_actions_taken = serializers.CharField(required=False, allow_blank=True, default="")


class IncidentLinkCapaActionSerializer(serializers.Serializer):
    corrective_action_id = serializers.IntegerField(required=True)


class IncidentCloseActionSerializer(serializers.Serializer):
    closure_notes = serializers.CharField(required=True, allow_blank=False)


class IncidentReopenActionSerializer(serializers.Serializer):
    reopen_reason = serializers.CharField(required=True, allow_blank=False)
