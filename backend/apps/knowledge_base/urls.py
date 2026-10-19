from django.urls import path
from .views import (
    KnowledgeSourceListCreateView,
    KnowledgeSourceDetailView,
    KnowledgeMetaView,
)

urlpatterns = [
    path("", KnowledgeSourceListCreateView.as_view(), name="knowledge-list-create"),
    path("meta/", KnowledgeMetaView.as_view(), name="knowledge-meta"),
    path("<int:pk>/", KnowledgeSourceDetailView.as_view(), name="knowledge-detail"),
]
