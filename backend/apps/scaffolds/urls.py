from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ScaffoldInspectionViewSet,
    ScaffoldSummaryView,
    ScaffoldViewSet,
)

router = DefaultRouter()
router.register(r"scaffolds", ScaffoldViewSet, basename="scaffold")
router.register(r"inspections", ScaffoldInspectionViewSet, basename="scaffold-inspection")

urlpatterns = [
    path("summary/", ScaffoldSummaryView.as_view(), name="scaffold-summary"),
    path("", include(router.urls)),
]
