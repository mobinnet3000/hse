from django.urls import path
from .views import (
    ChangeRequestListCreateView,
    ChangeRequestDetailView,
    MOCSubmitView,
    MOCApproveRiskView,
    MOCAuthorizeView,
    MOCCloseView,
)

app_name = "moc"

urlpatterns = [
    path("", ChangeRequestListCreateView.as_view(), name="moc-list-create"),
    path("<int:pk>/", ChangeRequestDetailView.as_view(), name="moc-detail"),
    path("<int:pk>/submit/", MOCSubmitView.as_view(), name="moc-submit"),
    path("<int:pk>/approve-risk/", MOCApproveRiskView.as_view(), name="moc-approve-risk"),
    path("<int:pk>/authorize/", MOCAuthorizeView.as_view(), name="moc-authorize"),
    path("<int:pk>/close/", MOCCloseView.as_view(), name="moc-close"),
]
