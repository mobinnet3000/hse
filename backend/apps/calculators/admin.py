from django.contrib import admin
from .models import CalculationRecord


@admin.register(CalculationRecord)
class CalculationRecordAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "calculator_type", "organization", "user", "created_at"]
    list_filter = ["calculator_type", "organization", "created_at"]
    search_fields = ["title", "notes"]
