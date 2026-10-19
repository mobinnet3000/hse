from django.urls import path
from .views import (
    AiAnalyzeWorkplaceView,
    AiApplyChecklistView,
    AiApplyHazardView,
    AiStatusView,
    AiSuggestControlsView,
    AiSuggestChecklistView,
)

urlpatterns = [
    path("status/", AiStatusView.as_view(), name="ai-status"),
    path("analyze-workplace/", AiAnalyzeWorkplaceView.as_view(), name="ai-analyze-workplace"),
    path("suggest-checklist/", AiSuggestChecklistView.as_view(), name="ai-suggest-checklist"),
    path("suggest-controls/", AiSuggestControlsView.as_view(), name="ai-suggest-controls"),
    path("apply-hazard/", AiApplyHazardView.as_view(), name="ai-apply-hazard"),
    path("apply-checklist/", AiApplyChecklistView.as_view(), name="ai-apply-checklist"),
]
