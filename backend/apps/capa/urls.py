from django.urls import path

from . import views

urlpatterns = [
    path("", views.CorrectiveActionListCreateView.as_view(), name="corrective-action-list"),
    path(
        "<int:pk>/",
        views.CorrectiveActionDetailView.as_view(),
        name="corrective-action-detail",
    ),
    path(
        "<int:pk>/verify/",
        views.CorrectiveActionVerifyView.as_view(),
        name="corrective-action-verify",
    ),
]
