from django.contrib import admin

from .models import (
    Competency,
    Employee,
    EmployeeCompetency,
    PPEAssignment,
    PPEAssignmentEvent,
    PPEItem,
    PPEStock,
    TrainingAttendance,
    TrainingCourse,
    TrainingSession,
)


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["employee_no", "full_name", "organization", "workplace", "job_title", "user", "is_active", "is_synthetic"]
    list_filter = ["organization", "workplace", "is_active", "is_synthetic"]
    search_fields = ["employee_no", "first_name", "last_name", "job_title", "user__username"]


@admin.register(TrainingCourse)
class TrainingCourseAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["code", "title", "organization", "category", "delivery_type", "is_mandatory", "requires_renewal", "is_active"]
    list_filter = ["organization", "delivery_type", "is_mandatory", "requires_renewal", "is_active", "is_synthetic"]
    search_fields = ["code", "title", "category"]


@admin.register(TrainingSession)
class TrainingSessionAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["course", "organization", "workplace", "scheduled_on", "instructor_name", "status", "capacity"]
    list_filter = ["organization", "status", "is_synthetic"]
    search_fields = ["course__code", "course__title", "instructor_name"]


@admin.register(TrainingAttendance)
class TrainingAttendanceAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["employee", "session", "organization", "attendance_status", "assessment_result", "score", "completed_on"]
    list_filter = ["organization", "attendance_status", "assessment_result", "is_synthetic"]
    search_fields = ["employee__employee_no", "employee__first_name", "employee__last_name", "session__course__title"]


@admin.register(Competency)
class CompetencyAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["code", "name", "organization", "is_mandatory", "validity_months", "is_active", "is_synthetic"]
    list_filter = ["organization", "is_mandatory", "is_active", "is_synthetic"]
    search_fields = ["code", "name", "description", "allowed_activities"]
    filter_horizontal = ["accepted_courses"]


@admin.register(EmployeeCompetency)
class EmployeeCompetencyAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["employee", "competency", "organization", "achieved_on", "expires_on", "status", "certificate_number"]
    list_filter = ["organization", "status", "is_synthetic"]
    search_fields = ["employee__employee_no", "employee__first_name", "employee__last_name", "competency__code", "competency__name", "certificate_number"]


@admin.register(PPEItem)
class PPEItemAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["code", "name", "organization", "category", "replacement_interval_days", "inspection_required", "is_durable", "tracks_serial", "is_active"]
    list_filter = ["organization", "category", "inspection_required", "is_durable", "tracks_serial", "is_active", "is_synthetic"]
    search_fields = ["code", "name", "category"]


@admin.register(PPEStock)
class PPEStockAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["item", "organization", "workplace", "location_name", "quantity_on_hand", "quantity_minimum", "is_active"]
    list_filter = ["organization", "is_active", "is_synthetic"]
    search_fields = ["item__code", "item__name", "location_name"]


@admin.register(PPEAssignment)
class PPEAssignmentAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["employee", "item", "organization", "quantity", "serial_number", "issued_on", "replacement_due_on", "status"]
    list_filter = ["organization", "status", "is_synthetic"]
    search_fields = ["employee__employee_no", "employee__first_name", "employee__last_name", "item__code", "item__name", "serial_number"]


@admin.register(PPEAssignmentEvent)
class PPEAssignmentEventAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    list_display = ["assignment", "event_type", "organization", "occurred_on", "quantity", "actor"]
    list_filter = ["organization", "event_type", "is_synthetic"]
    search_fields = ["assignment__employee__employee_no", "assignment__item__code", "notes"]
