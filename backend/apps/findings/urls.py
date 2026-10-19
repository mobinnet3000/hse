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
]
