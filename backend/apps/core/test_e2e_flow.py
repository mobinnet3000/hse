from datetime import timedelta
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.accounts.models import User
from apps.checklists.models import Checklist, ChecklistItem
from apps.organizations.models import Membership, Organization
from apps.workplaces.models import Workplace


class EndToEndScenarioTests(TestCase):
    """
    End-to-End scenario test covering:
    1. Authentication & organization access
    2. Hazard identification & risk assessment
    3. Inspection checklist execution & item responses
    4. Non-conformity creation from non-conforming item
    5. Corrective action creation, notification dispatch, progress update & verification
    6. Dashboard metrics reflect completed inspection, risk, NC, and completed action
    7. CSV report export for all entities
    8. Audit log records events
    """

    def setUp(self):
        self.org = Organization.objects.create(name="شرکت پتروشیمی پارس", code="pars-petro")
        self.manager = User.objects.create_user(
            username="hse_mgr",
            email="mgr@parspetro.ir",
            password="Strong-Password-1234!",
            first_name="محمد",
            last_name="حسینی",
        )
        self.worker = User.objects.create_user(
            username="field_eng",
            email="eng@parspetro.ir",
            password="Strong-Password-1234!",
            first_name="رضا",
            last_name="کریمی",
        )
        Membership.objects.create(
            user=self.manager,
            organization=self.org,
            role=Membership.Roles.HSE_MANAGER,
        )
        Membership.objects.create(
            user=self.worker,
            organization=self.org,
            role=Membership.Roles.ACTION_OWNER,
        )
        self.workplace = Workplace.objects.create(
            organization=self.org,
            name="واحد تقطیر ۲",
            code="DIST-02",
        )

    def test_complete_e2e_hse_lifecycle(self):
        # 1. Login
        login_res = self.client.post(
            reverse("auth-login"),
            {"username": "hse_mgr", "password": "Strong-Password-1234!"},
            content_type="application/json",
        )
        self.assertEqual(login_res.status_code, 200)

        # Verify access to organization
        orgs_res = self.client.get(reverse("organization-list"))
        self.assertEqual(orgs_res.status_code, 200)
        self.assertEqual(len(orgs_res.json()), 1)
        self.assertEqual(orgs_res.json()[0]["id"], self.org.id)

        # 2. Register hazard and perform risk assessment
        hazard_res = self.client.post(
            reverse("hazard-list"),
            {
                "organization": self.org.id,
                "workplace": self.workplace.id,
                "title": "نشت بخار در فلنج خط ۷",
                "category": "safety",
                "description": "نشت جزئی بخار در فشار کاری ۸ بار",
            },
            content_type="application/json",
        )
        self.assertEqual(hazard_res.status_code, 201)
        hazard_id = hazard_res.json()["id"]

        risk_res = self.client.post(
            reverse("assessment-list"),
            {
                "organization": self.org.id,
                "hazard": hazard_id,
                "likelihood": 4,
                "severity": 4,
                "proposed_controls": "تعویض گسکت و آچارکشی فلنج",
            },
            content_type="application/json",
        )
        self.assertEqual(risk_res.status_code, 201)
        risk_data = risk_res.json()
        self.assertEqual(risk_data["score"], 16)
        self.assertEqual(risk_data["level"], "critical")

        # 3. Create Checklist, Schedule Inspection, and perform it
        chk_res = self.client.post(
            reverse("checklist-list"),
            {
                "organization": self.org.id,
                "title": "چک‌لیست ایمنی خطوط بخار",
                "description": "بازرسی هفتگی",
            },
            content_type="application/json",
        )
        self.assertEqual(chk_res.status_code, 201)
        chk_id = chk_res.json()["id"]

        item_res = self.client.post(
            reverse("checklist-items", args=[chk_id]),
            {"text": "عدم وجود نشتی در اتصالات فلنجی", "is_required": True, "order": 1},
            content_type="application/json",
        )
        self.assertEqual(item_res.status_code, 201)

        today = timezone.now().date()
        insp_res = self.client.post(
            reverse("inspection-list"),
            {
                "organization": self.org.id,
                "workplace": self.workplace.id,
                "checklist": chk_id,
                "title": "بازرسی ادواری واحد ۲",
                "scheduled_at": f"{today}T08:00:00Z",
            },
            content_type="application/json",
        )
        self.assertEqual(insp_res.status_code, 201)
        insp_id = insp_res.json()["id"]

        # Start inspection
        self.client.patch(
            reverse("inspection-detail", args=[insp_id]),
            {"status": "in_progress"},
            content_type="application/json",
        )

        insp_detail = self.client.get(reverse("inspection-detail", args=[insp_id])).json()
        response_id = insp_detail["responses"][0]["id"]

        # Record non-conforming response
        resp_update = self.client.patch(
            reverse("inspection-response-detail", args=[response_id]),
            {"result": "nonconform", "notes": "نشتی شدید در اتصال فلنج مشاهده شد."},
            content_type="application/json",
        )
        self.assertEqual(resp_update.status_code, 200)

        # Complete inspection
        comp_res = self.client.post(reverse("inspection-complete", args=[insp_id]))
        self.assertEqual(comp_res.status_code, 200)

        # 4. Create Non-Conformity from inspection response
        nc_res = self.client.post(
            reverse("nonconformity-list"),
            {
                "inspection_response": response_id,
                "description": "نشتی شدید در اتصال فلنج خط بخار",
                "severity": "high",
            },
            content_type="application/json",
        )
        self.assertEqual(nc_res.status_code, 201)

        nc_id = nc_res.json()["id"]

        # 5. Create Corrective Action assigned to field worker
        due_date = today + timedelta(days=2)
        action_res = self.client.post(
            reverse("corrective-action-list"),
            {
                "non_conformity": nc_id,
                "description": "سرویس و تعویض گسکت فلنج نشت‌کننده",
                "responsible": self.worker.id,
                "due_date": str(due_date),
            },
            content_type="application/json",
        )
        self.assertEqual(action_res.status_code, 201)
        action_id = action_res.json()["id"]

        # Verify that notification was created for worker
        self.client.force_login(self.worker)
        notifs_res = self.client.get(reverse("notification-list"))
        self.assertEqual(notifs_res.status_code, 200)
        self.assertGreaterEqual(len(notifs_res.json()), 1)
        notif_id = notifs_res.json()[0]["id"]

        # Worker marks notification as read
        read_res = self.client.post(reverse("notification-mark-read", args=[notif_id]))
        self.assertEqual(read_res.status_code, 200)
        self.assertTrue(read_res.json()["is_read"])

        # Worker updates progress: in_progress -> pending_verification
        self.client.patch(
            reverse("corrective-action-detail", args=[action_id]),
            {"status": "in_progress"},
            content_type="application/json",
        )
        self.client.patch(
            reverse("corrective-action-detail", args=[action_id]),
            {"status": "pending_verification", "result_text": "گسکت تعویض و تست هیدروستاتیک با موفقیت انجام شد."},
            content_type="application/json",
        )

        # Manager verifies action
        self.client.force_login(self.manager)
        verify_res = self.client.post(reverse("corrective-action-verify", args=[action_id]))
        self.assertEqual(verify_res.status_code, 200)
        self.assertEqual(verify_res.json()["status"], "completed")
        self.assertTrue(verify_res.json()["effectiveness_verified"])

        # Transition NC to ready_for_review
        self.client.patch(
            reverse("nonconformity-detail", args=[nc_id]),
            {"status": "in_progress"},
            content_type="application/json",
        )
        self.client.patch(
            reverse("nonconformity-detail", args=[nc_id]),
            {"status": "ready_for_review"},
            content_type="application/json",
        )

        # Close Non-Conformity
        close_nc_res = self.client.post(reverse("nonconformity-close", args=[nc_id]))
        self.assertEqual(close_nc_res.status_code, 200)
        self.assertEqual(close_nc_res.json()["status"], "closed")


        # 6. Check Dashboard Metrics
        dash_res = self.client.get(reverse("dashboard-metrics"), {"organization": self.org.id})
        self.assertEqual(dash_res.status_code, 200)
        metrics = dash_res.json()
        self.assertEqual(metrics["inspections"]["completed"], 1)
        self.assertEqual(metrics["risks"]["critical"], 1)
        self.assertEqual(metrics["non_conformities"]["closed"], 1)
        self.assertEqual(metrics["corrective_actions"]["completed"], 1)

        # 7. Check Reports CSV Export for all types
        for r_type in ["inspections", "risks", "non-conformities", "corrective-actions"]:
            rep_res = self.client.get(reverse("report-export", args=[r_type]), {"organization": self.org.id})
            self.assertEqual(rep_res.status_code, 200)
            self.assertEqual(rep_res["Content-Type"], "text/csv; charset=utf-8-sig")
            csv_text = rep_res.content.decode("utf-8-sig")
            self.assertIn("شرکت پتروشیمی پارس", csv_text)

        # 8. Check Audit Log
        audit_res = self.client.get(reverse("audit-event-list"), {"organization": self.org.id})
        self.assertEqual(audit_res.status_code, 200)
        audit_events = audit_res.json()
        self.assertGreaterEqual(len(audit_events), 1)
