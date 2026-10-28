from rest_framework.permissions import BasePermission
from apps.organizations.models import Membership


class TenantRequiredPermission(BasePermission):
    """
    Ensures that the authenticated user belongs to at least one active organization
    or has administrative privileges (staff/superuser).
    """
    message = "دسترسی به این بخش نیازمند عضویت در حداقل یک سازمان فعال است."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        return Membership.objects.filter(user=request.user, is_active=True).exists()
