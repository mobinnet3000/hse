from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.auditlog.models import AuditEvent
from apps.capa.models import CorrectiveAction
from apps.findings.models import NonConformity
from apps.incidents.models import Incident
from apps.organizations.models import Membership, Organization
from apps.permits.models import Permit, ShiftHandover
from apps.risks.models import Hazard
from apps.workplaces.models import Workplace


class PermitManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.platform_admin = User.objects.create_user(
            username="admin_user", email="admin@example.com", password="Password123!", global_role="platform_admin"
        )
        self.org_admin_a = User.objects.create_user(
            username="org_admin_a", email="admin_a@example.com", password="Password123!"
        )
        self.hse_manager_a = User.objects.create_user(
            username="hse_manager_a", email="manager_a@example.com", password="Password123!"
        )
        self.supervisor_a = User.objects.create_user(
            username="supervisor_a", email="supervisor_a@example.com", password="Password123!"
        )
        self.worker_a = User.objects.create_user(
            username="worker_a", email="worker_a@example.com", password="Password123!"
        )
        self.org_admin_b = User.objects.create_user(
            username="org_admin_b", email="admin_b@example.com", password="Password123!"
        )

        # Organizations
        self.org_a = Organization.objects.create(name="فولاد البرز", code="STEEL-ALBORZ")
        self.org_b = Organization.objects.create(name="پتروشیمی سپهر", code="PETRO-SEPEHR")

        # Workplaces
        self.workplace_a = Workplace.objects.create(organization=self.org_a, name="واحد ذوب و نورد")
        self.workplace_b = Workplace.objects.create(organization=self.org_b, name="واحد تقطیر ۲")

        # Memberships
        Membership.objects.create(user=self.org_admin_a, organization=self.org_a, role=Membership.Roles.ORG_ADMIN)
        Membership.objects.create(user=self.hse_manager_a, organization=self.org_a, role=Membership.Roles.HSE_MANAGER)
        Membership.objects.create(user=self.supervisor_a, organization=self.org_a, role=Membership.Roles.HSE_INSPECTOR)
        Membership.objects.create(user=self.worker_a, organization=self.org_a, role=Membership.Roles.ACTION_OWNER)
        Membership.objects.create(user=self.org_admin_b, organization=self.org_b, role=Membership.Roles.ORG_ADMIN)

        # Base Permit in Org A
        now = timezone.now()
        self.permit_a = Permit.objects.create(
            organization=self.org_a,
            workplace=self.workplace_a,
            permit_type=Permit.PermitType.HOT_WORK,
            title="جوشکاری خط لوله هیدرولیک کوره ۳",
            description="عملیات برشکاری و جوشکاری در مجاورت مخازن روغن",
            reference_code="PTW-202610-0001",
            status=Permit.Status.REQUESTED,
            valid_from=now + timedelta(hours=1),
            valid_until=now + timedelta(hours=8),
            requester=self.worker_a,
            responsible_supervisor=self.supervisor_a,
            gas_testing_required=True,
            isolation_loto_required=True,
            precautions_taken="تیم آتش‌نشانی مستقر در ایستگاه شماره ۱ در حالت آماده‌باش قرار دارد.",
        )

        # Base Permit in Org B
        self.permit_b = Permit.objects.create(
            organization=self.org_b,
            workplace=self.workplace_b,
            permit_type=Permit.PermitType.CONFINED_SPACE,
            title="ورود به برج تقطیر جهت بازرسی کاتالیست",
            description="تخلیه گاز و ورود به فضای بسته برج T-101",
            reference_code="PTW-202610-0002",
            status=Permit.Status.REQUESTED,
            valid_from=now + timedelta(hours=1),
            valid_until=now + timedelta(hours=10),
            requester=self.org_admin_b,
            responsible_supervisor=self.org_admin_b,
        )

    def test_tenant_isolation_list_and_detail(self):
        """User in Org A cannot view or access permits from Org B."""
        self.client.force_authenticate(user=self.worker_a)

        response = self.client.get("/api/v1/permits/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data.get("results", response.data)]
        self.assertIn(self.permit_a.id, ids)
        self.assertNotIn(self.permit_b.id, ids)

        # Detail of permit B should return 404
        detail_resp = self.client.get(f"/api/v1/permits/{self.permit_b.id}/")
        self.assertEqual(detail_resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_request_permit_success(self):
        """Authorized user requests a new permit and gets auto-generated reference code."""
        self.client.force_authenticate(user=self.supervisor_a)

        now = timezone.now()
        payload = {
            "organization": self.org_a.id,
            "workplace": self.workplace_a.id,
            "permit_type": "work_at_height",
            "title": "تعمیر سنسورهای روشنایی سوله نورد در ارتفاع ۱۲ متری",
            "description": "استفاده از داربست و کمربند ایمنی فول بادی",
            "valid_from": (now + timedelta(hours=2)).isoformat(),
            "valid_until": (now + timedelta(hours=6)).isoformat(),
            "work_area": "سوله نورد، دهانه ۴",
            "assigned_workers": "رضا مرادی، علی اکبری",
            "precautions_taken": "نردبان نجات و تیم امداد در دسترس است.",
            "required_ppe": "هارنس ایمنی، کلاه چانه‌دار",
        }

        response = self.client.post("/api/v1/permits/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(response.data["reference_code"].startswith("PTW-"))
        self.assertEqual(response.data["status"], "requested")
        self.assertEqual(response.data["permit_type"], "work_at_height")

    def test_separation_of_duties_approval_invariant(self):
        """Enforces Separation of Duties: requester cannot approve their own permit."""
        # worker_a is the requester of permit_a
        # Give worker_a admin rights temporarily or simulate self-approval attempt
        Membership.objects.filter(user=self.worker_a, organization=self.org_a).update(
            role=Membership.Roles.ORG_ADMIN
        )

        self.client.force_authenticate(user=self.worker_a)
        response = self.client.post(f"/api/v1/permits/{self.permit_a.id}/approve/", {"notes": "تایید خودم"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("تفکیک وظایف", str(response.data))

        # Distinct authorized user (HSE Manager) can approve successfully
        self.client.force_authenticate(user=self.hse_manager_a)
        approve_resp = self.client.post(
            f"/api/v1/permits/{self.permit_a.id}/approve/",
            {"notes": "تمامی جوانب بررسی و تایید شد."},
            format="json",
        )
        self.assertEqual(approve_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_resp.data["status"], "approved")
        self.assertEqual(approve_resp.data["approver"], self.hse_manager_a.id)

    def test_activate_requires_controls_verification(self):
        """Activation requires gas testing and LOTO when flagged."""
        # First approve permit
        self.permit_a.status = Permit.Status.APPROVED
        self.permit_a.approver = self.hse_manager_a
        self.permit_a.approved_at = timezone.now()
        self.permit_a.save()

        self.client.force_authenticate(user=self.supervisor_a)

        # Missing gas results
        bad_payload = {
            "gas_testing_results": "",
            "isolation_loto_details": "قفل و برچسب‌گذاری کلید برق تابلوی اصلی",
        }
        resp = self.client.post(f"/api/v1/permits/{self.permit_a.id}/activate/", bad_payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("گازسنجی", str(resp.data))

        # Missing LOTO details
        bad_payload_2 = {
            "gas_testing_results": "O2: 20.9%, LEL: 0%, H2S: 0ppm",
            "isolation_loto_details": "",
        }
        resp2 = self.client.post(f"/api/v1/permits/{self.permit_a.id}/activate/", bad_payload_2, format="json")
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ایزولاسیون", str(resp2.data))

        # Valid activation
        valid_payload = {
            "gas_testing_results": "O2: 20.9%, LEL: 0%, CO: 2ppm - ایمن",
            "isolation_loto_details": "کلید اصلی بریکر موتور قطع، قفل قرمز شماره ۳۴ و برچسب هشدار نصب شد.",
        }
        resp_ok = self.client.post(f"/api/v1/permits/{self.permit_a.id}/activate/", valid_payload, format="json")
        self.assertEqual(resp_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_ok.data["status"], "active")
        self.assertEqual(resp_ok.data["controls_verified_by"], self.supervisor_a.id)

    def test_cannot_activate_expired_permit(self):
        """Permits past their valid_until cannot be activated."""
        past_time = timezone.now() - timedelta(days=2)
        self.permit_a.valid_from = past_time - timedelta(hours=4)
        self.permit_a.valid_until = past_time
        self.permit_a.status = Permit.Status.APPROVED
        self.permit_a.save()

        self.client.force_authenticate(user=self.supervisor_a)
        resp = self.client.post(
            f"/api/v1/permits/{self.permit_a.id}/activate/",
            {
                "gas_testing_results": "تایید گاز",
                "isolation_loto_details": "تایید لوتو",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("منقضی", str(resp.data))

    def test_permit_lifecycle_flow(self):
        """Full state transition: request -> review -> approve -> activate -> suspend -> resume -> complete -> close."""
        self.client.force_authenticate(user=self.hse_manager_a)

        # 1. Review (under_review)
        resp = self.client.post(
            f"/api/v1/permits/{self.permit_a.id}/review/",
            {"status": "under_review", "review_notes": "در حال ارزیابی شرایط محیطی"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "under_review")

        # 2. Approve
        resp = self.client.post(f"/api/v1/permits/{self.permit_a.id}/approve/", {"notes": "مورد تایید است"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "approved")

        # 3. Activate
        self.client.force_authenticate(user=self.supervisor_a)
        resp = self.client.post(
            f"/api/v1/permits/{self.permit_a.id}/activate/",
            {
                "gas_testing_results": "O2: 20.8%, بدون گاز سمی",
                "isolation_loto_details": "برق و سوخت کاملا مسدود شدند",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "active")

        # 4. Suspend due to adverse condition
        resp = self.client.post(
            f"/api/v1/permits/{self.permit_a.id}/suspend/",
            {"reason": "وزش باد شدید و لغزندگی سقف"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "suspended")

        # 5. Resume
        resp = self.client.post(f"/api/v1/permits/{self.permit_a.id}/resume/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "active")

        # 6. Complete
        resp = self.client.post(f"/api/v1/permits/{self.permit_a.id}/complete/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "completed")

        # 7. Close
        self.client.force_authenticate(user=self.hse_manager_a)
        resp = self.client.post(
            f"/api/v1/permits/{self.permit_a.id}/close/",
            {"closure_summary": "محل تمیزکاری شد و قفل‌ها باز شدند و کار بدون حادثه پایان یافت."},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "closed")

        # Verify audit logs created
        events = AuditEvent.objects.filter(entity_type="Permit", entity_id=self.permit_a.id)
        self.assertGreaterEqual(events.count(), 6)

    def test_permit_rejection_and_cancellation(self):
        """Test reject and cancel flows."""
        # Rejection
        self.client.force_authenticate(user=self.hse_manager_a)
        resp = self.client.post(
            f"/api/v1/permits/{self.permit_a.id}/reject/",
            {"reason": "عدم ارائه گواهی سلامت اپراتور جوشکاری"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "rejected")

        # Cancellation by requester on permit_b
        self.client.force_authenticate(user=self.org_admin_b)
        resp_cancel = self.client.post(
            f"/api/v1/permits/{self.permit_b.id}/cancel/",
            {"reason": "لغو عملیات به دلیل تعمیرات غیرمنتظره"},
            format="json",
        )
        self.assertEqual(resp_cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_cancel.data["status"], "cancelled")

    def test_permit_summary_stats(self):
        """Permit summary statistics returns valid aggregation."""
        self.client.force_authenticate(user=self.supervisor_a)
        resp = self.client.get("/api/v1/permits/stats/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("total_permits", resp.data)
        self.assertIn("active_count", resp.data)
        self.assertIn("requested_count", resp.data)
        self.assertEqual(resp.data["total_permits"], 1)  # Only permit_a in org_a
        self.assertEqual(resp.data["requested_count"], 1)

    def test_shift_handover_flow(self):
        """Shift handover creation and acknowledgement workflow."""
        self.client.force_authenticate(user=self.supervisor_a)

        now = timezone.now()
        payload = {
            "organization": self.org_a.id,
            "workplace": self.workplace_a.id,
            "shift_date": now.date().isoformat(),
            "shift_type": "morning",
            "incoming_supervisor": self.hse_manager_a.id,
            "handover_notes": "شیفت صبح با ۴ مورد برشکاری و یک مورد کار در ارتفاع سپری شد.",
            "safety_concerns": "هیچ حادثه ناتوان‌کننده‌ای رخ نداد.",
            "equipment_status": "خط ۱ و ۲ نورد فعال، خط ۳ در حال تعمیرات اساسی است.",
            "active_permit_ids": [self.permit_a.id],
        }

        # Create handover
        resp = self.client.post("/api/v1/permits/handovers/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        handover_id = resp.data["id"]
        self.assertEqual(resp.data["status"], "submitted")

        # Outgoing supervisor cannot acknowledge their own handover
        resp_bad_ack = self.client.post(
            f"/api/v1/permits/handovers/{handover_id}/acknowledge/",
            {"acknowledgement_notes": "تایید"},
            format="json",
        )
        self.assertEqual(resp_bad_ack.status_code, status.HTTP_400_BAD_REQUEST)

        # Incoming supervisor acknowledges
        self.client.force_authenticate(user=self.hse_manager_a)
        resp_ack = self.client.post(
            f"/api/v1/permits/handovers/{handover_id}/acknowledge/",
            {"acknowledgement_notes": "شیفت و موارد ایمنی با موفقیت تحویل گرفته شد."},
            format="json",
        )
        self.assertEqual(resp_ack.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_ack.data["status"], "acknowledged")

        # Handover cannot be acknowledged twice
        resp_dup = self.client.post(
            f"/api/v1/permits/handovers/{handover_id}/acknowledge/",
            {"acknowledgement_notes": "تکرار"},
            format="json",
        )
        self.assertEqual(resp_dup.status_code, status.HTTP_400_BAD_REQUEST)

    def test_shift_handover_safety_summary(self):
        """Shift handover safety summary accurately collects active hazards, CAPAs, and permits."""
        # Create an incident and a hazard
        Incident.objects.create(
            organization=self.org_a,
            workplace=self.workplace_a,
            title="لغزش کارگر روی کف مرطوب",
            incident_type=Incident.IncidentType.NEAR_MISS,
            severity=Incident.Severity.MINOR,
            status=Incident.Status.REPORTED,
            occurred_at=timezone.now(),
            reported_by=self.worker_a,
        )

        Hazard.objects.create(
            organization=self.org_a,
            workplace=self.workplace_a,
            title="سیم‌کشی فرسوده تابلوی برق شماره ۲",
            category=Hazard.Category.SAFETY,
            status=Hazard.Status.ACTIVE,
        )

        self.client.force_authenticate(user=self.supervisor_a)
        url = f"/api/v1/permits/handovers/safety-summary/?organization={self.org_a.id}&workplace={self.workplace_a.id}"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("unresolved_hazards", resp.data)
        self.assertIn("recent_incidents", resp.data)
        self.assertIn("active_permits", resp.data)
        self.assertEqual(len(resp.data["unresolved_hazards"]), 1)
        self.assertEqual(len(resp.data["recent_incidents"]), 1)
