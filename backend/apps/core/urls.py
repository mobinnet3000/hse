from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("readiness/", views.readiness, name="readiness"),
    path("integrations/status/", views.integrations_status, name="integrations-status"),
    path("integrations/test/", views.test_integration_view, name="integrations-test"),
]
