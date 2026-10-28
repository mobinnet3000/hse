from django.urls import path
from .views import DashboardMetricsView, PersonalWorkspaceAPIView, ProactiveIndicatorsAPIView

urlpatterns = [
    path("metrics/", DashboardMetricsView.as_view(), name="dashboard-metrics"),
    path("indicators/", ProactiveIndicatorsAPIView.as_view(), name="dashboard-indicators"),
    path("workspace/", PersonalWorkspaceAPIView.as_view(), name="dashboard-workspace"),
]
