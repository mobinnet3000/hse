from rest_framework import serializers

from apps.accounts.models import User
from apps.core.access import (
    can_approve_permits,
    can_conduct_shift_handover,
    can_control_permits,
    is_active_member,
)
from apps.organizations.models import Organization
from apps.risks.models import Hazard
from apps.risks.serializers import HazardSerializer
from apps.workplaces.models import Workplace
from .models import Permit, PermitAttachment, ShiftHandover


class PermitAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PermitAttachment
        fields = [
            "id",
            "permit",
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


class PermitListSerializer(serializers.ModelSerializer):
    permit_type_display = serializers.CharField(source="get_permit_type_display", read_only=True)
    status = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True, default=None)
    requester_name = serializers.SerializerMethodField()
    approver_name = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = Permit
        fields = [
            "id",
            "organization",
            "organization_name",
            "workplace",
            "workplace_name",
            "reference_code",
            "permit_type",
            "permit_type_display",
            "title",
            "status",
            "status_display",
            "valid_from",
            "valid_until",
            "actual_start",
            "actual_completion",
            "requester",
            "requester_name",
            "approver",
            "approver_name",
            "controls_verified",
            "gas_testing_required",
            "isolation_loto_required",
            "is_expired",
            "is_synthetic",
            "created_at",
        ]

    def get_requester_name(self, obj):
        if not obj.requester:
            return None
        return f"{obj.requester.first_name} {obj.requester.last_name}".strip() or obj.requester.username

    def get_approver_name(self, obj):
        if not obj.approver:
            return None
        return f"{obj.approver.first_name} {obj.approver.last_name}".strip() or obj.approver.username

    def get_status(self, obj):
        return obj.effective_status

    def get_status_display(self, obj):
        return Permit.Status(obj.effective_status).label

    def get_is_expired(self, obj):
        return obj.is_expired


class PermitDetailSerializer(PermitListSerializer):
    related_hazards = HazardSerializer(many=True, read_only=True)
    attachments = PermitAttachmentSerializer(many=True, read_only=True)
    responsible_supervisor_name = serializers.SerializerMethodField()
    controls_verified_by_name = serializers.SerializerMethodField()
    closed_by_name = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()
    can_control = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()

    class Meta(PermitListSerializer.Meta):
        fields = PermitListSerializer.Meta.fields + [
            "description",
            "work_area",
            "equipment_involved",
            "assigned_workers",
            "responsible_supervisor",
            "responsible_supervisor_name",
            "precautions_taken",
            "required_ppe",
            "gas_testing_results",
            "isolation_loto_details",
            "controls_verified_by",
            "controls_verified_by_name",
            "controls_verified_at",
            "review_notes",
            "rejection_reason",
            "suspension_reason",
            "closure_summary",
            "closed_by",
            "closed_by_name",
            "closed_at",
            "related_hazards",
            "attachments",
            "can_approve",
            "can_control",
            "can_cancel",
            "updated_at",
        ]

    def get_responsible_supervisor_name(self, obj):
        if not obj.responsible_supervisor:
            return None
        return f"{obj.responsible_supervisor.first_name} {obj.responsible_supervisor.last_name}".strip() or obj.responsible_supervisor.username

    def get_controls_verified_by_name(self, obj):
        if not obj.controls_verified_by:
            return None
        return f"{obj.controls_verified_by.first_name} {obj.controls_verified_by.last_name}".strip() or obj.controls_verified_by.username

    def get_closed_by_name(self, obj):
        if not obj.closed_by:
            return None
        return f"{obj.closed_by.first_name} {obj.closed_by.last_name}".strip() or obj.closed_by.username

    def get_can_approve(self, obj):
        user = self.context.get("request", None) and self.context["request"].user
        if not user or not user.is_authenticated:
            return False
        if obj.requester_id == user.id or obj.is_expired:
            return False
        if obj.status not in {Permit.Status.REQUESTED, Permit.Status.UNDER_REVIEW}:
            return False
        return bool(can_approve_permits(user, obj.organization_id))

    def get_can_control(self, obj):
        user = self.context.get("request", None) and self.context["request"].user
        return bool(user and can_control_permits(user, obj.organization_id))

    def get_can_cancel(self, obj):
        user = self.context.get("request", None) and self.context["request"].user
        if not user or not user.is_authenticated:
            return False
        if obj.status in {
            Permit.Status.COMPLETED,
            Permit.Status.REJECTED,
            Permit.Status.CLOSED,
            Permit.Status.CANCELLED,
        }:
            return False
        if can_control_permits(user, obj.organization_id):
            return True
        if obj.requester_id == user.id:
            return obj.status in {
                Permit.Status.REQUESTED,
                Permit.Status.UNDER_REVIEW,
                Permit.Status.APPROVED,
            }
        return False


