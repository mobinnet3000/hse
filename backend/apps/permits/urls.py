from django.urls import path

from .views import (
    PermitActivateView,
    PermitApproveView,
    PermitCancelView,
    PermitCloseView,
    PermitCompleteView,
    PermitDetailView,
    PermitListCreateView,
    PermitRejectView,
    PermitResumeView,
    PermitReviewView,
    PermitSummaryStatsView,
    PermitSuspendView,
    ShiftHandoverAcknowledgeView,
    ShiftHandoverDetailView,
    ShiftHandoverListCreateView,
    ShiftHandoverSafetySummaryView,
)

app_name = "permits"

urlpatterns = [
    # Permit Endpoints
    path("", PermitListCreateView.as_view(), name="permit-list-create"),
    path("stats/", PermitSummaryStatsView.as_view(), name="permit-stats"),
    path("<int:pk>/", PermitDetailView.as_view(), name="permit-detail"),
    path("<int:pk>/review/", PermitReviewView.as_view(), name="permit-review"),
    path("<int:pk>/approve/", PermitApproveView.as_view(), name="permit-approve"),
    path("<int:pk>/activate/", PermitActivateView.as_view(), name="permit-activate"),
    path("<int:pk>/suspend/", PermitSuspendView.as_view(), name="permit-suspend"),
    path("<int:pk>/resume/", PermitResumeView.as_view(), name="permit-resume"),
    path("<int:pk>/complete/", PermitCompleteView.as_view(), name="permit-complete"),
    path("<int:pk>/close/", PermitCloseView.as_view(), name="permit-close"),
    path("<int:pk>/reject/", PermitRejectView.as_view(), name="permit-reject"),
    path("<int:pk>/cancel/", PermitCancelView.as_view(), name="permit-cancel"),

    # Shift Handover Endpoints
    path("handovers/", ShiftHandoverListCreateView.as_view(), name="handover-list-create"),
    path("handovers/safety-summary/", ShiftHandoverSafetySummaryView.as_view(), name="handover-safety-summary"),
    path("handovers/<int:pk>/", ShiftHandoverDetailView.as_view(), name="handover-detail"),
    path("handovers/<int:pk>/acknowledge/", ShiftHandoverAcknowledgeView.as_view(), name="handover-acknowledge"),
]
