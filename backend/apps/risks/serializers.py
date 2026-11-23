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




# =====================================================================
# Enterprise Risk Register (10-Step) Serializers
# =====================================================================

from .models import (
    RiskRegister,
    RiskActivityTask,
    HazardSource,
    RiskScenario,
    RiskControl,
    DimensionScoreSet,
    RiskTreatmentAction,
)
from .services import RiskMatrixCalculator


class DimensionScoreSetSerializer(serializers.ModelSerializer):
    phase_display = serializers.CharField(source="get_phase_display", read_only=True)
    dimension_display = serializers.CharField(source="get_dimension_display", read_only=True)

    class Meta:
        model = DimensionScoreSet
        fields = [
            "id",
            "scenario",
            "phase",
            "phase_display",
            "dimension",
            "dimension_display",
            "likelihood",
            "severity",
            "rpn",
            "risk_level",
            "target_rpn",
            "created_at",
        ]
        read_only_fields = ["id", "rpn", "risk_level", "created_at"]


class RiskControlSerializer(serializers.ModelSerializer):
    hierarchy_display = serializers.CharField(source="get_hierarchy_display", read_only=True)

    class Meta:
        model = RiskControl
        fields = [
            "id",
            "scenario",
            "description",
            "hierarchy",
            "hierarchy_display",
            "control_type",
            "control_owner",
            "inspection_frequency",
            "is_effective",
            "effectiveness_evidence",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class RiskTreatmentActionSerializer(serializers.ModelSerializer):
    hierarchy_display = serializers.CharField(source="get_hierarchy_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)

    class Meta:
        model = RiskTreatmentAction
        fields = [
            "id",
            "scenario",
            "action_description",
            "hierarchy",
            "hierarchy_display",
            "priority",
            "priority_display",
            "action_owner",
            "due_date",
            "status",
            "status_display",
            "completion_evidence",
            "verification_result",
            "verified_by",
            "traceability_node_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RiskScenarioSerializer(serializers.ModelSerializer):
    existing_controls = RiskControlSerializer(many=True, read_only=True)
    scores = DimensionScoreSetSerializer(many=True, read_only=True)
    treatments = RiskTreatmentActionSerializer(many=True, read_only=True)
    overall_current_risk = serializers.SerializerMethodField()

    class Meta:
        model = RiskScenario
        fields = [
            "id",
            "hazard",
            "scenario_title",
            "undesired_event",
            "initiating_event",
            "direct_causes",
            "root_causes",
            "escalation_factors",
            "event_sequence",
            "scenario_conditions",
            "exposure_pathway",
            "existing_controls",
            "scores",
            "treatments",
            "overall_current_risk",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_overall_current_risk(self, obj):
        return RiskMatrixCalculator.calculate_overall_scenario_risk(obj, phase="current")


class HazardSourceSerializer(serializers.ModelSerializer):
    domain_display = serializers.CharField(source="get_domain_display", read_only=True)
    scenarios = RiskScenarioSerializer(many=True, read_only=True)

    class Meta:
        model = HazardSource
        fields = [
            "id",
            "activity_task",
            "domain",
            "domain_display",
            "category",
            "description",
            "scenarios",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class RiskActivityTaskSerializer(serializers.ModelSerializer):
    hazards = HazardSourceSerializer(many=True, read_only=True)

    class Meta:
        model = RiskActivityTask
        fields = [
            "id",
            "register",
            "activity_title",
            "activity_description",
            "task_name",
            "job_steps",
            "work_method",
            "equipment",
            "materials",
            "personnel_count",
            "competency",
            "duration_frequency",
            "simops",
            "operating_conditions",
            "hazards",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class RiskRegisterSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    approved_by_name = serializers.CharField(source="approved_by.get_full_name", read_only=True)
    activities_count = serializers.IntegerField(source="activities.count", read_only=True)

    class Meta:
        model = RiskRegister
        fields = [
            "id",
            "organization",
            "register_code",
            "title",
            "revision",
            "status",
            "status_display",
            "assessment_date",
            "next_review_date",
            "project_name",
            "department",
            "site_location",
            "area",
            "project_phase",
            "operation_type",
            "client_name",
            "contractor_name",
            "traceability_chain_id",
            "risk_acceptance_status",
            "acceptance_authority",
            "audit_trail_code",
            "approval_notes",
            "created_by",
            "created_by_name",
            "approved_by",
            "approved_by_name",
            "activities_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class FullRiskRegisterCreateSerializer(serializers.Serializer):
    """
    سریالایزر ساخت اتمیک پرونده ۱۱ مرحله‌ای
    """
    context = serializers.DictField()
    activity = serializers.DictField(required=False, default=dict)
    hazard = serializers.DictField(required=False, default=dict)
    scenario = serializers.DictField(required=False, default=dict)
    controls = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    initial_scores = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    current_scores = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    residual_scores = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    treatments = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    governance = serializers.DictField(required=False, default=dict)


class RiskRegisterDetailSerializer(RiskRegisterSerializer):
    activities = RiskActivityTaskSerializer(many=True, read_only=True)

    class Meta(RiskRegisterSerializer.Meta):
        fields = RiskRegisterSerializer.Meta.fields + ["activities"]
