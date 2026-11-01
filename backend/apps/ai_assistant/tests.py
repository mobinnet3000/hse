from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.auditlog.models import AuditEvent
from apps.checklists.models import Checklist
from apps.knowledge_base.models import KnowledgeSource
from apps.organizations.models import Membership, Organization
from apps.risks.models import Hazard
from apps.workplaces.models import Workplace


class AiAssistantTests(TestCase):
    def setUp(self):
        import os
        self._orig_avalai_key = os.environ.get("AVALAI_API_KEY")
        os.environ["AVALAI_API_KEY"] = "<TEST_KEY_PLACEHOLDER>"
        self.client = APIClient()

        # Users
        self.org_admin = User.objects.create_user(
            username="org_admin", email="admin@example.com", password="Password123!"
        )
        self.viewer = User.objects.create_user(
            username="viewer", email="viewer@example.com", password="Password123!"
        )
        self.stranger = User.objects.create_user(
            username="stranger", email="stranger@example.com", password="Password123!"
        )

        # Organization & Workplace
        self.org = Organization.objects.create(name="مجتمع صنعتی فولاد", code="STEEL-01")
        self.workplace = Workplace.objects.create(
            organization=self.org, name="کارگاه اسکلت فلزی"
        )

        # Memberships
        Membership.objects.create(
            user=self.org_admin,
            organization=self.org,
            role=Membership.Roles.ORG_ADMIN,
            is_active=True,
        )
        Membership.objects.create(
            user=self.viewer,
            organization=self.org,
            role=Membership.Roles.EXECUTIVE_VIEWER,
            is_active=True,
        )

        # Seed some knowledge sources
        KnowledgeSource.objects.create(
            code="IR-OHS-HEIGHT-89",
            title="آیین‌نامه ایمنی کار در ارتفاع",
            category=KnowledgeSource.Category.REGULATION,
            summary="الزامات کار در ارتفاع و داربست",
            content="مفاد الزامات ایمنی کار در ارتفاع و کمربند ایمنی",
            tags="ارتفاع, داربست, سقوط",
            is_verified=True,
            status=KnowledgeSource.Status.ACTIVE,
        )
        KnowledgeSource.objects.create(
            code="IR-OHS-ELEC-86",
            title="آیین‌نامه ایمنی تأسیسات الکتریکی",
            category=KnowledgeSource.Category.REGULATION,
            summary="الزامات چاه ارت و کلید محافظ جان",
            content="مفاد سیستم زمین و LOTO",
            tags="برق, ارت, کابل",
            is_verified=True,
            status=KnowledgeSource.Status.ACTIVE,
        )

    def tearDown(self):
        import os
        if getattr(self, "_orig_avalai_key", None) is not None:
            os.environ["AVALAI_API_KEY"] = self._orig_avalai_key
        else:
            os.environ.pop("AVALAI_API_KEY", None)

    def test_get_ai_status(self):
        self.client.force_authenticate(user=self.org_admin)
        res = self.client.get(f"/api/v1/ai/status/?organization_id={self.org.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("active_engine", res.data)
        self.assertGreaterEqual(res.data["verified_regulations_count"], 2)

    def test_analyze_workplace_forbidden_for_non_member(self):
        self.client.force_authenticate(user=self.stranger)
        res = self.client.post(
            "/api/v1/ai/analyze-workplace/",
            {
                "organization_id": self.org.id,
                "activity_description": "کار روی داربست و جوشکاری اسکلت",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_analyze_workplace_generates_grounded_hazards(self):
        self.client.force_authenticate(user=self.org_admin)
        res = self.client.post(
            "/api/v1/ai/analyze-workplace/",
            {
                "organization_id": self.org.id,
                "workplace_id": self.workplace.id,
                "activity_description": "نصب تیرآهن در ارتفاع روی داربست و کابل‌کشی موقت برق",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertTrue(data.get("is_ai_generated"))
        self.assertIn("hazards", data)
        self.assertGreater(len(data["hazards"]), 0)

        # Audit event recorded
        self.assertTrue(
            AuditEvent.objects.filter(
                organization=self.org,
                action="ai.analyze_workplace",
                actor=self.org_admin,
            ).exists()
        )

    def test_suggest_checklist(self):
        self.client.force_authenticate(user=self.org_admin)
        res = self.client.post(
            "/api/v1/ai/suggest-checklist/",
            {
                "organization_id": self.org.id,
                "focus_area": "کار در ارتفاع و داربست",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("items", res.data)
        self.assertGreaterEqual(len(res.data["items"]), 3)
        self.assertIn("citation", res.data["items"][0])

    def test_suggest_hierarchy_of_controls(self):
        self.client.force_authenticate(user=self.viewer)
        res = self.client.post(
            "/api/v1/ai/suggest-controls/",
            {
                "organization_id": self.org.id,
                "hazard_title": "سقوط از ارتفاع روی داربست لوله‌ای",
                "category": "safety",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("hierarchy", res.data)
        self.assertEqual(len(res.data["hierarchy"]), 5)  # 5 tiers of hierarchy
        self.assertEqual(res.data["hierarchy"][0]["level"], "elimination")

    def test_apply_hazard_and_permissions(self):
        # Viewer cannot create hazards
        self.client.force_authenticate(user=self.viewer)
        res = self.client.post(
            "/api/v1/ai/apply-hazard/",
            {
                "organization_id": self.org.id,
                "workplace_id": self.workplace.id,
                "title": "سقوط از ارتفاع",
                "category": "safety",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Org admin can create hazard
        self.client.force_authenticate(user=self.org_admin)
        res = self.client.post(
            "/api/v1/ai/apply-hazard/",
            {
                "organization_id": self.org.id,
                "workplace_id": self.workplace.id,
                "title": "سقوط از ارتفاع به دلیل نقص لایف‌لاین",
                "category": "safety",
                "causes": "عدم بستن لنیارد",
                "consequences": "شکستگی اندام",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        hazard_id = res.data["id"]
        self.assertTrue(Hazard.objects.filter(id=hazard_id, status=Hazard.Status.DRAFT).exists())

    def test_apply_checklist(self):
        self.client.force_authenticate(user=self.org_admin)
        res = self.client.post(
            "/api/v1/ai/apply-checklist/",
            {
                "organization_id": self.org.id,
                "title": "چک‌لیست داربست تاییدشده",
                "description": "تولیدشده با هوش مصنوعی و تاییدشده توسط سرپرست",
                "items": [
                    {"order": 1, "text": "بررسی تگ سبز داربست", "is_required": True},
                    {"order": 2, "text": "بررسی محکم‌بودن پایه‌ها", "is_required": True},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        checklist_id = res.data["id"]
        chk = Checklist.objects.get(id=checklist_id)
        self.assertEqual(chk.items.count(), 2)


class Phase19AIAssistantTests(TestCase):
    """
    Exhaustive tests for Phase 19 Intelligent AI HSE Assistant:
    - Multi-step assessment lifecycle
    - Multi-tenant boundary isolation
    - AvalAI service integration & schema normalization
    - Checklist draft editing, section/item ordering
    - Formal validation & human review gatekeeping
    - Real Checklist generation with idempotency protection
    - Audit logging
    """

    def setUp(self):
        import os
        self._orig_avalai_key = os.environ.get("AVALAI_API_KEY")
        os.environ["AVALAI_API_KEY"] = "<TEST_KEY_PLACEHOLDER>"
        self.client = APIClient()

        # Users
        self.hse_manager = User.objects.create_user(
            username="hse_manager_p19", email="hse@steel.ir", password="Password123!"
        )
        self.inspector = User.objects.create_user(
            username="inspector_p19", email="inspector@steel.ir", password="Password123!"
        )
        self.other_org_user = User.objects.create_user(
            username="other_user_p19", email="other@other.ir", password="Password123!"
        )

        # Organizations
        self.org = Organization.objects.create(name="فولاد هرمزگان", code="HORM-STEEL")
        self.other_org = Organization.objects.create(name="پتروشیمی جم", code="JAM-PETRO")

        # Workplaces
        self.workplace = Workplace.objects.create(
            organization=self.org, name="کارگاه برشکاری و سازه سنگین"
        )
        self.other_workplace = Workplace.objects.create(
            organization=self.other_org, name="واحد اولفین"
        )

        # Memberships
        Membership.objects.create(
            user=self.hse_manager,
            organization=self.org,
            role=Membership.Roles.HSE_MANAGER,
            is_active=True,
        )
        Membership.objects.create(
            user=self.inspector,
            organization=self.org,
            role=Membership.Roles.HSE_INSPECTOR,
            is_active=True,
        )
        Membership.objects.create(
            user=self.other_org_user,
            organization=self.other_org,
            role=Membership.Roles.HSE_MANAGER,
            is_active=True,
        )

        # Representative Workplace Scenario Input (Section 15)
        self.scenario_input_data = {
            "general_info": {
                "title": "ارزیابی ایمنی کارگاه برشکاری و اسکلت فلزی",
                "workplace_name": "کارگاه برشکاری و سازه سنگین",
                "workplace_type": "کارگاه صنعتی ساخت سازه‌های سنگین",
                "industry": "صنایع فلزی و فولادی",
                "employee_count": 45,
                "shift_count": 2,
                "shift_duration": 8,
                "objective": "شناسایی خطرات، ارزیابی ریسک و تولید چک‌لیست بازرسی تخصصی",
            },
            "activities": [
                {
                    "name": "برشکاری با گیوتین و اره نواری",
                    "description": "برش ورق‌های ضخیم فولادی و پروفیل‌ها",
                    "frequency": "روزانه و مستمر",
                    "workers_count": 6,
                },
                {
                    "name": "جوشکاری قوسی و اسکلت‌سازی",
                    "description": "جوشکاری اتصالات تیرآهن و ستون‌ها با الکترود دستی",
                    "frequency": "مداوم",
                    "workers_count": 12,
                },
                {
                    "name": "سنگ‌زنی و پلیسه‌گیری",
                    "description": "سنگ‌زدن لبه‌های برش‌خورده و پاکسازی گرده جوش",
                    "frequency": "مستمر",
                    "workers_count": 8,
                },
            ],
            "equipment": [
                {
                    "name": "پرس هیدرولیک ۱۰۰ تن",
                    "type": "پرس هیدرولیکی",
                    "guarding": "حفاظ ناقص، نیاز به پرده نوری",
                    "emergency_stop": "دارد",
                },
                {
                    "name": "جرثقیل سقفی ۵ تن",
                    "type": "جرثقیل سقفی بکسلی",
                    "guarding": "ضامن قلاب فنری",
                    "emergency_stop": "روی ریموت دارد",
                },
            ],
            "materials": [
                {
                    "name": "الکترود جوشکاری E7018",
                    "physical_state": "جامد فلزی با روکش قلیایی",
                    "quantity": "۲۰۰ کیلوگرم روزانه",
                    "sds_available": "موجود در انبار",
                }
            ],
            "environmental_conditions": {
                "noise": {"value": 89, "unit": "dBA", "method": "اندازه‌گیری میدانی"},
                "ventilation": "طبیعی از طریق درب‌های سالن، فاقد مکش موضعی در ایستگاه‌ها",
            },
            "personnel_ppe": {
                "roles": "جوشکار، کمک‌جوشکار، اپراتور پرس، ریگر",
                "training_status": "آموزش مقدماتی انجام شده",
                "ppe_used": "کفش ایمنی، عینک سنگ‌زنی، دستکش چرمی",
            },
            "special_hazards": [
                {"type": "hot_work", "details": "جوشکاری و برشکاری گرم با شعله و قوس"},
                {"type": "lifting", "details": "جابجایی تیرآهن‌های سنگین با جرثقیل سقفی"},
            ],
            "existing_controls": {
                "ptw": "صدور پروانه کار گرم برای مخازن الزامی است",
                "fire": "کپسول‌های پودر و گاز ۶ کیلویی در سالن",
            },
            "additional_description": "کارگاه نیازمند بازنگری فوری در خصوص تهویه گازهای جوشکاری و تست میکروسوئیچ‌های پرس است.",
        }

    def tearDown(self):
        import os
        if getattr(self, "_orig_avalai_key", None) is not None:
            os.environ["AVALAI_API_KEY"] = self._orig_avalai_key
        else:
            os.environ.pop("AVALAI_API_KEY", None)

    def test_service_status_endpoint(self):
        self.client.force_authenticate(user=self.hse_manager)
        res = self.client.get("/api/v1/ai-assistant/service-status/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertIn("provider", data)
        self.assertIn("configured_model", data)
        self.assertIn("status", data)

    def test_create_assessment_and_tenant_isolation(self):
        from .models import AIAssessment
        self.client.force_authenticate(user=self.hse_manager)

        # 1. Create assessment in Org 1
        res = self.client.post(
            "/api/v1/ai-assistant/assessments/",
            {
                "organization": self.org.id,
                "workplace": self.workplace.id,
                "title": "ارزیابی ایمنی کارگاه اسکلت فلزی",
                "input_data": self.scenario_input_data,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        assessment_id = res.data["id"]
        self.assertEqual(res.data["title"], "ارزیابی ایمنی کارگاه اسکلت فلزی")

        # 2. User from Org 2 cannot retrieve Org 1 assessment
        self.client.force_authenticate(user=self.other_org_user)
        res_other = self.client.get(f"/api/v1/ai-assistant/assessments/{assessment_id}/")
        self.assertEqual(res_other.status_code, status.HTTP_404_NOT_FOUND)

        # List also excludes Org 1 assessments
        res_list = self.client.get("/api/v1/ai-assistant/assessments/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in res_list.data.get("results", res_list.data)]
        self.assertNotIn(assessment_id, ids)

    def test_analyze_workplace_assessment_full_pipeline(self):
        from .models import AIAssessment, AIGenerationLog
        from apps.auditlog.models import AuditEvent

        self.client.force_authenticate(user=self.hse_manager)
        assessment = AIAssessment.objects.create(
            organization=self.org,
            workplace=self.workplace,
            title="ارزیابی تحلیلی تست پایپ‌لاین",
            input_data=self.scenario_input_data,
            created_by=self.hse_manager,
            status=AIAssessment.Status.DRAFT,
        )

        # Call analyze
        res = self.client.post(f"/api/v1/ai-assistant/assessments/{assessment.id}/analyze/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        assessment.refresh_from_db()
        self.assertEqual(assessment.status, AIAssessment.Status.ANALYZED)
        self.assertTrue(bool(assessment.analysis_result))
        self.assertTrue(bool(assessment.checklist_draft))

        # Check hazards structure and risk scoring
        hazards = assessment.analysis_result.get("hazards", [])
        self.assertGreaterEqual(len(hazards), 3)
        for h in hazards:
            self.assertIn("title", h)
            self.assertIn("proposed_probability", h)
            self.assertIn("proposed_severity", h)
            self.assertIn("calculated_score", h)
            self.assertIn("proposed_risk_level", h)
            # Verify score formula: score = prob * sev
            self.assertEqual(h["calculated_score"], h["proposed_probability"] * h["proposed_severity"])

        # Check generation log was persisted
        log_entry = AIGenerationLog.objects.filter(assessment=assessment).first()
        self.assertIsNotNone(log_entry)
        self.assertTrue(log_entry.is_success)

        # Check audit event
        audit_exists = AuditEvent.objects.filter(
            action="ai.workplace_analyzed",
            entity_id=assessment.id,
        ).exists()
        self.assertTrue(audit_exists)

    def test_checklist_draft_edit_and_ordering(self):
        from .models import AIAssessment

        self.client.force_authenticate(user=self.hse_manager)
        assessment = AIAssessment.objects.create(
            organization=self.org,
            workplace=self.workplace,
            title="ارزیابی برای تست ویرایش پیش‌نویس",
            input_data=self.scenario_input_data,
            created_by=self.hse_manager,
            status=AIAssessment.Status.ANALYZED,
            checklist_draft={
                "title": "عنوان اولیه پیش‌نویس",
                "sections": [
                    {
                        "temporary_id": "SEC-1",
                        "title": "بخش ۱: ایمنی ماشین‌آلات",
                        "order": 1,
                        "items": [
                            {"temporary_id": "CHK-1", "title": "بررسی پرده نوری", "order": 1, "is_critical": True}
                        ],
                    }
                ],
            },
        )

        # User updates draft with an added item and changed title
        updated_sections = [
            {
                "temporary_id": "SEC-1",
                "title": "بخش ۱: ایمنی ماشین‌آلات و پرس‌ها (ویرایش‌شده)",
                "order": 1,
                "items": [
                    {"temporary_id": "CHK-1", "title": "بررسی پرده نوری", "order": 1, "is_critical": True},
                    {"temporary_id": "CHK-2", "title": "بررسی شیر اطمینان هیدرولیک", "order": 2, "is_critical": False},
                ],
            }
        ]

        res = self.client.put(
            f"/api/v1/ai-assistant/assessments/{assessment.id}/checklist-draft/",
            {
                "title": "چک‌لیست نهایی ویرایش‌شده توسط کارشناس",
                "sections": updated_sections,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        assessment.refresh_from_db()
        self.assertEqual(assessment.status, AIAssessment.Status.EDITING)
        self.assertEqual(assessment.checklist_draft["title"], "چک‌لیست نهایی ویرایش‌شده توسط کارشناس")
        self.assertEqual(len(assessment.checklist_draft["sections"][0]["items"]), 2)

    def test_validate_draft_success_and_failure(self):
        from .models import AIAssessment

        self.client.force_authenticate(user=self.hse_manager)
        assessment = AIAssessment.objects.create(
            organization=self.org,
            workplace=self.workplace,
            title="ارزیابی برای تست اعتبارسنجی",
            created_by=self.hse_manager,
            status=AIAssessment.Status.EDITING,
            checklist_draft={"title": "چک‌لیست ناقص", "sections": []},  # Empty sections
        )

        # Empty draft validation fails (400)
        res_fail = self.client.post(f"/api/v1/ai-assistant/assessments/{assessment.id}/validate_draft/")
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res_fail.json().get("is_valid"))

        # Valid draft validation succeeds
        assessment.checklist_draft = {
            "title": "چک‌لیست معتبر",
            "sections": [
                {
                    "title": "بخش معتبر",
                    "items": [{"title": "بند معتبر", "inspection_criterion": "معیار دقیق"}],
                }
            ],
        }
        assessment.save()

        res_ok = self.client.post(f"/api/v1/ai-assistant/assessments/{assessment.id}/validate_draft/")
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertTrue(res_ok.json().get("is_valid"))

        assessment.refresh_from_db()
        self.assertEqual(assessment.status, AIAssessment.Status.VALIDATED)

    def test_approval_and_real_checklist_generation(self):
        from .models import AIAssessment
        from apps.checklists.models import Checklist

        self.client.force_authenticate(user=self.hse_manager)
        assessment = AIAssessment.objects.create(
            organization=self.org,
            workplace=self.workplace,
            title="ارزیابی آماده صدور چک‌لیست",
            created_by=self.hse_manager,
            status=AIAssessment.Status.VALIDATED,
            checklist_draft={
                "title": "چک‌لیست نهایی کارگاه سازه‌های فولادی",
                "description": "چک‌لیست جامع مصوب برای بازرسی هفتگی",
                "sections": [
                    {
                        "title": "بخش ۱: پرس‌ها و ادوات برش",
                        "items": [
                            {
                                "title": "آیا پرده نوری پرس هیدرولیک کالیبره و فعال است؟",
                                "inspection_criterion": "با ورود مانع، جک در کمتر از ۰.۱ ثانیه متوقف شود.",
                                "evidence_required": ["تست چشمی پرده", "لاگ بازرسی"],
                                "is_critical": True,
                            },
                            {
                                "title": "آیا سنگ‌فرزها دارای حفاظ استاندارد هستند؟",
                                "inspection_criterion": "حفاظ ۱۸۰ درجه سالم بدون شکستگی.",
                                "is_critical": False,
                            },
                        ],
                    }
                ],
            },
        )

        # 1. Generation fails before approval (assessment is only VALIDATED)
        res_early_gen = self.client.post(f"/api/v1/ai-assistant/assessments/{assessment.id}/generate_checklist/")
        self.assertEqual(res_early_gen.status_code, status.HTTP_400_BAD_REQUEST)

        # Let's approve explicitly
        res_approve = self.client.post(
            f"/api/v1/ai-assistant/assessments/{assessment.id}/approve/",
            {
                "confirmed_reviewed": True,
                "approval_notes": "کلیه بندها با استانداردهای کارخانه انطباق داده شد و مورد تأیید است.",
            },
            format="json",
        )
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)

        assessment.refresh_from_db()
        self.assertEqual(assessment.status, AIAssessment.Status.APPROVED)
        self.assertIsNotNone(assessment.approved_at)
        self.assertEqual(assessment.approved_by, self.hse_manager)

        # 2. Generate Real Checklist
        res_gen = self.client.post(f"/api/v1/ai-assistant/assessments/{assessment.id}/generate_checklist/")
        self.assertEqual(res_gen.status_code, status.HTTP_201_CREATED)
        checklist_id = res_gen.json()["checklist_id"]

        # Verify real Checklist in existing Checklist architecture
        real_checklist = Checklist.objects.get(pk=checklist_id)
        self.assertEqual(real_checklist.organization, self.org)
        self.assertEqual(real_checklist.title, "چک‌لیست نهایی کارگاه سازه‌های فولادی")
        self.assertEqual(real_checklist.items.count(), 2)

        # Check item formatting includes section and criticality badge
        item1 = real_checklist.items.first()
        self.assertIn("[بحرانی]", item1.text)
        self.assertIn("[بخش ۱: پرس‌ها و ادوات برش]", item1.text)
        self.assertIn("معیار پذیرش", item1.text)

        # 3. Idempotency Test: Second call returns existing checklist without duplication
        res_gen_again = self.client.post(f"/api/v1/ai-assistant/assessments/{assessment.id}/generate_checklist/")
        self.assertEqual(res_gen_again.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_gen_again.json()["checklist_id"], checklist_id)
        self.assertEqual(Checklist.objects.filter(originating_ai_assessments=assessment).count(), 1)

