from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ChatConversationViewSet

router = DefaultRouter()
router.register("conversations", ChatConversationViewSet, basename="chat-conversations")

urlpatterns = [
    path("unread-count/", ChatConversationViewSet.as_view({"get": "unread_count"}), name="chat-unread-count"),
    path("", include(router.urls)),
]
