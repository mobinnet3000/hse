import os
import uuid
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def document_file_upload_path(instance, filename):
    """
    Generate an unguessable storage path partitioned by organization ID.
    Prevents path traversal and predictable URL enumeration.
    """
    ext = os.path.splitext(filename)[1].lower()
    org_id = instance.document.organization_id if instance.document_id else "common"
    safe_uuid = uuid.uuid4().hex
    return f"documents/org_{org_id}/{safe_uuid}{ext}"


class DocumentCategory(models.TextChoices):
    POLICY = "policy", "خط‌مشی و بیانیه کلان (Policy)"
    PROCEDURE = "procedure", "روش اجرایی استاندارد (SOP / Procedure)"
    WORK_INSTRUCTION = "work_instruction", "دستورالعمل کاری و ایمنی (Work Instruction)"
    FORM = "form", "فرم، لاگ‌شیت و چک‌لیست کنترلی (Form/Checklist)"
    SDS = "sds", "برگه اطلاعات ایمنی مواد شیمیایی (SDS / MSDS)"
    RISK_ASSESSMENT = "risk_assessment", "شناسایی خطرات و ارزیابی ریسک (JSA / HIRA)"
    PERMIT_TEMPLATE = "permit_template", "الگوی مجوزهای کار (PTW Template)"
    CERTIFICATE = "certificate", "گواهینامه، استاندارد و تأییدیه فنی (Certificate)"
    TRAINING_MATERIAL = "training_material", "جزوه، اسلاید و محتوای آموزشی (Training Material)"
    INSPECTION_AUDIT = "inspection_audit", "گزارش ممیزی و بازرسی جامع (Audit / Inspection)"
    TECHNICAL_FILE = "technical_file", "پرونده فنی و نقشه‌های ایمنی (Technical File / P&ID)"
    ENVIRONMENTAL_RECORD = "environmental_record", "سوابق و مستندات زیست‌محیطی (Environmental Record)"
    OTHER = "other", "سایر مستندات کنترل‌شده (Other)"


class ConfidentialityLevel(models.TextChoices):
    PUBLIC = "public", "عمومی (Public)"
    INTERNAL = "internal", "داخلی سازمان (Internal)"
    CONFIDENTIAL = "confidential", "محرمانه (Confidential)"
    STRICTLY_CONFIDENTIAL = "strictly_confidential", "به‌شدت محرمانه و مدیریتی (Strictly Confidential)"


class DocumentStatus(models.TextChoices):
    DRAFT = "draft", "پیش‌نویس (Draft)"
    SUBMITTED = "submitted", "ارسال‌شده برای بررسی (Submitted)"
    UNDER_REVIEW = "under_review", "در حال بررسی و ممیزی (Under Review)"
    APPROVED = "approved", "تأییدشده (Approved)"
    EFFECTIVE = "effective", "لازم‌الاجرا و جاری (Effective)"
    REJECTED = "rejected", "ردشده / نیازمند بازنگری (Rejected)"
    SUPERSEDED = "superseded", "منسوخ / نگارش جدیدتر موجود (Superseded)"
    EXPIRED = "expired", "منقضی‌شده (Expired)"
    ARCHIVED = "archived", "بایگانی‌شده راکد (Archived)"
    WITHDRAWN = "withdrawn", "ابطال‌شده (Withdrawn)"


class VersionStatus(models.TextChoices):
    DRAFT = "draft", "پیش‌نویس (Draft)"
    UNDER_REVIEW = "under_review", "در حال بررسی (Under Review)"
    APPROVED = "approved", "تأییدشده و فعال (Approved)"
    REJECTED = "rejected", "ردشده (Rejected)"
    SUPERSEDED = "superseded", "منسوخ / جایگزین‌شده (Superseded)"
    ARCHIVED = "archived", "بایگانی‌شده (Archived)"


