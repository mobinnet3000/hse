from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import PSSRChecklistItemViewSet, PSSROutstandingActionViewSet, PSSRReviewViewSet

router = DefaultRouter()
router.register("reviews", PSSRReviewViewSet, basename="pssr-reviews")
router.register("items", PSSRChecklistItemViewSet, basename="pssr-items")
router.register("actions", PSSROutstandingActionViewSet, basename="pssr-actions")

urlpatterns = [
    path("", include(router.urls)),
]
