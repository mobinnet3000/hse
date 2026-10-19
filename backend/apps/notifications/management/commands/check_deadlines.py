from django.core.management.base import BaseCommand
from apps.notifications.services import check_deadline_notifications


class Command(BaseCommand):
    help = "Check approaching and overdue deadlines for corrective actions and emit notifications"

    def handle(self, *args, **options):
        count = check_deadline_notifications()
        self.stdout.write(self.style.SUCCESS(f"Deadline notifications processed: {count} notification(s) created."))
