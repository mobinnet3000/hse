from django.urls import path
from .views import (
    DashboardMetricsView,
    PersonalWorkspaceAPIView,
    ProactiveIndicatorsAPIView,
    HSEStrategicGoalListCreateView,
    HSEStrategicGoalDetailView,
    HSEBudgetProgramListCreateView,
    HSEKPIEngineView,
    Executive20ModuleDashboardView,
)

urlpatterns = [
    path("metrics/", DashboardMetricsView.as_view(), name="dashboard-metrics"),
    path("indicators/", ProactiveIndicatorsAPIView.as_view(), name="dashboard-indicators"),
    path("workspace/", PersonalWorkspaceAPIView.as_view(), name="dashboard-workspace"),
    path("kpi-engine/", HSEKPIEngineView.as_view(), name="kpi-engine"),
    path("executive/", Executive20ModuleDashboardView.as_view(), name="executive-20-dashboard"),
    path("strategic-goals/", HSEStrategicGoalListCreateView.as_view(), name="strategic-goals-list"),
    path("strategic-goals/<int:pk>/", HSEStrategicGoalDetailView.as_view(), name="strategic-goals-detail"),
    path("budget/", HSEBudgetProgramListCreateView.as_view(), name="budget-list"),
]
