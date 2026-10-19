from datetime import timedelta
from django.utils import timezone
from .models import Notification


def notify_user(user, organization, title, message):
    """
    Creates an in-app notification for the user. Avoids duplicate unread notifications
    with identical content.
    """
    if not user or not organization:
        return None

    # De-duplicate: don't create duplicate identical unread notification
    existing = Notification.objects.filter(
        user=user,
        organization=organization,
        title=title,
        message=message,
        is_read=False,
    ).first()
    if existing:
        return existing

    return Notification.objects.create(
        user=user,
        organization=organization,
        title=title,
        message=message,
    )


def check_deadline_notifications():
    """
    Scans for corrective actions with upcoming (<= 3 days) or overdue deadlines
    and notifies responsible users without duplicate notifications.
    Returns the number of created notifications.
    """
    from apps.capa.models import CorrectiveAction

    today = timezone.now().date()
    upcoming_limit = today + timedelta(days=3)

    actions = (
        CorrectiveAction.objects.filter(
            status__in=[
                CorrectiveAction.Status.OPEN,
                CorrectiveAction.Status.IN_PROGRESS,
                CorrectiveAction.Status.PENDING_VERIFICATION,
            ],
            responsible__isnull=False,
            due_date__isnull=False,
        )
        .select_related("responsible", "organization")
    )

    created_count = 0

    for action in actions:
        # Case 1: Overdue
        if action.due_date < today:
            title = "سررسید گذشته اقدام اصلاحی"
            message = (
                f"مهلت اقدام اصلاحی شماره {action.id} "
                f"(«{action.description[:35]}») در تاریخ {action.due_date} به پایان رسیده است."
            )
            # Avoid duplicate for overdue within last 24 hours
            recent_notif = Notification.objects.filter(
                user=action.responsible,
                organization=action.organization,
                title=title,
                message=message,
                created_at__date=today,
            ).exists()
            if not recent_notif:
                notify_user(
                    user=action.responsible,
                    organization=action.organization,
                    title=title,
                    message=message,
                )
                created_count += 1

        # Case 2: Approaching deadline (within 3 days)
        elif today <= action.due_date <= upcoming_limit:
            title = "نزدیک‌شدن مهلت اقدام اصلاحی"
            message = (
                f"مهلت اقدام اصلاحی شماره {action.id} "
                f"(«{action.description[:35]}») در تاریخ {action.due_date} به پایان می‌رسد."
            )
            # Avoid sending duplicate upcoming notification
            exists = Notification.objects.filter(
                user=action.responsible,
                organization=action.organization,
                title=title,
                message=message,
            ).exists()
            if not exists:
                notify_user(
                    user=action.responsible,
                    organization=action.organization,
                    title=title,
                    message=message,
                )
                created_count += 1

    return created_count
