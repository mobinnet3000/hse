from django.contrib import admin

from .models import CalibrationRecord, Equipment, MaintenancePlan, MaintenanceWorkOrder


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["code", "name", "organization", "workplace", "category", "status", "calibration_required", "is_synthetic"]
    list_filter = ["organization", "category", "status", "calibration_required", "is_synthetic"]
    search_fields = ["code", "name", "serial_number", "manufacturer", "model_number"]
    filter_horizontal = ["related_hazards", "related_permits"]


@admin.register(MaintenancePlan)
class MaintenancePlanAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["title", "equipment", "organization", "interval_days", "next_due_date", "is_active", "responsible"]
    list_filter = ["organization", "is_active", "is_synthetic"]
    search_fields = ["title", "equipment__code", "equipment__name"]


@admin.register(MaintenanceWorkOrder)
class MaintenanceWorkOrderAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["title", "equipment", "organization", "work_type", "status", "scheduled_date", "completed_date", "assigned_to"]
    list_filter = ["organization", "work_type", "status", "is_synthetic"]
    search_fields = ["title", "equipment__code", "equipment__name", "result"]


@admin.register(CalibrationRecord)
class CalibrationRecordAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["equipment", "organization", "performed_on", "next_due_on", "result", "provider", "certificate_number"]
    list_filter = ["organization", "result", "is_synthetic"]
    search_fields = ["equipment__code", "provider", "certificate_number"]
