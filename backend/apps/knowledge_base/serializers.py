from rest_framework import serializers

from apps.core.access import can_manage_organization, membership_role
from apps.organizations.models import Membership
from .models import KnowledgeSource


class KnowledgeSourceSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True, default=None)
    creator_name = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeSource
        fields = [
            "id",
            "organization",
            "organization_name",
            "title",
            "code",
            "category",
            "category_display",
            "issuing_authority",
            "effective_date",
            "version",
            "status",
            "status_display",
            "is_verified",
            "summary",
            "content",
            "tags",
            "created_by",
            "creator_name",
            "can_edit",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]

    def get_creator_name(self, obj):
        if not obj.created_by:
            return None
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username

    def get_can_edit(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        user = request.user
        if user.is_platform_admin:
            return True
        if obj.organization_id is None:
            return False
        role = membership_role(user, obj.organization_id)
        return role in {Membership.Roles.ORG_ADMIN, Membership.Roles.HSE_MANAGER}

    def validate(self, attrs):
        title = attrs.get("title", getattr(self.instance, "title", "")).strip()
        code = attrs.get("code", getattr(self.instance, "code", "")).strip()
        organization = attrs.get("organization", getattr(self.instance, "organization", None))

        if not title:
            raise serializers.ValidationError({"title": "عنوان منبع الزامی است."})
        if not code:
            raise serializers.ValidationError({"code": "کد یا شناسه استاندارد الزامی است."})

        # Check uniqueness of code for same organization / global scope
        qs = KnowledgeSource.objects.filter(code__iexact=code, organization=organization)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({"code": "منبعی با این کد در این دامنه قبلاً ثبت شده است."})

        return attrs
