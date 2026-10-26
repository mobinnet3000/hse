from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.findings.models import NonConformity
from apps.organizations.models import Membership, Organization
from apps.permits.models import Permit
from apps.permits.services import check_permit_gatekeeper_prerequisites
from apps.workforce.models import ContractorCompany
from apps.workplaces.models import Workplace

from .models import Scaffold, ScaffoldInspection, ScaffoldTagLog
from .services import (
    change_scaffold_tag,
    record_scaffold_inspection,
    validate_scaffold_for_permit,
)


class ScaffoldTestBase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = date.today()

        # Org A
        self.org_a = Organization.objects.create(name="مجتمع فولاد البرز", code="foolad-alborz")
        self.wp_a = Workplace.objects.create(organization=self.org_a, name="سوله نورد", code="WP-ROLL")
        self.user_a = User.objects.create_user(
            username="scf_inspector_a", email="scf_a@test.com", password="Pass123456_test"
        )
        Membership.objects.create(
            user=self.user_a,
            organization=self.org_a,
            role=Membership.Roles.HSE_MANAGER,
            is_active=True,
        )

        # Org B
        self.org_b = Organization.objects.create(name="پتروشیمی سپهر", code="petro-sepehr")
        self.wp_b = Workplace.objects.create(organization=self.org_b, name="محوطه مخازن", code="WP-SPH")
        self.user_b = User.objects.create_user(
            username="scf_inspector_b", email="scf_b@test.com", password="Pass123456_test"
        )
        Membership.objects.create(
            user=self.user_b,
            organization=self.org_b,
            role=Membership.Roles.HSE_MANAGER,
            is_active=True,
        )

        # Contractor
        self.contractor_a = ContractorCompany.objects.create(
            organization=self.org_a,
            name="پایدار سازه البرز",
            registration_no="REG-7701",
        )

        # Base Scaffold in Org A
        self.scaffold_a = Scaffold.objects.create(
            organization=self.org_a,
            workplace=self.wp_a,
            tag_number="SCF-FA-001",
            scaffold_type=Scaffold.ScaffoldType.MODULAR_SYSTEM,
            load_duty=Scaffold.LoadDuty.MEDIUM_DUTY,
            location_details="دیواره شرقی کوره نورد",
            height_meters=Decimal("6.50"),
            length_meters=Decimal("8.00"),
            width_meters=Decimal("1.80"),
            contractor=self.contractor_a,
            erection_date=self.today - timedelta(days=10),
            intended_use="جوشکاری و نصب داکت‌های مکنده دود",
            tag_status=Scaffold.TagStatus.RED_UNSAFE,
        )


class ScaffoldLifecycleAndInspectionTests(ScaffoldTestBase):
    def test_inspection_green_tag_success(self):
        # Initial status is red
        self.assertEqual(self.scaffold_a.tag_status, Scaffold.TagStatus.RED_UNSAFE)
        self.assertFalse(self.scaffold_a.is_usable_for_work)

        # Conduct inspection with all checkpoints passed
        inspection = record_scaffold_inspection(
            scaffold=self.scaffold_a,
            inspector_name="مهندس کاظمی",
            result_tag=Scaffold.TagStatus.GREEN_SAFE,
            validity_days=7,
            base_plates_ok=True,
            bracing_ok=True,
            guardrails_ok=True,
            toeboards_ok=True,
            planks_decking_ok=True,
            ties_anchors_ok=True,
            ladder_access_ok=True,
            findings="کلیه اتصالات و نرده‌های حفاظتی استاندارد تایید شد.",
            inspector=self.user_a,
        )

        self.scaffold_a.refresh_from_db()
        self.assertEqual(self.scaffold_a.tag_status, Scaffold.TagStatus.GREEN_SAFE)
        self.assertTrue(self.scaffold_a.is_usable_for_work)
        self.assertFalse(self.scaffold_a.is_inspection_overdue)
        self.assertEqual(self.scaffold_a.next_inspection_due, self.today + timedelta(days=7))
        self.assertIsNone(inspection.non_conformity)

        # Check tag log
        last_log = ScaffoldTagLog.objects.filter(scaffold=self.scaffold_a).first()
        self.assertIsNotNone(last_log)
        self.assertEqual(last_log.new_tag, Scaffold.TagStatus.GREEN_SAFE)

    def test_inspection_structural_failure_forces_red_tag_and_creates_capa(self):
        initial_nc_count = NonConformity.objects.filter(organization=self.org_a).count()

        # Attempt to mark as green, but guardrails_ok is False
        inspection = record_scaffold_inspection(
            scaffold=self.scaffold_a,
            inspector_name="مهندس کاظمی",
            result_tag=Scaffold.TagStatus.GREEN_SAFE,  # Attempt green
            validity_days=7,
            guardrails_ok=False,  # Critical flaw!
            planks_decking_ok=False,
            findings="نقص جدی: تخته‌های سکو لق بوده و نرده محافظ نصب نشده است.",
            inspector=self.user_a,
        )

        self.scaffold_a.refresh_from_db()
        # Must be forced to RED_UNSAFE
        self.assertEqual(inspection.result_tag, Scaffold.TagStatus.RED_UNSAFE)
        self.assertEqual(self.scaffold_a.tag_status, Scaffold.TagStatus.RED_UNSAFE)
        self.assertFalse(self.scaffold_a.is_usable_for_work)

        # NonConformity must be created
        self.assertIsNotNone(inspection.non_conformity)
        self.assertEqual(NonConformity.objects.filter(organization=self.org_a).count(), initial_nc_count + 1)
        self.assertEqual(inspection.non_conformity.severity, NonConformity.Severity.CRITICAL)

    def test_manual_tag_change_flow(self):
        updated = change_scaffold_tag(
            scaffold=self.scaffold_a,
            new_tag=Scaffold.TagStatus.YELLOW_RESTRICTED,
            reason="باد شدید در ارتفاع؛ تردد صرفاً با هماهنگی مسئول ایمنی",
            actor=self.user_a,
            yellow_restrictions="حداکثر ۱ نفر روی سکو و الزام به قلاب کردن ۲ کارابین",
        )
        self.assertEqual(updated.tag_status, Scaffold.TagStatus.YELLOW_RESTRICTED)
        self.assertIn("حداکثر ۱ نفر", updated.yellow_restrictions)


