from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import CraneSpecificationViewSet, LiftingPlanViewSet

router = DefaultRouter()
router.register("cranes", CraneSpecificationViewSet, basename="cranes")
router.register("plans", LiftingPlanViewSet, basename="lifting-plans")

urlpatterns = [
    path("", include(router.urls)),
]
