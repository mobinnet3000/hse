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
            "owner",
            "review_date",
            "reassessment_needed",
            "reassessment_reason",
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


from .models import (
    Barrier,
    BarrierAssessment,
    BowTieConsequence,
    BowTieDiagram,
    BowTieThreat,
    HCMSControlMatrix,
    RiskAssessmentTemplate,
)


class BowTieThreatSerializer(serializers.ModelSerializer):
    class Meta:
        model = BowTieThreat
        fields = ["id", "diagram", "title", "category", "order"]
        read_only_fields = ["id"]


class BowTieConsequenceSerializer(serializers.ModelSerializer):
    severity_level_display = serializers.CharField(source="get_severity_level_display", read_only=True)

    class Meta:
        model = BowTieConsequence
        fields = ["id", "diagram", "title", "severity_level", "severity_level_display", "order"]
        read_only_fields = ["id"]


class BarrierAssessmentSerializer(serializers.ModelSerializer):
    effectiveness_display = serializers.CharField(source="get_effectiveness_display", read_only=True)
    assessed_by_name = serializers.CharField(source="assessed_by.get_full_name", read_only=True)

    class Meta:
        model = BarrierAssessment
        fields = [
            "id",
            "barrier",
            "effectiveness",
            "effectiveness_display",
            "assessed_by",
            "assessed_by_name",
            "assessment_date",
            "evidence_reference",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "barrier", "created_at"]


class BarrierSerializer(serializers.ModelSerializer):
    barrier_type_display = serializers.CharField(source="get_barrier_type_display", read_only=True)
    nature_display = serializers.CharField(source="get_nature_display", read_only=True)
    current_effectiveness_display = serializers.CharField(
        source="get_current_effectiveness_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    owner_name = serializers.CharField(source="owner.get_full_name", read_only=True)
    related_asset_name = serializers.CharField(source="related_asset.name", read_only=True)
    assessments = BarrierAssessmentSerializer(many=True, read_only=True)

    class Meta:
        model = Barrier
        fields = [
            "id",
            "diagram",
            "threat",
            "consequence",
            "barrier_type",
            "barrier_type_display",
            "nature",
            "nature_display",
            "name",
            "description",
            "is_critical",
            "owner",
            "owner_name",
            "current_effectiveness",
            "current_effectiveness_display",
            "related_asset",
            "related_asset_name",
            "status",
            "status_display",
            "assessments",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class BowTieDiagramSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    hazard_title = serializers.CharField(source="hazard.title", read_only=True)
    owner_name = serializers.CharField(source="owner.get_full_name", read_only=True)
    threats = BowTieThreatSerializer(many=True, read_only=True)
    consequences = BowTieConsequenceSerializer(many=True, read_only=True)
    barriers = BarrierSerializer(many=True, read_only=True)

    class Meta:
        model = BowTieDiagram
        fields = [
            "id",
            "organization",
            "hazard",
            "hazard_title",
            "top_event",
            "description",
            "status",
            "status_display",
            "owner",
            "owner_name",
            "target_review_date",
            "threats",
            "consequences",
            "barriers",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "created_at", "updated_at"]

    def validate_hazard(self, hazard):
        organization = _context_organization(self)
        if organization is None or hazard.organization_id != organization.pk:
            raise serializers.ValidationError("خطر باید متعلق به همان سازمان باشد.")
        return hazard


class HCMSControlMatrixSerializer(serializers.ModelSerializer):
    hierarchy_display = serializers.CharField(source="get_hierarchy_of_control_display", read_only=True)
    status_display = serializers.CharField(source="get_implementation_status_display", read_only=True)
    residual_level_display = serializers.CharField(source="get_residual_level_display", read_only=True)
    hazard_title = serializers.CharField(source="hazard.title", read_only=True)
    owner_name = serializers.CharField(source="responsible_owner.get_full_name", read_only=True)

    class Meta:
        model = HCMSControlMatrix
        fields = [
            "id",
            "organization",
            "hazard",
            "hazard_title",
            "barrier",
            "control_title",
            "hierarchy_of_control",
            "hierarchy_display",
            "implementation_status",
            "status_display",
            "review_frequency_days",
            "last_reviewed_at",
            "next_review_due",
            "responsible_owner",
            "owner_name",
            "initial_risk_score",
            "residual_likelihood",
            "residual_severity",
            "residual_score",
            "residual_level",
            "residual_level_display",
            "reassessment_trigger",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "residual_score",
            "residual_level",
            "created_at",
            "updated_at",
        ]


class RiskAssessmentTemplateSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = RiskAssessmentTemplate
        fields = [
            "id",
            "organization",
            "title",
            "industry",
            "category",
            "category_display",
            "standard_code",
            "version",
            "typical_threats",
            "typical_consequences",
            "recommended_barriers",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


