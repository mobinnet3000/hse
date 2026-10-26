from rest_framework import serializers

from .models import (
    ConfidentialityLevel,
    Document,
    DocumentAcknowledgment,
    DocumentCategory,
    DocumentLink,
    DocumentReviewLog,
    DocumentStatus,
    DocumentVersion,
    VersionStatus,
)


class DocumentVersionSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = DocumentVersion
        fields = [
            "id",
            "document",
            "version_number",
            "original_filename",
            "file_size_bytes",
            "file_hash_sha256",
            "mime_type",
            "change_summary",
            "uploaded_by",
            "uploaded_by_name",
            "status",
            "status_display",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_notes",
            "created_at",
            "download_url",
        ]
        read_only_fields = [
            "id",
            "original_filename",
            "file_size_bytes",
            "file_hash_sha256",
            "mime_type",
            "uploaded_by",
            "status",
            "reviewed_by",
            "reviewed_at",
            "created_at",
        ]

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by:
            return ""
        return obj.uploaded_by.get_full_name() or obj.uploaded_by.username

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return ""
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.username

    def get_download_url(self, obj):
        return f"/api/v1/documents/documents/{obj.document_id}/versions/{obj.id}/download/"


class DocumentAcknowledgmentSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    version_number = serializers.CharField(source="version.version_number", read_only=True)

    class Meta:
        model = DocumentAcknowledgment
        fields = [
            "id",
            "document",
            "version",
            "version_number",
            "user",
            "user_name",
            "acknowledged_at",
            "signature_note",
        ]
        read_only_fields = ["id", "acknowledged_at", "user"]

    def get_user_name(self, obj):
        if not obj.user:
            return ""
        return obj.user.get_full_name() or obj.user.username


class DocumentReviewLogSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.SerializerMethodField()
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    version_number = serializers.CharField(source="version.version_number", read_only=True, default="")

    class Meta:
        model = DocumentReviewLog
        fields = [
            "id",
            "document",
            "version",
            "version_number",
            "reviewer",
            "reviewer_name",
            "action",
            "action_display",
            "decision_reason",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_reviewer_name(self, obj):
        if not obj.reviewer:
            return ""
        return obj.reviewer.get_full_name() or obj.reviewer.username


class DocumentLinkSerializer(serializers.ModelSerializer):
    target_type_display = serializers.CharField(source="get_target_type_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DocumentLink
        fields = [
            "id",
            "document",
            "target_type",
            "target_type_display",
            "target_id",
            "link_title",
            "link_note",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "created_by"]

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ""
        return obj.created_by.get_full_name() or obj.created_by.username


class DocumentListSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    confidentiality_display = serializers.CharField(source="get_confidentiality_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True, default="")
    owner_name = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()
    assigned_reviewer_name = serializers.SerializerMethodField()
    current_version_number = serializers.SerializerMethodField()
    current_version_id = serializers.SerializerMethodField()
    current_version_filename = serializers.SerializerMethodField()
    current_version_size = serializers.SerializerMethodField()
    current_version_hash = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)
    is_review_overdue = serializers.BooleanField(read_only=True)
    is_review_due_soon = serializers.BooleanField(read_only=True)
    is_effective = serializers.BooleanField(read_only=True)
    acknowledgments_count = serializers.SerializerMethodField()
    versions_count = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "organization",
            "document_number",
            "title",
            "category",
            "category_display",
            "confidentiality",
            "confidentiality_display",
            "status",
            "status_display",
            "department",
            "workplace",
            "workplace_name",
            "owner",
            "owner_name",
            "author",
            "author_name",
            "assigned_reviewer",
            "assigned_reviewer_name",
            "current_version_id",
            "current_version_number",
            "current_version_filename",
            "current_version_size",
            "current_version_hash",
            "effective_date",
            "next_review_date",
            "expiry_date",
            "is_expired",
            "is_review_overdue",
            "is_review_due_soon",
            "is_effective",
            "requires_acknowledgment",
            "acknowledgments_count",
            "versions_count",
            "tags",
            "updated_at",
            "created_at",
        ]

    def get_owner_name(self, obj):
        if not obj.owner:
            return ""
        return obj.owner.get_full_name() or obj.owner.username

    def get_author_name(self, obj):
        if not obj.author:
            return ""
        return obj.author.get_full_name() or obj.author.username

    def get_assigned_reviewer_name(self, obj):
        if not obj.assigned_reviewer:
            return ""
        return obj.assigned_reviewer.get_full_name() or obj.assigned_reviewer.username

    def get_current_version_id(self, obj):
        return obj.current_version_id

    def get_current_version_number(self, obj):
        if obj.current_version:
            return obj.current_version.version_number
        return ""

    def get_current_version_filename(self, obj):
        if obj.current_version:
            return obj.current_version.original_filename
        return ""

    def get_current_version_size(self, obj):
        if obj.current_version:
            return obj.current_version.file_size_bytes
        return 0

    def get_current_version_hash(self, obj):
        if obj.current_version:
            return obj.current_version.file_hash_sha256
        return ""

    def get_acknowledgments_count(self, obj):
        return getattr(obj, "prefetched_acks_count", obj.acknowledgments.count())

    def get_versions_count(self, obj):
        return getattr(obj, "prefetched_versions_count", obj.versions.count())


class DocumentDetailSerializer(DocumentListSerializer):
    versions = DocumentVersionSerializer(many=True, read_only=True)
    review_logs = DocumentReviewLogSerializer(many=True, read_only=True)
    cross_links = DocumentLinkSerializer(many=True, read_only=True)
    acknowledgments = DocumentAcknowledgmentSerializer(many=True, read_only=True)
    archived_by_name = serializers.SerializerMethodField()

    class Meta(DocumentListSerializer.Meta):
        fields = DocumentListSerializer.Meta.fields + [
            "description",
            "retention_years",
            "archived_at",
            "archived_reason",
            "archived_by",
            "archived_by_name",
            "versions",
            "review_logs",
            "cross_links",
            "acknowledgments",
        ]

    def get_archived_by_name(self, obj):
        if not obj.archived_by:
            return ""
        return obj.archived_by.get_full_name() or obj.archived_by.username


class DocumentCreateSerializer(serializers.ModelSerializer):
    file = serializers.FileField(required=False, write_only=True)
    version_number = serializers.CharField(required=False, default="1.0", write_only=True)
    change_summary = serializers.CharField(required=False, default="نسخه اولیه سند", write_only=True)

    class Meta:
        model = Document
        fields = [
            "id",
            "organization",
            "document_number",
            "title",
            "description",
            "category",
            "confidentiality",
            "department",
            "workplace",
            "owner",
            "assigned_reviewer",
            "effective_date",
            "next_review_date",
            "expiry_date",
            "retention_years",
            "tags",
            "requires_acknowledgment",
            "file",
            "version_number",
            "change_summary",
        ]
        read_only_fields = ["id", "organization"]


class DocumentRevisionUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)
    version_number = serializers.CharField(required=True, max_length=30)
    change_summary = serializers.CharField(required=False, default="", allow_blank=True)
    submit_for_review = serializers.BooleanField(default=True)


class DocumentReviewActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])
    notes = serializers.CharField(required=False, default="", allow_blank=True)
    reason = serializers.CharField(required=False, default="", allow_blank=True)
    effective_date = serializers.DateField(required=False, allow_null=True)
    next_review_date = serializers.DateField(required=False, allow_null=True)
    expiry_date = serializers.DateField(required=False, allow_null=True)


class DocumentArchiveSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True)


class DocumentRestoreSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, default="", allow_blank=True)


class DocumentAcknowledgmentActionSerializer(serializers.Serializer):
    signature_note = serializers.CharField(required=False, default="", allow_blank=True, max_length=255)


class DocumentLinkCreateSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=DocumentLink.TargetType.choices)
    target_id = serializers.IntegerField(min_value=1)
    link_title = serializers.CharField(required=False, default="", allow_blank=True, max_length=255)
    link_note = serializers.CharField(required=False, default="", allow_blank=True, max_length=255)
