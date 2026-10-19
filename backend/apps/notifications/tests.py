from datetime import timedelta
from io import StringIO
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.accounts.models import User
from apps.capa.models import CorrectiveAction
from apps.findings.models import NonConformity
from apps.notifications.models import Notification
from apps.notifications.services import check_deadline_notifications, notify_user
from apps.organizations.models import Membership, Organization


class NotificationTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="سازمان", code="org")
        self.user1 = User.objects.create_user(username="u1", password="Pass-12345-abc")
        self.user2 = User.objects.create_user(username="u2", password="Pass-12345-abc")
        Membership.objects.create(user=self.user1, organization=self.org, role=Membership.Roles.HSE_MANAGER)
        Membership.objects.create(user=self.user2, organization=self.org, role=Membership.Roles.ACTION_OWNER)
        Notification.objects.create(user=self.user1, organization=self.org, title="تست", message="پیام")

    def test_notifications_user_scoped(self):
        self.client.force_login(self.user1)
        res = self.client.get(reverse("notification-list"))
        self.assertEqual(len(res.json()), 1)

        self.client.force_login(self.user2)
        res = self.client.get(reverse("notification-list"))
        self.assertEqual(len(res.json()), 0)

    def test_mark_read_and_mark_all(self):
        self.client.force_login(self.user1)
        notif = Notification.objects.get(user=self.user1)
        res = self.client.post(reverse("notification-mark-read", args=[notif.pk]))
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["is_read"])

        # Create another unread
        Notification.objects.create(user=self.user1, organization=self.org, title="تست ۲", message="پیام ۲")
        res_all = self.client.post(reverse("notification-mark-all-read"))
        self.assertEqual(res_all.status_code, 200)
        self.assertFalse(Notification.objects.filter(user=self.user1, is_read=False).exists())

    def test_filter_unread(self):
        self.client.force_login(self.user1)
        Notification.objects.create(user=self.user1, organization=self.org, title="خوانده‌شده", message="م", is_read=True)
        res = self.client.get(reverse("notification-list"), {"unread": "true"})
        self.assertEqual(len(res.json()), 1)

    def test_check_deadline_notifications_and_deduplication(self):
        nc = NonConformity.objects.create(organization=self.org, description="مشکل")
        today = timezone.now().date()

        # Action 1: Overdue
        CorrectiveAction.objects.create(
            organization=self.org,
            non_conformity=nc,
            description="اقدام منقضی",
            responsible=self.user2,
            due_date=today - timedelta(days=1),
            status="open",
        )
        # Action 2: Approaching deadline (in 2 days)
        CorrectiveAction.objects.create(
            organization=self.org,
            non_conformity=nc,
            description="اقدام در حال انقضا",
            responsible=self.user2,
            due_date=today + timedelta(days=2),
            status="open",
        )

        # Run detection
        count = check_deadline_notifications()
        self.assertEqual(count, 2)
        self.assertEqual(Notification.objects.filter(user=self.user2).count(), 2)

        # Re-running immediately should NOT produce duplicates
        re_count = check_deadline_notifications()
        self.assertEqual(re_count, 0)
        self.assertEqual(Notification.objects.filter(user=self.user2).count(), 2)

    def test_check_deadlines_management_command(self):
        out = StringIO()
        call_command("check_deadlines", stdout=out)
        self.assertIn("Deadline notifications processed", out.getvalue())