class ScaffoldPTWIntegrationTests(ScaffoldTestBase):
    def setUp(self):
        super().setUp()
        self.permit_height = Permit.objects.create(
            organization=self.org_a,
            workplace=self.wp_a,
            reference_code="PTW-HEIGHT-001",
            permit_type=Permit.PermitType.WORK_AT_HEIGHT,
            title="نصب داکت هواکش در ارتفاع ۶ متری",
            description="نصب لوله‌های فلزی با استفاده از داربست",
            valid_from=timezone.now() - timedelta(hours=1),
            valid_until=timezone.now() + timedelta(hours=8),
            requester=self.user_a,
            status=Permit.Status.APPROVED,
            scaffold=self.scaffold_a,
        )

    def test_gatekeeper_blocks_activation_when_scaffold_is_red(self):
        # Scaffold is RED
        self.scaffold_a.tag_status = Scaffold.TagStatus.RED_UNSAFE
        self.scaffold_a.save()

        gatekeeper = check_permit_gatekeeper_prerequisites(self.permit_height)
        self.assertFalse(gatekeeper["is_ready_for_activation"])
        self.assertIn("تگ قرمز (خطرناک و اکیداً ممنوع)", str(gatekeeper["blockers"]))

    def test_gatekeeper_blocks_activation_when_scaffold_inspection_is_overdue(self):
        # Scaffold is green but inspection overdue
        self.scaffold_a.tag_status = Scaffold.TagStatus.GREEN_SAFE
        self.scaffold_a.next_inspection_due = self.today - timedelta(days=2)  # Overdue!
        self.scaffold_a.save()

        gatekeeper = check_permit_gatekeeper_prerequisites(self.permit_height)
        self.assertFalse(gatekeeper["is_ready_for_activation"])
        self.assertIn("مهلت بازرسی ادواری", str(gatekeeper["blockers"]))

    def test_gatekeeper_passes_when_scaffold_is_green_and_valid(self):
        self.scaffold_a.tag_status = Scaffold.TagStatus.GREEN_SAFE
        self.scaffold_a.next_inspection_due = self.today + timedelta(days=5)
        self.scaffold_a.current_tag_valid_until = timezone.now() + timedelta(days=5)
        self.scaffold_a.save()

        gatekeeper = check_permit_gatekeeper_prerequisites(self.permit_height)
        # Assuming other fields are ok, scaffold check passes
        self.assertEqual(gatekeeper["scaffold"]["status"], "ok")


class ScaffoldAPISecurityAndMultiTenantTests(ScaffoldTestBase):
    def test_tenant_isolation_in_scaffolds_api(self):
        # User B queries scaffolds
        self.client.force_authenticate(user=self.user_b)
        res_b = self.client.get("/api/v1/scaffolds/scaffolds/")
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)
        results = res_b.data.get("results", res_b.data)
        ids = [s["id"] for s in results]
        self.assertNotIn(self.scaffold_a.id, ids)

        # User B cannot change tag on Org A scaffold
        res_tag = self.client.post(
            f"/api/v1/scaffolds/scaffolds/{self.scaffold_a.id}/change-tag/",
            {"new_tag": Scaffold.TagStatus.GREEN_SAFE, "reason": "Hacking attempt"},
        )
        self.assertEqual(res_tag.status_code, status.HTTP_404_NOT_FOUND)

    def test_scaffold_summary_and_tag_card_endpoint(self):
        self.client.force_authenticate(user=self.user_a)

        # Summary
        res_sum = self.client.get(f"/api/v1/scaffolds/summary/?organization={self.org_a.id}")
        self.assertEqual(res_sum.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sum.data["total_scaffolds"], 1)
        self.assertEqual(res_sum.data["red_count"], 1)

        # Printable tag card
        res_card = self.client.get(f"/api/v1/scaffolds/scaffolds/{self.scaffold_a.id}/tag-card/")
        self.assertEqual(res_card.status_code, status.HTTP_200_OK)
        self.assertEqual(res_card.data["tag_number"], "SCF-FA-001")
        self.assertIn("HSE-SCAFFOLD", res_card.data["qr_payload"])
