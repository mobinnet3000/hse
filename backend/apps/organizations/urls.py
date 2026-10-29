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
    path(
        "plans/",
        views.SubscriptionPlanListView.as_view(),
        name="subscription-plans",
    ),
    path(
        "<int:pk>/subscription/",
        views.OrganizationSubscriptionView.as_view(),
        name="organization-subscription",
    ),
    path(
        "<int:pk>/entitlements/",
        views.ModuleEntitlementListView.as_view(),
        name="organization-entitlements",
    ),
    path(
        "<int:pk>/payment-requests/",
        views.SubscriptionPaymentRequestView.as_view(),
        name="organization-payment-request",
    ),
]
