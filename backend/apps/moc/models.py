from django.db import models
from django.utils import timezone
from apps.core.mixins import EnterpriseContextMixin


class ChangeRequest(EnterpriseContextMixin, models.Model):
    """
    ماژول مدیریت تغییرات (Management of Change - MOC)
    پایش چرخه عمر درخواست‌های تغییر، ارزیابی ریسک تغییر، تأییدیه‌های چندمرحله‌ای و چک‌لیست قبل از اجرا
    """
    class ChangeType(models.TextChoices):
        PROCESS = "process", "تغییر در فرآیند یا پارامترهای عملیاتی"
        EQUIPMENT = "equipment", "تغییر، اصلاح یا تعویض تجهیزات و ماشین‌آلات"
        PROCEDURAL = "procedural", "تغییر در روش اجرایی یا دستورالعمل (SOP)"
        MATERIAL = "material", "تغییر در مواد اولیه، کاتالیست یا مواد شیمیایی"
        ORGANIZATIONAL = "organizational", "تغییر ساختار سازمانی یا پرسنل کلیدی"

    class Category(models.TextChoices):
        PERMANENT = "permanent", "دائمی"
        TEMPORARY = "temporary", "موقت (دارای انقضای مشخص)"
        EMERGENCY = "emergency", "تغییر فوری / اضطراری"

    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        SUBMITTED = "submitted", "ثبت‌شده و در انتظار ارزیابی ریسک"
        RISK_ASSESSED = "risk_assessed", "ارزیابی ریسک انجام‌شده"
        UNDER_REVIEW = "under_review", "در حال بررسی کمیته تغییرات"
        APPROVED = "approved", "تأییدشده و مجاز به اجرا (Authorized)"
        REJECTED = "rejected", "ردشده"
        IMPLEMENTED = "implemented", "اجراشده"
        CLOSED = "closed", "مختومه‌شده و اسناد به‌روزشده"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="change_requests",
    )
    workplace = models.ForeignKey(
        "workplaces.Workplace",
        on_delete=models.PROTECT,
        related_name="change_requests",
        null=True,
        blank=True,
    )
    moc_number = models.CharField(max_length=64, unique=True, db_index=True, verbose_name="شماره MOC")
    title = models.CharField(max_length=200, verbose_name="عنوان تغییر")
    change_type = models.CharField(max_length=32, choices=ChangeType.choices, default=ChangeType.PROCESS)
    category = models.CharField(max_length=32, choices=Category.choices, default=Category.PERMANENT)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.DRAFT, db_index=True)

    reason_for_change = models.TextField(verbose_name="علت و توجیه فنی تغییر")
    description = models.TextField(verbose_name="شرح کامل تغییر")
    scope_of_work = models.TextField(blank=True, verbose_name="دامنه و محدوده فعالیت")
    temporary_expiry_date = models.DateField(null=True, blank=True, verbose_name="تاریخ خاتمه اعتبار تغییر موقت")

    # Cross-module links
    related_equipment = models.ForeignKey(
        "assets.Equipment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moc_requests",
        verbose_name="تجهیز مرتبط با تغییر",
    )
    related_risk_register = models.ForeignKey(
        "risks.RiskRegister",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moc_requests",
        verbose_name="رجیستر ارزیابی ریسک ناشی از تغییر",
    )
    related_permit = models.ForeignKey(
        "permits.Permit",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moc_requests",
        verbose_name="مجوز کار صادرشده برای اجرای تغییر",
    )

    # Approval-Based wiring with Risk Management
    risk_assessment_required = models.BooleanField(default=True, verbose_name="نیازمند ارزیابی ریسک تغییر")
    risk_assessed = models.BooleanField(default=False, verbose_name="ارزیابی ریسک انجام شده")
    risk_approved = models.BooleanField(default=False, verbose_name="تأییدیه مدیریت ریسک اخذ شده")
    risk_assessor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moc_risk_reviews",
        verbose_name="ارزیاب ریسک",
    )
    risk_assessment_notes = models.TextField(blank=True, verbose_name="نتایج و شروط ارزیابی ریسک تغییر")
    risk_assessed_at = models.DateTimeField(null=True, blank=True)

    # Pre-implementation verification checklist & document control
    pre_implementation_checklist = models.JSONField(
        default=list,
        blank=True,
        verbose_name="چک‌لیست اقدامات پیش از اجرا (Pre-implementation Checks)",
    )
    document_revision_required = models.BooleanField(default=False, verbose_name="نیازمند به‌روزرسانی اسناد و مدارک فنی (P&ID, SOP)")
    revised_documents_ref = models.CharField(max_length=255, blank=True, verbose_name="شناسه اسناد اصلاح‌شده")
    training_required = models.BooleanField(default=False, verbose_name="نیازمند آموزش به پرسنل درگیر تغییر")
    training_details = models.TextField(blank=True, verbose_name="جزئیات برنامه آموزشی تغییر")

    # Workflow actors & dates
    requested_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="moc_requests_requested",
        verbose_name="درخواست‌کننده",
    )
    approved_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moc_requests_approved",
        verbose_name="تصویب‌کننده نهایی",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moc_requests_closed",
        verbose_name="مختومه‌کننده",
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    closure_notes = models.TextField(blank=True, verbose_name="شرح اقدامات اختتام و به‌روزرسانی اسناد")
    is_synthetic = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "moc_number"]),
        ]

    def __str__(self):
        return f"[{self.moc_number}] {self.title}"

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        now = timezone.now()
        if not self.moc_number:
            count = ChangeRequest.objects.filter(created_at__year=now.year).count() + 1
            self.moc_number = f"MOC-{now.year}-{count:04d}"

        if not self.traceability_chain_id:
            self.traceability_chain_id = f"TRC-{self.moc_number}"

        super().save(*args, **kwargs)

        if is_new:
            try:
                from apps.core.traceability import TraceabilityChain, TraceabilityNode
                chain, _ = TraceabilityChain.objects.get_or_create(
                    organization=self.organization,
                    tracking_code=self.traceability_chain_id,
                    defaults={
                        "title": f"زنجیره ردیابی مدیریت تغییرات: {self.title}",
                        "origin_module": "moc",
                        "origin_object_id": str(self.moc_number),
                    }
                )
                TraceabilityNode.objects.create(
                    chain=chain,
                    from_module="moc",
                    from_id=str(self.moc_number),
                    to_module="moc",
                    to_id=str(self.moc_number),
                    relation_type="direct",
                    description=f"ثبت درخواست تغییر {self.moc_number}",
                    actor=self.requested_by,
                )
            except Exception:
                pass
