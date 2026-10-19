from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.organizations.models import Membership, Organization
from apps.risks.models import Hazard, RiskAssessment
from apps.risks.risk import calculate_risk_score, evaluate_risk, risk_level_for_score
from apps.workplaces.models import Workplace


class RiskCalculationTests(TestCase):
    def test_formula(self):
        self.assertEqual(calculate_risk_score(1, 1), 1)
        self.assertEqual(calculate_risk_score(5, 5), 25)
        self.assertEqual(calculate_risk_score(3, 4), 12)

    def test_level_thresholds(self):
        self.assertEqual(risk_level_for_score(1)[0], "low")
        self.assertEqual(risk_level_for_score(4)[0], "low")
        self.assertEqual(risk_level_for_score(5)[0], "medium")
        self.assertEqual(risk_level_for_score(9)[0], "medium")
        self.assertEqual(risk_level_for_score(10)[0], "high")
        self.assertEqual(risk_level_for_score(14)[0], "high")
        self.assertEqual(risk_level_for_score(15)[0], "critical")
        self.assertEqual(risk_level_for_score(25)[0], "critical")

    def test_boundaries_valid(self):
        self.assertEqual(evaluate_risk(1, 5)[0], 5)
        self.assertEqual(evaluate_risk(5, 1)[0], 5)

    def test_invalid_values_rejected(self):
        for likelihood, severity in [(0, 3), (6, 3), (3, 0), (3, 6), (-1, 3)]:
            with self.assertRaises(ValueError):
                calculate_risk_score(likelihood, severity)

    def test_non_integer_rejected(self):
        with self.assertRaises(ValueError):
            calculate_risk_score(2.5, 3)
        with self.assertRaises(ValueError):
            calculate_risk_score("3", 3)


class RiskApiBase(TestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name="سازمان الف", code="org-a")
        self.org_b = Organization.objects.create(name="سازمان ب", code="org-b")
        self.workplace_a = Workplace.objects.create(
            organization=self.org_a, name="کارگاه الف", code="wa"
        )
        self.workplace_b = Workplace.objects.create(
            organization=self.org_b, name="کارگاه ب", code="wb"
        )
        self.manager = User.objects.create_user(username="manager", password="Pass-12345-abc")
        self.inspector = User.objects.create_user(username="inspector", password="Pass-12345-abc")
        self.auditor = User.objects.create_user(username="auditor", password="Pass-12345-abc")
        self.outsider = User.objects.create_user(username="outsider", password="Pass-12345-abc")
        Membership.objects.create(
            user=self.manager, organization=self.org_a, role=Membership.Roles.HSE_MANAGER
        )
        Membership.objects.create(
            user=self.inspector, organization=self.org_a, role=Membership.Roles.HSE_INSPECTOR
        )
        Membership.objects.create(
            user=self.auditor, organization=self.org_a, role=Membership.Roles.READ_ONLY_AUDITOR
        )
        Membership.objects.create(
            user=self.outsider, organization=self.org_b, role=Membership.Roles.HSE_MANAGER
        )
        self.hazard_a = Hazard.objects.create(
            organization=self.org_a,
            workplace=self.workplace_a,
            title="سقوط از ارتفاع",
            category=Hazard.Category.SAFETY,
        )
        self.hazard_b = Hazard.objects.create(
            organization=self.org_b,
            title="نشت مواد شیمیایی",
            category=Hazard.Category.CHEMICAL,
        )


