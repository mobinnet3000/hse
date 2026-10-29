from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DocumentSummaryView, DocumentViewSet

router = DefaultRouter()
router.register(r"documents", DocumentViewSet, basename="document")

urlpatterns = [
    path("summary/", DocumentSummaryView.as_view(), name="document-summary"),
    path("", include(router.urls)),
]
