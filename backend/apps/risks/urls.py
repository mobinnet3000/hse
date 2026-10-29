from django.urls import path

from . import views

urlpatterns = [
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
]
