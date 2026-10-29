from django.urls import path
from . import views

urlpatterns = [
    path("", views.NonConformityListCreateView.as_view(), name="nonconformity-list"),
    path(
        "<int:pk>/",
        views.NonConformityDetailView.as_view(),
        name="nonconformity-detail",
    ),
    path(
        "<int:pk>/close/",
        views.NonConformityCloseView.as_view(),
        name="nonconformity-close",
    ),
    path(
        "<int:pk>/reopen/",
        views.NonConformityReopenView.as_view(),
        name="nonconformity-reopen",
    ),
    path(
        "<int:pk>/evidence/",
        views.NonConformityEvidenceUploadView.as_view(),
        name="nonconformity-evidence",
    ),
]
