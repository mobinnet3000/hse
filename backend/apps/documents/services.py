import hashlib
import mimetypes
import os
from datetime import timedelta
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.auditlog.services import log_event
from apps.core.access import active_membership
from apps.notifications.services import notify_user
from apps.organizations.models import Membership, Organization

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

MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB

ALLOWED_FILE_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".doc",
    ".xlsx",
    ".xls",
    ".pptx",
    ".txt",
    ".jpg",
    ".jpeg",
    ".png",
    ".csv",
}

DISALLOWED_FILE_EXTENSIONS = {
    ".exe",
    ".bat",
    ".cmd",
    ".sh",
    ".py",
    ".js",
    ".vbs",
    ".ps1",
    ".dll",
    ".msi",
    ".com",
    ".scr",
}


def validate_uploaded_file(file_obj):
    """
    Validate uploaded file size, extension, and calculate SHA-256 checksum.
    Returns (safe_filename, size_bytes, sha256_hash, mime_type).
    """
    if not file_obj:
        raise ValidationError("فایلی بارگذاری نشده است.")

    filename = getattr(file_obj, "name", "document.pdf")
    # Sanitize basename to prevent path traversal
    safe_filename = os.path.basename(filename)
    ext = os.path.splitext(safe_filename)[1].lower()

    if ext in DISALLOWED_FILE_EXTENSIONS:
        raise ValidationError(f"بارگذاری پسوند امنیتی {ext} مجاز نمی‌باشد.")

    if ext not in ALLOWED_FILE_EXTENSIONS:
        raise ValidationError(
            f"پسوند فایل ({ext}) مجاز نیست. پسوندهای مجاز: PDF, Word, Excel, PowerPoint, Text, Image, CSV"
        )

    file_size = getattr(file_obj, "size", 0)
    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise ValidationError("حجم فایل بارگذاری‌شده نمی‌تواند بیش از ۲۵ مگابایت باشد.")

    # Calculate SHA256
    sha256 = hashlib.sha256()
    if hasattr(file_obj, "chunks"):
        for chunk in file_obj.chunks():
            sha256.update(chunk)
    else:
        content = file_obj.read()
        sha256.update(content)
        file_obj.seek(0)

    hash_hex = sha256.hexdigest()
    guessed_type, _ = mimetypes.guess_type(safe_filename)
    mime = guessed_type or getattr(file_obj, "content_type", "application/octet-stream")

    return safe_filename, file_size, hash_hex, mime


def can_access_document(user, document: Document) -> bool:
    """
    Tenant and confidentiality permission gatekeeper.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True

    membership = active_membership(user, document.organization_id)
    if not membership:
        return False

    # Owner, Author, or Assigned Reviewer always have access
    if user.id in [
        getattr(document, "owner_id", None),
        getattr(document, "author_id", None),
        getattr(document, "assigned_reviewer_id", None),
    ]:
        return True

    # Confidentiality levels
    conf = document.confidentiality
    role = membership.role

    if conf in [ConfidentialityLevel.PUBLIC, ConfidentialityLevel.INTERNAL]:
        return True

    if conf == ConfidentialityLevel.CONFIDENTIAL:
        allowed_roles = {
            Membership.Roles.ORG_ADMIN,
            Membership.Roles.HSE_MANAGER,
            Membership.Roles.HSE_INSPECTOR,
            Membership.Roles.WORKSHOP_SUPERVISOR,
        }
        return role in allowed_roles

    if conf == ConfidentialityLevel.STRICTLY_CONFIDENTIAL:
        allowed_roles = {
            Membership.Roles.ORG_ADMIN,
            Membership.Roles.HSE_MANAGER,
        }
        return role in allowed_roles

    return False


def can_manage_document(user, document: Document) -> bool:
    """
    Check if user can edit, review, or archive the document.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True

    membership = active_membership(user, document.organization_id)
    if not membership:
        return False

    role = membership.role
    if role in [Membership.Roles.ORG_ADMIN, Membership.Roles.HSE_MANAGER]:
        return True

    # Owner or Author can manage their own drafts
    if user.id in [document.owner_id, document.author_id] and document.status in [
        DocumentStatus.DRAFT,
        DocumentStatus.REJECTED,
    ]:
        return True

    return False


