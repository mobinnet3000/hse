from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import SurveySubmissionViewSet, SurveyViewSet

router = DefaultRouter()
router.register("surveys", SurveyViewSet, basename="surveys")
router.register("submissions", SurveySubmissionViewSet, basename="survey-submissions")

urlpatterns = [
    path("", include(router.urls)),
]
