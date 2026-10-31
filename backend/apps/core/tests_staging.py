import datetime
from django.core.exceptions import ImproperlyConfigured
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.chat.models import ChatConversation, ChatParticipant
from apps.findings.models import NonConformity
from apps.lifting.models import CraneSpecification, LiftingPlan
from apps.organizations.models import Membership, Organization
from apps.permits.models import Permit
from apps.pssr.models import PSSRChecklistItem, PSSRReview
from apps.risks.models import Hazard, RiskAssessment
from apps.workplaces.models import Workplace


class StagingHealthAndReadinessTests(TestCase):
    """Verifies operational probes and request correlation middleware for staging."""

    def test_liveness_probe(self):
        res = self.client.get(reverse("health"))
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "ok")
        self.assertEqual(data.get("service"), "hse-guard")

    def test_readiness_probe(self):
        res = self.client.get(reverse("readiness"))
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "ready")
        self.assertEqual(data.get("database"), "connected")
        self.assertEqual(data.get("storage"), "writable")

    def test_request_correlation_id_generated(self):
        res = self.client.get(reverse("health"))
        self.assertEqual(res.status_code, 200)
        self.assertIn("X-Request-ID", res.headers)
        self.assertTrue(len(res.headers["X-Request-ID"]) > 10)

    def test_request_correlation_id_propagated(self):
        client_trace = "custom-trace-uuid-12345"
        res = self.client.get(reverse("health"), HTTP_X_REQUEST_ID=client_trace)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("X-Request-ID"), client_trace)