def can_review_document(user, document: Document) -> bool:
    """
    Check if user can approve or reject the document.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True

    membership = active_membership(user, document.organization_id)
    if not membership:
        return False

    role = membership.role
    if role in [Membership.Roles.ORG_ADMIN, Membership.Roles.HSE_MANAGER]:
        return True

    if document.assigned_reviewer_id == user.id:
        return True

    return False


@transaction.atomic
def create_document_with_initial_version(
    *,
    organization: Organization,
    document_number: str,
    title: str,
    category: str,
    user,
    description: str = "",
    confidentiality: str = ConfidentialityLevel.INTERNAL,
    department: str = "",
    workplace=None,
    owner=None,
    assigned_reviewer=None,
    effective_date=None,
    next_review_date=None,
    expiry_date=None,
    retention_years: int = 5,
    tags: str = "",
    requires_acknowledgment: bool = False,
    file_obj=None,
    version_number: str = "1.0",
    change_summary: str = "نسخه اولیه",
    is_synthetic: bool = False,
) -> Document:
    """
    Create a new controlled document and optionally attach its initial version (v1.0).
    """
    clean_number = document_number.strip().upper()
    if Document.objects.filter(organization=organization, document_number=clean_number).exists():
        raise ValidationError({"document_number": f"سندی با شماره {clean_number} در این سازمان ثبت شده است."})

    doc = Document.objects.create(
        organization=organization,
        document_number=clean_number,
        title=title.strip(),
        description=description.strip(),
        category=category,
        confidentiality=confidentiality,
        status=DocumentStatus.DRAFT,
        department=department.strip(),
        workplace=workplace,
        owner=owner or user,
        author=user,
        assigned_reviewer=assigned_reviewer,
        effective_date=effective_date,
        next_review_date=next_review_date,
        expiry_date=expiry_date,
        retention_years=retention_years,
        tags=tags.strip(),
        requires_acknowledgment=requires_acknowledgment,
        is_synthetic=is_synthetic,
    )

    if file_obj:
        orig_name, size, sha_hash, mime = validate_uploaded_file(file_obj)
        version = DocumentVersion.objects.create(
            document=doc,
            version_number=version_number.strip(),
            file=file_obj,
            original_filename=orig_name,
            file_size_bytes=size,
            file_hash_sha256=sha_hash,
            mime_type=mime,
            change_summary=change_summary.strip(),
            uploaded_by=user,
            status=VersionStatus.DRAFT,
            is_synthetic=is_synthetic,
        )
        doc.current_version = version
        doc.save(update_fields=["current_version", "updated_at"])

        DocumentReviewLog.objects.create(
            document=doc,
            version=version,
            reviewer=user,
            action=DocumentReviewLog.Action.VERSION_CREATED,
            decision_reason=change_summary,
        )

    log_event(
        organization=organization,
        actor=user,
        action="create_document",
        entity_type="Document",
        entity_id=doc.id,
        details={
            "document_number": doc.document_number,
            "title": doc.title,
            "category": doc.category,
            "version": version_number if file_obj else None,
        },
    )

    return doc


@transaction.atomic
def create_document_revision(
    *,
    document: Document,
    file_obj,
    version_number: str,
    user,
    change_summary: str = "",
    submit_for_review: bool = True,
    is_synthetic: bool = False,
) -> DocumentVersion:
    """
    Upload a new revision for an existing document without altering historical versions.
    """
    if not can_manage_document(user, document):
        raise PermissionDenied("شما مجوز ثبت ویرایش برای این سند را ندارید.")

    clean_version = version_number.strip()
    if DocumentVersion.objects.filter(document=document, version_number=clean_version).exists():
        raise ValidationError({"version_number": f"نگارش {clean_version} قبلاً برای این سند ثبت شده است."})

    orig_name, size, sha_hash, mime = validate_uploaded_file(file_obj)

    version_status = VersionStatus.UNDER_REVIEW if submit_for_review else VersionStatus.DRAFT
    version = DocumentVersion.objects.create(
        document=document,
        version_number=clean_version,
        file=file_obj,
        original_filename=orig_name,
        file_size_bytes=size,
        file_hash_sha256=sha_hash,
        mime_type=mime,
        change_summary=change_summary.strip(),
        uploaded_by=user,
        status=version_status,
        is_synthetic=is_synthetic,
    )

    DocumentReviewLog.objects.create(
        document=document,
        version=version,
        reviewer=user,
        action=DocumentReviewLog.Action.VERSION_CREATED,
        decision_reason=change_summary,
    )

    if submit_for_review:
        document.status = DocumentStatus.UNDER_REVIEW
        document.save(update_fields=["status", "updated_at"])

        DocumentReviewLog.objects.create(
            document=document,
            version=version,
            reviewer=user,
            action=DocumentReviewLog.Action.SUBMITTED,
            decision_reason="ارسال نگارش جدید جهت ممیزی",
        )

        if document.assigned_reviewer:
            notify_user(
                user=document.assigned_reviewer,
                organization=document.organization,
                title="سند جدید نیازمند بازنگری",
                message=f"نگارش {version.version_number} سند «{document.title}» توسط {user.get_full_name() or user.username} ارسال شد.",
            )

    log_event(
        organization=document.organization,
        actor=user,
        action="upload_revision",
        entity_type="Document",
        entity_id=document.id,
        details={
            "document_number": document.document_number,
            "version": version.version_number,
            "filename": orig_name,
            "sha256": sha_hash,
        },
    )

    return version


@transaction.atomic
def submit_document_for_review(document: Document, user) -> Document:
    """
    Submit a draft or rejected document for formal review.
    """
    if not can_manage_document(user, document):
        raise PermissionDenied("مجوز ارسال این سند برای بازنگری را ندارید.")

    if not document.versions.exists():
        raise ValidationError("سند فاقد هرگونه فایل پیوست نگارش است و امکان ارسال برای بازنگری وجود ندارد.")

    document.status = DocumentStatus.UNDER_REVIEW
    document.save(update_fields=["status", "updated_at"])

    # Update latest version status if draft
    latest_version = document.versions.first()
    if latest_version and latest_version.status == VersionStatus.DRAFT:
        latest_version.status = VersionStatus.UNDER_REVIEW
        latest_version.save(update_fields=["status"])

    DocumentReviewLog.objects.create(
        document=document,
        version=latest_version,
        reviewer=user,
        action=DocumentReviewLog.Action.SUBMITTED,
        decision_reason="ارسال برای بررسی و تصویب",
    )

    if document.assigned_reviewer:
        notify_user(
            user=document.assigned_reviewer,
            organization=document.organization,
            title="سند در انتظار تصویب",
            message=f"سند «{document.title}» ({document.document_number}) برای ممیزی در کارتابل شما قرار گرفت.",
        )

    log_event(
        organization=document.organization,
        actor=user,
        action="submit_for_review",
        entity_type="Document",
        entity_id=document.id,
        details={"document_number": document.document_number},
    )

    return document


@transaction.atomic
def approve_document_version(
    document: Document,
    version: DocumentVersion,
    reviewer,
    notes: str = "",
    effective_date=None,
    next_review_date=None,
    expiry_date=None,
) -> Document:
    """
    Approve a document version. Supersedes previous approved version and activates current version.
    """
    if not can_review_document(reviewer, document):
        raise PermissionDenied("شما مجوز تصویب یا تأیید این سند را ندارید.")

    today = timezone.now().date()

    # 1. Supersede any currently approved versions
    old_approved = document.versions.filter(status=VersionStatus.APPROVED).exclude(id=version.id)
    for old_v in old_approved:
        old_v.status = VersionStatus.SUPERSEDED
        old_v.save(update_fields=["status"])
        DocumentReviewLog.objects.create(
            document=document,
            version=old_v,
            reviewer=reviewer,
            action=DocumentReviewLog.Action.SUPERSEDED,
            decision_reason=f"جایگزین‌شده با نگارش تصویب‌شده {version.version_number}",
        )

    # 2. Approve this version
    version.status = VersionStatus.APPROVED
    version.reviewed_by = reviewer
    version.reviewed_at = timezone.now()
    version.review_notes = notes.strip()
    version.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_notes"])

    # 3. Update document current_version and status
    document.current_version = version

    if effective_date:
        document.effective_date = effective_date
    elif not document.effective_date:
        document.effective_date = today

    if next_review_date:
        document.next_review_date = next_review_date
    if expiry_date:
        document.expiry_date = expiry_date

    # Determine status: EFFECTIVE if effective_date <= today, else APPROVED
    if document.effective_date <= today:
        document.status = DocumentStatus.EFFECTIVE
    else:
        document.status = DocumentStatus.APPROVED

    document.save(
        update_fields=[
            "current_version",
            "status",
            "effective_date",
            "next_review_date",
            "expiry_date",
            "updated_at",
        ]
    )

    DocumentReviewLog.objects.create(
        document=document,
        version=version,
        reviewer=reviewer,
        action=DocumentReviewLog.Action.APPROVED,
        decision_reason=notes or "تصویب و ابلاغ نگارش",
    )

    # Notify author and owner
    recipients = {document.author, document.owner} - {reviewer, None}
    for recipient in recipients:
        notify_user(
            user=recipient,
            organization=document.organization,
            title="سند تصویب و ابلاغ گردید",
            message=f"نگارش {version.version_number} سند «{document.title}» توسط {reviewer.get_full_name() or reviewer.username} تأیید شد.",
        )

    log_event(
        organization=document.organization,
        actor=reviewer,
        action="approve_document",
        entity_type="Document",
        entity_id=document.id,
        details={
            "document_number": document.document_number,
            "version": version.version_number,
            "notes": notes,
        },
    )

    return document


@transaction.atomic
def reject_document_version(
    document: Document,
    version: DocumentVersion,
    reviewer,
    reason: str,
) -> Document:
    """
    Reject a document version with a mandatory reason.
    """
    if not can_review_document(reviewer, document):
        raise PermissionDenied("شما مجوز رد یا بازنگری این سند را ندارید.")

    clean_reason = reason.strip()
    if not clean_reason:
        raise ValidationError({"reason": "ذکر علت رد سند و نکات مورد نیاز جهت اصلاح الزامی است."})

    version.status = VersionStatus.REJECTED
    version.reviewed_by = reviewer
    version.reviewed_at = timezone.now()
    version.review_notes = clean_reason
    version.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_notes"])

    document.status = DocumentStatus.REJECTED
    document.save(update_fields=["status", "updated_at"])

    DocumentReviewLog.objects.create(
        document=document,
        version=version,
        reviewer=reviewer,
        action=DocumentReviewLog.Action.REJECTED,
        decision_reason=clean_reason,
    )

    if document.author and document.author != reviewer:
        notify_user(
            user=document.author,
            organization=document.organization,
            title="سند جهت اصلاحات رد شد",
            message=f"نگارش {version.version_number} سند «{document.title}» رد شد. دلیل: {clean_reason}",
        )

    log_event(
        organization=document.organization,
        actor=reviewer,
        action="reject_document",
        entity_type="Document",
        entity_id=document.id,
        details={
            "document_number": document.document_number,
            "version": version.version_number,
            "reason": clean_reason,
        },
    )

    return document


@transaction.atomic
def archive_document(document: Document, user, reason: str) -> Document:
    """
    Archive a document with mandatory reason.
    """
    if not can_manage_document(user, document):
        raise PermissionDenied("شما مجوز بایگانی این سند را ندارید.")

    clean_reason = reason.strip()
    if not clean_reason:
        raise ValidationError({"reason": "ذکر علت بایگانی سند الزامی است."})

    document.status = DocumentStatus.ARCHIVED
    document.archived_at = timezone.now()
    document.archived_reason = clean_reason
    document.archived_by = user
    document.save(update_fields=["status", "archived_at", "archived_reason", "archived_by", "updated_at"])

    DocumentReviewLog.objects.create(
        document=document,
        version=document.current_version,
        reviewer=user,
        action=DocumentReviewLog.Action.ARCHIVED,
        decision_reason=clean_reason,
    )

    log_event(
        organization=document.organization,
        actor=user,
        action="archive_document",
        entity_type="Document",
        entity_id=document.id,
        details={"document_number": document.document_number, "reason": clean_reason},
    )

    return document


@transaction.atomic
def restore_document(document: Document, user, reason: str = "") -> Document:
    """
    Restore an archived document back to superseded or draft status.
    """
    if not can_manage_document(user, document):
        raise PermissionDenied("شما مجوز بازیابی این سند را ندارید.")

    if document.status != DocumentStatus.ARCHIVED:
        raise ValidationError("سند در وضعیت بایگانی نیست.")

    # If it has an approved version, mark superseded; otherwise draft
    has_approved = document.versions.filter(status=VersionStatus.APPROVED).exists()
    document.status = DocumentStatus.SUPERSEDED if has_approved else DocumentStatus.DRAFT
    document.archived_at = None
    document.archived_reason = ""
    document.archived_by = None
    document.save(update_fields=["status", "archived_at", "archived_reason", "archived_by", "updated_at"])

    DocumentReviewLog.objects.create(
        document=document,
        version=document.current_version,
        reviewer=user,
        action=DocumentReviewLog.Action.RESTORED,
        decision_reason=reason or "بازیابی سند از بایگانی",
    )

    log_event(
        organization=document.organization,
        actor=user,
        action="restore_document",
        entity_type="Document",
        entity_id=document.id,
        details={"document_number": document.document_number, "reason": reason},
    )

    return document


@transaction.atomic
def record_document_acknowledgment(document: Document, user, signature_note: str = "") -> DocumentAcknowledgment:
    """
    Record that an employee has read and acknowledged compliance with the document's current version.
    """
    if not can_access_document(user, document):
        raise PermissionDenied("شما دسترسی به این سند ندارید.")

    if not document.current_version:
        raise ValidationError("این سند نگارش فعالی برای مطالعه و تصدیق ندارد.")

    ack, created = DocumentAcknowledgment.objects.get_or_create(
        document=document,
        version=document.current_version,
        user=user,
        defaults={"signature_note": signature_note.strip()},
    )

    if created:
        log_event(
            organization=document.organization,
            actor=user,
            action="acknowledge_document",
            entity_type="Document",
            entity_id=document.id,
            details={
                "document_number": document.document_number,
                "version": document.current_version.version_number,
            },
        )

    return ack


def link_document_to_target(document: Document, target_type: str, target_id: int, user, link_title: str = "", link_note: str = "") -> DocumentLink:
    """
    Cross-domain linkage to PTW, Asset, Incident, Risk, Scaffold, etc.
    """
    if not can_access_document(user, document):
        raise PermissionDenied("دسترسی به سند مجاز نیست.")

    return DocumentLink.objects.create(
        document=document,
        target_type=target_type,
        target_id=target_id,
        link_title=link_title.strip(),
        link_note=link_note.strip(),
        created_by=user,
    )


def get_document_summary(organization_ids: list[int]) -> dict:
    """
    Calculates summary metrics for document control dashboard.
    """
    qs = Document.objects.filter(organization_id__in=organization_ids)
    today = timezone.now().date()
    soon_threshold = today + timedelta(days=14)

    total_count = qs.count()
    effective_count = qs.filter(status__in=[DocumentStatus.EFFECTIVE, DocumentStatus.APPROVED]).exclude(expiry_date__lt=today).count()
    under_review_count = qs.filter(status__in=[DocumentStatus.UNDER_REVIEW, DocumentStatus.SUBMITTED]).count()
    draft_count = qs.filter(status=DocumentStatus.DRAFT).count()
    rejected_count = qs.filter(status=DocumentStatus.REJECTED).count()
    archived_count = qs.filter(status=DocumentStatus.ARCHIVED).count()

    # Expiring & Overdue Review
    expiring_soon_count = qs.filter(
        status__in=[DocumentStatus.EFFECTIVE, DocumentStatus.APPROVED],
        expiry_date__gte=today,
        expiry_date__lte=soon_threshold,
    ).count()

    review_due_count = qs.filter(
        status__in=[DocumentStatus.EFFECTIVE, DocumentStatus.APPROVED],
        next_review_date__isnull=False,
        next_review_date__lte=soon_threshold,
    ).count()

    total_acks = DocumentAcknowledgment.objects.filter(document__organization_id__in=organization_ids).count()

    # Group by categories
    by_category = list(
        qs.values("category")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    return {
        "total_documents": total_count,
        "effective_documents": effective_count,
        "under_review_documents": under_review_count,
        "draft_documents": draft_count,
        "rejected_documents": rejected_count,
        "archived_documents": archived_count,
        "expiring_soon": expiring_soon_count,
        "review_due_soon": review_due_count,
        "total_acknowledgments": total_acks,
        "categories_breakdown": by_category,
    }
