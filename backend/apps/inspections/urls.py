from django.urls import path

from . import views

urlpatterns = [
    path("", views.InspectionListCreateView.as_view(), name="inspection-list"),
    path("<int:pk>/", views.InspectionDetailView.as_view(), name="inspection-detail"),
    path(
        "<int:pk>/complete/",
        views.InspectionCompleteView.as_view(),
        name="inspection-complete",
    ),
    path(
        "responses/<int:pk>/",
        views.InspectionResponseUpdateView.as_view(),
        name="inspection-response-detail",
    ),
]
