from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.findings.models import NonConformity
from apps.incidents.models import Incident
from apps.organizations.models import Membership, Organization
from apps.risks.models import RiskRegister
from apps.workplaces.models import Workplace
from apps.core.models import TraceabilityChain, TraceabilityNode
from apps.core.events import HSEEventRegistry, hse_signal_event


class Phase2AnomalyIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="پتروشیمی پارس آزمون", code="pars-p2-test")
        self.user = User.objects.create_user(username="hse_lead_user", password="LeadPassword123!")
        Membership.objects.create(user=self.user, organization=self.org, role=Membership.Roles.HSE_MANAGER)

        self.workplace = Workplace.objects.create(
            organization=self.org,
            name="واحد تفکیک و تثبیت میعانات",
            code="UNIT-201",
        )
        self.client.force_login(self.user)

    def test_anomaly_creation_with_potential_risk_and_traceability(self):
        payload = {
            "organization": self.org.id,
            "workplace": self.workplace.id,
            "anomaly_type": NonConformity.AnomalyType.UNSAFE_CONDITION,
            "category_flag": "safety",
            "description": "وجود نشت روغن در مسیر تردد پرسنل در مجاورت پمپ P-102",
            "severity": NonConformity.Severity.MEDIUM,
            "priority": NonConformity.Priority.HIGH,
            "potential_likelihood": 4,
            "potential_severity": 3,
            "reporter_name": "مهندس بازرسی میدانی",
            "project_name": "توسعه فاز ۱۲",
            "site_location": "سایت ۱",
            "area": "زون پمپ‌ها",
        }
        response = self.client.post("/api/v1/findings/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        anomaly = NonConformity.objects.get(id=response.data["id"])
        self.assertTrue(anomaly.reference_number.startswith("ANM-"))
        self.assertEqual(anomaly.potential_likelihood, 4)
        self.assertEqual(anomaly.potential_severity, 3)
        self.assertEqual(anomaly.risk_score, 12)  # 4 * 3
        self.assertTrue(anomaly.traceability_chain_id.startswith("TRC-ANM-"))

        # Verify TraceabilityChain was recorded
        chain = TraceabilityChain.objects.filter(tracking_code=anomaly.traceability_chain_id).first()
        self.assertIsNotNone(chain)
        self.assertEqual(chain.origin_module, "anomalies")
        self.assertGreaterEqual(chain.nodes.count(), 1)

    def test_anomaly_escalate_to_incident(self):
        anomaly = NonConformity.objects.create(
            organization=self.org,
            workplace=self.workplace,
            anomaly_type=NonConformity.AnomalyType.NEAR_MISS,
            category_flag="safety",
            description="پرتاب تراشه فلزی به نزدیکی چشم پرسنل به علت عدم استفاده از شیلد",
            severity=NonConformity.Severity.HIGH,
            priority=NonConformity.Priority.URGENT,
            potential_likelihood=4,
            potential_severity=4,
            reporter_name="ناظر HSE",
        )

        escalate_url = f"/api/v1/findings/{anomaly.id}/escalate-incident/"
        payload = {
            "title": "برخورد براده به پیشانی حین سنگ‌زنی لوله",
            "severity": "medium",
            "incident_type": "injury",
        }
        response = self.client.post(escalate_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        anomaly.refresh_from_db()
        self.assertTrue(anomaly.escalated_to_incident)
        self.assertIsNotNone(anomaly.related_incident)

        incident = anomaly.related_incident
        self.assertEqual(incident.title, payload["title"])
        self.assertEqual(incident.related_anomaly_id, anomaly.id)
        # Traceability inheritance
        self.assertEqual(incident.traceability_chain_id, anomaly.traceability_chain_id)

        # Verify node added to chain
        chain = TraceabilityChain.objects.get(tracking_code=anomaly.traceability_chain_id)
        incident_node = chain.nodes.filter(to_module="incidents").first()
        self.assertIsNotNone(incident_node)
        self.assertEqual(incident_node.relation_type, "automatic")

    def test_anomaly_escalate_to_risk_register(self):
        anomaly = NonConformity.objects.create(
            organization=self.org,
            workplace=self.workplace,
            anomaly_type=NonConformity.AnomalyType.UNSAFE_CONDITION,
            category_flag="environment",
            description="نشت مزمن میعانات از فلنج خط بای‌پاس",
            reporter_name="مهندس محیط‌زیست",
        )

        risk_register = RiskRegister.objects.create(
            organization=self.org,
            register_code="RSK-2026-ENV-01",
            title="رجیستر ارزیابی ریسک‌های زیست‌محیطی واحد تقطیر",
            assessment_date=timezone.now().date(),
            created_by=self.user,
        )

        escalate_url = f"/api/v1/findings/{anomaly.id}/escalate-risk/"
        payload = {
            "risk_register_id": str(risk_register.id),
        }
        response = self.client.post(escalate_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        anomaly.refresh_from_db()
        self.assertTrue(anomaly.escalated_to_risk)
        self.assertEqual(str(anomaly.related_risk_register_id), str(risk_register.id))

        chain = TraceabilityChain.objects.get(tracking_code=anomaly.traceability_chain_id)
        risk_node = chain.nodes.filter(to_module="risks").first()
        self.assertIsNotNone(risk_node)
        self.assertEqual(risk_node.relation_type, "analytical")
