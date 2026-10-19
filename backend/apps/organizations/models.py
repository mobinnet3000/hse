from django.db import models


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
