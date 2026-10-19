from rest_framework import serializers

from .models import Workplace


class WorkplaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workplace
        fields = [
            "id",
            "organization",
            "parent",
            "name",
            "code",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        organization = attrs.get("organization", getattr(self.instance, "organization", None))
        parent = attrs.get("parent", getattr(self.instance, "parent", None))
        if parent is not None:
            if organization is not None and parent.organization_id != organization.pk:
                raise serializers.ValidationError(
                    {"parent": "محل کار والد باید متعلق به همان سازمان باشد."}
                )
            if self.instance is not None and parent.pk == self.instance.pk:
                raise serializers.ValidationError(
                    {"parent": "محل کار نمی‌تواند والد خودش باشد."}
                )
        return attrs
