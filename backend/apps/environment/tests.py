from decimal import Decimal
from datetime import date, timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.findings.models import NonConformity
from apps.organizations.models import Membership, Organization
from apps.workforce.models import ContractorCompany
from apps.workplaces.models import Workplace

from .models import (
    EnvironmentalAspect,
    EnvironmentalThreshold,
    OccupationalHygieneRecord,
    WasteRecord,
    WastewaterEmissionRecord,
)
from .services import (
    evaluate_and_record_hygiene_survey,
    evaluate_and_record_wastewater_emission,
    generate_waste_manifest_csv,
    get_environmental_summary,
    update_waste_status,
)


class EnvironmentTestBase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = date.today()

        # Org A
        self.org_a = Organization.objects.create(name="مجتمع فولاد البرز", code="foolad-alborz")
        self.wp_a = Workplace.objects.create(organization=self.org_a, name="سوله نورد", code="WP-ROLL")
        self.user_a = User.objects.create_user(
            username="env_officer_a", email="env_a@test.com", password="Pass123456_test"
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
            username="env_officer_b", email="env_b@test.com", password="Pass123456_test"
        )
        Membership.objects.create(
            user=self.user_b,
            organization=self.org_b,
            role=Membership.Roles.HSE_MANAGER,
            is_active=True,
        )

        # Contractor in Org A
        self.contractor_a = ContractorCompany.objects.create(
            organization=self.org_a,
            name="پیمانکار مدیریت بازیافت پارس",
            registration_no="REG-9912",
        )

        # Thresholds in Org A
        self.threshold_cod = EnvironmentalThreshold.objects.create(
            organization=self.org_a,
            name="حداکثر مجاز COD پساب",
            category=EnvironmentalThreshold.Category.WASTEWATER,
            parameter="COD",
            limit_type=EnvironmentalThreshold.LimitType.MAX_LIMIT,
            limit_value=Decimal("100.00"),
            unit="mg/L",
            standard_reference="استاندارد خروجی محیط زیست",
        )
        self.threshold_ph = EnvironmentalThreshold.objects.create(
            organization=self.org_a,
            name="دامنه مجاز pH پساب",
            category=EnvironmentalThreshold.Category.WASTEWATER,
            parameter="PH",
            limit_type=EnvironmentalThreshold.LimitType.RANGE,
            limit_value=Decimal("8.50"),
            min_value=Decimal("6.50"),
            unit="pH",
            standard_reference="استاندارد خروجی محیط زیست",
        )
        self.threshold_noise = EnvironmentalThreshold.objects.create(
            organization=self.org_a,
            name="حد مجاز صوت ۸ ساعته",
            category=EnvironmentalThreshold.Category.NOISE,
            parameter="NOISE_DBA",
            limit_type=EnvironmentalThreshold.LimitType.MAX_LIMIT,
            limit_value=Decimal("85.00"),
            unit="dBA",
            standard_reference="حدود تماس شغلی وزارت بهداشت",
        )


class EnvironmentalThresholdAndAspectTests(EnvironmentTestBase):
    def test_threshold_evaluation_max_and_range(self):
        # Within max limit
        is_exc, _ = self.threshold_cod.evaluate_value(Decimal("95.00"))
        self.assertFalse(is_exc)

        # Exceeding max limit
        is_exc, reason = self.threshold_cod.evaluate_value(Decimal("130.50"))
        self.assertTrue(is_exc)
        self.assertIn("بیش از حد مجاز", reason)

        # Range within
        is_exc, _ = self.threshold_ph.evaluate_value(Decimal("7.20"))
        self.assertFalse(is_exc)

        # Range outside (too low)
        is_exc, _ = self.threshold_ph.evaluate_value(Decimal("5.80"))
        self.assertTrue(is_exc)

        # Range outside (too high)
        is_exc, _ = self.threshold_ph.evaluate_value(Decimal("9.10"))
        self.assertTrue(is_exc)

    def test_range_threshold_requires_valid_min_value(self):
        with self.assertRaises(ValidationError):
            t = EnvironmentalThreshold(
                organization=self.org_a,
                name="تست نامعتبر",
                category=EnvironmentalThreshold.Category.WASTEWATER,
                parameter="INVALID",
                limit_type=EnvironmentalThreshold.LimitType.RANGE,
                limit_value=Decimal("10.00"),
                min_value=Decimal("15.00"),  # min > max
                unit="test",
            )
            t.clean()

    def test_environmental_aspect_significance_calculation(self):
        # Non-significant
        aspect1 = EnvironmentalAspect.objects.create(
            organization=self.org_a,
            workplace=self.wp_a,
            activity_or_process="مصرف کاغذ اداری",
            aspect="پسماند کاغذ",
            impact="اتلاف منابع",
            severity_score=2,
            probability_score=3,
        )
        self.assertEqual(aspect1.significance_score, 6)
        self.assertFalse(aspect1.is_significant)

        # Significant (score >= 12)
        aspect2 = EnvironmentalAspect.objects.create(
            organization=self.org_a,
            workplace=self.wp_a,
            activity_or_process="ذوب ضایعات در کوره",
            aspect="نشت گاز SO2 و غبار فلزی",
            impact="آلودگی اتمسفر و تهدید سلامتی",
            severity_score=4,
            probability_score=4,
        )
        self.assertEqual(aspect2.significance_score, 16)
        self.assertTrue(aspect2.is_significant)


