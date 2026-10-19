from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.auditlog.models import AuditEvent
from apps.knowledge_base.models import KnowledgeSource
from apps.organizations.models import Membership, Organization


class KnowledgeBaseTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.platform_admin = User.objects.create_user(
            username="admin_user",
            email="admin@example.com",
            password="Password123!",
            global_role="platform_admin",
        )
        self.org_admin_user = User.objects.create_user(
            username="org_admin_user",
            email="orgadmin@example.com",
            password="Password123!",
        )
        self.viewer_user = User.objects.create_user(
            username="viewer_user",
            email="viewer@example.com",
            password="Password123!",
        )
        self.external_user = User.objects.create_user(
            username="external_user",
            email="ext@example.com",
            password="Password123!",
        )

        # Organizations
        self.org_a = Organization.objects.create(name="سازمان الف", code="ORG-A")
        self.org_b = Organization.objects.create(name="سازمان ب", code="ORG-B")

        # Memberships
        Membership.objects.create(
            user=self.org_admin_user,
            organization=self.org_a,
            role=Membership.Roles.ORG_ADMIN,
            is_active=True,
        )
        Membership.objects.create(
            user=self.viewer_user,
            organization=self.org_a,
            role=Membership.Roles.EXECUTIVE_VIEWER,
            is_active=True,
        )
        Membership.objects.create(
            user=self.external_user,
            organization=self.org_b,
            role=Membership.Roles.ORG_ADMIN,
            is_active=True,
        )

        # Sources
        self.global_source = KnowledgeSource.objects.create(
            code="GLOBAL-01",
            title="آیین‌نامه سراسری ایمنی",
            category=KnowledgeSource.Category.REGULATION,
            summary="خلاصه آیین‌نامه سراسری",
            content="مفاد آیین‌نامه سراسری ایمنی کارگاهی",
            tags="سراسری, ایمنی",
            organization=None,
        )
        self.org_a_source = KnowledgeSource.objects.create(
            code="SOP-A-01",
            title="دستورالعمل داخلی سازمان الف",
            category=KnowledgeSource.Category.INTERNAL_PROCEDURE,
            summary="دستورالعمل تردد در کارگاه",
            content="متن دستورالعمل تردد و استفاده از کارت تردد",
            tags="تردد, داخلی",
            organization=self.org_a,
        )
        self.org_b_source = KnowledgeSource.objects.create(
            code="SOP-B-01",
            title="دستورالعمل داخلی سازمان ب",
            category=KnowledgeSource.Category.INTERNAL_PROCEDURE,
            summary="دستورالعمل انبارداری ب",
            content="متن دستورالعمل انبار ب",
            organization=self.org_b,
        )

    def test_list_knowledge_sources_isolation(self):
        self.client.force_authenticate(user=self.viewer_user)
        res = self.client.get("/api/v1/knowledge-base/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", res.data)
        codes = [item["code"] for item in results]
        self.assertIn("GLOBAL-01", codes)
        self.assertIn("SOP-A-01", codes)
        self.assertNotIn("SOP-B-01", codes)

    def test_search_and_filter(self):
        self.client.force_authenticate(user=self.viewer_user)
        # Search
        res = self.client.get("/api/v1/knowledge-base/?search=تردد")
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["code"], "SOP-A-01")

        # Category filter
        res = self.client.get("/api/v1/knowledge-base/?category=regulation")
        results = res.data.get("results", res.data)
        codes = [item["code"] for item in results]
        self.assertIn("GLOBAL-01", codes)
        self.assertNotIn("SOP-A-01", codes)

    def test_create_global_source_permission(self):
        self.client.force_authenticate(user=self.org_admin_user)
        res = self.client.post(
            "/api/v1/knowledge-base/",
            {
                "title": "استاندارد ملی جدید",
                "code": "INSO-NEW-99",
                "category": "standard",
                "content": "متن استاندارد",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.platform_admin)
        res = self.client.post(
            "/api/v1/knowledge-base/",
            {
                "title": "استاندارد ملی جدید",
                "code": "INSO-NEW-99",
                "category": "standard",
                "content": "متن استاندارد سراسری",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(KnowledgeSource.objects.filter(code="INSO-NEW-99").exists())

    def test_create_org_source_and_audit_log(self):
        self.client.force_authenticate(user=self.org_admin_user)
        res = self.client.post(
            "/api/v1/knowledge-base/",
            {
                "organization": self.org_a.id,
                "title": "دستورالعمل جوشکاری",
                "code": "SOP-A-02",
                "category": "internal_procedure",
                "content": "الزامات ایمنی جوشکاری گاز و برق",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            AuditEvent.objects.filter(
                organization=self.org_a,
                action="knowledge_source.created",
                entity_type="KnowledgeSource",
            ).exists()
        )

    def test_duplicate_code_rejected(self):
        self.client.force_authenticate(user=self.org_admin_user)
        res = self.client.post(
            "/api/v1/knowledge-base/",
            {
                "organization": self.org_a.id,
                "title": "تکراری",
                "code": "SOP-A-01",  # already exists in org_a
                "category": "internal_procedure",
                "content": "متن",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        details = res.data.get("error", {}).get("details", res.data)
        self.assertIn("code", details)

    def test_meta_endpoint(self):
        self.client.force_authenticate(user=self.viewer_user)
        res = self.client.get("/api/v1/knowledge-base/meta/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("categories", res.data)
        self.assertIn("statuses", res.data)

    def test_seed_command(self):
        call_command("seed_knowledge_base")
        self.assertTrue(KnowledgeSource.objects.filter(code="IR-OHS-HEIGHT-89").exists())
        self.assertTrue(KnowledgeSource.objects.filter(code="INSO-ISO-45001-CL8").exists())
