from django.contrib import admin
from .models import KnowledgeSource


@admin.register(KnowledgeSource)
class KnowledgeSourceAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "category", "organization", "status", "is_verified", "updated_at")
    list_filter = ("category", "status", "is_verified", "organization")
    search_fields = ("code", "title", "tags", "summary")
