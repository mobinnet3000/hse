from django.urls import path

from . import views

urlpatterns = [
    path("", views.ChecklistListCreateView.as_view(), name="checklist-list"),
    path("<int:pk>/", views.ChecklistDetailView.as_view(), name="checklist-detail"),
    path(
        "<int:pk>/items/",
        views.ChecklistItemListCreateView.as_view(),
        name="checklist-items",
    ),
    path(
        "items/<int:pk>/",
        views.ChecklistItemDetailView.as_view(),
        name="checklist-item-detail",
    ),
]
