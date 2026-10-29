import datetime
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.organizations.models import Membership, Organization
from apps.workplaces.models import Workplace
from .models import PSSRChecklistItem, PSSROutstandingAction, PSSRReview
from .services import PSSRSafetyError, approve_pssr_review, populate_default_checklist, reject_pssr_review

User = get_user_model()


class PSSRWorkflowTestCase(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="سازمان پالایشگاهی", is_active=True)
        self.workplace = Workplace.objects.create(name="واحد تفکیک میعانات", organization=self.org)
        self.leader = User.objects.create_user(username="pssr_lead", password="pwd")
        self.approver = User.objects.create_user(username="plant_manager", password="pwd")
        Membership.objects.create(user=self.leader, organization=self.org, role=Membership.Roles.WORKSHOP_SUPERVISOR)
        Membership.objects.create(user=self.approver, organization=self.org, role=Membership.Roles.WORKSHOP_SUPERVISOR)

        self.pssr = PSSRReview.objects.create(
            organization=self.org,
            workplace=self.workplace,
            pssr_number="PSSR-2026-UNIT-01",
            project_or_system_name="راه‌اندازی کمپرسور C-101",
            review_type=PSSRReview.ReviewType.NEW_INSTALLATION,
            target_startup_date=datetime.date.today(),
            leader=self.leader,
        )
        populate_default_checklist(self.pssr)

    def test_checklist_population(self):
        self.assertGreaterEqual(self.pssr.checklist_items.count(), 15)

    def test_approval_blocked_on_pending_critical_items(self):
        with self.assertRaises(PSSRSafetyError) as ctx:
            approve_pssr_review(self.pssr, self.approver)
        self.assertIn("بند حیاتی و بحرانی ایمنی", str(ctx.exception))

    def test_approval_blocked_on_open_pre_startup_actions(self):
        # Make all critical checklist items compliant
        self.pssr.checklist_items.filter(is_critical=True).update(
            verification_status=PSSRChecklistItem.VerificationStatus.COMPLIANT
        )

        # Create an open pre-startup action
        PSSROutstandingAction.objects.create(
            pssr=self.pssr,
            title="تعویض گسکت معیوب فلنج خروجی",
            description="نشتی جزئی در تست هیدرواستاتیک",
            target_date=datetime.date.today(),
            is_pre_startup=True,
            status=PSSROutstandingAction.ActionStatus.OPEN,
        )

        with self.assertRaises(PSSRSafetyError) as ctx:
            approve_pssr_review(self.pssr, self.approver)
        self.assertTrue("Pre-Startup" in str(ctx.exception) or "مسدود" in str(ctx.exception))

    def test_successful_approval(self):
        # Mark all critical items compliant
        self.pssr.checklist_items.filter(is_critical=True).update(
            verification_status=PSSRChecklistItem.VerificationStatus.COMPLIANT
        )
        # Add an action and resolve it
        action = PSSROutstandingAction.objects.create(
            pssr=self.pssr,
            title="تست آژیر اضطراری",
            description="بررسی صدای آژیر",
            target_date=datetime.date.today(),
            is_pre_startup=True,
            status=PSSROutstandingAction.ActionStatus.RESOLVED,
        )

        approved = approve_pssr_review(self.pssr, self.approver, signoff_notes="تاییدیه راه‌اندازی صادر شد.")
        self.assertEqual(approved.status, PSSRReview.Status.APPROVED)
        self.assertEqual(approved.approver, self.approver)
        self.assertIsNotNone(approved.actual_startup_date)

    def test_reject_requires_reason(self):
        with self.assertRaises(PSSRSafetyError):
            reject_pssr_review(self.pssr, self.approver, reason="")


class PSSRAPISecurityTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org1 = Organization.objects.create(name="سازمان اول", code="pssr-org-1", is_active=True)
        self.org2 = Organization.objects.create(name="سازمان دوم", code="pssr-org-2", is_active=True)
        self.workplace1 = Workplace.objects.create(name="کارگاه ۱", organization=self.org1)
        self.workplace2 = Workplace.objects.create(name="کارگاه ۲", organization=self.org2)

        self.user = User.objects.create_user(username="pssr_user", password="pwd")
        Membership.objects.create(user=self.user, organization=self.org1, role=Membership.Roles.WORKSHOP_SUPERVISOR)
        self.client.force_authenticate(user=self.user)

        self.pssr = PSSRReview.objects.create(
            organization=self.org1,
            workplace=self.workplace1,
            pssr_number="PSSR-SEC-01",
            project_or_system_name="تست امنیتی راه‌اندازی",
            review_type=PSSRReview.ReviewType.NEW_INSTALLATION,
            target_startup_date=datetime.date.today(),
            leader=self.user,
        )

    def test_cannot_bypass_approval_via_direct_patch(self):
        # Attempt to patch status directly to approved
        response = self.client.patch(
            f"/api/v1/pssr/reviews/{self.pssr.id}/",
            {"status": "approved", "project_or_system_name": "تغییر نام مجاز"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pssr.refresh_from_db()
        # Status must remain draft, not approved
        self.assertEqual(self.pssr.status, PSSRReview.Status.DRAFT)
        self.assertEqual(self.pssr.project_or_system_name, "تغییر نام مجاز")

    def test_foreign_workplace_rejected(self):
        # Attempt to create PSSR review with workplace from org2
        response = self.client.post(
            "/api/v1/pssr/reviews/",
            {
                "workplace": self.workplace2.id,
                "pssr_number": "PSSR-FOREIGN-01",
                "project_or_system_name": "سیستم خارجی",
                "review_type": "new_installation",
                "target_startup_date": str(datetime.date.today()),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("کارگاه", str(response.data))
