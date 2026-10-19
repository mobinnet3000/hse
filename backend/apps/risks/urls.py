from django.urls import path

from . import views

urlpatterns = [
    path("", views.HazardListCreateView.as_view(), name="hazard-list"),
    path("<int:pk>/", views.HazardDetailView.as_view(), name="hazard-detail"),
    path(
        "assessments/",
        views.AssessmentListCreateView.as_view(),
        name="assessment-list",
    ),
    path(
        "assessments/<int:pk>/",
        views.AssessmentDetailView.as_view(),
        name="assessment-detail",
    ),
]
