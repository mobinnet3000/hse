from django.urls import path

from . import views

urlpatterns = [
    path("", views.WorkplaceListCreateView.as_view(), name="workplace-list"),
    path("<int:pk>/", views.WorkplaceDetailView.as_view(), name="workplace-detail"),
]
