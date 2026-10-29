from django.contrib import admin
from .models import PSSRChecklistItem, PSSROutstandingAction, PSSRReview


class PSSRChecklistItemInline(admin.TabularInline):
    model = PSSRChecklistItem
    extra = 0


class PSSROutstandingActionInline(admin.TabularInline):
    model = PSSROutstandingAction
    extra = 0


@admin.register(PSSRReview)
class PSSRReviewAdmin(admin.ModelAdmin):
    list_display = [
        "pssr_number",
        "project_or_system_name",
        "organization",
        "workplace",
        "review_type",
        "target_startup_date",
        "status",
    ]
    list_filter = ["status", "review_type", "organization", "target_startup_date"]
    search_fields = ["pssr_number", "project_or_system_name"]
    inlines = [PSSRChecklistItemInline, PSSROutstandingActionInline]
