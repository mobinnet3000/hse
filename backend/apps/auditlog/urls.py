from django.urls import path
from .views import (
    AuditEventListView,
    AuditPlanListCreateView,
    AuditPlanDetailView,
    AuditFindingListCreateView,
)

urlpatterns = [
    path("", AuditEventListView.as_view(), name="audit-event-list"),
    path("plans/", AuditPlanListCreateView.as_view(), name="audit-plan-list"),
    path("plans/<int:pk>/", AuditPlanDetailView.as_view(), name="audit-plan-detail"),
    path("findings/", AuditFindingListCreateView.as_view(), name="audit-finding-list"),
]
