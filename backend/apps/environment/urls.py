from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    EnvironmentalAspectViewSet,
    EnvironmentalSummaryView,
    EnvironmentalThresholdViewSet,
    OccupationalHygieneRecordViewSet,
    WasteExportCSVView,
    WasteRecordViewSet,
    WastewaterEmissionRecordViewSet,
    ChemicalItemViewSet,
    EmergencyScenarioViewSet,
    EmergencyDrillViewSet,
    EmergencyResourceViewSet,
    ResourceConsumptionViewSet,
    EmergencyActivateView,
)

router = DefaultRouter()
router.register(r"thresholds", EnvironmentalThresholdViewSet, basename="threshold")
router.register(r"aspects", EnvironmentalAspectViewSet, basename="aspect")
router.register(r"waste", WasteRecordViewSet, basename="waste")
router.register(r"emissions", WastewaterEmissionRecordViewSet, basename="emission")
router.register(r"hygiene", OccupationalHygieneRecordViewSet, basename="hygiene")
router.register(r"chemicals", ChemicalItemViewSet, basename="chemical")
router.register(r"emergency-scenarios", EmergencyScenarioViewSet, basename="emergency-scenario")
router.register(r"emergency-drills", EmergencyDrillViewSet, basename="emergency-drill")
router.register(r"emergency-resources", EmergencyResourceViewSet, basename="emergency-resource")
router.register(r"resource-consumption", ResourceConsumptionViewSet, basename="resource-consumption")

urlpatterns = [
    path("summary/", EnvironmentalSummaryView.as_view(), name="environment-summary"),
    path("waste/export-csv/", WasteExportCSVView.as_view(), name="waste-export-csv"),
    path("emergency-scenarios/<int:pk>/activate/", EmergencyActivateView.as_view(), name="emergency-activate"),
    path("", include(router.urls)),
]
