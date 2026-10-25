from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from apps.accounts.models import User
from apps.assets.models import CalibrationRecord, Equipment
from apps.capa.models import CorrectiveAction
from apps.checklists.models import Checklist
from apps.findings.models import NonConformity
from apps.inspections.models import Inspection
from apps.organizations.models import Membership, Organization
from apps.risks.models import Hazard, RiskAssessment
from apps.workplaces.models import Workplace


class ReportTests(TestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name="سازمان الف", code="org-a")
        self.org_b = Organization.objects.create(name="سازمان ب", code="org-b")
        self.user_a = User.objects.create_user(username="u1", password="Pass-12345-abc")
        self.user_b = User.objects.create_user(username="u2", password="Pass-12345-abc")
        Membership.objects.create(user=self.user_a, organization=self.org_a, role=Membership.Roles.HSE_MANAGER)
        Membership.objects.create(user=self.user_b, organization=self.org_b, role=Membership.Roles.HSE_MANAGER)

        self.wp = Workplace.objects.create(organization=self.org_a, name="کارگاه اصلی", code="wp-1")
        c = Checklist.objects.create(organization=self.org_a, title="چک‌لیست")
        Inspection.objects.create(
            organization=self.org_a, workplace=self.wp, checklist=c, title="بازرسی گزارش", status="completed"
        )
        h = Hazard.objects.create(organization=self.org_a, workplace=self.wp, title="خطر تست", category="safety")
        RiskAssessment.objects.create(
            organization=self.org_a, hazard=h, likelihood=3, severity=4, score=12, level="high"
        )
        nc = NonConformity.objects.create(
            organization=self.org_a, workplace=self.wp, description="عدم انطباق تست", severity="medium", status="open"
        )
        CorrectiveAction.objects.create(
            organization=self.org_a, non_conformity=nc, description="اقدام تست", status="open"
        )
        self.equipment = Equipment.objects.create(
            organization=self.org_a,
            workplace=self.wp,
            code="REPORT-EQ-001",
            name="تجهیز گزارش",
            category=Equipment.Category.GAS_DETECTION,
            status=Equipment.Status.READY,
            calibration_required=True,
        )
        CalibrationRecord.objects.create(
            organization=self.org_a,
            equipment=self.equipment,
            performed_on=self.equipment.created_at.date(),
            next_due_on=self.equipment.created_at.date() + timedelta(days=100),
            provider="آزمایشگاه گزارش",
            result=CalibrationRecord.Result.PASSED,
        )

    def test_csv_export_all_types(self):
        self.client.force_login(self.user_a)
        for r_type in ["inspections", "risks", "non-conformities", "corrective-actions", "assets"]:
            res = self.client.get(reverse("report-export", args=[r_type]))
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res["Content-Type"], "text/csv; charset=utf-8-sig")
            content = res.content.decode("utf-8-sig")
            self.assertIn("سازمان الف", content)
            if r_type == "assets":
                self.assertIn("REPORT-EQ-001", content)
                self.assertIn("معتبر", content)

    def test_csv_filter_by_workplace_and_status(self):
        self.client.force_login(self.user_a)
        res = self.client.get(reverse("report-export", args=["inspections"]), {"status": "completed", "workplace": self.wp.id})
        self.assertEqual(res.status_code, 200)
        self.assertIn("بازرسی گزارش", res.content.decode("utf-8-sig"))

        res_empty = self.client.get(reverse("report-export", args=["inspections"]), {"status": "draft"})
        self.assertEqual(res_empty.status_code, 200)
        self.assertNotIn("بازرسی گزارش", res_empty.content.decode("utf-8-sig"))

    def test_csv_multi_tenant_isolation(self):
        # User B cannot export Org A data
        self.client.force_login(self.user_b)
        res_forbidden = self.client.get(reverse("report-export", args=["inspections"]), {"organization": self.org_a.id})
        self.assertEqual(res_forbidden.status_code, 404)

        # User B default export has no Org A data
        res = self.client.get(reverse("report-export", args=["inspections"]))
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("سازمان الف", res.content.decode("utf-8-sig"))

        assets_forbidden = self.client.get(
            reverse("report-export", args=["assets"]), {"organization": self.org_a.id}
        )
        self.assertEqual(assets_forbidden.status_code, 404)
        assets_res = self.client.get(reverse("report-export", args=["assets"]))
        self.assertEqual(assets_res.status_code, 200)
        self.assertNotIn("REPORT-EQ-001", assets_res.content.decode("utf-8-sig"))

    def test_invalid_report_type(self):
        self.client.force_login(self.user_a)
        res = self.client.get(reverse("report-export", args=["unknown-report"]))
        self.assertEqual(res.status_code, 400)
