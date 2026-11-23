from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    SurveySubmissionViewSet,
    SurveyViewSet,
    BehaviorObservationListCreateView,
    SafetyCultureScoreListCreateView,
)

router = DefaultRouter()
router.register("surveys", SurveyViewSet, basename="surveys")
router.register("submissions", SurveySubmissionViewSet, basename="survey-submissions")

urlpatterns = [
    path("bbs/", BehaviorObservationListCreateView.as_view(), name="bbs-list"),
    path("culture-score/", SafetyCultureScoreListCreateView.as_view(), name="culture-score-list"),
    path("", include(router.urls)),
]