class Document(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="controlled_documents",
        help_text="سازمان مالک مدرک",
    )
    document_number = models.CharField(
        max_length=100,
        db_index=True,
        help_text="شماره یا کد شناسه یکتای مدرک (مانند DOC-SOP-001)",
    )
    title = models.CharField(max_length=255, help_text="عنوان کامل مدرک")
    description = models.TextField(blank=True, help_text="شرح، هدف و دامنه کاربرد")
    category = models.CharField(
        max_length=50,
        choices=DocumentCategory.choices,
        default=DocumentCategory.PROCEDURE,
    )
    confidentiality = models.CharField(
        max_length=30,
        choices=ConfidentialityLevel.choices,
        default=ConfidentialityLevel.INTERNAL,
    )
    status = models.CharField(
        max_length=30,
        choices=DocumentStatus.choices,
        default=DocumentStatus.DRAFT,
        db_index=True,
    )
    department = models.CharField(
        max_length=150,
        blank=True,
        help_text="واحد یا دپارتمان متولی (مثلاً: ایمنی، آتش‌نشانی، بهداشت)",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="controlled_documents",
        help_text="کارگاه یا سایت عملیاتی مرتبط (اختیاری)",
    )
    owner = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_documents",
        help_text="مسئول/متولی اصلی نگهداری سند",
    )
    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="authored_documents",
        help_text="تهیه‌کننده یا مؤلف اولیه",
    )
    assigned_reviewer = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewing_documents",
        help_text="بررسی‌کننده یا ممیز مسئول تعیین‌شده",
    )
    current_version = models.ForeignKey(
        "DocumentVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="current_for_document",
        help_text="آخرین نگارش معتبر و فعال جاری",
    )
    effective_date = models.DateField(
        null=True,
        blank=True,
        help_text="تاریخ آغاز لازم‌الاجرا شدن مدرک",
    )
    next_review_date = models.DateField(
        null=True,
        blank=True,
        help_text="تاریخ سررسید بازنگری دوره‌ای",
    )
    expiry_date = models.DateField(
        null=True,
        blank=True,
        help_text="تاریخ پایان اعتبار قانونی/فنی مدرک",
    )
    retention_years = models.PositiveIntegerField(
        default=5,
        help_text="مدت زمان نگهداری قانونی پس از منسوخ شدن (به سال)",
    )
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_reason = models.TextField(blank=True, help_text="علت بایگانی یا خروج از رده")
    archived_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="archived_documents",
    )
    tags = models.CharField(
        max_length=255,
        blank=True,
        help_text="کلمات کلیدی با کاما جدا شوند (مثلاً: ارتفاع، آتش‌نشانی، LOTO)",
    )
    requires_acknowledgment = models.BooleanField(
        default=False,
        help_text="آیا نیاز به مطالعه و ثبت تصدیق خواندن توسط کارکنان دارد؟",
    )
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "document_number"],
                name="unique_document_number_per_org",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "category"]),
            models.Index(fields=["document_number"]),
            models.Index(fields=["next_review_date"]),
            models.Index(fields=["expiry_date"]),
        ]

    def __str__(self):
        return f"{self.document_number} - {self.title}"

    def clean(self):
        if self.organization_id and not self.organization.is_active:
            raise ValidationError({"organization": "سازمان انتخابی غیرفعال است."})
        if self.effective_date and self.expiry_date and self.effective_date > self.expiry_date:
            raise ValidationError({"expiry_date": "تاریخ انقضا نمی‌تواند قبل از تاریخ ابلاغ باشد."})

    @property
    def is_expired(self):
        if not self.expiry_date:
            return False
        return self.expiry_date < timezone.now().date()

    @property
    def is_review_overdue(self):
        if not self.next_review_date:
            return False
        return self.next_review_date < timezone.now().date()

    @property
    def is_review_due_soon(self):
        if not self.next_review_date:
            return False
        today = timezone.now().date()
        diff = (self.next_review_date - today).days
        return 0 <= diff <= 14

    @property
    def is_effective(self):
        if self.status in [DocumentStatus.EFFECTIVE, DocumentStatus.APPROVED]:
            if self.is_expired:
                return False
            if self.effective_date and self.effective_date > timezone.now().date():
                return False
            return True
        return False