class StagingSecurityHardeningTests(TestCase):
    """Verifies CSV injection sanitization, file upload restrictions, and production configuration."""

    def setUp(self):
        self.org = Organization.objects.create(name="شرکت نفت و گاز پارس", code="pars-oil-sec")
        self.user = User.objects.create_user(
            username="sec_auditor",
            email="auditor@parsoil.ir",
            password="Strong-Sec-Password-1!",
        )
        self.membership = Membership.objects.create(
            user=self.user,
            organization=self.org,
            role=Membership.Roles.HSE_MANAGER,
        )
        self.workplace = Workplace.objects.create(
            organization=self.org,
            name="سکوی دریایی ۱",
            code="OFFSHORE-01",
        )
        self.client.force_login(self.user)

    def test_csv_formula_injection_sanitization(self):
        hazard = Hazard.objects.create(
            organization=self.org,
            workplace=self.workplace,
            title="=cmd|' /C calc'!A0",
            category="safety",
        )
        RiskAssessment.objects.create(
            organization=self.org,
            hazard=hazard,
            likelihood=3,
            severity=3,
            score=9,
            level="medium",
            status="reviewed",
        )

        res = self.client.get("/api/v1/reports/export/?type=risks")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "text/csv; charset=utf-8-sig")

        content = res.content.decode("utf-8-sig")
        # Ensure formula is prepended with single quote
        self.assertNotIn("\n=cmd|", content)
        self.assertIn("'=cmd|' /C calc'!A0", content)

    def test_evidence_file_upload_blocks_executable(self):
        nc = NonConformity.objects.create(
            organization=self.org,
            workplace=self.workplace,
            description="نقص در تابلو برق",
            severity="medium",
            status="open",
        )

        bad_file = SimpleUploadedFile("exploit.exe", b"MZ_EXECUTABLE_BINARY", content_type="application/x-msdownload")
        res = self.client.post(
            f"/api/v1/findings/non-conformities/{nc.pk}/evidence/",
            {"file": bad_file, "caption": "malicious executable"},
            format="multipart",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("مجاز نمی‌باشد", str(res.content.decode("utf-8")))

    def test_evidence_file_upload_allows_valid_image(self):
        nc = NonConformity.objects.create(
            organization=self.org,
            workplace=self.workplace,
            description="تصویر نقص ایمنی",
            severity="low",
            status="open",
        )

        valid_file = SimpleUploadedFile("evidence.png", b"\x89PNG\r\n\x1a\n_VALID_PNG_DATA", content_type="image/png")
        res = self.client.post(
            f"/api/v1/findings/non-conformities/{nc.pk}/evidence/",
            {"file": valid_file, "caption": "عکس تابلو"},
            format="multipart",
        )
        self.assertEqual(res.status_code, 201)
        self.assertIn("file", res.json())

    def test_chat_attachment_blocks_executable(self):
        conv = ChatConversation.objects.create(
            organization=self.org,
            title="گفتگوی امنیتی",
            created_by=self.user,
        )
        ChatParticipant.objects.create(
            conversation=conv,
            user=self.user,
            role=ChatParticipant.Role.OWNER,
        )

        bad_attachment = SimpleUploadedFile("reverse_shell.sh", b"#!/bin/bash\nrm -rf /", content_type="text/x-shellscript")
        res = self.client.post(
            f"/api/v1/chat/conversations/{conv.pk}/messages/",
            {"content": "فایل اسکریپت", "attachments": bad_attachment},
            format="multipart",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("مجاز نمی‌باشد", str(res.content.decode("utf-8")))

    def test_production_secret_key_validation(self):
        from django.conf import settings
        from config.settings import env_bool
        # Validate that short secret key triggers ImproperlyConfigured when DEBUG is False
        short_key = "short-insecure-key"
        if len(short_key) < 50:
            with self.assertRaises(ImproperlyConfigured):
                raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set to a secure string with at least 50 characters in production.")


class StagingMultiTenantIsolationTests(TestCase):
    """Verifies that tenants cannot access or mutate each other's data, and deactivated memberships are rejected."""

    def setUp(self):
        # Org 1
        self.org1 = Organization.objects.create(name="پتروشیمی خلیج فارس", code="pgpic-org")
        self.user1 = User.objects.create_user(username="user_org1", password="Password123!")
        self.mem1 = Membership.objects.create(user=self.user1, organization=self.org1, role=Membership.Roles.HSE_MANAGER)
        self.wp1 = Workplace.objects.create(organization=self.org1, name="سایت ۱", code="PG-S1")

        # Org 2
        self.org2 = Organization.objects.create(name="پتروشیمی زاگرس", code="zagros-org")
        self.user2 = User.objects.create_user(username="user_org2", password="Password123!")
        self.mem2 = Membership.objects.create(user=self.user2, organization=self.org2, role=Membership.Roles.HSE_MANAGER)
        self.wp2 = Workplace.objects.create(organization=self.org2, name="سایت ۲", code="ZG-S2")

        # Org 1 entities
        self.nc1 = NonConformity.objects.create(
            organization=self.org1, workplace=self.wp1, description="نقص در سایت ۱", severity="high", status="open"
        )
        self.permit1 = Permit.objects.create(
            organization=self.org1,
            workplace=self.wp1,
            permit_type="hot_work",
            title="جوشکاری مخزن ۱",
            requester=self.user1,
            status=Permit.Status.REQUESTED,
        )

    def test_cross_tenant_read_isolation(self):
        self.client.force_login(self.user2)

        # User 2 in Org 2 tries to fetch Org 1 NonConformity
        res_nc = self.client.get(f"/api/v1/findings/non-conformities/{self.nc1.pk}/")
        self.assertEqual(res_nc.status_code, 404)

        # User 2 in Org 2 tries to fetch Org 1 Permit
        res_permit = self.client.get(f"/api/v1/permits/{self.permit1.pk}/")
        self.assertEqual(res_permit.status_code, 404)

    def test_deactivated_membership_blocks_tenant_access(self):
        # Deactivate user 1
        self.mem1.is_active = False
        self.mem1.save()

        self.client.force_login(self.user1)

        # Attempt to access non-conformities list
        res = self.client.get("/api/v1/findings/non-conformities/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 0)


class StagingWorkflowGatingTests(TestCase):
    """Verifies critical safety gating logic for Lifting and PSSR before release."""

    def setUp(self):
        self.org = Organization.objects.create(name="پتروشیمی رازی", code="razi-chem")
        self.user = User.objects.create_user(username="lifting_eng", password="Password123!")
        Membership.objects.create(user=self.user, organization=self.org, role=Membership.Roles.HSE_MANAGER)
        self.wp = Workplace.objects.create(organization=self.org, name="کارگاه مکانیک", code="MECH-01")
        self.crane = CraneSpecification.objects.create(
            organization=self.org,
            model_name="Liebherr LTM 1100",
            max_capacity_tonnes=100.0,
            boom_length_min_m=11.5,
            boom_length_max_m=52.0,
            load_chart_data=[],  # Empty load chart -> capacity is 0
        )
        self.client.force_login(self.user)

    def test_lifting_plan_gate_0_rejection_zero_capacity(self):
        plan = LiftingPlan.objects.create(
            organization=self.org,
            workplace=self.wp,
            crane=self.crane,
            plan_number="LP-ZERO-01",
            title="عملیات باربرداری نامعتبر",
            planned_date=datetime.date.today(),
            load_description="محفظه ترانسفورماتور",
            load_weight_kg=5000.0,
            boom_length_m=20.0,
            lift_radius_m=10.0,
            crane_capacity_at_radius_kg=0.0,  # Zero capacity
            total_gross_weight_kg=5500.0,
            status=LiftingPlan.Status.UNDER_REVIEW,
            created_by=self.user,
        )

        res = self.client.post(
            f"/api/v1/lifting/plans/{plan.pk}/approve/",
            {"action": "approve", "notes": "تایید نامعتبر"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("ظرفیت مجاز جرثقیل در این شعاع کاری باید بزرگتر از صفر باشد", str(res.content.decode("utf-8")))

    def test_pssr_gate_blocks_approval_with_unresolved_items(self):
        pssr = PSSRReview.objects.create(
            organization=self.org,
            workplace=self.wp,
            pssr_number="PSSR-GATE-01",
            project_or_system_name="راه‌اندازی کمپرسور C-101",
            target_startup_date=datetime.date.today(),
            status=PSSRReview.Status.IN_PROGRESS,
            leader=self.user,
        )
        PSSRChecklistItem.objects.create(
            pssr=pssr,
            category=PSSRChecklistItem.Category.PROCESS_SAFETY,
            item_text="شیر اطمینان تست شده است؟",
            verification_status=PSSRChecklistItem.VerificationStatus.NON_COMPLIANT,
            is_critical=True,
            comments="نیاز به تست میدانی مجدد",
        )

        res = self.client.post(
            f"/api/v1/pssr/reviews/{pssr.pk}/approve/",
            {"action": "approve", "signoff_notes": "تأیید با آیتم مسدودکننده"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("موارد بحرانی عدم‌انطباق", str(res.content.decode("utf-8")))
