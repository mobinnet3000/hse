from django.contrib import admin
from .models import CraneSpecification, LiftApprovalLog, LiftingPlan


class LiftApprovalLogInline(admin.TabularInline):
    model = LiftApprovalLog
    extra = 0
    readonly_fields = ["user", "action", "notes", "created_at"]


@admin.register(CraneSpecification)
class CraneSpecificationAdmin(admin.ModelAdmin):
    list_display = ["model_name", "manufacturer", "max_capacity_tonnes", "organization", "is_active"]
    list_filter = ["organization", "is_active"]
    search_fields = ["model_name", "manufacturer"]


@admin.register(LiftingPlan)
class LiftingPlanAdmin(admin.ModelAdmin):
    list_display = [
        "plan_number",
        "title",
        "organization",
        "workplace",
        "category",
        "status",
        "total_gross_weight_kg",
        "crane_utilization_pct",
        "planned_date",
    ]
    list_filter = ["status", "category", "organization", "planned_date"]
    search_fields = ["plan_number", "title", "load_description"]
    inlines = [LiftApprovalLogInline]
