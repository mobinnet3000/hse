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
from apps.risks.models import Hazard
from apps.workplaces.models import Workplace


class IncidentManagementTests(TestCase):
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
        self.inspector_a = User.objects.create_user(
            username="inspector_a", email="inspector_a@example.com", password="Password123!"
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
        self.workplace_a = Workplace.objects.create(organization=self.org_a, name="واحد نورد گرم")
        self.workplace_b = Workplace.objects.create(organization=self.org_b, name="واحد تقطیر")

        # Memberships
        Membership.objects.create(user=self.org_admin_a, organization=self.org_a, role=Membership.Roles.ORG_ADMIN)
        Membership.objects.create(user=self.hse_manager_a, organization=self.org_a, role=Membership.Roles.HSE_MANAGER)
        Membership.objects.create(user=self.inspector_a, organization=self.org_a, role=Membership.Roles.HSE_INSPECTOR)
        Membership.objects.create(user=self.worker_a, organization=self.org_a, role=Membership.Roles.ACTION_OWNER)
        Membership.objects.create(user=self.org_admin_b, organization=self.org_b, role=Membership.Roles.ORG_ADMIN)

        # Base Incident in Org A
        self.incident_a = Incident.objects.create(
            organization=self.org_a,
            workplace=self.workplace_a,
            title="نشت روغن هیدرولیک و لغزش اپراتور",
            incident_type=Incident.IncidentType.NEAR_MISS,
            severity=Incident.Severity.MINOR,
            status=Incident.Status.REPORTED,
            occurred_at=timezone.now(),
            reported_by=self.worker_a,
            description="نشت روغن از پمپ شماره ۲ در سالن نورد موجب لغزش پای کارگر شد.",
        )

        # Base Incident in Org B
        self.incident_b = Incident.objects.create(
            organization=self.org_b,
            workplace=self.workplace_b,
            title="افت فشار ناگهانی خط گاز نیتروژن",
            incident_type=Incident.IncidentType.UNSAFE_CONDITION,
            severity=Incident.Severity.MODERATE,
            status=Incident.Status.REPORTED,
            occurred_at=timezone.now(),
            reported_by=self.org_admin_b,
            description="افت فشار خط گاز نیتروژن در برج تقطیر.",
        )

    def test_list_incidents_tenant_isolation(self):
        # User in Org A can only see Org A incident
        self.client.force_authenticate(user=self.worker_a)
        res = self.client.get("/api/v1/incidents/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", res.data)
        ids = [item["id"] for item in results]
        self.assertIn(self.incident_a.id, ids)
        self.assertNotIn(self.incident_b.id, ids)

        # User in Org B cannot see Org A incident
        self.client.force_authenticate(user=self.org_admin_b)
        res = self.client.get(f"/api/v1/incidents/{self.incident_a.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_report_incident_success_and_audit_event(self):
        self.client.force_authenticate(user=self.worker_a)
        payload = {
            "organization": self.org_a.id,
            "workplace": self.workplace_a.id,
            "title": "سقوط آچار سنگین از داربست طبقه سوم",
            "incident_type": "near_miss",
            "severity": "moderate",
            "occurred_at": timezone.now().isoformat(),
            "location_details": "پای داربست خط ۳",
            "description": "حین بستن بست‌های داربست آچار از دست کارگر رها شد اما خوشبختانه به کسی برخورد نکرد.",
            "immediate_actions_taken": "محصورکردن محدوده با نوار خطر زرد",
        }
        res = self.client.post("/api/v1/incidents/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        inc_id = res.data["id"]
        self.assertTrue(Incident.objects.filter(id=inc_id, status=Incident.Status.REPORTED).exists())

        # Audit event recorded
        self.assertTrue(
            AuditEvent.objects.filter(
                organization=self.org_a,
                action="incident.reported",
                entity_type="Incident",
                entity_id=inc_id,
            ).exists()
        )

    def test_stranger_cannot_report_incident_in_other_org(self):
        self.client.force_authenticate(user=self.org_admin_b)
        payload = {
            "organization": self.org_a.id,  # Org A, but user belongs to Org B
            "title": "گزارش غیرمجاز",
            "incident_type": "incident",
            "severity": "minor",
            "occurred_at": timezone.now().isoformat(),
            "description": "تلاش برای ثبت حادثه در سازمان دیگر",
        }
        res = self.client.post("/api/v1/incidents/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_review_and_assign_investigator(self):
        # Worker cannot review
        self.client.force_authenticate(user=self.worker_a)
        res = self.client.post(
            f"/api/v1/incidents/{self.incident_a.id}/review/",
            {"review_notes": "بررسی اولیه توسط کارگر"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # HSE Manager reviews and assigns investigator
        self.client.force_authenticate(user=self.hse_manager_a)
        res = self.client.post(
            f"/api/v1/incidents/{self.incident_a.id}/review/",
            {
                "review_notes": "موضوع نیازمند علت‌یابی ریشه‌ای و بررسی خط نشت روغن است.",
                "assigned_investigator_id": self.inspector_a.id,
                "next_status": "under_investigation",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.incident_a.refresh_from_db()
        self.assertEqual(self.incident_a.status, Incident.Status.UNDER_INVESTIGATION)
        self.assertEqual(self.incident_a.assigned_investigator, self.inspector_a)

    def test_investigation_and_root_cause(self):
        self.incident_a.assigned_investigator = self.inspector_a
        self.incident_a.status = Incident.Status.UNDER_INVESTIGATION
        self.incident_a.save()

        # Random user cannot record investigation
        self.client.force_authenticate(user=self.worker_a)
        res = self.client.post(
            f"/api/v1/incidents/{self.incident_a.id}/investigate/",
            {"root_cause": "علت ریشه‌ای تستی"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Assigned investigator records investigation
        self.client.force_authenticate(user=self.inspector_a)
        res = self.client.post(
            f"/api/v1/incidents/{self.incident_a.id}/investigate/",
            {
                "root_cause": "فرسودگی واشر اورینگ پمپ هیدرولیک و عدم اجرای برنامه PM دوره‌ای.",
                "contributing_factors": "کمبود روشنایی کافی در زیر مخزن پمپ.",
                "immediate_actions_taken": "تمیزکاری سطح و تعویض فوری واشر معیوب.",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.incident_a.refresh_from_db()
        self.assertEqual(self.incident_a.status, Incident.Status.ACTION_REQUIRED)
        self.assertIn("فرسودگی واشر", self.incident_a.root_cause)

    def test_link_capa_and_close_prerequisites(self):
        # Create a non-conformity and CAPA in Org A
        nc = NonConformity.objects.create(
            organization=self.org_a,
            description="نقص در اتصالات هیدرولیک پمپ نورد و نشت مکرر روغن",
            severity=NonConformity.Severity.MEDIUM,
        )
        capa = CorrectiveAction.objects.create(
            organization=self.org_a,
            non_conformity=nc,
            description="تعویض کلیه واشرها و شیلنگ‌های فشار قوی خط نورد",
            status=CorrectiveAction.Status.OPEN,
        )

        # Link CAPA to incident
        self.client.force_authenticate(user=self.hse_manager_a)
        res = self.client.post(
            f"/api/v1/incidents/{self.incident_a.id}/link-capa/",
            {"corrective_action_id": capa.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn(capa, self.incident_a.related_corrective_actions.all())

        # Cannot close incident while CAPA is OPEN
        res = self.client.post(
            f"/api/v1/incidents/{self.incident_a.id}/close/",
            {"closure_notes": "تلاش برای بستن سریع حادثه"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("اقدام اصلاحی باز", str(res.data))

        # Complete CAPA
        capa.status = CorrectiveAction.Status.COMPLETED
        capa.effectiveness_verified = True
        capa.save()

        # Close incident now succeeds
        res = self.client.post(
            f"/api/v1/incidents/{self.incident_a.id}/close/",
            {"closure_notes": "اقدام اصلاحی اجرا و تأیید شد. خطر لغزش کاملاً مرتفع گردید."},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.incident_a.refresh_from_db()
        self.assertEqual(self.incident_a.status, Incident.Status.CLOSED)
        self.assertIsNotNone(self.incident_a.closed_at)

    def test_reopen_incident_workflow(self):
        self.incident_a.status = Incident.Status.CLOSED
        self.incident_a.closed_at = timezone.now()
        self.incident_a.save()

        self.client.force_authenticate(user=self.hse_manager_a)
        res = self.client.post(
            f"/api/v1/incidents/{self.incident_a.id}/reopen/",
            {"reopen_reason": "مشاهده مجدد نشتی در همان موقعیت و لزوم بازنگری علت ریشه‌ای."},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.incident_a.refresh_from_db()
        self.assertEqual(self.incident_a.status, Incident.Status.REOPENED)
        self.assertIsNone(self.incident_a.closed_at)

    def test_summary_kpi_stats(self):
        self.client.force_authenticate(user=self.worker_a)
        res = self.client.get(f"/api/v1/incidents/summary/?organization={self.org_a.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertIn("total", data)
        self.assertIn("near_misses", data)
        self.assertGreaterEqual(data["total"], 1)
