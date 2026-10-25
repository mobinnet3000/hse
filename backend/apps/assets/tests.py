from datetime import timedelta
from io import StringIO

from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.auditlog.models import AuditEvent
from apps.findings.models import NonConformity
from apps.incidents.models import Incident
from apps.inspections.models import Inspection
from apps.organizations.models import Membership, Organization
from apps.risks.models import Hazard
from apps.workplaces.models import Workplace

from .models import CalibrationRecord, Equipment, MaintenancePlan, MaintenanceWorkOrder


class AssetTestBase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = timezone.localdate()

        self.admin_a = User.objects.create_user(
            username="asset_admin_a", email="admin-a@example.com", password="Password123!"
        )
        self.manager_a = User.objects.create_user(
            username="asset_manager_a", email="manager-a@example.com", password="Password123!"
        )
        self.inspector_a = User.objects.create_user(
            username="asset_inspector_a", email="inspector-a@example.com", password="Password123!"
        )
        self.supervisor_a = User.objects.create_user(
            username="asset_supervisor_a", email="supervisor-a@example.com", password="Password123!"
        )
        self.worker_a = User.objects.create_user(
            username="asset_worker_a", email="worker-a@example.com", password="Password123!"
        )
        self.admin_b = User.objects.create_user(
            username="asset_admin_b", email="admin-b@example.com", password="Password123!"
        )

        self.org_a = Organization.objects.create(name="سازمان الف", code="ASSET-ORG-A")
        self.org_b = Organization.objects.create(name="سازمان ب", code="ASSET-ORG-B")
        self.workplace_a = Workplace.objects.create(
            organization=self.org_a, name="کارگاه الف", code="asset-wp-a"
        )
        self.workplace_b = Workplace.objects.create(
            organization=self.org_b, name="کارگاه ب", code="asset-wp-b"
        )

        Membership.objects.create(
            user=self.admin_a, organization=self.org_a, role=Membership.Roles.ORG_ADMIN
        )
        Membership.objects.create(
            user=self.manager_a, organization=self.org_a, role=Membership.Roles.HSE_MANAGER
        )
        Membership.objects.create(
            user=self.inspector_a, organization=self.org_a, role=Membership.Roles.HSE_INSPECTOR
        )
        Membership.objects.create(
            user=self.supervisor_a, organization=self.org_a, role=Membership.Roles.WORKSHOP_SUPERVISOR
        )
        Membership.objects.create(
            user=self.worker_a, organization=self.org_a, role=Membership.Roles.ACTION_OWNER
        )
        Membership.objects.create(
            user=self.admin_b, organization=self.org_b, role=Membership.Roles.ORG_ADMIN
        )

        self.equipment_a = Equipment.objects.create(
            organization=self.org_a,
            workplace=self.workplace_a,
            code="EQ-A-001",
            name="گازسنج عملیاتی",
            category=Equipment.Category.GAS_DETECTION,
            status=Equipment.Status.READY,
            calibration_required=True,
            created_by=self.manager_a,
        )
        self.calibration_a = CalibrationRecord.objects.create(
            organization=self.org_a,
            equipment=self.equipment_a,
            performed_on=self.today - timedelta(days=10),
            next_due_on=self.today + timedelta(days=100),
            provider="آزمایشگاه معتمد",
            certificate_number="CERT-A-001",
            result=CalibrationRecord.Result.PASSED,
            performed_by=self.inspector_a,
        )
        self.equipment_b = Equipment.objects.create(
            organization=self.org_b,
            workplace=self.workplace_b,
            code="EQ-B-001",
            name="کپسول سازمان ب",
            category=Equipment.Category.FIRE_EXTINGUISHER,
            status=Equipment.Status.READY,
            calibration_required=False,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


class AssetTenantAndCrudTests(AssetTestBase):
    def test_tenant_isolation_for_equipment_detail_and_relations(self):
        self.auth(self.worker_a)
        response = self.client.get("/api/v1/assets/equipment/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data]
        self.assertIn(self.equipment_a.id, ids)
        self.assertNotIn(self.equipment_b.id, ids)

        self.assertEqual(
            self.client.get(f"/api/v1/assets/equipment/{self.equipment_b.id}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(
                f"/api/v1/assets/maintenance-plans/?equipment={self.equipment_b.id}"
            ).data,
            [],
        )
        self.assertEqual(
            self.client.get(
                f"/api/v1/assets/calibrations/?equipment={self.equipment_b.id}"
            ).data,
            [],
        )

        calibration_b = CalibrationRecord.objects.create(
            organization=self.org_b,
            equipment=self.equipment_b,
            performed_on=self.today,
            next_due_on=self.today + timedelta(days=30),
            provider="آزمایشگاه ب",
            result=CalibrationRecord.Result.PASSED,
        )
        order_b = MaintenanceWorkOrder.objects.create(
            organization=self.org_b,
            equipment=self.equipment_b,
            title="دستورکار سازمان ب",
            work_type=MaintenanceWorkOrder.WorkType.PREVENTIVE,
            status=MaintenanceWorkOrder.Status.PLANNED,
            scheduled_date=self.today,
        )
        self.assertEqual(
            self.client.get(f"/api/v1/assets/calibrations/{calibration_b.id}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(
                f"/api/v1/assets/maintenance-work-orders/{order_b.id}/"
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        stats_response = self.client.get(
            f"/api/v1/assets/equipment/stats/?organization={self.org_b.id}"
        )
        self.assertEqual(stats_response.status_code, status.HTTP_200_OK)
        self.assertEqual(stats_response.data["total_equipment"], 0)

    def test_duplicate_code_per_org_is_rejected_but_other_org_allowed(self):
        self.auth(self.manager_a)
        payload = {
            "organization": self.org_a.id,
            "workplace": self.workplace_a.id,
            "code": "eq-a-001",
            "name": "تجهیز تکراری",
            "category": "other",
        }
        response = self.client.post("/api/v1/assets/equipment/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("تکراری", str(response.data))

        Equipment.objects.create(
            organization=self.org_b, code="EQ-A-001", name="همکد در سازمان دیگر"
        )
        self.assertEqual(
            Equipment.objects.filter(code__iexact="EQ-A-001").count(), 2
        )

    def test_cross_tenant_equipment_and_workplace_rejected(self):
        self.auth(self.manager_a)
        response = self.client.post(
            "/api/v1/assets/equipment/",
            {
                "organization": self.org_a.id,
                "workplace": self.workplace_b.id,
                "code": "EQ-X-001",
                "name": "تجهیز نامعتبر",
                "category": "other",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        other_payload = {
            "organization": self.org_b.id,
            "workplace": self.workplace_b.id,
            "code": "EQ-X-002",
            "name": "تجهیز سازمان دیگر",
            "category": "other",
        }
        response = self.client.post("/api/v1/assets/equipment/", other_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_calibration_required_equipment_cannot_start_ready(self):
        self.auth(self.manager_a)
        response = self.client.post(
            "/api/v1/assets/equipment/",
            {
                "organization": self.org_a.id,
                "code": "EQ-CAL-001",
                "name": "تجهیز نیازمند کالیبراسیون",
                "category": "gas_detection",
                "calibration_required": True,
                "status": "ready",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            "/api/v1/assets/equipment/",
            {
                "organization": self.org_a.id,
                "code": "EQ-CAL-002",
                "name": "تجهیز نیازمند کالیبراسیون",
                "category": "gas_detection",
                "calibration_required": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["status"], "out_of_service")
        self.assertEqual(response.data["calibration_status"], "missing")

    def test_equipment_status_endpoint_is_controlled(self):
        self.auth(self.manager_a)
        missing = Equipment.objects.create(
            organization=self.org_a,
            code="EQ-NO-CAL",
            name="بدون کالیبراسیون",
            status=Equipment.Status.OUT_OF_SERVICE,
            calibration_required=True,
        )
        response = self.client.post(
            f"/api/v1/assets/equipment/{missing.id}/status/",
            {"status": "ready", "reason": "تلاش برای آماده‌سازی"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("کالیبراسیون", str(response.data))

        response = self.client.patch(
            f"/api/v1/assets/equipment/{missing.id}/",
            {"status": "ready"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            f"/api/v1/assets/equipment/{self.equipment_a.id}/status/",
            {"status": "under_maintenance", "reason": "بازرسی فنی"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "under_maintenance")

    def test_action_permissions_are_role_based(self):
        self.auth(self.worker_a)
        response = self.client.post(
            "/api/v1/assets/equipment/",
            {"organization": self.org_a.id, "code": "EQ-NO", "name": "غیرمجاز", "category": "other"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.auth(self.inspector_a)
        response = self.client.post(
            "/api/v1/assets/maintenance-plans/",
            {
                "equipment": self.equipment_a.id,
                "title": "برنامه غیرمجاز",
                "interval_days": 30,
                "start_date": str(self.today),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = self.client.post(
            "/api/v1/assets/calibrations/",
            {
                "equipment": self.equipment_a.id,
                "performed_on": str(self.today),
                "next_due_on": str(self.today + timedelta(days=30)),
                "provider": "آزمایشگاه دوم",
                "certificate_number": "CERT-A-002",
                "result": "passed",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)


class AssetCalibrationTests(AssetTestBase):
    def test_calibration_history_is_preserved_and_latest_is_used(self):
        self.auth(self.inspector_a)
        response = self.client.post(
            "/api/v1/assets/calibrations/",
            {
                "equipment": self.equipment_a.id,
                "performed_on": str(self.today - timedelta(days=1)),
                "next_due_on": str(self.today + timedelta(days=200)),
                "provider": "آزمایشگاه جدید",
                "certificate_number": "CERT-A-002",
                "result": "passed",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(
            CalibrationRecord.objects.filter(equipment=self.equipment_a).count(), 2
        )
        detail = self.client.get(f"/api/v1/assets/equipment/{self.equipment_a.id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(len(detail.data["calibrations"]), 2)
        self.assertEqual(detail.data["calibration_status"], "valid")
        self.assertEqual(detail.data["calibration_due_on"], str(self.today + timedelta(days=200)))

    def test_expired_calibration_blocks_ready(self):
        self.equipment_a.status = Equipment.Status.OUT_OF_SERVICE
        self.equipment_a.save(update_fields=["status"])
        self.calibration_a.next_due_on = self.today - timedelta(days=1)
        self.calibration_a.save(update_fields=["next_due_on"])

        self.auth(self.manager_a)
        response = self.client.post(
            f"/api/v1/assets/equipment/{self.equipment_a.id}/status/",
            {"status": "ready"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("کالیبراسیون", str(response.data))

    def test_failed_calibration_forces_out_of_service_and_audits(self):
        self.auth(self.inspector_a)
        response = self.client.post(
            "/api/v1/assets/calibrations/",
            {
                "equipment": self.equipment_a.id,
                "performed_on": str(self.today),
                "next_due_on": str(self.today + timedelta(days=180)),
                "provider": "آزمایشگاه معتمد",
                "certificate_number": "CERT-FAIL-1",
                "result": "failed",
                "notes": "نشتی مدار",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.equipment_a.refresh_from_db()
        self.assertEqual(self.equipment_a.status, Equipment.Status.OUT_OF_SERVICE)
        self.assertEqual(self.equipment_a.calibration_status, "failed")
        self.assertTrue(
            AuditEvent.objects.filter(
                organization=self.org_a, action="equipment.calibration_failed"
            ).exists()
        )

    def test_failed_calibration_cannot_be_hidden_by_disabling_requirement(self):
        self.auth(self.inspector_a)
        failed = self.client.post(
            "/api/v1/assets/calibrations/",
            {
                "equipment": self.equipment_a.id,
                "performed_on": str(self.today),
                "next_due_on": str(self.today + timedelta(days=180)),
                "provider": "آزمایشگاه معتمد",
                "result": "failed",
            },
            format="json",
        )
        self.assertEqual(failed.status_code, status.HTTP_201_CREATED, failed.data)

        self.auth(self.manager_a)
        response = self.client.patch(
            f"/api/v1/assets/equipment/{self.equipment_a.id}/",
            {"calibration_required": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.equipment_a.refresh_from_db()
        self.assertTrue(self.equipment_a.calibration_required)
        self.assertEqual(self.equipment_a.calibration_status, "failed")

    def test_calibration_due_date_must_be_after_performed_date(self):
        self.auth(self.inspector_a)
        response = self.client.post(
            "/api/v1/assets/calibrations/",
            {
                "equipment": self.equipment_a.id,
                "performed_on": str(self.today),
                "next_due_on": str(self.today),
                "provider": "آزمایشگاه",
                "result": "passed",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_calibration_expiry_is_not_reported_as_valid(self):
        self.calibration_a.next_due_on = self.today - timedelta(days=1)
        self.calibration_a.save(update_fields=["next_due_on"])
        self.assertFalse(self.equipment_a.is_calibration_valid)
        self.assertEqual(self.equipment_a.calibration_status, "expired")

    def test_due_filter_uses_latest_calibration_not_old_records(self):
        CalibrationRecord.objects.create(
            organization=self.org_a,
            equipment=self.equipment_a,
            performed_on=self.today - timedelta(days=400),
            next_due_on=self.today - timedelta(days=300),
            provider="آزمایشگاه قدیمی",
            certificate_number="OLD-CERT",
            result=CalibrationRecord.Result.PASSED,
        )
        self.auth(self.worker_a)
        expired = self.client.get(
            f"/api/v1/assets/equipment/?organization={self.org_a.id}&due=calibration_expired"
        )
        self.assertEqual(expired.status_code, status.HTTP_200_OK)
        self.assertEqual(expired.data, [])
        valid = self.client.get(
            f"/api/v1/assets/equipment/?organization={self.org_a.id}&calibration_status=valid"
        )
        self.assertEqual([item["id"] for item in valid.data], [self.equipment_a.id])


class AssetMaintenanceTests(AssetTestBase):
    def _create_plan(self, next_due_date=None, interval_days=30):
        return MaintenancePlan.objects.create(
            organization=self.org_a,
            equipment=self.equipment_a,
            title="سرویس دوره‌ای گازسنج",
            interval_days=interval_days,
            instructions="تست ضربه و کالیبراسیون",
            responsible=self.supervisor_a,
            start_date=self.today - timedelta(days=10),
            next_due_date=next_due_date or (self.today - timedelta(days=1)),
            created_by=self.manager_a,
        )

    def test_next_due_is_calculated_after_completed_service(self):
        plan = self._create_plan(next_due_date=self.today - timedelta(days=1))
        self.auth(self.supervisor_a)
        order_response = self.client.post(
            "/api/v1/assets/maintenance-work-orders/",
            {
                "equipment": self.equipment_a.id,
                "plan": plan.id,
                "title": "سرویس عقب‌افتاده",
                "work_type": "preventive",
                "assigned_to": self.supervisor_a.id,
                "scheduled_date": str(self.today - timedelta(days=1)),
                "description": "سرویس دوره‌ای",
            },
            format="json",
        )
        self.assertEqual(order_response.status_code, status.HTTP_201_CREATED, order_response.data)
        order_id = order_response.data["id"]
        self.assertEqual(
            self.client.post(f"/api/v1/assets/maintenance-work-orders/{order_id}/start/").status_code,
            status.HTTP_200_OK,
        )
        self.equipment_a.refresh_from_db()
        self.assertEqual(self.equipment_a.status, Equipment.Status.UNDER_MAINTENANCE)

        complete_response = self.client.post(
            f"/api/v1/assets/maintenance-work-orders/{order_id}/complete/",
            {"completed_date": str(self.today), "findings": "سالم", "result": "سرویس انجام شد."},
            format="json",
        )
        self.assertEqual(complete_response.status_code, status.HTTP_200_OK, complete_response.data)
        plan.refresh_from_db()
        self.equipment_a.refresh_from_db()
        self.assertEqual(plan.next_due_date, self.today + timedelta(days=30))
        self.assertEqual(self.equipment_a.status, Equipment.Status.READY)
        self.assertTrue(
            AuditEvent.objects.filter(
                organization=self.org_a, action="maintenance_work_order.completed"
            ).exists()
        )

    def test_completion_requires_result_and_valid_transition(self):
        plan = self._create_plan()
        order = MaintenanceWorkOrder.objects.create(
            organization=self.org_a,
            equipment=self.equipment_a,
            plan=plan,
            title="سرویس",
            work_type=MaintenanceWorkOrder.WorkType.PREVENTIVE,
            status=MaintenanceWorkOrder.Status.COMPLETED,
            scheduled_date=self.today,
            completed_date=self.today,
            result="قبلاً انجام شده",
        )
        self.auth(self.supervisor_a)
        response = self.client.post(
            f"/api/v1/assets/maintenance-work-orders/{order.id}/start/"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        planned = MaintenanceWorkOrder.objects.create(
            organization=self.org_a,
            equipment=self.equipment_a,
            title="سرویس بدون نتیجه",
            work_type=MaintenanceWorkOrder.WorkType.CORRECTIVE,
            status=MaintenanceWorkOrder.Status.PLANNED,
            scheduled_date=self.today,
        )
        response = self.client.post(
            f"/api/v1/assets/maintenance-work-orders/{planned.id}/complete/",
            {"result": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_overdue_filter_and_cross_tenant_plan_access(self):
        self._create_plan(next_due_date=self.today - timedelta(days=2))
        self.auth(self.supervisor_a)
        response = self.client.get(
            f"/api/v1/assets/maintenance-plans/?organization={self.org_a.id}&due=overdue"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        plan_b = MaintenancePlan.objects.create(
            organization=self.org_b,
            equipment=self.equipment_b,
            title="برنامه سازمان ب",
            interval_days=30,
            start_date=self.today,
            next_due_date=self.today,
        )
        response = self.client.get(f"/api/v1/assets/maintenance-plans/{plan_b.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_interval_bounds_and_cross_tenant_calibration_are_rejected(self):
        self.auth(self.manager_a)
        for interval in (0, 3651):
            response = self.client.post(
                "/api/v1/assets/maintenance-plans/",
                {
                    "equipment": self.equipment_a.id,
                    "title": "تناوب نامعتبر",
                    "interval_days": interval,
                    "start_date": str(self.today),
                },
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.auth(self.inspector_a)
        response = self.client.post(
            "/api/v1/assets/calibrations/",
            {
                "equipment": self.equipment_b.id,
                "performed_on": str(self.today),
                "next_due_on": str(self.today + timedelta(days=30)),
                "provider": "آزمایشگاه غیرمجاز",
                "result": "passed",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_hard_delete_of_equipment_is_blocked(self):
        with self.assertRaises(ValidationError):
            self.equipment_a.delete()

    def test_open_corrective_work_order_blocks_ready(self):
        self.equipment_a.status = Equipment.Status.UNDER_MAINTENANCE
        self.equipment_a.save(update_fields=["status"])
        MaintenanceWorkOrder.objects.create(
            organization=self.org_a,
            equipment=self.equipment_a,
            title="تعمیر باز",
            work_type=MaintenanceWorkOrder.WorkType.CORRECTIVE,
            status=MaintenanceWorkOrder.Status.PLANNED,
            scheduled_date=self.today,
        )
        self.auth(self.manager_a)
        response = self.client.post(
            f"/api/v1/assets/equipment/{self.equipment_a.id}/status/",
            {"status": "ready"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AssetIntegrationTests(AssetTestBase):
    def test_incident_and_nonconformity_links_are_tenant_validated(self):
        self.auth(self.inspector_a)
        incident = Incident.objects.create(
            organization=self.org_a,
            equipment=self.equipment_a,
            title="نشت گاز در محل تجهیز",
            description="نشت جزئی در اتصال گازسنج.",
            occurred_at=timezone.now(),
            reported_by=self.inspector_a,
        )
        self.assertEqual(incident.equipment_id, self.equipment_a.id)
        with self.assertRaises(ValidationError):
            Incident(
                organization=self.org_b,
                equipment=self.equipment_a,
                title="نامعتبر",
                description="نامعتبر",
                occurred_at=timezone.now(),
            ).full_clean()

        response = self.client.post(
            "/api/v1/non-conformities/",
            {
                "organization": self.org_a.id,
                "equipment": self.equipment_a.id,
                "description": "کالیبراسیون منقضی روی تجهیز",
                "severity": "high",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["equipment"], self.equipment_a.id)

        response = self.client.post(
            "/api/v1/non-conformities/",
            {
                "organization": self.org_a.id,
                "equipment": self.equipment_b.id,
                "description": "تجهیز سازمان دیگر",
                "severity": "high",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_inspection_model_rejects_cross_tenant_equipment(self):
        from apps.checklists.models import Checklist

        checklist = Checklist.objects.create(
            organization=self.org_a, title="چک‌لیست تجهیز", created_by=self.manager_a
        )
        inspection = Inspection(
            organization=self.org_a,
            equipment=self.equipment_b,
            checklist=checklist,
            title="بازرسی نامعتبر",
        )
        with self.assertRaises(ValidationError):
            inspection.full_clean()

    def test_asset_detail_exposes_linked_history(self):
        Incident.objects.create(
            organization=self.org_a,
            equipment=self.equipment_a,
            title="حادثه مرتبط",
            description="شرح",
            occurred_at=timezone.now(),
            reported_by=self.inspector_a,
        )
        NonConformity.objects.create(
            organization=self.org_a,
            equipment=self.equipment_a,
            description="عدم‌انطباق مرتبط",
            severity=NonConformity.Severity.MEDIUM,
        )
        self.auth(self.worker_a)
        response = self.client.get(f"/api/v1/assets/equipment/{self.equipment_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["related_incidents"]), 1)
        self.assertEqual(len(response.data["related_nonconformities"]), 1)


class AssetSeedTests(TestCase):
    def test_seed_is_idempotent_and_preserves_real_password_and_assets(self):
        call_command("seed_demo_data", stdout=StringIO())
        first_equipment_count = Equipment.objects.filter(is_synthetic=True).count()
        self.assertGreater(first_equipment_count, 0)
        self.assertTrue(CalibrationRecord.objects.filter(is_synthetic=True).exists())
        demo_equipment = Equipment.objects.get(code="FA-EXT-001", is_synthetic=True)
        demo_plan = demo_equipment.maintenance_plans.get(is_synthetic=True)
        completed_orders = demo_plan.work_orders.filter(
            status=MaintenanceWorkOrder.Status.COMPLETED
        ).order_by("-completed_date")
        self.assertGreaterEqual(completed_orders.count(), 2)
        expected_due = completed_orders.first().completed_date + timedelta(
            days=demo_plan.interval_days
        )
        self.assertEqual(demo_plan.next_due_date, expected_due)

        demo_manager = User.objects.get(username="demo_hse_manager")
        demo_manager.set_password("Changed-Password-123!")
        demo_manager.save(update_fields=["password"])

        real_equipment = Equipment.objects.create(
            organization=Organization.objects.get(code="foolad-alborz"),
            code="REAL-ASSET-001",
            name="تجهیز واقعی",
            is_synthetic=False,
        )

        call_command("seed_demo_data", stdout=StringIO())
        self.assertEqual(
            Equipment.objects.filter(is_synthetic=True).count(), first_equipment_count
        )
        demo_manager.refresh_from_db()
        self.assertTrue(demo_manager.check_password("Changed-Password-123!"))
        real_equipment.refresh_from_db()
        self.assertEqual(real_equipment.name, "تجهیز واقعی")
        self.assertFalse(real_equipment.is_synthetic)
