from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (("نقش سراسری", {"fields": ("global_role",)}),)
    list_display = ("username", "email", "global_role", "is_active", "is_staff")
