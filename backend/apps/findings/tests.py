from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.findings.models import NonConformity, AnomalyEvidence
from apps.organizations.models import Membership, Organization
from apps.workplaces.models import Workplace


class AnomalyManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org_a = Organization.objects.create(name="شرکت پتروشیمی اروند", code="arvand-p17")
        self.org_b = Organization.objects.create(name="مجتمع فولاد اصفهان", code="esfahan-p17")

        self.user_a = User.objects.create_user(username="user_p17_a", password="Pass-12345-abc")
        self.user_b = User.objects.create_user(username="user_p17_b", password="Pass-12345-abc")

        Membership.objects.create(user=self.user_a, organization=self.org_a, role=Membership.Roles.HSE_MANAGER)
        Membership.objects.create(user=self.user_b, organization=self.org_b, role=Membership.Roles.HSE_MANAGER)

        self.workplace_a = Workplace.objects.create(
            organization=self.org_a,
            name="واحد تقطیر و تفکیک گاز",
            code="DIST-01",
        )

    def test_create_and_auto_reference_number(self):
        self.client.force_login(self.user_a)
        payload = {
            "organization": self.org_a.id,
            "workplace": self.workplace_a.id,
            "anomaly_type": NonConformity.AnomalyType.UNSAFE_ACT,
            "description": "عدم استفاده نفر جوشکار از ماسک ایمنی در فضای بسته مخزن",
            "severity": "high",
            "priority": "urgent",
            "source": "manual",
            "reporter_name": "احمد رضایی",
            "immediate_containment": "کار سریعا متوقف و ماسک با فیلتر تحویل شد.",
            "target_deadline": str(timezone.now().date()),
            "risk_score": 16,
        }
        res = self.client.post("/api/v1/non-conformities/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertTrue(data["reference_number"].startswith("ANO-"))
        self.assertEqual(data["anomaly_type"], NonConformity.AnomalyType.UNSAFE_ACT)
        self.assertEqual(data["status"], "open")

    def test_close_and_reopen_workflow(self):
        from apps.capa.models import CorrectiveAction
        self.client.force_login(self.user_a)
        anomaly = NonConformity.objects.create(
            organization=self.org_a,
            workplace=self.workplace_a,
            anomaly_type=NonConformity.AnomalyType.EQUIPMENT_DEFECT,
            description="نشت روغن هیدرولیک از بازوی بالابر",
            severity="medium",
            status=NonConformity.Status.READY_FOR_REVIEW,
        )
        self.assertTrue(anomaly.reference_number.startswith("ANO-"))

        # Create completed CAPA for this anomaly
        CorrectiveAction.objects.create(
            organization=self.org_a,
            non_conformity=anomaly,
            description="تعویض شلنگ هیدرولیک بازو",
            responsible=self.user_a,
            status="completed",
        )

        # Close
        res_close = self.client.post(
            f"/api/v1/non-conformities/{anomaly.id}/close/",
            format="json",
        )
        self.assertEqual(res_close.status_code, status.HTTP_200_OK)
        anomaly.refresh_from_db()
        self.assertEqual(anomaly.status, NonConformity.Status.CLOSED)
        self.assertIsNotNone(anomaly.closed_at)

        # Reopen
        res_reopen = self.client.post(
            f"/api/v1/non-conformities/{anomaly.id}/reopen/",
            {"reopened_reason": "نشت مجدد پس از ۳ ساعت کار پیوسته مشاهده شد."},
            format="json",
        )
        self.assertEqual(res_reopen.status_code, status.HTTP_200_OK)
        anomaly.refresh_from_db()
        self.assertEqual(anomaly.status, NonConformity.Status.OPEN)
        self.assertEqual(anomaly.reopened_count, 1)

    def test_tenant_isolation(self):
        anomaly = NonConformity.objects.create(
            organization=self.org_a,
            workplace=self.workplace_a,
            description="عدم انطباق محرمانه سازمان الف",
            status=NonConformity.Status.OPEN,
        )
        self.client.force_login(self.user_b)
        res = self.client.get(f"/api/v1/non-conformities/{anomaly.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # Unauthorized attempt to close
        res_close = self.client.post(f"/api/v1/non-conformities/{anomaly.id}/close/", {})
        self.assertEqual(res_close.status_code, status.HTTP_404_NOT_FOUND)