class WasteLifecycleTests(EnvironmentTestBase):
    def test_waste_record_creation_and_status_transitions(self):
        waste = WasteRecord.objects.create(
            organization=self.org_a,
            workplace=self.wp_a,
            waste_name="روغن سوخته هیدرولیک",
            waste_type=WasteRecord.WasteType.HAZARDOUS,
            quantity=Decimal("500.00"),
            unit=WasteRecord.Unit.LITER,
            storage_location="انبار ضایعات ویژه",
            generation_date=self.today,
            status=WasteRecord.Status.STORED,
        )
        self.assertEqual(waste.status, WasteRecord.Status.STORED)

        # Transition to transferred without consignment number fails
        with self.assertRaises(ValidationError):
            update_waste_status(waste, WasteRecord.Status.TRANSFERRED)

        # Transition with consignment number succeeds
        updated = update_waste_status(
            waste,
            WasteRecord.Status.TRANSFERRED,
            consignment_number="MANIFEST-2026-091",
            contractor=self.contractor_a,
            actor=self.user_a,
        )
        self.assertEqual(updated.status, WasteRecord.Status.TRANSFERRED)
        self.assertEqual(updated.consignment_number, "MANIFEST-2026-091")

        # Transition from transferred to stored is forbidden
        with self.assertRaises(ValidationError):
            update_waste_status(waste, WasteRecord.Status.STORED)

        # Transition to disposed with facility succeeds
        final = update_waste_status(
            updated,
            WasteRecord.Status.DISPOSED,
            disposal_facility="مرکز بازیافت روغن تصفیه کویر",
            disposal_method="تصفیه و بازیافت روغن پایه",
            disposal_date=self.today + timedelta(days=2),
            actor=self.user_a,
        )
        self.assertEqual(final.status, WasteRecord.Status.DISPOSED)
        self.assertEqual(final.disposal_facility, "مرکز بازیافت روغن تصفیه کویر")


