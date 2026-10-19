from django.urls import path

from . import views

urlpatterns = [
    path("", views.OrganizationListCreateView.as_view(), name="organization-list"),
    path("<int:pk>/", views.OrganizationDetailView.as_view(), name="organization-detail"),
    path(
        "<int:pk>/memberships/",
        views.MembershipListCreateView.as_view(),
        name="organization-memberships",
    ),
    path(
        "memberships/<int:pk>/",
        views.MembershipDetailView.as_view(),
        name="membership-detail",
    ),
]
