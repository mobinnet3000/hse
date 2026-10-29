from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    EnergyConsumptionLogViewSet,
    ExcavationOperationViewSet,
    FleetFuelLogViewSet,
    FleetVehicleViewSet,
)

router = DefaultRouter()
router.register("vehicles", FleetVehicleViewSet, basename="fleet-vehicles")
router.register("fuel-logs", FleetFuelLogViewSet, basename="fleet-fuel-logs")
router.register("energy-logs", EnergyConsumptionLogViewSet, basename="energy-logs")
router.register("excavations", ExcavationOperationViewSet, basename="excavations")

urlpatterns = [
    path("", include(router.urls)),
]
