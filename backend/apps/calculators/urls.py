from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CalculationRecordViewSet,
    EnergyFleetCalculatorAPIView,
    ExcavationCalculatorAPIView,
    HSERatesAPIView,
    NoiseCalculatorAPIView,
    RiggingCalculatorAPIView,
    UnitConvertAPIView,
)

router = DefaultRouter()
router.register("records", CalculationRecordViewSet, basename="calculation-records")

urlpatterns = [
    path("unit-convert/", UnitConvertAPIView.as_view(), name="calculator-unit-convert"),
    path("hse-rates/", HSERatesAPIView.as_view(), name="calculator-hse-rates"),
    path("noise/", NoiseCalculatorAPIView.as_view(), name="calculator-noise"),
    path("rigging/", RiggingCalculatorAPIView.as_view(), name="calculator-rigging"),
    path("energy-fleet/", EnergyFleetCalculatorAPIView.as_view(), name="calculator-energy-fleet"),
    path("excavation/", ExcavationCalculatorAPIView.as_view(), name="calculator-excavation"),
    path("", include(router.urls)),
]
