from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.auditlog.models import AuditEvent
from apps.checklists.models import Checklist
from apps.knowledge_base.models import KnowledgeSource
from apps.organizations.models import Membership, Organization
from apps.risks.models import Hazard
from apps.workplaces.models import Workplace


class AiAssistantTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.org_admin = User.objects.create_user(
            username="org_admin", email="admin@example.com", password="Password123!"
        )
        self.viewer = User.objects.create_user(
            username="viewer", email="viewer@example.com", password="Password123!"
        )
        self.stranger = User.objects.create_user(
            username="stranger", email="stranger@example.com", password="Password123!"
        )

        # Organization & Workplace
        self.org = Organization.objects.create(name="مجتمع صنعتی فولاد", code="STEEL-01")
        self.workplace = Workplace.objects.create(
            organization=self.org, name="کارگاه اسکلت فلزی"
        )

        # Memberships
        Membership.objects.create(
            user=self.org_admin,
            organization=self.org,
            role=Membership.Roles.ORG_ADMIN,
            is_active=True,
        )
        Membership.objects.create(
            user=self.viewer,
            organization=self.org,
            role=Membership.Roles.EXECUTIVE_VIEWER,
            is_active=True,
        )

        # Seed some knowledge sources
        KnowledgeSource.objects.create(
            code="IR-OHS-HEIGHT-89",
            title="آیین‌نامه ایمنی کار در ارتفاع",
            category=KnowledgeSource.Category.REGULATION,
            summary="الزامات کار در ارتفاع و داربست",
            content="مفاد الزامات ایمنی کار در ارتفاع و کمربند ایمنی",
            tags="ارتفاع, داربست, سقوط",
            is_verified=True,
            status=KnowledgeSource.Status.ACTIVE,
        )
        KnowledgeSource.objects.create(
            code="IR-OHS-ELEC-86",
            title="آیین‌نامه ایمنی تأسیسات الکتریکی",
            category=KnowledgeSource.Category.REGULATION,
            summary="الزامات چاه ارت و کلید محافظ جان",
            content="مفاد سیستم زمین و LOTO",
            tags="برق, ارت, کابل",
            is_verified=True,
            status=KnowledgeSource.Status.ACTIVE,
        )

    def test_get_ai_status(self):
        self.client.force_authenticate(user=self.org_admin)
        res = self.client.get(f"/api/v1/ai/status/?organization_id={self.org.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("active_engine", res.data)
        self.assertGreaterEqual(res.data["verified_regulations_count"], 2)

    def test_analyze_workplace_forbidden_for_non_member(self):
        self.client.force_authenticate(user=self.stranger)
        res = self.client.post(
            "/api/v1/ai/analyze-workplace/",
            {
                "organization_id": self.org.id,
                "activity_description": "کار روی داربست و جوشکاری اسکلت",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_analyze_workplace_generates_grounded_hazards(self):
        self.client.force_authenticate(user=self.org_admin)
        res = self.client.post(
            "/api/v1/ai/analyze-workplace/",
            {
                "organization_id": self.org.id,
                "workplace_id": self.workplace.id,
                "activity_description": "نصب تیرآهن در ارتفاع روی داربست و کابل‌کشی موقت برق",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertTrue(data.get("is_ai_generated"))
        self.assertIn("hazards", data)
        self.assertGreater(len(data["hazards"]), 0)

        # Audit event recorded
        self.assertTrue(
            AuditEvent.objects.filter(
                organization=self.org,
                action="ai.analyze_workplace",
                actor=self.org_admin,
            ).exists()
        )

    def test_suggest_checklist(self):
        self.client.force_authenticate(user=self.org_admin)
        res = self.client.post(
            "/api/v1/ai/suggest-checklist/",
            {
                "organization_id": self.org.id,
                "focus_area": "کار در ارتفاع و داربست",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("items", res.data)
        self.assertGreaterEqual(len(res.data["items"]), 3)
        self.assertIn("citation", res.data["items"][0])

    def test_suggest_hierarchy_of_controls(self):
        self.client.force_authenticate(user=self.viewer)
        res = self.client.post(
            "/api/v1/ai/suggest-controls/",
            {
                "organization_id": self.org.id,
                "hazard_title": "سقوط از ارتفاع روی داربست لوله‌ای",
                "category": "safety",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("hierarchy", res.data)
        self.assertEqual(len(res.data["hierarchy"]), 5)  # 5 tiers of hierarchy
        self.assertEqual(res.data["hierarchy"][0]["level"], "elimination")

    def test_apply_hazard_and_permissions(self):
        # Viewer cannot create hazards
        self.client.force_authenticate(user=self.viewer)
        res = self.client.post(
            "/api/v1/ai/apply-hazard/",
            {
                "organization_id": self.org.id,
                "workplace_id": self.workplace.id,
                "title": "سقوط از ارتفاع",
                "category": "safety",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Org admin can create hazard
        self.client.force_authenticate(user=self.org_admin)
        res = self.client.post(
            "/api/v1/ai/apply-hazard/",
            {
                "organization_id": self.org.id,
                "workplace_id": self.workplace.id,
                "title": "سقوط از ارتفاع به دلیل نقص لایف‌لاین",
                "category": "safety",
                "causes": "عدم بستن لنیارد",
                "consequences": "شکستگی اندام",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        hazard_id = res.data["id"]
        self.assertTrue(Hazard.objects.filter(id=hazard_id, status=Hazard.Status.DRAFT).exists())

    def test_apply_checklist(self):
        self.client.force_authenticate(user=self.org_admin)
        res = self.client.post(
            "/api/v1/ai/apply-checklist/",
            {
                "organization_id": self.org.id,
                "title": "چک‌لیست داربست تاییدشده",
                "description": "تولیدشده با هوش مصنوعی و تاییدشده توسط سرپرست",
                "items": [
                    {"order": 1, "text": "بررسی تگ سبز داربست", "is_required": True},
                    {"order": 2, "text": "بررسی محکم‌بودن پایه‌ها", "is_required": True},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        checklist_id = res.data["id"]
        chk = Checklist.objects.get(id=checklist_id)
        self.assertEqual(chk.items.count(), 2)
