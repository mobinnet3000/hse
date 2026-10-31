from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AIAssessmentViewSet,
    AiAnalyzeWorkplaceView,
    AiApplyChecklistView,
    AiApplyHazardView,
    AiStatusView,
    AiSuggestChecklistView,
    AiSuggestControlsView,
)

router = DefaultRouter()
router.register(r"assessments", AIAssessmentViewSet, basename="ai-assessment")

urlpatterns = [
    # Legacy Endpoints (Phase 6 preserved for 100% backward compatibility)
    path("status/", AiStatusView.as_view(), name="ai-status"),
    path("analyze-workplace/", AiAnalyzeWorkplaceView.as_view(), name="ai-analyze-workplace"),
    path("suggest-checklist/", AiSuggestChecklistView.as_view(), name="ai-suggest-checklist"),
    path("suggest-controls/", AiSuggestControlsView.as_view(), name="ai-suggest-controls"),
    path("apply-hazard/", AiApplyHazardView.as_view(), name="ai-apply-hazard"),
    path("apply-checklist/", AiApplyChecklistView.as_view(), name="ai-apply-checklist"),

    # Phase 19 Full-Stack AI Assistant Endpoints
    path("service-status/", AIAssessmentViewSet.as_view({"get": "service_status"}), name="ai-service-status"),
    path("statistics/", AIAssessmentViewSet.as_view({"get": "statistics"}), name="ai-statistics"),
    path("", include(router.urls)),
]