class PermitCreateSerializer(serializers.ModelSerializer):
    related_hazard_ids = serializers.PrimaryKeyRelatedField(
        queryset=Hazard.objects.all(),
        many=True,
        required=False,
        write_only=True,
    )

    reference_code = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)

    class Meta:
        model = Permit
        fields = [
            "id",
            "reference_code",
            "status",
            "organization",
            "workplace",
            "permit_type",
            "title",
            "description",
            "work_area",
            "equipment_involved",
            "valid_from",
            "valid_until",
            "responsible_supervisor",
            "assigned_workers",
            "precautions_taken",
            "required_ppe",
            "gas_testing_required",
            "gas_testing_results",
            "isolation_loto_required",
            "isolation_loto_details",
            "related_hazard_ids",
            "is_synthetic",
        ]
        read_only_fields = ["id", "reference_code", "status"]

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

        valid_from = attrs.get("valid_from")
        valid_until = attrs.get("valid_until")
        if valid_from and valid_until and valid_until <= valid_from:
            raise serializers.ValidationError({"valid_until": "زمان پایان اعتبار باید بعد از زمان شروع باشد."})

        return attrs


class PermitReviewActionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["under_review", "approved", "rejected"])
    review_notes = serializers.CharField(required=False, allow_blank=True)


class PermitActivateActionSerializer(serializers.Serializer):
    gas_testing_results = serializers.CharField(required=False, allow_blank=True)
    isolation_loto_details = serializers.CharField(required=False, allow_blank=True)


class PermitSuspendActionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True, min_length=3)


class PermitCloseActionSerializer(serializers.Serializer):
    closure_summary = serializers.CharField(required=True, min_length=3)


class PermitRejectActionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True, min_length=3)


class PermitCancelActionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


# =========================================================
# Shift Handover Serializers
# =========================================================

class ShiftHandoverSerializer(serializers.ModelSerializer):
    shift_type_display = serializers.CharField(source="get_shift_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    outgoing_supervisor_name = serializers.SerializerMethodField()
    incoming_supervisor_name = serializers.SerializerMethodField()
    acknowledged_by_name = serializers.SerializerMethodField()
    active_permits = PermitListSerializer(many=True, read_only=True)
    can_acknowledge = serializers.SerializerMethodField()

    class Meta:
        model = ShiftHandover
        fields = [
            "id",
            "organization",
            "organization_name",
            "workplace",
            "workplace_name",
            "shift_type",
            "shift_type_display",
            "shift_date",
            "status",
            "status_display",
            "outgoing_supervisor",
            "outgoing_supervisor_name",
            "incoming_supervisor",
            "incoming_supervisor_name",
            "handover_notes",
            "safety_concerns",
            "equipment_status",
            "active_permits",
            "outstanding_actions_summary",
            "unresolved_hazards_summary",
            "acknowledged_by",
            "acknowledged_by_name",
            "acknowledged_at",
            "acknowledgement_notes",
            "can_acknowledge",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]

    def get_outgoing_supervisor_name(self, obj):
        if not obj.outgoing_supervisor:
            return None
        return f"{obj.outgoing_supervisor.first_name} {obj.outgoing_supervisor.last_name}".strip() or obj.outgoing_supervisor.username

    def get_incoming_supervisor_name(self, obj):
        if not obj.incoming_supervisor:
            return None
        return f"{obj.incoming_supervisor.first_name} {obj.incoming_supervisor.last_name}".strip() or obj.incoming_supervisor.username

    def get_acknowledged_by_name(self, obj):
        if not obj.acknowledged_by:
            return None
        return f"{obj.acknowledged_by.first_name} {obj.acknowledged_by.last_name}".strip() or obj.acknowledged_by.username

    def get_can_acknowledge(self, obj):
        user = self.context.get("request", None) and self.context["request"].user
        if not user or not user.is_authenticated:
            return False
        if obj.status == ShiftHandover.Status.ACKNOWLEDGED:
            return False
        if obj.outgoing_supervisor_id == user.id:
            return False
        if not can_conduct_shift_handover(user, obj.organization_id):
            return False
        if obj.incoming_supervisor_id:
            return obj.incoming_supervisor_id == user.id
        return True


class ShiftHandoverCreateSerializer(serializers.ModelSerializer):
    active_permit_ids = serializers.PrimaryKeyRelatedField(
        queryset=Permit.objects.all(),
        many=True,
        required=False,
        write_only=True,
    )

    status = serializers.CharField(read_only=True)

    class Meta:
        model = ShiftHandover
        fields = [
            "id",
            "status",
            "organization",
            "workplace",
            "shift_type",
            "shift_date",
            "incoming_supervisor",
            "handover_notes",
            "safety_concerns",
            "equipment_status",
            "outstanding_actions_summary",
            "unresolved_hazards_summary",
            "active_permit_ids",
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

        return attrs


class ShiftHandoverAcknowledgeActionSerializer(serializers.Serializer):
    acknowledgement_notes = serializers.CharField(required=False, allow_blank=True)
