from datetime import timedelta
from io import StringIO

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.auditlog.models import AuditEvent
from apps.organizations.models import Membership, Organization
from apps.permits.models import Permit, PermitTypeCompetencyRequirement
from apps.permits.services import approve_permit, request_permit, review_permit, verify_controls_and_activate
from apps.workplaces.models import Workplace
from apps.workforce.models import (
    COMPETENCY_DUE_SOON_DAYS,
    PPE_REPLACEMENT_DUE_SOON_DAYS,
    Competency,
    Employee,
    EmployeeCompetency,
    PPEAssignment,
    PPEAssignmentEvent,
    PPEItem,
    PPEStock,
    TrainingAttendance,
    TrainingCourse,
    TrainingSession,
)
from apps.workforce.services import (
    assert_permit_competencies,
    create_assignment,
    create_attendance,
    create_competency,
    create_course,
    create_employee,
    create_ppe_item,
    create_session,
    create_stock,
    dispose_assignment,
    issue_employee_competency,
    replace_assignment,
    return_assignment,
    validate_permit_competencies,
    workforce_stats,
)


class WorkforceTestBase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = timezone.localdate()

        self.admin_a = User.objects.create_user(
            username="wf_admin_a", email="admin-a@example.com", password="Password123!"
        )
        self.manager_a = User.objects.create_user(
            username="wf_manager_a", email="manager-a@example.com", password="Password123!"
        )
        self.inspector_a = User.objects.create_user(
            username="wf_inspector_a", email="inspector-a@example.com", password="Password123!"
        )
        self.supervisor_a = User.objects.create_user(
            username="wf_supervisor_a", email="supervisor-a@example.com", password="Password123!"
        )
        self.worker_a = User.objects.create_user(
            username="wf_worker_a", email="worker-a@example.com", password="Password123!"
        )
        self.admin_b = User.objects.create_user(
            username="wf_admin_b", email="admin-b@example.com", password="Password123!"
        )

        self.org_a = Organization.objects.create(name="سازمان الف", code="WF-ORG-A")
        self.org_b = Organization.objects.create(name="سازمان ب", code="WF-ORG-B")
        self.workplace_a = Workplace.objects.create(
            organization=self.org_a, name="کارگاه الف", code="wf-wp-a"
        )
        self.workplace_b = Workplace.objects.create(
            organization=self.org_b, name="کارگاه ب", code="wf-wp-b"
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

        self.emp_a1 = Employee.objects.create(
            organization=self.org_a,
            workplace=self.workplace_a,
            employee_no="EMP-001",
            first_name="علی",
            last_name="رضایی",
            job_title="تکنسین فنی",
            user=self.worker_a,
        )
        self.emp_a2 = Employee.objects.create(
            organization=self.org_a,
            workplace=self.workplace_a,
            employee_no="EMP-002",
            first_name="محسن",
            last_name="حسینی",
            job_title="جوشکار",
        )
        self.emp_b1 = Employee.objects.create(
            organization=self.org_b,
            workplace=self.workplace_b,
            employee_no="EMP-B01",
            first_name="سعید",
            last_name="مرادی",
            job_title="اپراتور",
        )

        self.course_a = TrainingCourse.objects.create(
            organization=self.org_a,
            code="TR-HOT-01",
            title="ایمنی کار گرم و جوشکاری",
            category="ایمنی عمومی",
            delivery_type=TrainingCourse.DeliveryType.IN_PERSON,
            duration_minutes=480,
            validity_months=12,
            is_mandatory=True,
        )
        self.competency_a = Competency.objects.create(
            organization=self.org_a,
            code="COMP-HOT-01",
            name="صلاحیت کار گرم و برش‌کاری",
            validity_months=12,
        )
        self.competency_a.accepted_courses.add(self.course_a)

        self.ppe_item_a = PPEItem.objects.create(
            organization=self.org_a,
            code="PPE-HRN-01",
            name="هارنس ایمنی ۵ نقطه‌ای",
            category="حفاظت در برابر سقوط",
            inspection_required=True,
            tracks_serial=True,
            replacement_interval_days=730,
        )
        self.ppe_stock_a = PPEStock.objects.create(
            organization=self.org_a,
            item=self.ppe_item_a,
            workplace=self.workplace_a,
            quantity_on_hand=10,
            quantity_minimum=2,
        )

        self.ppe_item_consumable = PPEItem.objects.create(
            organization=self.org_a,
            code="PPE-GLV-01",
            name="دستکش نیتریل صنعتی",
            category="حفاظت دست",
            tracks_serial=False,
            is_durable=False,
        )
        self.ppe_stock_consumable = PPEStock.objects.create(
            organization=self.org_a,
            item=self.ppe_item_consumable,
            workplace=self.workplace_a,
            quantity_on_hand=5,
            quantity_minimum=2,
        )


class WorkforceTenantIsolationTests(WorkforceTestBase):
    def test_list_endpoints_isolate_by_tenant(self):
        self.client.force_login(self.admin_b)

        res = self.client.get("/api/v1/workforce/employees/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in res.data]
        self.assertIn(self.emp_b1.id, ids)
        self.assertNotIn(self.emp_a1.id, ids)

        res_courses = self.client.get("/api/v1/workforce/courses/")
        self.assertEqual(res_courses.status_code, status.HTTP_200_OK)
        course_ids = [c["id"] for c in res_courses.data]
        self.assertNotIn(self.course_a.id, course_ids)

    def test_cross_tenant_employee_access_denied(self):
        self.client.force_login(self.admin_b)
        res = self.client.get(f"/api/v1/workforce/employees/{self.emp_a1.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_assign_cross_tenant_workplace_to_employee(self):
        self.client.force_login(self.admin_a)
        res = self.client.post(
            "/api/v1/workforce/employees/",
            {
                "employee_no": "EMP-X99",
                "first_name": "نام",
                "last_name": "خانوادگی",
                "workplace": self.workplace_b.id,  # Wrong organization
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class TrainingWorkflowTests(WorkforceTestBase):
    def test_session_creation_and_attendance_flow(self):
        self.client.force_login(self.manager_a)

        # Create session
        res_sess = self.client.post(
            "/api/v1/workforce/training-sessions/",
            {
                "course": self.course_a.id,
                "workplace": self.workplace_a.id,
                "scheduled_on": str(self.today),
                "instructor_name": "مهندس صادقی",
                "status": TrainingSession.Status.COMPLETED,
                "capacity": 20,
            },
            format="json",
        )
        self.assertEqual(res_sess.status_code, status.HTTP_201_CREATED)
        session_id = res_sess.data["id"]

        # Record passed attendance
        res_att = self.client.post(
            "/api/v1/workforce/training-attendances/",
            {
                "session": session_id,
                "employee": self.emp_a1.id,
                "attendance_status": TrainingAttendance.AttendanceStatus.ATTENDED,
                "assessment_result": TrainingAttendance.AssessmentResult.PASSED,
                "score": 92.5,
                "completed_on": str(self.today),
            },
            format="json",
        )
        self.assertEqual(res_att.status_code, status.HTTP_201_CREATED)

        # Duplicate attendance for same session and employee rejected
        res_dup = self.client.post(
            "/api/v1/workforce/training-attendances/",
            {
                "session": session_id,
                "employee": self.emp_a1.id,
                "attendance_status": TrainingAttendance.AttendanceStatus.ATTENDED,
                "assessment_result": TrainingAttendance.AssessmentResult.PASSED,
                "completed_on": str(self.today),
            },
            format="json",
        )
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_record_passed_on_planned_session(self):
        session = TrainingSession.objects.create(
            organization=self.org_a,
            course=self.course_a,
            scheduled_on=self.today + timedelta(days=5),
            status=TrainingSession.Status.SCHEDULED,
        )
        self.client.force_login(self.manager_a)
        res = self.client.post(
            "/api/v1/workforce/training-attendances/",
            {
                "session": session.id,
                "employee": self.emp_a1.id,
                "attendance_status": TrainingAttendance.AttendanceStatus.ATTENDED,
                "assessment_result": TrainingAttendance.AssessmentResult.PASSED,
                "completed_on": str(self.today),
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class CompetencyLifecycleTests(WorkforceTestBase):
    def test_competency_issuance_and_status_calculation(self):
        self.client.force_login(self.manager_a)

        # 1. Issue valid competency expiring in 12 months
        res_issue = self.client.post(
            "/api/v1/workforce/employee-competencies/",
            {
                "employee": self.emp_a1.id,
                "competency": self.competency_a.id,
                "achieved_on": str(self.today),
                "expires_on": str(self.today + timedelta(days=365)),
                "certificate_number": "CERT-2026-001",
            },
            format="json",
        )
        self.assertEqual(res_issue.status_code, status.HTTP_201_CREATED)
        comp_record_id = res_issue.data["id"]

        # Check detail endpoint
        res_detail = self.client.get(
            f"/api/v1/workforce/employee-competencies/{comp_record_id}/"
        )
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(res_detail.data["effective_status"], "valid")
        self.assertTrue(res_detail.data["is_valid"])

    def test_competency_expiring_soon_and_expired(self):
        # Expiring soon (10 days remaining)
        rec_soon = EmployeeCompetency.objects.create(
            organization=self.org_a,
            employee=self.emp_a1,
            competency=self.competency_a,
            achieved_on=self.today - timedelta(days=355),
            expires_on=self.today + timedelta(days=10),
            status=EmployeeCompetency.Status.ACTIVE,
        )
        self.assertTrue(rec_soon.is_valid)
        self.assertEqual(rec_soon.effective_status, "expiring_soon")

        # Expired (5 days ago)
        rec_exp = EmployeeCompetency.objects.create(
            organization=self.org_a,
            employee=self.emp_a2,
            competency=self.competency_a,
            achieved_on=self.today - timedelta(days=370),
            expires_on=self.today - timedelta(days=5),
            status=EmployeeCompetency.Status.ACTIVE,
        )
        self.assertFalse(rec_exp.is_valid)
        self.assertEqual(rec_exp.effective_status, "expired")

    def test_suspend_and_revoke_competency(self):
        rec = EmployeeCompetency.objects.create(
            organization=self.org_a,
            employee=self.emp_a1,
            competency=self.competency_a,
            achieved_on=self.today,
            expires_on=self.today + timedelta(days=365),
            status=EmployeeCompetency.Status.ACTIVE,
        )
        self.client.force_login(self.manager_a)
        res_suspend = self.client.post(
            f"/api/v1/workforce/employee-competencies/{rec.id}/status/",
            {"status": EmployeeCompetency.Status.SUSPENDED, "reason": "عدم رعایت الزامات ایمنی"},
            format="json",
        )
        self.assertEqual(res_suspend.status_code, status.HTTP_200_OK)
        rec.refresh_from_db()
        self.assertEqual(rec.status, EmployeeCompetency.Status.SUSPENDED)
        self.assertFalse(rec.is_valid)


class PermitCompetencyValidationTests(WorkforceTestBase):
    def setUp(self):
        super().setUp()
        # Add competency requirement for HOT_WORK on org_a
        self.requirement = PermitTypeCompetencyRequirement.objects.create(
            organization=self.org_a,
            permit_type=Permit.PermitType.HOT_WORK,
            competency=self.competency_a,
        )

        # Create hot work permit
        self.permit = Permit.objects.create(
            organization=self.org_a,
            workplace=self.workplace_a,
            permit_type=Permit.PermitType.HOT_WORK,
            title="جوشکاری لوله اصلی گاز",
            description="جوشکاری خط لوله در محوطه کارگاه",
            reference_code="PTW-TEST-001",
            work_area="ناحیه جوشکاری",
            valid_from=timezone.now(),
            valid_until=timezone.now() + timedelta(hours=8),
            requester=self.supervisor_a,
            responsible_supervisor=self.supervisor_a,
            status=Permit.Status.REQUESTED,
        )

    def test_permit_approval_fails_without_competent_crew(self):
        # Permit has no assigned employees
        review_permit(self.permit, self.manager_a, status_choice=Permit.Status.UNDER_REVIEW)
        self.permit.refresh_from_db()

        with self.assertRaises(ValidationError) as ctx:
            approve_permit(self.permit, self.manager_a)
        self.assertIn("صلاحیت الزامی مجوز کار تأیید نشد", str(ctx.exception))

    def test_permit_approval_fails_with_expired_competency(self):
        # Assign emp_a2 with expired competency
        EmployeeCompetency.objects.create(
            organization=self.org_a,
            employee=self.emp_a2,
            competency=self.competency_a,
            achieved_on=self.today - timedelta(days=370),
            expires_on=self.today - timedelta(days=5),
            status=EmployeeCompetency.Status.ACTIVE,
        )
        self.permit.assigned_employees.add(self.emp_a2)
        review_permit(self.permit, self.manager_a, status_choice=Permit.Status.UNDER_REVIEW)

        with self.assertRaises(ValidationError) as ctx:
            approve_permit(self.permit, self.manager_a)
        self.assertIn("صلاحیت الزامی مجوز کار تأیید نشد", str(ctx.exception))

    def test_permit_approval_and_activation_succeed_with_valid_competency(self):
        # Assign emp_a1 with valid competency
        EmployeeCompetency.objects.create(
            organization=self.org_a,
            employee=self.emp_a1,
            competency=self.competency_a,
            achieved_on=self.today,
            expires_on=self.today + timedelta(days=365),
            status=EmployeeCompetency.Status.ACTIVE,
        )
        self.permit.assigned_employees.add(self.emp_a1)
        review_permit(self.permit, self.manager_a, status_choice=Permit.Status.UNDER_REVIEW)

        # Now approve succeeds!
        approved_permit = approve_permit(self.permit, self.manager_a)
        self.assertEqual(approved_permit.status, Permit.Status.APPROVED)

        # Activate succeeds!
        activated_permit = verify_controls_and_activate(approved_permit, self.supervisor_a)
        self.assertEqual(activated_permit.status, Permit.Status.ACTIVE)

        # Audit event checked
        last_event = AuditEvent.objects.filter(entity_type="Permit", action="permit.activated").first()
        self.assertIsNotNone(last_event)
        self.assertTrue(last_event.details.get("competency_compliant"))


class PPEStockAndAssignmentTests(WorkforceTestBase):
    def test_ppe_issuance_reduces_stock_atomically(self):
        initial_stock = self.ppe_stock_a.quantity_on_hand
        self.assertEqual(initial_stock, 10)

        assignment = create_assignment(
            organization=self.org_a,
            actor=self.supervisor_a,
            data={
                "employee": self.emp_a1,
                "item": self.ppe_item_a,
                "stock": self.ppe_stock_a,
                "quantity": 1,
                "serial_number": "SN-HARN-001",
                "issued_on": self.today,
                "condition_on_issue": "سالم و نو",
            },
        )
        self.assertEqual(assignment.status, PPEAssignment.Status.ACTIVE)
        self.ppe_stock_a.refresh_from_db()
        self.assertEqual(self.ppe_stock_a.quantity_on_hand, initial_stock - 1)

        # Event logged
        event = assignment.events.first()
        self.assertIsNotNone(event)
        self.assertEqual(event.event_type, PPEAssignmentEvent.EventType.ISSUED)

    def test_ppe_issuance_cannot_exceed_available_stock(self):
        with self.assertRaises(ValidationError) as ctx:
            create_assignment(
                organization=self.org_a,
                actor=self.supervisor_a,
                data={
                    "employee": self.emp_a1,
                    "item": self.ppe_item_consumable,
                    "stock": self.ppe_stock_consumable,
                    "quantity": 999,  # Far exceeds stock
                    "issued_on": self.today,
                },
            )
        self.assertIn("موجودی کافی نیست", str(ctx.exception))
        self.ppe_stock_consumable.refresh_from_db()
        self.assertEqual(self.ppe_stock_consumable.quantity_on_hand, 5)

    def test_ppe_return_and_replacement_lifecycle(self):
        assignment = create_assignment(
            organization=self.org_a,
            actor=self.supervisor_a,
            data={
                "employee": self.emp_a1,
                "item": self.ppe_item_a,
                "stock": self.ppe_stock_a,
                "quantity": 1,
                "serial_number": "SN-HARN-002",
                "issued_on": self.today,
            },
        )
        self.ppe_stock_a.refresh_from_db()
        self.assertEqual(self.ppe_stock_a.quantity_on_hand, 9)

        # Return assignment
        returned = return_assignment(
            assignment=assignment,
            actor=self.supervisor_a,
            condition="سالم و تمیز",
            returned_on=self.today,
            notes="پایان پروژه",
        )
        self.assertEqual(returned.status, PPEAssignment.Status.RETURNED)
        self.ppe_stock_a.refresh_from_db()
        self.assertEqual(self.ppe_stock_a.quantity_on_hand, 10)

        # Check events
        event_types = list(assignment.events.values_list("event_type", flat=True))
        self.assertIn(PPEAssignmentEvent.EventType.ISSUED, event_types)
        self.assertIn(PPEAssignmentEvent.EventType.RETURNED, event_types)

    def test_serialized_ppe_uniqueness(self):
        # First assignment with serial number
        create_assignment(
            organization=self.org_a,
            actor=self.supervisor_a,
            data={
                "employee": self.emp_a1,
                "item": self.ppe_item_a,
                "stock": self.ppe_stock_a,
                "quantity": 1,
                "serial_number": "SN-HARNESS-001",
                "issued_on": self.today,
            },
        )

        # Second assignment with same serial number must fail
        with self.assertRaises(ValidationError) as ctx:
            create_assignment(
                organization=self.org_a,
                actor=self.supervisor_a,
                data={
                    "employee": self.emp_a2,
                    "item": self.ppe_item_a,
                    "stock": self.ppe_stock_a,
                    "quantity": 1,
                    "serial_number": "SN-HARNESS-001",
                    "issued_on": self.today,
                },
            )
        self.assertTrue(
            "unique_active_ppe_serial_per_item" in str(ctx.exception)
            or "تخصیص داده شده است" in str(ctx.exception)
        )


class WorkforceSecurityAndHistoryTests(WorkforceTestBase):
    def test_cross_tenant_relationships_are_rejected(self):
        self.client.force_login(self.admin_a)
        res = self.client.post(
            "/api/v1/workforce/training-sessions/",
            {
                "course": self.course_a.id,
                "workplace": self.workplace_b.id,
                "instructor_name": "مدرس آزمون",
                "scheduled_on": str(self.today),
                "status": TrainingSession.Status.SCHEDULED,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        res = self.client.post(
            "/api/v1/workforce/ppe-assignments/",
            {
                "employee": self.emp_b1.id,
                "item": self.ppe_item_a.id,
                "stock": self.ppe_stock_a.id,
                "quantity": 1,
                "serial_number": "CROSS-ORG-1",
                "issued_on": str(self.today),
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_worker_cannot_create_workforce_records(self):
        self.client.force_login(self.worker_a)
        res = self.client.post(
            "/api/v1/workforce/employees/",
            {
                "employee_no": "EMP-NO-PERM",
                "first_name": "بدون",
                "last_name": "دسترسی",
            },
            format="json",
        )
        # The organization resolver deliberately returns 404 for unauthorized
        # organizations so it never discloses whether another tenant exists.
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_training_history_survives_course_deactivation(self):
        session = TrainingSession.objects.create(
            organization=self.org_a,
            course=self.course_a,
            scheduled_on=self.today,
            instructor_name="مدرس",
            status=TrainingSession.Status.COMPLETED,
        )
        attendance = create_attendance(
            session=session,
            actor=self.manager_a,
            data={
                "employee": self.emp_a1,
                "attendance_status": TrainingAttendance.AttendanceStatus.ATTENDED,
                "assessment_result": TrainingAttendance.AssessmentResult.PASSED,
                "score": 88,
                "completed_on": self.today,
            },
        )
        self.client.force_login(self.manager_a)
        res = self.client.patch(
            f"/api/v1/workforce/courses/{self.course_a.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data["is_active"])

        history = self.client.get(
            f"/api/v1/workforce/employees/{self.emp_a1.id}/training/"
        )
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(history.data[0]["id"], attendance.id)

    def test_competency_issuance_audit_and_renewal_history(self):
        self.client.force_login(self.manager_a)
        payload = {
            "employee": self.emp_a1.id,
            "competency": self.competency_a.id,
            "achieved_on": str(self.today - timedelta(days=400)),
            "expires_on": str(self.today - timedelta(days=30)),
        }
        first = self.client.post(
            "/api/v1/workforce/employee-competencies/", payload, format="json"
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(first.data["effective_status"], "expired")
        self.assertFalse(first.data["is_valid"])

        second = self.client.post(
            "/api/v1/workforce/employee-competencies/",
            {
                **payload,
                "achieved_on": str(self.today),
                "expires_on": str(self.today + timedelta(days=365)),
                "certificate_number": "RENEW-001",
            },
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertTrue(second.data["is_valid"])

        history = self.client.get(
            f"/api/v1/workforce/employees/{self.emp_a1.id}/competencies/"
        )
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(len(history.data), 2)
        self.assertIn(
            "employee_competency.issued",
            AuditEvent.objects.filter(
                entity_type="employee_competency"
            ).values_list("action", flat=True),
        )

    def test_competency_rejects_future_date_and_unaccepted_source_course(self):
        other_course = TrainingCourse.objects.create(
            organization=self.org_a,
            code="TR-OTHER",
            title="دوره نامرتبط",
            category="عمومی",
            duration_minutes=60,
        )
        self.client.force_login(self.manager_a)
        res = self.client.post(
            "/api/v1/workforce/employee-competencies/",
            {
                "employee": self.emp_a1.id,
                "competency": self.competency_a.id,
                "achieved_on": str(self.today + timedelta(days=1)),
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        res = self.client.post(
            "/api/v1/workforce/employee-competencies/",
            {
                "employee": self.emp_a1.id,
                "competency": self.competency_a.id,
                "achieved_on": str(self.today),
                "source_course": other_course.id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_revoked_competency_is_never_valid(self):
        record = EmployeeCompetency.objects.create(
            organization=self.org_a,
            employee=self.emp_a1,
            competency=self.competency_a,
            achieved_on=self.today - timedelta(days=10),
            expires_on=self.today + timedelta(days=100),
            status=EmployeeCompetency.Status.REVOKED,
        )
        self.assertFalse(record.is_valid)
        self.assertEqual(record.effective_status, "revoked")

    def test_attendance_result_requires_attendance_and_closed_session(self):
        session = TrainingSession.objects.create(
            organization=self.org_a,
            course=self.course_a,
            scheduled_on=self.today,
            status=TrainingSession.Status.COMPLETED,
        )
        with self.assertRaises(ValidationError):
            create_attendance(
                session=session,
                actor=self.manager_a,
                data={
                    "employee": self.emp_a1,
                    "attendance_status": TrainingAttendance.AttendanceStatus.ABSENT,
                    "assessment_result": TrainingAttendance.AssessmentResult.PASSED,
                    "completed_on": self.today,
                },
            )



class PermitRevalidationTests(WorkforceTestBase):
    def setUp(self):
        super().setUp()
        PermitTypeCompetencyRequirement.objects.create(
            organization=self.org_a,
            permit_type=Permit.PermitType.HOT_WORK,
            competency=self.competency_a,
        )
        self.permit = Permit.objects.create(
            organization=self.org_a,
            workplace=self.workplace_a,
            permit_type=Permit.PermitType.HOT_WORK,
            title="جوشکاری مخزن",
            description="آزمون اعتبارسنجی مجدد",
            reference_code="PTW-REVALIDATE-001",
            work_area="محوطه",
            valid_from=timezone.now(),
            valid_until=timezone.now() + timedelta(hours=8),
            requester=self.supervisor_a,
            responsible_supervisor=self.supervisor_a,
            status=Permit.Status.REQUESTED,
        )
        EmployeeCompetency.objects.create(
            organization=self.org_a,
            employee=self.emp_a1,
            competency=self.competency_a,
            achieved_on=self.today,
            expires_on=self.today + timedelta(days=365),
        )
        self.permit.assigned_employees.add(self.emp_a1)

    def test_activation_revalidates_after_crew_change(self):
        review_permit(self.permit, self.manager_a, status_choice=Permit.Status.UNDER_REVIEW)
        approved = approve_permit(self.permit, self.manager_a)
        expired = EmployeeCompetency.objects.create(
            organization=self.org_a,
            employee=self.emp_a2,
            competency=self.competency_a,
            achieved_on=self.today - timedelta(days=400),
            expires_on=self.today - timedelta(days=1),
        )
        self.assertFalse(expired.is_valid)
        approved.assigned_employees.add(self.emp_a2)
        with self.assertRaises(ValidationError):
            verify_controls_and_activate(approved, self.supervisor_a)

    def test_activation_revalidates_after_removing_crew(self):
        review_permit(self.permit, self.manager_a, status_choice=Permit.Status.UNDER_REVIEW)
        approved = approve_permit(self.permit, self.manager_a)
        approved.assigned_employees.clear()
        with self.assertRaises(ValidationError):
            verify_controls_and_activate(approved, self.supervisor_a)

    def test_free_text_crew_is_unknown_even_when_requester_maps_to_employee(self):
        self.emp_a2.user = self.supervisor_a
        self.emp_a2.save(update_fields=["user"])
        self.permit.assigned_employees.clear()
        self.permit.assigned_workers = "تیم پیمانکاری بدون شناسه ساختاریافته"
        self.permit.save(update_fields=["assigned_workers"])
        validation = validate_permit_competencies(self.permit)
        self.assertTrue(validation["is_unknown"])
        self.assertFalse(validation["is_compliant"])
        self.assertTrue(validation["unstructured_workers"])
        with self.assertRaises(ValidationError):
            assert_permit_competencies(self.permit)

    def test_suspended_competency_blocks_activation(self):
        EmployeeCompetency.objects.filter(employee=self.emp_a1).update(
            status=EmployeeCompetency.Status.SUSPENDED
        )
        review_permit(self.permit, self.manager_a, status_choice=Permit.Status.UNDER_REVIEW)
        with self.assertRaises(ValidationError):
            approve_permit(self.permit, self.manager_a)


class PPESafetyAndAuditTests(WorkforceTestBase):
    def test_second_issue_beyond_stock_does_not_go_negative(self):
        first = create_assignment(
            organization=self.org_a,
            actor=self.supervisor_a,
            data={
                "employee": self.emp_a1,
                "item": self.ppe_item_consumable,
                "stock": self.ppe_stock_consumable,
                "quantity": 4,
                "issued_on": self.today,
            },
        )
        self.assertEqual(first.quantity, 4)
        with self.assertRaises(ValidationError):
            create_assignment(
                organization=self.org_a,
                actor=self.supervisor_a,
                data={
                    "employee": self.emp_a2,
                    "item": self.ppe_item_consumable,
                    "stock": self.ppe_stock_consumable,
                    "quantity": 2,
                    "issued_on": self.today,
                },
            )
        self.ppe_stock_consumable.refresh_from_db()
        self.assertEqual(self.ppe_stock_consumable.quantity_on_hand, 1)
        self.assertGreaterEqual(self.ppe_stock_consumable.quantity_on_hand, 0)

    def test_damaged_return_is_not_restocked(self):
        assignment = create_assignment(
            organization=self.org_a,
            actor=self.supervisor_a,
            data={
                "employee": self.emp_a1,
                "item": self.ppe_item_consumable,
                "stock": self.ppe_stock_consumable,
                "quantity": 2,
                "issued_on": self.today,
            },
        )
        self.ppe_stock_consumable.refresh_from_db()
        self.assertEqual(self.ppe_stock_consumable.quantity_on_hand, 3)
        returned = return_assignment(
            assignment=assignment,
            actor=self.supervisor_a,
            condition="پاره و غیرقابل استفاده",
            returned_on=self.today,
            restock=False,
        )
        self.assertEqual(returned.status, PPEAssignment.Status.RETURNED)
        self.ppe_stock_consumable.refresh_from_db()
        self.assertEqual(self.ppe_stock_consumable.quantity_on_hand, 3)
        self.assertTrue(returned.events.filter(event_type=PPEAssignmentEvent.EventType.RETURNED).exists())

    def test_replacement_default_does_not_restock_old_item(self):
        assignment = create_assignment(
            organization=self.org_a,
            actor=self.supervisor_a,
            data={
                "employee": self.emp_a1,
                "item": self.ppe_item_a,
                "stock": self.ppe_stock_a,
                "quantity": 1,
                "serial_number": "OLD-HARNESS",
                "issued_on": self.today,
            },
        )
        replacement = replace_assignment(
            assignment=assignment,
            actor=self.supervisor_a,
            data={
                "serial_number": "NEW-HARNESS",
                "issued_on": self.today,
                "replacement_due_on": self.today + timedelta(days=365),
            },
        )
        self.assertEqual(replacement.status, PPEAssignment.Status.ACTIVE)
        self.ppe_stock_a.refresh_from_db()
        # Old item is not assumed serviceable, new item consumes one unit:
        # 10 - 1 (initial issue) - 1 (replacement issue) = 8.
        self.assertEqual(self.ppe_stock_a.quantity_on_hand, 8)
        self.assertTrue(
            assignment.events.filter(event_type=PPEAssignmentEvent.EventType.REPLACED).exists()
        )

    def test_dispose_keeps_history_and_does_not_restock(self):
        assignment = create_assignment(
            organization=self.org_a,
            actor=self.supervisor_a,
            data={
                "employee": self.emp_a1,
                "item": self.ppe_item_consumable,
                "stock": self.ppe_stock_consumable,
                "quantity": 2,
                "issued_on": self.today,
            },
        )
        dispose_assignment(
            assignment=assignment,
            actor=self.supervisor_a,
            condition="آسیب‌دیده",
            notes="خروج از سرویس",
        )
        self.ppe_stock_consumable.refresh_from_db()
        self.assertEqual(self.ppe_stock_consumable.quantity_on_hand, 3)
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, PPEAssignment.Status.DISPOSED)
        self.assertTrue(
            assignment.events.filter(event_type=PPEAssignmentEvent.EventType.DISPOSED).exists()
        )
        with self.assertRaises(ValidationError):
            assignment.delete()

    def test_ppe_audit_events_are_written(self):
        assignment = create_assignment(
            organization=self.org_a,
            actor=self.supervisor_a,
            data={
                "employee": self.emp_a1,
                "item": self.ppe_item_consumable,
                "stock": self.ppe_stock_consumable,
                "quantity": 1,
                "issued_on": self.today,
            },
        )
        return_assignment(
            assignment=assignment,
            actor=self.supervisor_a,
            condition="سالم",
            returned_on=self.today,
        )
        actions = set(
            AuditEvent.objects.filter(entity_type="ppe_assignment").values_list(
                "action", flat=True
            )
        )
        self.assertIn("ppe_assignment.issued", actions)
        self.assertIn("ppe_assignment.returned", actions)


class WorkforceReportAndStatsTests(WorkforceTestBase):
    def test_csv_exports(self):
        self.client.force_login(self.manager_a)

        for report_type in ["training", "competencies", "ppe"]:
            res = self.client.get(f"/api/v1/reports/export/{report_type}/")
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res["Content-Type"], "text/csv; charset=utf-8-sig")
            content = res.content
            # Verify UTF-8 BOM
            self.assertTrue(content.startswith(b"\xef\xbb\xbf"))

    def test_workforce_stats(self):
        self.client.force_login(self.manager_a)
        res = self.client.get("/api/v1/workforce/stats/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("employees_total", res.data)
        self.assertIn("employees_active", res.data)
        self.assertIn("courses_active", res.data)
        self.assertIn("competency_valid", res.data)
        self.assertIn("ppe_active_assignments", res.data)
