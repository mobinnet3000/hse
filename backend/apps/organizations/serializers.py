from rest_framework import serializers

from apps.accounts.models import User

from .models import Membership, Organization


class MembershipSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    username = serializers.CharField(source="user.username", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = Membership
        fields = [
            "id",
            "user",
            "username",
            "organization",
            "role",
            "role_display",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["organization", "created_at", "updated_at"]


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "code", "is_active", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]