class HazardApiTests(RiskApiBase):
    def test_unauthenticated_denied(self):
        self.assertEqual(self.client.get(reverse("hazard-list")).status_code, 403)

    def test_list_scoped_to_membership(self):
        self.client.force_login(self.inspector)
        response = self.client.get(reverse("hazard-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual([h["title"] for h in response.json()], ["سقوط از ارتفاع"])

    def test_cannot_read_other_org_hazard(self):
        self.client.force_login(self.inspector)
        response = self.client.get(reverse("hazard-detail", args=[self.hazard_b.pk]))
        self.assertEqual(response.status_code, 404)

    def test_inactive_membership_denied(self):
        Membership.objects.filter(user=self.inspector).update(is_active=False)
        self.client.force_login(self.inspector)
        self.assertEqual(self.client.get(reverse("hazard-list")).json(), [])
        self.assertEqual(
            self.client.get(reverse("hazard-detail", args=[self.hazard_a.pk])).status_code,
            404,
        )

    def test_inspector_can_create_hazard(self):
        self.client.force_login(self.inspector)
        response = self.client.post(
            reverse("hazard-list"),
            {
                "organization": self.org_a.pk,
                "workplace": self.workplace_a.pk,
                "title": "خطر جدید",
                "category": Hazard.Category.PHYSICAL,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["organization"], self.org_a.pk)
        self.assertTrue(
            Hazard.objects.filter(title="خطر جدید", created_by=self.inspector).exists()
        )

    def test_auditor_cannot_create_hazard(self):
        self.client.force_login(self.auditor)
        response = self.client.post(
            reverse("hazard-list"),
            {
                "organization": self.org_a.pk,
                "title": "نفوذ",
                "category": Hazard.Category.SAFETY,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_cannot_create_hazard_in_other_org(self):
        self.client.force_login(self.inspector)
        response = self.client.post(
            reverse("hazard-list"),
            {
                "organization": self.org_b.pk,
                "title": "نفوذ",
                "category": Hazard.Category.SAFETY,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_cannot_attach_workplace_from_other_org(self):
        self.client.force_login(self.inspector)
        response = self.client.post(
            reverse("hazard-list"),
            {
                "organization": self.org_a.pk,
                "workplace": self.workplace_b.pk,
                "title": "خطر",
                "category": Hazard.Category.SAFETY,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_organization_cannot_be_changed_on_update(self):
        self.client.force_login(self.inspector)
        response = self.client.patch(
            reverse("hazard-detail", args=[self.hazard_a.pk]),
            {"organization": self.org_b.pk, "title": "عنوان جدید"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.hazard_a.refresh_from_db()
        self.assertEqual(self.hazard_a.organization_id, self.org_a.pk)
        self.assertEqual(self.hazard_a.title, "عنوان جدید")

    def test_auditor_cannot_update_hazard(self):
        self.client.force_login(self.auditor)
        response = self.client.patch(
            reverse("hazard-detail", args=[self.hazard_a.pk]),
            {"title": "نفوذ"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_invalid_category_rejected(self):
        self.client.force_login(self.inspector)
        response = self.client.post(
            reverse("hazard-list"),
            {
                "organization": self.org_a.pk,
                "title": "خطر",
                "category": "not-a-category",
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_filters(self):
        Hazard.objects.create(
            organization=self.org_a,
            title="خطر شیمیایی",
            category=Hazard.Category.CHEMICAL,
        )
        self.client.force_login(self.inspector)
        response = self.client.get(reverse("hazard-list"), {"category": "chemical"})
        self.assertEqual([h["title"] for h in response.json()], ["خطر شیمیایی"])


class AssessmentApiTests(RiskApiBase):
    def test_create_computes_score_and_level_server_side(self):
        self.client.force_login(self.inspector)
        response = self.client.post(
            reverse("assessment-list"),
            {
                "organization": self.org_a.pk,
                "hazard": self.hazard_a.pk,
                "likelihood": 4,
                "severity": 5,
                "score": 1,
                "level": "low",
                "proposed_controls": "نرده حفاظتی",
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["score"], 20)
        self.assertEqual(body["level"], "critical")
        self.assertIsNotNone(body["assessed_at"])

    def test_update_recalculates_score(self):
        assessment = RiskAssessment.objects.create(
            organization=self.org_a,
            hazard=self.hazard_a,
            likelihood=2,
            severity=2,
            score=4,
            level="low",
        )
        self.client.force_login(self.inspector)
        response = self.client.patch(
            reverse("assessment-detail", args=[assessment.pk]),
            {"likelihood": 5},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["score"], 10)
        self.assertEqual(response.json()["level"], "high")
        assessment.refresh_from_db()
        self.assertEqual(assessment.score, 10)

    def test_invalid_range_rejected(self):
        self.client.force_login(self.inspector)
        for payload in ({"likelihood": 0}, {"severity": 6}):
            response = self.client.post(
                reverse("assessment-list"),
                {
                    "organization": self.org_a.pk,
                    "hazard": self.hazard_a.pk,
                    "likelihood": 3,
                    "severity": 3,
                    **payload,
                },
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 400)

    def test_cannot_assess_hazard_of_other_org(self):
        self.client.force_login(self.inspector)
        response = self.client.post(
            reverse("assessment-list"),
            {
                "organization": self.org_a.pk,
                "hazard": self.hazard_b.pk,
                "likelihood": 3,
                "severity": 3,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_cannot_read_other_org_assessment(self):
        assessment = RiskAssessment.objects.create(
            organization=self.org_b,
            hazard=self.hazard_b,
            likelihood=3,
            severity=3,
            score=9,
            level="medium",
        )
        self.client.force_login(self.inspector)
        response = self.client.get(reverse("assessment-detail", args=[assessment.pk]))
        self.assertEqual(response.status_code, 404)

    def test_auditor_cannot_create_assessment(self):
        self.client.force_login(self.auditor)
        response = self.client.post(
            reverse("assessment-list"),
            {
                "organization": self.org_a.pk,
                "hazard": self.hazard_a.pk,
                "likelihood": 3,
                "severity": 3,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_inspector_cannot_approve_assessment(self):
        assessment = RiskAssessment.objects.create(
            organization=self.org_a,
            hazard=self.hazard_a,
            likelihood=3,
            severity=3,
            score=9,
            level="medium",
        )
        self.client.force_login(self.inspector)
        response = self.client.patch(
            reverse("assessment-detail", args=[assessment.pk]),
            {"status": "approved"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_manager_can_approve_assessment(self):
        assessment = RiskAssessment.objects.create(
            organization=self.org_a,
            hazard=self.hazard_a,
            likelihood=3,
            severity=3,
            score=9,
            level="medium",
        )
        self.client.force_login(self.manager)
        response = self.client.patch(
            reverse("assessment-detail", args=[assessment.pk]),
            {"status": "approved"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "approved")

    def test_inactive_membership_denied(self):
        Membership.objects.filter(user=self.inspector).update(is_active=False)
        self.client.force_login(self.inspector)
        self.assertEqual(self.client.get(reverse("assessment-list")).json(), [])
