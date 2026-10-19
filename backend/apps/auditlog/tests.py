from django.test import TestCase
from django.urls import reverse
from apps.accounts.models import User
from apps.organizations.models import Membership, Organization
from apps.auditlog.models import AuditEvent
from apps.auditlog.services import log_event


class AuditLogTests(TestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name="سازمان الف", code="org-a")
        self.org_b = Organization.objects.create(name="سازمان ب", code="org-b")

        self.manager = User.objects.create_user(username="mgr", password="Pass-12345-abc")
        self.auditor = User.objects.create_user(username="auditor", password="Pass-12345-abc")
        self.standard = User.objects.create_user(username="std", password="Pass-12345-abc")
        self.platform_admin = User.objects.create_user(username="super", password="Pass-12345-abc", global_role="platform_admin")

        Membership.objects.create(user=self.manager, organization=self.org_a, role=Membership.Roles.HSE_MANAGER)
        Membership.objects.create(user=self.auditor, organization=self.org_a, role=Membership.Roles.READ_ONLY_AUDITOR)
        Membership.objects.create(user=self.standard, organization=self.org_a, role=Membership.Roles.ACTION_OWNER)

        log_event(
            organization=self.org_a,
            actor=self.manager,
            action="risk.create",
            entity_type="risk",
            entity_id=1,
            details={"title": "خطر ۱", "secret_key": "my-secret-token", "note": "تست"},
        )
        log_event(
            organization=self.org_b,
            actor=self.platform_admin,
            action="inspection.complete",
            entity_type="inspection",
            entity_id=2,
            details={"notes": "تکمیل شد"},
        )

    def test_audit_log_access(self):
        # Manager can view Org A logs
        self.client.force_login(self.manager)
        res = self.client.get(reverse("audit-event-list"))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 1)
        self.assertEqual(res.json()[0]["action"], "risk.create")

        # Auditor can view Org A logs
        self.client.force_login(self.auditor)
        res_auditor = self.client.get(reverse("audit-event-list"))
        self.assertEqual(res_auditor.status_code, 200)
        self.assertEqual(len(res_auditor.json()), 1)

        # Standard action owner cannot view logs (returns empty)
        self.client.force_login(self.standard)
        res_std = self.client.get(reverse("audit-event-list"))
        self.assertEqual(res_std.status_code, 200)
        self.assertEqual(len(res_std.json()), 0)

        # Platform admin can view all logs
        self.client.force_login(self.platform_admin)
        res_admin = self.client.get(reverse("audit-event-list"))
        self.assertEqual(res_admin.status_code, 200)
        self.assertEqual(len(res_admin.json()), 2)

    def test_audit_log_filters(self):
        self.client.force_login(self.manager)
        # Filter by matching action
        res = self.client.get(reverse("audit-event-list"), {"action": "risk.create"})
        self.assertEqual(len(res.json()), 1)

        # Filter by non-matching action
        res_none = self.client.get(reverse("audit-event-list"), {"action": "other.action"})
        self.assertEqual(len(res_none.json()), 0)

    def test_audit_log_pagination(self):
        self.client.force_login(self.manager)
        res = self.client.get(reverse("audit-event-list"), {"page": 1})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("count", data)
        self.assertIn("results", data)
        self.assertEqual(data["count"], 1)

    def test_audit_log_sensitive_data_scrubbed(self):
        self.client.force_login(self.manager)
        res = self.client.get(reverse("audit-event-list"))
        self.assertEqual(res.status_code, 200)
        details = res.json()[0]["details"]
        self.assertEqual(details["secret_key"], "******")
        self.assertEqual(details["title"], "خطر ۱")