class MonitoringExceedanceAndCAPATests(EnvironmentTestBase):
    def test_wastewater_emission_sample_within_limit(self):
        record = evaluate_and_record_wastewater_emission(
            organization=self.org_a,
            workplace=self.wp_a,
            sampling_point="حوضچه خروجی تصفیه‌خانه",
            category=WastewaterEmissionRecord.Category.WASTEWATER,
            sample_date=self.today,
            parameter="COD",
            measured_value=Decimal("80.00"),
            unit="mg/L",
            threshold=self.threshold_cod,
            actor=self.user_a,
        )
        self.assertFalse(record.is_exceedance)
        self.assertIsNone(record.non_conformity)

    def test_wastewater_emission_exceedance_creates_non_conformity(self):
        initial_nc_count = NonConformity.objects.filter(organization=self.org_a).count()

        record = evaluate_and_record_wastewater_emission(
            organization=self.org_a,
            workplace=self.wp_a,
            sampling_point="حوضچه خروجی تصفیه‌خانه",
            category=WastewaterEmissionRecord.Category.WASTEWATER,
            sample_date=self.today,
            parameter="COD",
            measured_value=Decimal("175.50"),  # > 100 limit
            unit="mg/L",
            threshold=self.threshold_cod,
            laboratory_name="آزمایشگاه معتمد آب آزمای البرز",
            test_report_number="LAB-REP-1405-88",
            actor=self.user_a,
            auto_create_nonconformity=True,
        )

        self.assertTrue(record.is_exceedance)
        self.assertIsNotNone(record.non_conformity)
        self.assertEqual(NonConformity.objects.filter(organization=self.org_a).count(), initial_nc_count + 1)

        nc = record.non_conformity
        self.assertEqual(nc.organization_id, self.org_a.id)
        self.assertEqual(nc.severity, NonConformity.Severity.HIGH)
        self.assertIn("175.5", nc.description)

    def test_occupational_hygiene_survey_evaluation_and_alert_scales(self):
        # 1. Acceptable (< 80% of 85 dBA, e.g. 65 dBA)
        rec_acc = evaluate_and_record_hygiene_survey(
            organization=self.org_a,
            workplace=self.wp_a,
            category=OccupationalHygieneRecord.Category.NOISE,
            location_details="اتاق استراحت پرسنل",
            survey_date=self.today,
            surveyor_name="مهندس کاظمی",
            measured_value=Decimal("62.00"),
            unit="dBA",
            threshold=self.threshold_noise,
            actor=self.user_a,
        )
        self.assertFalse(rec_acc.is_exceedance)
        self.assertEqual(rec_acc.assessment_result, OccupationalHygieneRecord.AssessmentResult.ACCEPTABLE)
        self.assertIsNone(rec_acc.non_conformity)

        # 2. Warning (between 80% and 100%, e.g. 78 dBA)
        rec_warn = evaluate_and_record_hygiene_survey(
            organization=self.org_a,
            workplace=self.wp_a,
            category=OccupationalHygieneRecord.Category.NOISE,
            location_details="ایستگاه اپراتوری میانی",
            survey_date=self.today,
            surveyor_name="مهندس کاظمی",
            measured_value=Decimal("75.00"),
            unit="dBA",
            threshold=self.threshold_noise,
            actor=self.user_a,
        )
        self.assertFalse(rec_warn.is_exceedance)
        self.assertEqual(rec_warn.assessment_result, OccupationalHygieneRecord.AssessmentResult.WARNING)
        self.assertIsNone(rec_warn.non_conformity)

        # 3. Unacceptable (> 85 dBA, e.g. 92 dBA)
        rec_crit = evaluate_and_record_hygiene_survey(
            organization=self.org_a,
            workplace=self.wp_a,
            category=OccupationalHygieneRecord.Category.NOISE,
            location_details="مجاور استند نورد سنگین",
            survey_date=self.today,
            surveyor_name="مهندس کاظمی",
            measured_value=Decimal("92.50"),
            unit="dBA",
            threshold=self.threshold_noise,
            control_recommendation="تجهیز اجباری اپراتورها به ایرپلاگ و ایرماف ترکیبی و محصورسازی صوتی موتور",
            actor=self.user_a,
        )
        self.assertTrue(rec_crit.is_exceedance)
        self.assertEqual(rec_crit.assessment_result, OccupationalHygieneRecord.AssessmentResult.UNACCEPTABLE)
        self.assertIsNotNone(rec_crit.non_conformity)
        self.assertIn("92.5", rec_crit.non_conformity.description)


class EnvironmentAPISecurityAndMultiTenantTests(EnvironmentTestBase):
    def test_tenant_isolation_in_apis(self):
        # Create waste in Org A
        waste_a = WasteRecord.objects.create(
            organization=self.org_a,
            workplace=self.wp_a,
            waste_name="پسماند فولاد A",
            waste_type=WasteRecord.WasteType.NON_HAZARDOUS,
            quantity=Decimal("100.00"),
            unit=WasteRecord.Unit.KG,
            storage_location="سایت A",
            generation_date=self.today,
        )

        # User B queries waste list
        self.client.force_authenticate(user=self.user_b)
        res_b = self.client.get("/api/v1/environment/waste/")
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)
        # Should not see Org A waste
        results = res_b.data.get("results", res_b.data)
        ids = [w["id"] for w in results]
        self.assertNotIn(waste_a.id, ids)

        # User B cannot update Org A waste status
        res_update = self.client.post(
            f"/api/v1/environment/waste/{waste_a.id}/update-status/",
            {"status": WasteRecord.Status.TRANSFERRED, "consignment_number": "HAX-123"},
        )
        self.assertEqual(res_update.status_code, status.HTTP_404_NOT_FOUND)

    def test_environmental_summary_and_csv_export(self):
        self.client.force_authenticate(user=self.user_a)

        # Get summary
        res_sum = self.client.get("/api/v1/environment/summary/?organization=" + str(self.org_a.id))
        self.assertEqual(res_sum.status_code, status.HTTP_200_OK)
        self.assertIn("aspects_total", res_sum.data)
        self.assertIn("hazardous_waste_kg", res_sum.data)
        self.assertIn("emission_exceedances_count", res_sum.data)

        # Export CSV
        res_csv = self.client.get("/api/v1/environment/waste/export-csv/?organization=" + str(self.org_a.id))
        self.assertEqual(res_csv.status_code, status.HTTP_200_OK)
        self.assertEqual(res_csv["Content-Type"], "text/csv; charset=utf-8-sig")
        self.assertIn("شناسه پسماند", res_csv.content.decode("utf-8-sig"))
