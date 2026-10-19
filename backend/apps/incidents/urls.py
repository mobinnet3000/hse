from django.urls import path
from .views import (
    IncidentCloseView,
    IncidentDetailView,
    IncidentInvestigateView,
    IncidentLinkCapaView,
    IncidentListCreateView,
    IncidentReopenView,
    IncidentReviewView,
    IncidentSummaryStatsView,
)

urlpatterns = [
    path("", IncidentListCreateView.as_view(), name="incident-list-create"),
    path("summary/", IncidentSummaryStatsView.as_view(), name="incident-summary-stats"),
    path("<int:pk>/", IncidentDetailView.as_view(), name="incident-detail"),
    path("<int:pk>/review/", IncidentReviewView.as_view(), name="incident-review"),
    path("<int:pk>/investigate/", IncidentInvestigateView.as_view(), name="incident-investigate"),
    path("<int:pk>/link-capa/", IncidentLinkCapaView.as_view(), name="incident-link-capa"),
    path("<int:pk>/close/", IncidentCloseView.as_view(), name="incident-close"),
    path("<int:pk>/reopen/", IncidentReopenView.as_view(), name="incident-reopen"),
]
