from rest_framework import serializers
from .models import PSSRChecklistItem, PSSROutstandingAction, PSSRReview


class PSSROutstandingActionSerializer(serializers.ModelSerializer):
    responsible_name = serializers.CharField(source="responsible.get_full_name", read_only=True)
    resolved_by_name = serializers.CharField(source="resolved_by.get_full_name", read_only=True)

    class Meta:
        model = PSSROutstandingAction
        fields = [
            "id",
            "pssr",
            "checklist_item",
            "title",
            "description",
            "responsible",
            "responsible_name",
            "target_date",
            "is_pre_startup",
            "status",
            "resolution_notes",
            "resolved_at",
            "resolved_by",
            "resolved_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PSSRChecklistItemSerializer(serializers.ModelSerializer):
    verified_by_name = serializers.CharField(source="verified_by.get_full_name", read_only=True)
    actions = PSSROutstandingActionSerializer(many=True, read_only=True)

    class Meta:
        model = PSSRChecklistItem
        fields = [
            "id",
            "pssr",
            "category",
            "item_text",
            "verification_status",
            "is_critical",
            "verified_by",
            "verified_by_name",
            "comments",
            "evidence_ref",
            "actions",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PSSRReviewListSerializer(serializers.ModelSerializer):
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    leader_name = serializers.CharField(source="leader.get_full_name", read_only=True)
    approver_name = serializers.CharField(source="approver.get_full_name", read_only=True)
    items_count = serializers.IntegerField(source="checklist_items.count", read_only=True)
    pending_actions_count = serializers.SerializerMethodField()

    class Meta:
        model = PSSRReview
        fields = [
            "id",
            "organization",
            "workplace",
            "workplace_name",
            "pssr_number",
            "project_or_system_name",
            "review_type",
            "target_startup_date",
            "actual_startup_date",
            "leader",
            "leader_name",
            "approver",
            "approver_name",
            "status",
            "items_count",
            "pending_actions_count",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "leader",
            "approver",
            "status",
            "created_at",
            "updated_at",
        ]

    def get_pending_actions_count(self, obj):
        return obj.outstanding_actions.filter(status=PSSROutstandingAction.ActionStatus.OPEN).count()

    def validate_workplace(self, value):
        request = self.context.get("request")
        if request and hasattr(request, "user") and value:
            from apps.organizations.models import Membership
            user_org_ids = Membership.objects.filter(
                user=request.user, is_active=True
            ).values_list("organization_id", flat=True)
            if value.organization_id not in user_org_ids:
                raise serializers.ValidationError("کارگاه انتخاب‌شده متعلق به سازمان جاری نیست.")
        return value


class PSSRReviewDetailSerializer(serializers.ModelSerializer):
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    leader_name = serializers.CharField(source="leader.get_full_name", read_only=True)
    approver_name = serializers.CharField(source="approver.get_full_name", read_only=True)
    checklist_items = PSSRChecklistItemSerializer(many=True, read_only=True)
    outstanding_actions = PSSROutstandingActionSerializer(many=True, read_only=True)

    class Meta:
        model = PSSRReview
        fields = [
            "id",
            "organization",
            "workplace",
            "workplace_name",
            "pssr_number",
            "project_or_system_name",
            "review_type",
            "target_startup_date",
            "actual_startup_date",
            "leader",
            "leader_name",
            "approver",
            "approver_name",
            "status",
            "final_signoff_notes",
            "rejection_reason",
            "checklist_items",
            "outstanding_actions",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "leader",
            "approver",
            "status",
            "final_signoff_notes",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]

    def validate_workplace(self, value):
        request = self.context.get("request")
        if request and hasattr(request, "user") and value:
            from apps.organizations.models import Membership
            user_org_ids = Membership.objects.filter(
                user=request.user, is_active=True
            ).values_list("organization_id", flat=True)
            if value.organization_id not in user_org_ids:
                raise serializers.ValidationError("کارگاه انتخاب‌شده متعلق به سازمان جاری نیست.")
        return value


class PSSRApprovalActionSerializer(serializers.Serializer):
    signoff_notes = serializers.CharField(required=False, allow_blank=True, default="")
    rejection_reason = serializers.CharField(required=False, allow_blank=True, default="")
