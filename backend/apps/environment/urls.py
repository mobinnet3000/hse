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
)

router = DefaultRouter()
router.register(r"thresholds", EnvironmentalThresholdViewSet, basename="threshold")
router.register(r"aspects", EnvironmentalAspectViewSet, basename="aspect")
router.register(r"waste", WasteRecordViewSet, basename="waste")
router.register(r"emissions", WastewaterEmissionRecordViewSet, basename="emission")
router.register(r"hygiene", OccupationalHygieneRecordViewSet, basename="hygiene")

urlpatterns = [
    path("summary/", EnvironmentalSummaryView.as_view(), name="environment-summary"),
    path("waste/export-csv/", WasteExportCSVView.as_view(), name="waste-export-csv"),
    path("", include(router.urls)),
]
