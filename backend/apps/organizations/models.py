import datetime
from django.db import models
from django.utils import timezone


class Organization(models.Model):
    name = models.CharField(max_length=200)
    code = models.SlugField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Membership(models.Model):
    class Roles(models.TextChoices):
        ORG_ADMIN = "org_admin", "مدیر سازمان"
        HSE_MANAGER = "hse_manager", "مدیر HSE"
        HSE_INSPECTOR = "hse_inspector", "بازرس HSE"
        WORKSHOP_SUPERVISOR = "workshop_supervisor", "سرپرست کارگاه"
        ACTION_OWNER = "action_owner", "مسئول اقدام"
        EXECUTIVE_VIEWER = "executive_viewer", "بازدیدکننده مدیریتی"
        READ_ONLY_AUDITOR = "read_only_auditor", "حسابرس خواندنی"

    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="memberships"
    )
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=32, choices=Roles.choices)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "organization"], name="unique_user_organization"
            )
        ]
        ordering = ["organization__name", "user__username"]

    def __str__(self):
        return f"{self.user} @ {self.organization} ({self.get_role_display()})"


class SubscriptionPlan(models.Model):
    name = models.CharField(max_length=150)
    code = models.SlugField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    price_monthly_irr = models.FloatField(default=0.0)
    max_users = models.PositiveIntegerField(default=10)
    max_workplaces = models.PositiveIntegerField(default=3)
    included_modules = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["price_monthly_irr"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class OrganizationSubscription(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "فعال"
        TRIAL = "trial", "دوره آزمایشی"
        EXPIRED = "expired", "منقضی‌شده"
        SUSPENDED = "suspended", "معلق‌شده"

    organization = models.OneToOneField(
        Organization, on_delete=models.CASCADE, related_name="subscription"
    )
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TRIAL)
    valid_from = models.DateField(default=timezone.now)
    valid_until = models.DateField()
    auto_renew = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def is_valid_period(self) -> bool:
        today = timezone.now().date()
        return self.valid_from <= today <= self.valid_until and self.status in [
            self.Status.ACTIVE,
            self.Status.TRIAL,
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.plan.name} ({self.get_status_display()})"


class ModuleEntitlement(models.Model):
    ALWAYS_FREE_MODULES = {
        "dashboard",
        "accounts",
        "workplaces",
        "knowledge",
        "notifications",
        "auditlog",
        "calculators",
    }

    COMMERCIAL_MODULES = {
        "permits": "مجوزهای کار و تحویل شیفت (PTW)",
        "scaffolds": "مدیریت داربست‌ها و کار در ارتفاع",
        "risks_advanced": "مدیریت پیشرفته ریسک، BowTie و HCMS",
        "environment": "مدیریت محیط زیست، پساب و بهداشت حرفه‌ای",
        "documents": "کنترل مدارک، نسخه‌بندی و آرشیو امن",
        "workforce_advanced": "شایستگی‌ها، پیمانکاران و حضور و غیاب",
        "lifting_plans": "طراحی و شبیه‌سازی طرح باربرداری و ریگینگ",
        "pssr": "بازبینی ایمنی پیش از راه‌اندازی (PSSR)",
        "surveys": "نظرسنجی‌ها، جو ایمنی و آزمون‌های تخصصی",
        "chat": "پیام‌رسان داخلی و گفت‌وگوی تیمی",
        "anomalies": "مدیریت جامع ناهنجاری‌ها و مشاهدات ایمنی",
        "indicators": "موتور شاخص‌های پیشگیرانه و پیشرو HSE",
        "fleet_energy": "پایش انرژی، سوخت ناوگان و گودبرداری",
    }

    class Source(models.TextChoices):
        PLAN = "plan", "مبتنی بر پلن اشتراک"
        ADDON = "addon", "ماژول افزونه اختصاصی"
        TRIAL = "trial", "فعال‌سازی موقت آزمایشی"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="entitlements"
    )
    module_code = models.CharField(max_length=50)
    is_enabled = models.BooleanField(default=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.PLAN)
    valid_until = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("organization", "module_code")]

    def is_currently_entitled(self) -> bool:
        if not self.is_enabled:
            return False
        if self.valid_until and timezone.now().date() > self.valid_until:
            return False
        return True

    def __str__(self):
        return f"{self.organization.name} -> {self.module_code} ({'فعال' if self.is_enabled else 'غیرفعال'})"


class SubscriptionPaymentRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "در انتظار بررسی مالی"
        VERIFIED = "verified", "تایید و فعال‌سازی شد"
        REJECTED = "rejected", "رد شده"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="payment_requests")
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    amount_irr = models.FloatField()
    payment_reference = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    submitted_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="submitted_payments"
    )
    verified_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="verified_payments"
    )
    verification_notes = models.TextField(blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


def check_module_entitlement(organization: Organization, module_code: str) -> bool:
    """Checks whether an organization is authorized to access a given module."""
    if module_code in ModuleEntitlement.ALWAYS_FREE_MODULES:
        return True

    # Check direct entitlement override
    entitlement = ModuleEntitlement.objects.filter(
        organization=organization, module_code=module_code
    ).first()
    if entitlement:
        return entitlement.is_currently_entitled()

    # Check subscription plan
    sub = getattr(organization, "subscription", None)
    if sub and sub.is_valid_period():
        if module_code in sub.plan.included_modules or "all" in sub.plan.included_modules:
            return True

    return False
