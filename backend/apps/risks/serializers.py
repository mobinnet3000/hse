from rest_framework import serializers

from apps.workplaces.models import Workplace

from .models import Hazard, RiskAssessment
from .risk import LIKELIHOOD_MAX, LIKELIHOOD_MIN, SEVERITY_MAX, SEVERITY_MIN


def _context_organization(serializer):
    organization = serializer.context.get("organization")
    if organization is not None:
        return organization
    organization_id = serializer.context.get("organization_id")
    if organization_id is not None:
        from apps.organizations.models import Organization

        return Organization.objects.filter(pk=organization_id).first()
    return getattr(serializer.instance, "organization", None)


class HazardSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Hazard
        fields = [
            "id",
            "organization",
            "workplace",
            "title",
            "description",
            "category",
            "category_display",
            "source",
            "causes",
            "consequences",
            "exposed_persons",
            "existing_controls",
            "status",
            "status_display",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["organization", "created_at", "updated_at"]

    def validate_workplace(self, workplace):
        if workplace is None:
            return workplace
        organization = _context_organization(self)
        if organization is None or workplace.organization_id != organization.pk:
            raise serializers.ValidationError("محل کار باید متعلق به همان سازمان باشد.")
        return workplace


class RiskAssessmentSerializer(serializers.ModelSerializer):
    level_display = serializers.CharField(source="get_level_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    likelihood = serializers.IntegerField(min_value=LIKELIHOOD_MIN, max_value=LIKELIHOOD_MAX)
    severity = serializers.IntegerField(min_value=SEVERITY_MIN, max_value=SEVERITY_MAX)

    class Meta:
        model = RiskAssessment
        fields = [
            "id",
            "hazard",
            "organization",
            "likelihood",
            "severity",
            "score",
            "level",
            "level_display",
            "proposed_controls",
            "implemented_controls",
            "status",
            "status_display",
            "assessed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "organization",
            "score",
            "level",
            "assessed_at",
            "created_at",
            "updated_at",
        ]

    def validate_hazard(self, hazard):
        organization = _context_organization(self)
        if organization is None or hazard.organization_id != organization.pk:
            raise serializers.ValidationError("خطر باید متعلق به همان سازمان باشد.")
        return hazard

