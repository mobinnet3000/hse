import datetime
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from apps.organizations.models import Organization, Membership
from apps.workforce.models import (
    Employee,
    OccupationalHealthFitRecord,
    MedicalRecordConfidential,
    ContractorCompany,
)
from apps.environment.models import (
    ChemicalItem,
    EmergencyScenario,
    EmergencyDrill,
    EmergencyResource,
    ResourceConsumptionRecord,
)
from apps.auditlog.models import AuditPlan, AuditFinding
from apps.surveys.models import BehaviorObservation, SafetyCultureScore
from apps.dashboard.models import HSEStrategicGoal, HSEBudgetProgram

User = get_user_model()


class Phase456ComprehensiveTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="مجتمع پتروشیمی نمونه", code="PETRO-EX")
        
        # Superuser / Admin
        self.admin_user = User.objects.create_superuser(
            username="admin_test",
            password="Password123!",
            email="admin@petro.test"
        )
        Membership.objects.create(
            user=self.admin_user,
            organization=self.org,
            role=Membership.Roles.ORG_ADMIN,
        )

        # Standard Field Supervisor (non-medical)
        self.supervisor_user = User.objects.create_user(
            username="supervisor_test",
            password="Password123!",
            email="supervisor@petro.test"
        )
        Membership.objects.create(
            user=self.supervisor_user,
            organization=self.org,
            role=Membership.Roles.WORKSHOP_SUPERVISOR,
        )

        # Medical Officer
        self.doctor_user = User.objects.create_user(
            username="doctor_test",
            password="Password123!",
            email="doctor@petro.test"
        )
        Membership.objects.create(
            user=self.doctor_user,
            organization=self.org,
            role="medical_officer",
        )

        self.employee = Employee.objects.create(
            organization=self.org,
            employee_no="EMP-1001",
            first_name="علی",
            last_name="محمدی",
        )

    # =========================================================================
    # Phase 4: Strict Medical Confidentiality Isolation
    # =========================================================================
    def test_medical_confidentiality_isolation_barrier(self):
        # 1. Create a confidential medical record
        med_rec = MedicalRecordConfidential.objects.create(
            employee=self.employee,
            examination_date=datetime.date.today(),
            clinical_diagnosis="کاهش شنوایی حسی-عصبی دوطرفه ناشی از صوت مداوم فرکانس ۴۰۰۰ هرتز",
            audiogram_data={"left_ear_db": 45, "right_ear_db": 50},
            spirometry_data={"fev1_fvc_ratio": 78.5},
            blood_test_data={"wbc": 6500, "platelets": 210000},
            physician_notes="ممنوعیت کامل ورود به محدوده توربوکمپرسور واحد الفین",
        )

        # 2. Create operational fit status
        fit_rec = OccupationalHealthFitRecord.objects.create(
            employee=self.employee,
            fit_status=OccupationalHealthFitRecord.FitStatus.FIT_WITH_RESTRICTION,
            work_restrictions="عدم اشتغال در محیط‌های با تراز صوتی بالای ۸۵ دسی‌بل",
            valid_until=datetime.date.today() + datetime.timedelta(days=180),
        )

        client = APIClient()

        # Non-medical supervisor tries to access confidential medical records -> MUST BE 403
        client.force_authenticate(user=self.supervisor_user)
        resp_confidential_denied = client.get("/api/v1/workforce/health/confidential/")
        self.assertEqual(resp_confidential_denied.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("medical_confidentiality_blocked", str(resp_confidential_denied.data))

        # Non-medical supervisor accesses operational fit records -> 200 OK, zero clinical fields
        resp_fit = client.get("/api/v1/workforce/health/fit-status/")
        self.assertEqual(resp_fit.status_code, status.HTTP_200_OK)
        results = resp_fit.data.get("results", resp_fit.data) if isinstance(resp_fit.data, dict) else resp_fit.data
        fit_data = results[0]
        self.assertEqual(fit_data["fit_status"], "fit_with_restriction")
        self.assertEqual(fit_data["work_restrictions"], "عدم اشتغال در محیط‌های با تراز صوتی بالای ۸۵ دسی‌بل")
        # Invariant: NO clinical diagnosis or audiogram in fit data
        self.assertNotIn("clinical_diagnosis", fit_data)
        self.assertNotIn("audiogram_data", fit_data)
        self.assertNotIn("blood_test_data", fit_data)

        # Medical doctor accesses confidential records -> 200 OK
        client.force_authenticate(user=self.doctor_user)
        resp_confidential_ok = client.get(f"/api/v1/workforce/health/confidential/?employee={self.employee.id}")
        self.assertEqual(resp_confidential_ok.status_code, status.HTTP_200_OK)
        conf_results = resp_confidential_ok.data.get("results", resp_confidential_ok.data) if isinstance(resp_confidential_ok.data, dict) else resp_confidential_ok.data
        self.assertIn("کاهش شنوایی", conf_results[0]["clinical_diagnosis"])

    # =========================================================================
    # Phase 4: Chemical Management & Emergency Activation
    # =========================================================================
    def test_chemical_management_and_emergency_scenario(self):
        client = APIClient()
        client.force_authenticate(user=self.admin_user)

        # 1. Create Chemical
        chem_resp = client.post("/api/v1/environment/chemicals/", {
            "organization": self.org.id,
            "name": "تولوئن صنعتی (Toluene)",
            "cas_number": "108-88-3",
            "un_number": "UN 1294",
            "hazard_classification": "flammable",
            "storage_location": "مخزن انبار حلال شماره ۲",
            "current_stock": 2500.0,
            "unit": "liter",
            "compatibility_group": "Group 3 - Flammable Liquids",
            "sds_document_url": "/documents/sds-toluene.pdf",
            "exposure_limit_oel": "50 ppm",
        }, format="json")
        self.assertEqual(chem_resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(chem_resp.data["traceability_chain_id"].startswith("TRC-CHM-"))

        # 2. Create Emergency Scenario
        scen_resp = client.post("/api/v1/environment/emergency-scenarios/", {
            "organization": self.org.id,
            "title": "نشت گاز سمی H2S در واحد فرآورش",
            "severity_tier": "tier_2",
            "muster_point": "دکل ایمن بادنمای شمالی",
            "evacuation_route": "مسیر بادگیر شمالی - دروازه ۳",
            "erp_summary": "اعلام آژیر پیوسته سطح ۲، قطع تغذیه خوراک و اعزام تیم واکنش سریع با تجهیزات SCBA",
        }, format="json")
        self.assertEqual(scen_resp.status_code, status.HTTP_201_CREATED)
        scen_id = scen_resp.data["id"]
        self.assertTrue(scen_resp.data["traceability_chain_id"].startswith("TRC-EMG-"))

        # 3. Activate Emergency Scenario
        act_resp = client.post(f"/api/v1/environment/emergency-scenarios/{scen_id}/activate/")
        self.assertEqual(act_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(act_resp.data["status"], "activated")

    # =========================================================================
    # Phase 5: Audit & Compliance & Safety Culture BBS
    # =========================================================================
    def test_audit_compliance_and_bbs_observations(self):
        client = APIClient()
        client.force_authenticate(user=self.admin_user)

        # 1. Create Audit Plan
        audit_resp = client.post("/api/v1/audit-logs/plans/", {
            "organization": self.org.id,
            "title": "ممیزی داخلی سیستم مدیریت HSE بر مبنای ISO 45001",
            "audit_standard": "ISO 45001:2018",
            "planned_date": "2026-12-01",
            "status": "scheduled",
            "scope_summary": "ممیزی فرآیندهای عملیاتی، ارزیابی ریسک و مجوز کار واحد الفین",
        }, format="json")
        self.assertEqual(audit_resp.status_code, status.HTTP_201_CREATED)
        audit_id = audit_resp.data["id"]
        self.assertTrue(audit_resp.data["audit_code"].startswith("AUD-"))

        # 2. Add Audit Finding (Non-Conformity)
        finding_resp = client.post("/api/v1/audit-logs/findings/", {
            "audit_plan": audit_id,
            "finding_type": "minor_nonconformity",
            "standard_clause": "8.1.2 - Eliminating hazards",
            "description": "عدم نصب سنسور تشخیص نشت گاز هیدروژن در ایستگاه نمونه‌گیری",
        }, format="json")
        self.assertEqual(finding_resp.status_code, status.HTTP_201_CREATED)

        # 3. Log BBS Safe Behavior
        bbs_resp = client.post("/api/v1/surveys/bbs/", {
            "organization": self.org.id,
            "observation_date": "2026-11-23",
            "observation_type": "safe",
            "category": "ppe",
            "description": "استفاده کامل از شیلد محافظ صورت هنگام تزریق کاستیک به مخزن خنثی‌سازی",
            "immediate_coaching": "تشویق شفاهی و ثبت در کارت سبز ایمنی",
        }, format="json")
        self.assertEqual(bbs_resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(bbs_resp.data["traceability_chain_id"].startswith("TRC-BBS-"))

    # =========================================================================
    # Phase 6: KPI Engine & Executive 20-Module Dashboard
    # =========================================================================
    def test_kpi_engine_and_executive_20_module_dashboard(self):
        client = APIClient()
        client.force_authenticate(user=self.admin_user)

        # 1. Test Strategic Goal creation
        goal_resp = client.post("/api/v1/dashboard/strategic-goals/", {
            "organization": self.org.id,
            "title": "رسیدن به صفر حادثه تلفاتی و کاهش ۵۰ درصدی حوادث جزئی",
            "pillar": "zero_harm",
            "target_metric": "LTIFR",
            "baseline_value": 1.25,
            "target_value": 0.0,
            "current_value": 0.45,
            "unit": "ضریب در میلیون نفر-ساعت",
            "deadline": "2027-03-20",
            "priority": "critical",
            "status": "on_track",
        }, format="json")
        self.assertEqual(goal_resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(goal_resp.data["traceability_chain_id"].startswith("TRC-STR-"))

        # 2. Test KPI Engine
        kpi_resp = client.get(f"/api/v1/dashboard/kpi-engine/?organization={self.org.id}")
        self.assertEqual(kpi_resp.status_code, status.HTTP_200_OK)
        self.assertIn("ltifr", kpi_resp.data)
        self.assertIn("trir", kpi_resp.data)
        self.assertIn("severity_rate", kpi_resp.data)
        self.assertIn("safe_behavior_rate", kpi_resp.data)

        # 3. Test Executive 20-Module Live Overview
        exec_resp = client.get(f"/api/v1/dashboard/executive/?organization={self.org.id}")
        self.assertEqual(exec_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(exec_resp.data["modules_total"], 20)
        self.assertEqual(len(exec_resp.data["modules"]), 20)
        
        # Verify codes of all 20 modules exist
        codes = [m["code"] for m in exec_resp.data["modules"]]
        expected_codes = [
            "risk_management", "anomaly_reports", "incidents", "permits",
            "inspections", "equipment", "ppe", "training", "moc",
            "contractors", "environment", "health", "emergency", "chemicals",
            "audit", "documents", "safety_culture", "capa", "strategic_hse", "kpi_engine"
        ]
        for ec in expected_codes:
            self.assertIn(ec, codes)
