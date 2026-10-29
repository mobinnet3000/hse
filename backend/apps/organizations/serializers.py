from rest_framework import serializers

from apps.accounts.models import User
from .models import (
    Membership,
    ModuleEntitlement,
    Organization,
    OrganizationSubscription,
    SubscriptionPaymentRequest,
    SubscriptionPlan,
)


class MembershipSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = Membership
        fields = [
            "id",
            "user",
            "username",
            "full_name",
            "organization",
            "role",
            "role_display",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["organization", "created_at", "updated_at"]

    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "name",
            "code",
            "description",
            "price_monthly_irr",
            "max_users",
            "max_workplaces",
            "included_modules",
            "is_active",
            "created_at",
        ]


class ModuleEntitlementSerializer(serializers.ModelSerializer):
    module_title = serializers.SerializerMethodField()

    class Meta:
        model = ModuleEntitlement
        fields = [
            "id",
            "organization",
            "module_code",
            "module_title",
            "is_enabled",
            "source",
            "valid_until",
            "created_at",
        ]

    def get_module_title(self, obj):
        return ModuleEntitlement.COMMERCIAL_MODULES.get(obj.module_code, obj.module_code)


class OrganizationSubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    plan_code = serializers.CharField(source="plan.code", read_only=True)
    included_modules = serializers.JSONField(source="plan.included_modules", read_only=True)
    is_valid_period = serializers.BooleanField(read_only=True)

    class Meta:
        model = OrganizationSubscription
        fields = [
            "id",
            "organization",
            "plan",
            "plan_name",
            "plan_code",
            "included_modules",
            "status",
            "valid_from",
            "valid_until",
            "is_valid_period",
            "auto_renew",
            "created_at",
            "updated_at",
        ]


class SubscriptionPaymentRequestSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    submitted_by_name = serializers.CharField(source="submitted_by.get_full_name", read_only=True)

    class Meta:
        model = SubscriptionPaymentRequest
        fields = [
            "id",
            "organization",
            "plan",
            "plan_name",
            "amount_irr",
            "payment_reference",
            "status",
            "submitted_by",
            "submitted_by_name",
            "verified_by",
            "verification_notes",
            "verified_at",
            "created_at",
        ]
        read_only_fields = ["id", "status", "verified_by", "verified_at", "created_at"]


class OrganizationSerializer(serializers.ModelSerializer):
    subscription = OrganizationSubscriptionSerializer(read_only=True)
    entitlements = ModuleEntitlementSerializer(many=True, read_only=True)

    class Meta:
        model = Organization
        fields = ["id", "name", "code", "is_active", "subscription", "entitlements", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]
