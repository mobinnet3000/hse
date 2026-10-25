from django.urls import path

from . import views

urlpatterns = [
    path("equipment/", views.EquipmentListCreateView.as_view(), name="equipment-list"),
    path("equipment/stats/", views.EquipmentStatsView.as_view(), name="equipment-stats"),
    path("equipment/<int:pk>/", views.EquipmentDetailView.as_view(), name="equipment-detail"),
    path("equipment/<int:pk>/status/", views.EquipmentStatusView.as_view(), name="equipment-status"),
    path("maintenance-plans/", views.MaintenancePlanListCreateView.as_view(), name="maintenance-plan-list"),
    path("maintenance-plans/<int:pk>/", views.MaintenancePlanDetailView.as_view(), name="maintenance-plan-detail"),
    path("maintenance-work-orders/", views.MaintenanceWorkOrderListCreateView.as_view(), name="maintenance-work-order-list"),
    path("maintenance-work-orders/<int:pk>/", views.MaintenanceWorkOrderDetailView.as_view(), name="maintenance-work-order-detail"),
    path("maintenance-work-orders/<int:pk>/start/", views.MaintenanceWorkOrderStartView.as_view(), name="maintenance-work-order-start"),
    path("maintenance-work-orders/<int:pk>/complete/", views.MaintenanceWorkOrderCompleteView.as_view(), name="maintenance-work-order-complete"),
    path("maintenance-work-orders/<int:pk>/cancel/", views.MaintenanceWorkOrderCancelView.as_view(), name="maintenance-work-order-cancel"),
    path("calibrations/", views.CalibrationListCreateView.as_view(), name="calibration-list"),
    path("calibrations/<int:pk>/", views.CalibrationDetailView.as_view(), name="calibration-detail"),
]
