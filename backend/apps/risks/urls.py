from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"registers", views.RiskRegisterViewSet, basename="risk-register")
router.register(r"activities", views.RiskActivityTaskViewSet, basename="risk-activity")
router.register(r"hazard-sources", views.HazardSourceViewSet, basename="hazard-source")
router.register(r"scenarios", views.RiskScenarioViewSet, basename="risk-scenario")
router.register(r"controls", views.RiskControlViewSet, basename="risk-control")
router.register(r"scores", views.DimensionScoreSetViewSet, basename="dimension-score")
router.register(r"treatments", views.RiskTreatmentActionViewSet, basename="risk-treatment")

urlpatterns = [
    # Legacy routes
    path("", views.HazardListCreateView.as_view(), name="hazard-list"),
    path("<int:pk>/", views.HazardDetailView.as_view(), name="hazard-detail"),
    path(
        "assessments/",
        views.AssessmentListCreateView.as_view(),
        name="assessment-list",
    ),
    path(
        "assessments/<int:pk>/",
        views.AssessmentDetailView.as_view(),
        name="assessment-detail",
    ),
    # Phase 11: BowTie, Barriers, HCMS, & Templates
    path("bowtie/", views.BowTieListCreateView.as_view(), name="bowtie-list"),
    path("bowtie/<int:pk>/", views.BowTieDetailView.as_view(), name="bowtie-detail"),
    path("bowtie/<int:diagram_id>/threats/", views.BowTieThreatCreateView.as_view(), name="bowtie-threat-create"),
    path("bowtie/<int:diagram_id>/consequences/", views.BowTieConsequenceCreateView.as_view(), name="bowtie-consequence-create"),
    path("barriers/", views.BarrierListCreateView.as_view(), name="barrier-list"),
    path("barriers/<int:pk>/", views.BarrierDetailView.as_view(), name="barrier-detail"),
    path("barriers/<int:pk>/assess/", views.BarrierAssessmentCreateView.as_view(), name="barrier-assessment-create"),
    path("hcms/", views.HCMSControlMatrixListCreateView.as_view(), name="hcms-list"),
    path("hcms/<int:pk>/", views.HCMSControlMatrixDetailView.as_view(), name="hcms-detail"),
    path("templates/", views.RiskTemplateListView.as_view(), name="risk-template-list"),
    path("dashboard/summary/", views.RiskDashboardSummaryView.as_view(), name="risk-dashboard-summary"),

    # Enterprise 10-Step Risk Register & 5x5 Matrix routes
    path("matrix-5x5/", views.RiskMatrix5x5SummaryView.as_view(), name="risk-matrix-5x5"),
    path("", include(router.urls)),
]
