from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.organizations.models import Organization, Membership
from apps.risks.models import (
    RiskRegister,
    RiskActivityTask,
    HazardSource,
    RiskScenario,
    RiskControl,
    DimensionScoreSet,
    RiskTreatmentAction,
)
from apps.risks.services import RiskMatrixCalculator
from apps.core.traceability import TraceabilityChain, TraceabilityNode
from apps.incidents.models import Incident

User = get_user_model()


class EnterpriseRiskEngineTestCase(TestCase):
    def setUp(self):
        self.org1 = Organization.objects.create(name="پتروشیمی خلیج فارس", code="PETRO")
        self.org2 = Organization.objects.create(name="پالایشگاه ستاره نفت", code="REFINE")

        self.user1 = User.objects.create_user(
            username="hse_expert_1",
            password="Password123!",
            email="hse1@petro.local"
        )
        self.user2 = User.objects.create_user(
            username="hse_expert_2",
            password="Password123!",
            email="hse2@refinery.local"
        )

        # Connect users to organizations via Membership
        Membership.objects.create(user=self.user1, organization=self.org1, role=Membership.Roles.HSE_MANAGER)
        Membership.objects.create(user=self.user2, organization=self.org2, role=Membership.Roles.HSE_MANAGER)

        self.client = APIClient()

    def test_rpn_calculation_and_alarp_levels(self):
        """
        تست صحت محاسبات RPN = L * S و دسته‌بندی بر اساس اصل ALARP
        """
        # 1 to 4: Low
        self.assertEqual(RiskMatrixCalculator.calculate_rpn(1, 1), 1)
        self.assertEqual(RiskMatrixCalculator.classify_level(1), "low")
        self.assertEqual(RiskMatrixCalculator.calculate_rpn(2, 2), 4)
        self.assertEqual(RiskMatrixCalculator.classify_level(4), "low")

        # 5 to 9: Medium
        self.assertEqual(RiskMatrixCalculator.calculate_rpn(3, 2), 6)
        self.assertEqual(RiskMatrixCalculator.classify_level(6), "medium")
        self.assertEqual(RiskMatrixCalculator.calculate_rpn(3, 3), 9)
        self.assertEqual(RiskMatrixCalculator.classify_level(9), "medium")

        # 10 to 15: High
        self.assertEqual(RiskMatrixCalculator.calculate_rpn(2, 5), 10)
        self.assertEqual(RiskMatrixCalculator.classify_level(10), "high")
        self.assertEqual(RiskMatrixCalculator.calculate_rpn(3, 4), 12)
        self.assertEqual(RiskMatrixCalculator.classify_level(12), "high")
        self.assertEqual(RiskMatrixCalculator.calculate_rpn(5, 3), 15)
        self.assertEqual(RiskMatrixCalculator.classify_level(15), "high")

        # 16 to 25: Critical
        self.assertEqual(RiskMatrixCalculator.calculate_rpn(4, 4), 16)
        self.assertEqual(RiskMatrixCalculator.classify_level(16), "critical")
        self.assertEqual(RiskMatrixCalculator.calculate_rpn(5, 5), 25)
        self.assertEqual(RiskMatrixCalculator.classify_level(25), "critical")

        # Out of bounds raises ValueError
        with self.assertRaises(ValueError):
            RiskMatrixCalculator.calculate_rpn(0, 5)
        with self.assertRaises(ValueError):
            RiskMatrixCalculator.calculate_rpn(6, 1)

    def test_haer_dimension_independence(self):
        """
        تست استقلال ابعاد چهارگانه HAER (انسان، دارایی، محیط زیست، اعتبار)
        """
        register = RiskRegister.objects.create(
            organization=self.org1,
            register_code="RR-TEST-001",
            title="ارزیابی برشکاری لاین اتیلن",
            created_by=self.user1
        )
        task = RiskActivityTask.objects.create(
            register=register,
            activity_title="تعمیرات لاین انتقال اتیلن",
            task_name="برش سرد لوله"
        )
        hazard = HazardSource.objects.create(
            activity_task=task,
            domain="process",
            category="گاز تحت فشار",
            description="نشت اتیلن با فشار ۱۰ بار"
        )
        scenario = RiskScenario.objects.create(
            hazard=hazard,
            scenario_title="گسیختگی فلنج و انفجار ابر بخار",
            undesired_event="انفجار موضعی",
            initiating_event="نقص واشر آب‌بندی",
            direct_causes="فرسودگی پیچ و مهره"
        )

        # نمره اولیه برای انسان: L=3, S=4 -> RPN=12 (High)
        s_human = DimensionScoreSet.objects.create(
            scenario=scenario,
            phase="initial",
            dimension="human",
            likelihood=3,
            severity=4
        )
        # نمره اولیه برای دارایی: L=4, S=5 -> RPN=20 (Critical)
        s_asset = DimensionScoreSet.objects.create(
            scenario=scenario,
            phase="initial",
            dimension="asset",
            likelihood=4,
            severity=5
        )
        # نمره اولیه برای محیط زیست: L=2, S=3 -> RPN=6 (Medium)
        s_env = DimensionScoreSet.objects.create(
            scenario=scenario,
            phase="initial",
            dimension="environment",
            likelihood=2,
            severity=3
        )
        # نمره اولیه برای اعتبار: L=2, S=4 -> RPN=8 (Medium)
        s_rep = DimensionScoreSet.objects.create(
            scenario=scenario,
            phase="initial",
            dimension="reputation",
            likelihood=2,
            severity=4
        )

        self.assertEqual(s_human.rpn, 12)
        self.assertEqual(s_human.risk_level, "high")
        self.assertEqual(s_asset.rpn, 20)
        self.assertEqual(s_asset.risk_level, "critical")
        self.assertEqual(s_env.rpn, 6)
        self.assertEqual(s_env.risk_level, "medium")
        self.assertEqual(s_rep.rpn, 8)
        self.assertEqual(s_rep.risk_level, "medium")

        # محاسبه ماکزیمم کلی سناریو باید برابر با ریسک دارایی (۲۰ - بحرانی) باشد
        overall = RiskMatrixCalculator.calculate_overall_scenario_risk(scenario, phase="initial")
        self.assertEqual(overall["overall_rpn"], 20)
        self.assertEqual(overall["overall_level"], "critical")
        self.assertEqual(overall["dominant_dimension"], "asset")

    def test_traceability_chain_cross_module_event(self):
        """
        تست زنجیره ردیابی خودکار: ایجاد حادثه -> تولید رویداد INCIDENT_LOGGED -> ایجاد گره ردیابی در ماژول ریسک
        """
        from django.utils import timezone
        incident = Incident.objects.create(
            organization=self.org1,
            title="نشت گاز متان در پمپ‌خانه",
            severity="major",
            occurred_at=timezone.now(),
            reported_by=self.user1
        )

        # باید یک زنجیره ردیابی ایجاد شده باشد
        chain = TraceabilityChain.objects.filter(
            organization=self.org1,
            origin_module="incidents",
            origin_object_id=str(incident.id)
        ).first()

        self.assertIsNotNone(chain, "زنجیره ردیابی باید به صورت خودکار ایجاد شده باشد.")
        self.assertTrue(chain.nodes.exists(), "حداقل یک گره ردیابی بین‌ماژولی باید ثبت شده باشد.")

        node = chain.nodes.first()
        self.assertEqual(node.from_module, "incidents")
        self.assertEqual(node.to_module, "risks")
        self.assertEqual(node.relation_type, "event_based")

    def test_multi_tenant_isolation_api(self):
        """
        تست ایزولاسیون سازمانی: کاربر سازمان ۱ نباید بتواند رجیستر سازمان ۲ را ببیند یا ویرایش کند
        """
        reg_org2 = RiskRegister.objects.create(
            organization=self.org2,
            register_code="RR-ORG2-999",
            title="پرونده محرمانه سازمان ۲",
            created_by=self.user2
        )

        # کاربر ۱ لاگین می‌کند
        self.client.force_authenticate(user=self.user1)

        # درخواست لیست رجیسترهای ریسک
        resp = self.client.get("/api/v1/risks/registers/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        items = resp.data if isinstance(resp.data, list) else resp.data.get("results", [])
        ids = [str(item["id"]) for item in items]
        self.assertNotIn(str(reg_org2.id), ids, "رجیستر سازمان دیگر نباید در لیست دیده شود.")

        # تلاش برای مشاهده مستقیم پرونده سازمان ۲
        resp_detail = self.client.get(f"/api/v1/risks/registers/{reg_org2.id}/")
        self.assertEqual(resp_detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_full_11_step_create_and_approval(self):
        """
        تست فرآیند جامع ساخت ۱۱ مرحله‌ای پرونده ریسک و تصویب نهایی (Step 1 to 11)
        """
        self.client.force_authenticate(user=self.user1)
        payload = {
            "context": {
                "organization": self.org1.id,
                "register_code": "RR-TEST-FULL-01",
                "title": "عملیات سندبلاست مخزن T-201",
                "project_name": "پروژه بازسازی مخازن",
                "department": "تعمیرات",
                "site_location": "محوطه مخازن",
                "area": "مخزن ۲۰",
                "project_phase": "عملیات",
                "operation_type": "سندبلاست و رنگ‌آمیزی",
            },
            "activity": {
                "activity_title": "زنگ‌زدایی و سندبلاست",
                "task_name": "پاشش سیلیس پرفشار",
                "job_steps": ["عایق‌کاری", "استقرار کمپرسور", "پاشش", "پاکسازی"],
                "personnel_count": 3,
                "competency": "اپراتور سندبلاست",
            },
            "hazard": {
                "domain": "health",
                "category": "گرد و غبار سیلیس و ذرات معلق",
                "description": "استنشاق ذرات کریستالی سیلیس و بیماری سیلیکوزیس",
            },
            "scenario": {
                "scenario_title": "پارگی هوز باد و استنشاق حاد سیلیس",
                "undesired_event": "انتشار شدید گرد و غبار بدون ماسک هوارسان",
                "initiating_event": "اتصال نادرست کلمپ شلنگ",
                "direct_causes": "فرسودگی کلمپ شلنگ",
            },
            "controls": [
                {
                    "description": "استفاده از شلنگ استاندارد مجهز به سیم مهار Whipcheck",
                    "hierarchy": "engineering",
                    "control_type": "مهندسی حفاظتی",
                    "control_owner": "مسئول ایمنی",
                    "inspection_frequency": "روزانه",
                    "is_effective": True,
                }
            ],
            "initial_scores": [
                {"dimension": "human", "likelihood": 4, "severity": 4},
                {"dimension": "asset", "likelihood": 2, "severity": 2},
            ],
            "current_scores": [
                {"dimension": "human", "likelihood": 2, "severity": 4},
                {"dimension": "asset", "likelihood": 1, "severity": 2},
            ],
            "residual_scores": [
                {"dimension": "human", "likelihood": 1, "severity": 3, "target_rpn": 3},
            ],
            "treatments": [
                {
                    "action_description": "نصب هود مجهز به کلاهخود مجهز به فیلتر هوای کربن فعال",
                    "hierarchy": "ppe",
                    "priority": "high",
                    "due_date": "2026-12-01",
                    "status": "in_progress",
                }
            ],
            "governance": {
                "risk_acceptance_status": "acceptable",
                "acceptance_authority": "مدیر HSE مجتمع",
            }
        }

        resp = self.client.post("/api/v1/risks/registers/full-create/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.data
        reg_id = data["id"]
        self.assertEqual(data["register_code"], "RR-TEST-FULL-01")
        self.assertEqual(data["activities_count"], 1)

        # بررسی ایجاد زنجیره ردیابی
        chain = TraceabilityChain.objects.filter(tracking_code=f"TRC-RSK-TEST-FULL-01").first()
        self.assertIsNotNone(chain, "زنجیره ردیابی باید برای رجیستر ایجاد شده باشد.")

        # بررسی گردش کار تصویب رسمی (Step 11)
        approve_resp = self.client.post(
            f"/api/v1/risks/registers/{reg_id}/approve/",
            {
                "acceptance_authority": "شورای عالی حفاظت فنی",
                "approval_notes": "تصویب با شرط حضور مستمر ناظر ایمنی",
            },
            format="json"
        )
        self.assertEqual(approve_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_resp.data["status"], "approved")
        self.assertTrue(approve_resp.data["audit_trail_code"].startswith("AUD-RR-"))

    def test_legacy_risk_migration_service(self):
        """
        تست سرویس مهاجرت رکوردهای قدیمی RiskAssessment به رجیستر ۱۱ مرحله‌ای
        """
        from apps.risks.models import Hazard, RiskAssessment
        from apps.risks.services import RiskManagementEngineService

        # ایجاد یک خطر و ارزیابی قدیمی
        hazard = Hazard.objects.create(
            organization=self.org1,
            title="برق‌گرفتگی از کابل فرسوده ژنراتور",
            category="safety",
            description="کابل بدون روکش در مجاورت حوضچه آب",
            causes="فرسودگی کابل در گذر زمان",
            consequences="شوک الکتریکی و سوختگی درجه ۳",
            existing_controls="کلید محافظ جان RCD",
        )
        legacy_assessment = RiskAssessment.objects.create(
            hazard=hazard,
            organization=self.org1,
            likelihood=3,
            severity=4,
            score=12,
            level="high",
            proposed_controls="تعویض کامل کابل با مدل آرموردار و تابلو توزیع ضدآب",
            status="approved"
        )

        res = RiskManagementEngineService.sync_legacy_risks_to_registers(organization_id=self.org1.id)
        self.assertGreaterEqual(res["migrated_count"], 1)

        # بررسی ایجاد RiskRegister متناظر
        reg = RiskRegister.objects.filter(register_code=f"RR-LEGACY-{legacy_assessment.id}").first()
        self.assertIsNotNone(reg)
        self.assertEqual(reg.status, "approved")
        self.assertTrue(reg.activities.exists())
        self.assertEqual(reg.activities.first().hazards.first().scenarios.first().scores.count(), 3)

