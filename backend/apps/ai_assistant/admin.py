from django.contrib import admin
from .models import AIAssessment, AIGenerationLog


@admin.register(AIAssessment)
class AIAssessmentAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "workplace", "status", "created_by", "created_at")
    list_filter = ("status", "organization")
    search_fields = ("title", "input_data")


@admin.register(AIGenerationLog)
class AIGenerationLogAdmin(admin.ModelAdmin):
    list_display = ("assessment", "model", "is_success", "duration_ms", "created_at")
    list_filter = ("is_success", "model")
