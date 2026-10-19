from django.contrib import admin
from .models import Incident, IncidentAttachment


class IncidentAttachmentInline(admin.TabularInline):
    model = IncidentAttachment
    extra = 1


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "incident_type",
        "severity",
        "status",
        "organization",
        "workplace",
        "occurred_at",
        "is_synthetic",
    )
    list_filter = ("incident_type", "severity", "status", "organization", "is_synthetic")
    search_fields = ("title", "description", "root_cause")
    inlines = [IncidentAttachmentInline]
