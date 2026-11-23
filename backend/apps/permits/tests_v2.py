from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.organizations.models import Membership, Organization
from apps.permits.models import Permit
from apps.risks.models import RiskRegister
from apps.workplaces.models import Workplace
from apps.core.models import TraceabilityChain, TraceabilityNode
from apps.workforce.models import Employee, Competency, EmployeeCompetency


class Phase2PermitIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="پتروشیمی جم آزمون", code="jam-p2-test")
        
        self.requester = User.objects.create_user(username="permit_req_user", password="ReqPassword123!")
        self.approver = User.objects.create_user(username="permit_app_user", password="AppPassword123!")

        Membership.objects.create(user=self.requester, organization=self.org, role=Membership.Roles.HSE_INSPECTOR)
        Membership.objects.create(user=self.approver, organization=self.org, role=Membership.Roles.HSE_MANAGER)

        self.workplace = Workplace.objects.create(
            organization=self.org,
            name="برج تقطیر T-101",
            code="WP-DIST-101",
        )

    def test_permit_creation_with_direct_risk_and_traceability(self):
        self.client.force_login(self.requester)

        # Create parent risk register
        risk = RiskRegister.objects.create(
            organization=self.org,
            register_code="RSK-2026-HOT-01",
            title="ارزیابی ریسک فعالیت‌های گرم و جوشکاری در زون ۱",
            assessment_date=timezone.now().date(),
            created_by=self.requester,
        )

        valid_from = timezone.now() + timedelta(hours=1)
        valid_until = timezone.now() + timedelta(hours=9)

        payload = {
            "organization": self.org.id,
            "workplace": self.workplace.id,
            "permit_type": Permit.PermitType.HOT_WORK,
            "title": "جوشکاری ساپورت لوله تغذیه ریبویلر",
            "description": "جوشکاری برق بر روی براکت نگهدارنده لوله ۶ اینچ",
            "work_area": "طبقه سوم سازه برج T-101",
            "valid_from": valid_from.isoformat(),
            "valid_until": valid_until.isoformat(),
            "gas_testing_required": True,
            "isolation_loto_required": True,
            "weather_condition_ok": True,
            "related_risk_register": str(risk.id),
            "jsa_document_ref": "JSA-2026-HOT-009",
            "operational_constraints": "توقف در صورت باد بیش از ۲۵ نات یا بارش باران، استقرار کپسول CO2 در ۲ متری محل",
        }

        response = self.client.post("/api/v1/permits/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        permit = Permit.objects.get(id=response.data["id"])
        self.assertEqual(str(permit.related_risk_register_id), str(risk.id))
        self.assertEqual(permit.jsa_document_ref, payload["jsa_document_ref"])
        self.assertEqual(permit.operational_constraints, payload["operational_constraints"])

        # Check traceability inheritance
        self.assertEqual(permit.traceability_chain_id, risk.traceability_chain_id)

        # Verify TraceabilityNode
        chain = TraceabilityChain.objects.get(tracking_code=risk.traceability_chain_id)
        ptw_node = chain.nodes.filter(to_module="permits").first()
        self.assertIsNotNone(ptw_node)
        self.assertEqual(ptw_node.relation_type, "direct")

    def test_permit_operational_lifecycle(self):
        # 1. Request permit
        valid_from = timezone.now() + timedelta(hours=1)
        valid_until = timezone.now() + timedelta(hours=9)
        permit = Permit.objects.create(
            organization=self.org,
            workplace=self.workplace,
            permit_type=Permit.PermitType.CONFINED_SPACE,
            title="ورود به مخزن V-105 جهت شستشو و بازرسی چشمی",
            description="عملیات سندبلاست و رسوب‌زدایی داخل مخزن",
            valid_from=valid_from,
            valid_until=valid_until,
            requester=self.requester,
            gas_testing_required=True,
            isolation_loto_required=True,
            weather_condition_ok=True,
        )
        self.assertEqual(permit.status, Permit.Status.REQUESTED)

        # 2. Review permit -> Under Review
        self.client.force_login(self.approver)
        review_resp = self.client.post(
            f"/api/v1/permits/{permit.id}/review/",
            {"status": "under_review", "review_notes": "بررسی اولیه انجام شد."},
            format="json",
        )
        self.assertEqual(review_resp.status_code, status.HTTP_200_OK)
        permit.refresh_from_db()
        self.assertEqual(permit.status, Permit.Status.UNDER_REVIEW)

        # 3. Approve permit (SoD: Approver != Requester)
        approve_resp = self.client.post(
            f"/api/v1/permits/{permit.id}/approve/",
            {"notes": "صدور پروانه مشروط به گازسنجی تایید است."},
            format="json",
        )
        self.assertEqual(approve_resp.status_code, status.HTTP_200_OK)
        permit.refresh_from_db()
        self.assertEqual(permit.status, Permit.Status.APPROVED)

        # 4. Activate permit (Controls verified)
        activate_resp = self.client.post(
            f"/api/v1/permits/{permit.id}/activate/",
            {
                "gas_testing_results": "O2: 20.9%, H2S: 0 ppm, LEL: 0%",
                "isolation_loto_details": "قفل و برچسب بر روی ولو ورودی V-101 و بریکر پمپ تغذیه شماره ۳",
            },
            format="json",
        )
        self.assertEqual(activate_resp.status_code, status.HTTP_200_OK)
        permit.refresh_from_db()
        self.assertEqual(permit.status, Permit.Status.ACTIVE)
        self.assertTrue(permit.controls_verified)

        # 5. Suspend permit (e.g. Due to bad weather or gas alert)
        suspend_resp = self.client.post(
            f"/api/v1/permits/{permit.id}/suspend/",
            {"reason": "افزایش ناگهانی غلظت بخارات هیدروکربنی در اطراف مخزن"},
            format="json",
        )
        self.assertEqual(suspend_resp.status_code, status.HTTP_200_OK)
        permit.refresh_from_db()
        self.assertEqual(permit.status, Permit.Status.SUSPENDED)

        # 6. Resume permit
        resume_resp = self.client.post(
            f"/api/v1/permits/{permit.id}/resume/",
            {"resumption_notes": "تهویه مصنوعی تقویت شد و گازسنجی مجدد نرمال شد."},
            format="json",
        )
        self.assertEqual(resume_resp.status_code, status.HTTP_200_OK)
        permit.refresh_from_db()
        self.assertEqual(permit.status, Permit.Status.ACTIVE)

        # 7. Complete and Close
        complete_resp = self.client.post(f"/api/v1/permits/{permit.id}/complete/", {}, format="json")
        self.assertEqual(complete_resp.status_code, status.HTTP_200_OK)
        permit.refresh_from_db()
        self.assertEqual(permit.status, Permit.Status.COMPLETED)

        close_resp = self.client.post(
            f"/api/v1/permits/{permit.id}/close/",
            {"closure_summary": "کارگاه پاکسازی شد، ایزولاسیون برداشته شد و تجهیز به واحد عملیات تحویل گردید."},
            format="json",
        )
        self.assertEqual(close_resp.status_code, status.HTTP_200_OK)
        permit.refresh_from_db()
        self.assertEqual(permit.status, Permit.Status.CLOSED)

    def test_medical_confidentiality_isolation_in_gatekeeper(self):
        self.client.force_login(self.requester)

        emp = Employee.objects.create(
            organization=self.org,
            workplace=self.workplace,
            employee_no="EMP-9001",
            first_name="علی",
            last_name="رضایی",
            job_title="تکنسین تعمیرات مکانیک",
        )

        comp = Competency.objects.create(
            organization=self.org,
            code="COMP-HOT",
            name="گواهینامه ایمنی جوشکاری و برشکاری",
        )

        EmployeeCompetency.objects.create(
            organization=self.org,
            employee=emp,
            competency=comp,
            achieved_on=timezone.now().date(),
            expires_on=timezone.now().date() + timedelta(days=365),
            status=EmployeeCompetency.Status.ACTIVE,
        )

        permit = Permit.objects.create(
            organization=self.org,
            workplace=self.workplace,
            permit_type=Permit.PermitType.HOT_WORK,
            title="جوشکاری فلنج خط گاز",
            valid_from=timezone.now(),
            valid_until=timezone.now() + timedelta(hours=6),
            requester=self.requester,
            assigned_workers=f"{emp.first_name} {emp.last_name} ({emp.employee_no})",
        )

        # Gatekeeper evaluation
        response = self.client.get(f"/api/v1/permits/{permit.id}/gatekeeper-check/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Ensure response contains operational fit/competency check, but NO clinical diagnosis/medical records
        data = response.data
        self.assertIn("competency", data)
        self.assertIn("contractor", data)
        self.assertIn("gas_testing", data)
        self.assertIn("loto", data)
        self.assertIn("weather", data)
        self.assertIn("simops", data)

        # Verify clinical medical records are NOT in the payload
        response_text = response.content.decode("utf-8")
        self.assertNotIn("medical_record", response_text)
        self.assertNotIn("clinical_diagnosis", response_text)
        self.assertNotIn("doctor_notes", response_text)
