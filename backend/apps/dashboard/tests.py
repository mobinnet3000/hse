from datetime import timedelta
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.accounts.models import User
from apps.capa.models import CorrectiveAction
from apps.checklists.models import Checklist
from apps.findings.models import NonConformity
from apps.inspections.models import Inspection
from apps.organizations.models import Membership, Organization
from apps.risks.models import Hazard, RiskAssessment


class DashboardTests(TestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name="سازمان الف", code="org-a")
        self.org_b = Organization.objects.create(name="سازمان ب", code="org-b")
        self.user_a = User.objects.create_user(username="usera", password="Pass-12345-abc")
        self.user_b = User.objects.create_user(username="userb", password="Pass-12345-abc")
        Membership.objects.create(user=self.user_a, organization=self.org_a, role=Membership.Roles.HSE_MANAGER)
        Membership.objects.create(user=self.user_b, organization=self.org_b, role=Membership.Roles.HSE_MANAGER)

        c = Checklist.objects.create(organization=self.org_a, title="چک‌لیست")
        Inspection.objects.create(organization=self.org_a, checklist=c, title="بازرسی ۱", status="completed")

        # Hazards and assessments in Org A
        h = Hazard.objects.create(organization=self.org_a, title="خطر تست", category="safety")
        RiskAssessment.objects.create(
            hazard=h,
            organization=self.org_a,
            likelihood=4,
            severity=5,
            score=20,
            level="critical",
            status="approved",
        )

        # NC and Actions in Org A
        nc = NonConformity.objects.create(
            organization=self.org_a,
            description="عدم انطباق تست",
            severity="high",
            status="open",
        )
        today = timezone.now().date()
        # Overdue action
        CorrectiveAction.objects.create(
            organization=self.org_a,
            non_conformity=nc,
            description="اقدام عقب‌افتاده",
            responsible=self.user_a,
            due_date=today - timedelta(days=2),
            status="open",
        )
        # Upcoming action
        CorrectiveAction.objects.create(
            organization=self.org_a,
            non_conformity=nc,
            description="اقدام دارای مهلت",
            responsible=self.user_a,
            due_date=today + timedelta(days=2),
            status="in_progress",
        )

    def test_metrics_scoped_to_organization(self):
        self.client.force_login(self.user_a)
        res = self.client.get(reverse("dashboard-metrics"))
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["inspections"]["completed"], 1)
        self.assertEqual(data["risks"]["critical"], 1)
        self.assertEqual(data["non_conformities"]["open"], 1)
        self.assertEqual(data["corrective_actions"]["open"], 2)
        self.assertEqual(data["corrective_actions"]["overdue"], 1)
        self.assertEqual(len(data["urgent_deadlines"]["actions"]), 2)

        self.client.force_login(self.user_b)
        res = self.client.get(reverse("dashboard-metrics"))
        self.assertEqual(res.status_code, 200)
        b_data = res.json()
        self.assertEqual(b_data["inspections"]["completed"], 0)
        self.assertEqual(b_data["risks"]["critical"], 0)
        self.assertEqual(b_data["non_conformities"]["open"], 0)
        self.assertEqual(b_data["corrective_actions"]["total"], 0)

    def test_metrics_filter_by_organization_and_unauthorized(self):
        self.client.force_login(self.user_a)
        # Accessible org
        res = self.client.get(reverse("dashboard-metrics"), {"organization": self.org_a.id})
        self.assertEqual(res.status_code, 200)
        # Inaccessible org
        res_forbidden = self.client.get(reverse("dashboard-metrics"), {"organization": self.org_b.id})
        self.assertEqual(res_forbidden.status_code, 404)

    def test_proactive_indicators_api(self):
        self.client.force_login(self.user_a)
        res = self.client.get("/api/v1/dashboard/indicators/", {"organization": self.org_a.id, "days": 30})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("indicators", data)
        self.assertIn("summary", data)
        self.assertEqual(data["organization_id"], self.org_a.id)
        self.assertGreater(len(data["indicators"]), 0)

        # Cross-organization isolation
        res_other = self.client.get("/api/v1/dashboard/indicators/", {"organization": self.org_b.id})
        self.assertEqual(res_other.status_code, 404)

    def test_personal_workspace_api(self):
        self.client.force_login(self.user_a)
        res = self.client.get("/api/v1/dashboard/workspace/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("pending_approvals", data)
        self.assertIn("my_tasks", data)
        self.assertIn("unread_counts", data)
        self.assertEqual(data["user"]["id"], self.user_a.id)
