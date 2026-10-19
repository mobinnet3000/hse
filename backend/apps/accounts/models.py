from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class GlobalRoles(models.TextChoices):
        PLATFORM_ADMIN = "platform_admin", "مدیر پلتفرم"
        STANDARD = "standard", "کاربر عادی"

    global_role = models.CharField(
        max_length=32, choices=GlobalRoles.choices, default=GlobalRoles.STANDARD
    )

    @property
    def is_platform_admin(self):
        return self.global_role == self.GlobalRoles.PLATFORM_ADMIN

    def __str__(self):
        return self.get_full_name() or self.username