class DocumentVersion(models.Model):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="versions",
    )
    version_number = models.CharField(
        max_length=30,
        help_text="شماره ویرایش یا نگارش مدرک (مانند 1.0, 1.1, 2.0)",
    )
    file = models.FileField(
        upload_to=document_file_upload_path,
        max_length=500,
        help_text="فایل ضمیمه مدرک در مخزن امن",
    )
    original_filename = models.CharField(max_length=255)
    file_size_bytes = models.BigIntegerField(default=0)
    file_hash_sha256 = models.CharField(
        max_length=64,
        blank=True,
        help_text="هش امنیتی SHA-256 جهت اثبات عدم دستکاری محتوا",
    )
    mime_type = models.CharField(max_length=120, blank=True)
    change_summary = models.TextField(
        blank=True,
        help_text="خلاصه تغییرات نسبت به ویرایش قبلی (Change Summary)",
    )
    uploaded_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_document_versions",
    )
    status = models.CharField(
        max_length=30,
        choices=VersionStatus.choices,
        default=VersionStatus.DRAFT,
    )
    reviewed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_document_versions",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True, help_text="توضیحات و بازخورد ممیز/بررسی‌کننده")
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["document", "version_number"],
                name="unique_version_per_document",
            )
        ]
        indexes = [
            models.Index(fields=["document", "status"]),
            models.Index(fields=["file_hash_sha256"]),
        ]

    def __str__(self):
        return f"{self.document.document_number} v{self.version_number} ({self.get_status_display()})"


class DocumentAcknowledgment(models.Model):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="acknowledgments",
    )
    version = models.ForeignKey(
        DocumentVersion,
        on_delete=models.CASCADE,
        related_name="acknowledgments",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="document_acknowledgments",
    )
    acknowledged_at = models.DateTimeField(auto_now_add=True)
    signature_note = models.CharField(
        max_length=255,
        blank=True,
        help_text="یادداشت تأیید یا توضیحات اختیاری کاربر",
    )
    is_synthetic = models.BooleanField(default=False)

    class Meta:
        ordering = ["-acknowledged_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["document", "version", "user"],
                name="unique_acknowledgment_per_version_user",
            )
        ]

    def __str__(self):
        return f"{self.user.username} acknowledged {self.document.document_number} v{self.version.version_number}"


class DocumentReviewLog(models.Model):
    class Action(models.TextChoices):
        SUBMITTED = "submitted", "ارسال برای بازنگری و ممیزی"
        APPROVED = "approved", "تأیید و تصویب مدرک"
        REJECTED = "rejected", "رد و درخواست اصلاحات"
        SUPERSEDED = "superseded", "منسوخ‌سازی با نگارش جدید"
        ARCHIVED = "archived", "بایگانی مدرک"
        RESTORED = "restored", "بازیابی از بایگانی"
        VERSION_CREATED = "version_created", "بارگذاری ویرایش جدید"

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="review_logs",
    )
    version = models.ForeignKey(
        DocumentVersion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="review_logs",
    )
    reviewer = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="document_review_actions",
    )
    action = models.CharField(max_length=30, choices=Action.choices)
    decision_reason = models.TextField(blank=True, help_text="علت تصمیم یا توضیحات ثبت‌شده")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.document.document_number} - {self.action} by {self.reviewer}"


class DocumentLink(models.Model):
    class TargetType(models.TextChoices):
        PERMIT = "permit", "مجوز کار (Permit to Work)"
        ASSET = "asset", "تجهیز / ماشین‌آلات (Asset / Equipment)"
        INCIDENT = "incident", "حادثه / شبه‌حادثه (Incident)"
        RISK = "risk", "ریسک / BowTie (Risk / Hazard)"
        SCAFFOLD = "scaffold", "داربست (Scaffold)"
        ENVIRONMENTAL_ASPECT = "environmental_aspect", "جنبه زیست‌محیطی (Environmental Aspect)"
        CONTRACTOR = "contractor", "پیمانکار (Contractor)"
        OTHER = "other", "سایر ماژول‌ها"

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="cross_links",
    )
    target_type = models.CharField(max_length=50, choices=TargetType.choices)
    target_id = models.PositiveIntegerField()
    link_title = models.CharField(max_length=255, blank=True)
    link_note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["target_type", "target_id"]),
        ]

    def __str__(self):
        return f"Link {self.document.document_number} -> {self.target_type}:{self.target_id}"
