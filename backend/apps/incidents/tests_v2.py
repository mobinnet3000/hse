from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.incidents.models import Incident
from apps.organizations.models import Membership, Organization
from apps.risks.models import RiskRegister
from apps.workplaces.models import Workplace
from apps.core.models import TraceabilityChain, TraceabilityNode
from apps.core.events import HSEEventRegistry, hse_signal_event


class Phase2IncidentIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="پتروشیمی بوشهر آزمون", code="bushehr-p2-test")
        self.user = User.objects.create_user(username="hse_inspector_user", password="InspectorPass123!")
        Membership.objects.create(user=self.user, organization=self.org, role=Membership.Roles.HSE_MANAGER)

        self.workplace = Workplace.objects.create(
            organization=self.org,
            name="سایت فرآیندی الفین",
            code="SITE-OLEFIN",
        )
        self.client.force_login(self.user)

    def test_incident_creation_and_auto_code_and_traceability(self):
        payload = {
            "organization": self.org.id,
            "workplace": self.workplace.id,
            "title": "نشت هیدروکربن سبک در مسیر پمپ تغذیه برج ۱۰۰",
            "incident_type": Incident.IncidentType.NEAR_MISS,
            "severity": Incident.Severity.MAJOR,
            "occurred_at": timezone.now().isoformat(),
            "description": "نشت بخارات هیدروکربنی به علت فرسودگی گسکت فلنج",
        }
        response = self.client.post("/api/v1/incidents/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        incident = Incident.objects.get(id=response.data["id"])
        self.assertTrue(incident.incident_code.startswith("INC-"))
        self.assertTrue(incident.traceability_chain_id.startswith("TRC-INC-"))

        # Verify chain
        chain = TraceabilityChain.objects.filter(tracking_code=incident.traceability_chain_id).first()
        self.assertIsNotNone(chain)
        self.assertEqual(chain.origin_module, "incidents")

    def test_critical_incident_triggers_emergency_alert(self):
        incident = Incident.objects.create(
            organization=self.org,
            workplace=self.workplace,
            title="آتش‌سوزی در مبدل حرارتی E-104",
            incident_type=Incident.IncidentType.INCIDENT,
            severity=Incident.Severity.CRITICAL,
            occurred_at=timezone.now(),
            reported_by=self.user,
        )
        incident.refresh_from_db()
        self.assertTrue(incident.emergency_alert_dispatched)

    def test_rca_5_whys_analysis_and_lessons_learned(self):
        incident = Incident.objects.create(
            organization=self.org,
            workplace=self.workplace,
            title="آسیب‌دیدگی مچ دست تکنسین هنگام بستن پیچ فلنج",
            incident_type=Incident.IncidentType.INCIDENT,
            severity=Incident.Severity.MODERATE,
            occurred_at=timezone.now(),
            reported_by=self.user,
        )

        rca_payload = {
            "rca_method": "5_whys",
            "direct_causes": "استفاده از آچار غیر استاندارد و فرسوده",
            "root_cause": "نقص در فرآیند بازرسی دوره‌ای ابزارآلات کارگاهی و عدم وجود سیستم ترخیص ابزار",
            "contributing_factors": "فشار زمانی برای راه‌اندازی خط و روشنایی ناکافی در شیفت شب",
            "five_whys_data": [
                {"why_number": 1, "question": "چرا آچار در رفت؟", "answer": "فک آچار دچار سایش شدید بود."},
                {"why_number": 2, "question": "چرا از آچار ساییده استفاده شد؟", "answer": "آچار سالم در انبار در دسترس نبود."},
                {"why_number": 3, "question": "چرا آچار معیوب در دسترس بود؟", "answer": "برچسب‌گذاری و اسقاط ابزار انجام نشده بود."},
                {"why_number": 4, "question": "چرا بازرسی ابزار انجام نشد؟", "answer": "چک‌لیست ماهیانه ابزار سه ماه است تکمیل نشده."},
                {"why_number": 5, "question": "علت ریشه‌ای سیستمی چه بود؟", "answer": "فقدان نظارت و مسئولیت مشخص در نگهداری پیشگیرانه ابزار."},
            ],
            "lessons_learned": "الزام بازرسی ابزار قبل از صدور پروانه کار و درج در جلسات TBM",
        }

        response = self.client.post(f"/api/v1/incidents/{incident.id}/rca/", rca_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        incident.refresh_from_db()
        self.assertEqual(incident.rca_method, "5_whys")
        self.assertEqual(incident.direct_causes, rca_payload["direct_causes"])
        self.assertEqual(incident.root_cause, rca_payload["root_cause"])
        self.assertEqual(incident.lessons_learned, rca_payload["lessons_learned"])
        self.assertEqual(len(incident.five_whys_data), 5)
        self.assertIsNotNone(incident.investigation_completed_at)

    def test_link_incident_to_risk_register(self):
        incident = Incident.objects.create(
            organization=self.org,
            workplace=self.workplace,
            title="نشت گاز متان از ولو کنترل V-200",
            incident_type=Incident.IncidentType.INCIDENT,
            severity=Incident.Severity.MAJOR,
            occurred_at=timezone.now(),
            reported_by=self.user,
        )

        risk_register = RiskRegister.objects.create(
            organization=self.org,
            register_code="RSK-2026-GAS-02",
            title="رجیستر ارزیابی ریسک‌های فرآیندی نشت گاز متان",
            assessment_date=timezone.now().date(),
            created_by=self.user,
        )

        response = self.client.post(
            f"/api/v1/incidents/{incident.id}/link-risk/",
            {"risk_register_id": str(risk_register.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        incident.refresh_from_db()
        self.assertEqual(str(incident.related_risk_register_id), str(risk_register.id))

        chain = TraceabilityChain.objects.get(tracking_code=incident.traceability_chain_id)
        node = chain.nodes.filter(to_module="risks").first()
        self.assertIsNotNone(node)
        self.assertEqual(node.relation_type, "direct")
