from django.contrib import admin
from .models import Permit, PermitAttachment, ShiftHandover


class PermitAttachmentInline(admin.TabularInline):
    model = PermitAttachment
    extra = 0


@admin.register(Permit)
class PermitAdmin(admin.ModelAdmin):
    list_display = [
        "reference_code",
        "title",
        "permit_type",
        "organization",
        "workplace",
        "status",
        "valid_from",
        "valid_until",
        "requester",
        "approver",
        "is_synthetic",
    ]
    list_filter = ["organization", "status", "permit_type", "is_synthetic"]
    search_fields = ["reference_code", "title", "description", "work_area"]
    inlines = [PermitAttachmentInline]


@admin.register(ShiftHandover)
class ShiftHandoverAdmin(admin.ModelAdmin):
    list_display = [
        "workplace",
        "shift_type",
        "shift_date",
        "organization",
        "status",
        "outgoing_supervisor",
        "incoming_supervisor",
        "acknowledged_at",
        "is_synthetic",
    ]
    list_filter = ["organization", "status", "shift_type", "is_synthetic"]
    search_fields = ["workplace__name", "handover_notes", "safety_concerns"]
