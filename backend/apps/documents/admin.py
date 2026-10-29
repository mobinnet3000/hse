from django.contrib import admin
from .models import (
    Document,
    DocumentAcknowledgment,
    DocumentLink,
    DocumentReviewLog,
    DocumentVersion,
)


class DocumentVersionInline(admin.TabularInline):
    model = DocumentVersion
    extra = 0
    readonly_fields = [
        "version_number",
        "original_filename",
        "file_size_bytes",
        "file_hash_sha256",
        "status",
        "uploaded_by",
        "created_at",
    ]


class DocumentReviewLogInline(admin.TabularInline):
    model = DocumentReviewLog
    extra = 0
    readonly_fields = ["reviewer", "action", "decision_reason", "created_at"]


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = [
        "document_number",
        "title",
        "category",
        "status",
        "confidentiality",
        "organization",
        "effective_date",
        "expiry_date",
    ]
    list_filter = ["status", "category", "confidentiality", "organization"]
    search_fields = ["document_number", "title", "tags"]
    inlines = [DocumentVersionInline, DocumentReviewLogInline]


@admin.register(DocumentVersion)
class DocumentVersionAdmin(admin.ModelAdmin):
    list_display = [
        "document",
        "version_number",
        "status",
        "original_filename",
        "uploaded_by",
        "created_at",
    ]
    list_filter = ["status"]
    search_fields = ["document__document_number", "version_number", "original_filename"]


@admin.register(DocumentAcknowledgment)
class DocumentAcknowledgmentAdmin(admin.ModelAdmin):
    list_display = ["document", "version", "user", "acknowledged_at"]
    list_filter = ["acknowledged_at"]


@admin.register(DocumentReviewLog)
class DocumentReviewLogAdmin(admin.ModelAdmin):
    list_display = ["document", "version", "reviewer", "action", "created_at"]
    list_filter = ["action"]


@admin.register(DocumentLink)
class DocumentLinkAdmin(admin.ModelAdmin):
    list_display = ["document", "target_type", "target_id", "link_title", "created_at"]
    list_filter = ["target_type"]
