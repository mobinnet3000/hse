import os
import sys
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.organizations.models import Organization, Membership
from apps.workplaces.models import Workplace
from apps.workforce.models import (
    Employee,
    ContractorCompany,
    ContractorWorker,
    JobPosition,
    EmployeeJobAssignment,
    TrainingCourse,
    TrainingSession,
    Competency,
    EmployeeCompetency,
    PPEItem,
    PPEStock,
    PPEAssignment,
    OccupationalHealthFitRecord,
    MedicalRecordConfidential,
    AttendanceRecord,
)
from apps.assets.models import Equipment
from apps.findings.models import NonConformity
from apps.incidents.models import Incident
from apps.permits.models import Permit
from apps.inspections.models import Inspection
from apps.moc.models import ChangeRequest
from apps.environment.models import (
    EnvironmentalAspect,
    WasteRecord,
    WastewaterEmissionRecord,
    ChemicalItem,
    EmergencyScenario,
    EmergencyDrill,
    EmergencyResource,
    ResourceConsumptionRecord,
)
from apps.auditlog.models import AuditPlan, AuditFinding
from apps.documents.models import Document
from apps.surveys.models import BehaviorObservation, SafetyCultureScore
from apps.capa.models import CorrectiveAction
from apps.dashboard.models import HSEStrategicGoal, HSEBudgetProgram
from apps.risks.models import (
    RiskRegister,
    RiskActivityTask,
    HazardSource,
    RiskScenario,
    RiskControl,
    DimensionScoreSet,
    RiskTreatmentAction,
)

User = get_user_model()


def seed():
    print("🌱 Starting Comprehensive Seed for All 20 HSE Modules (Phase 7)...")

    # 1. Organization
    org, _ = Organization.objects.get_or_create(
        code="PETRO_PARS",
        defaults={
            "name": "شرکت صنایع پتروشیمی پارس جنوبی",
            "is_active": True,
        }
    )
    print(f"✓ Organization: {org.name} (Code: {org.code})")

    # 2. Users (Admin, Doctor, Supervisor)
    admin_user = User.objects.filter(username="admin").first()
    if not admin_user:
        admin_user = User.objects.create_superuser(
            username="admin",
            email="admin@hseguard.local",
            password="Admin12345!"
        )
        print("✓ Created superuser: admin / Admin12345!")
    else:
        admin_user.set_password("Admin12345!")
        admin_user.save()

    Membership.objects.get_or_create(
        user=admin_user,
        organization=org,
        defaults={"role": Membership.Roles.ORG_ADMIN}
    )

    doctor_user, _ = User.objects.get_or_create(
        username="dr_moradi",
        defaults={
            "first_name": "دکتر احسان",
            "last_name": "مرادی",
            "email": "doctor@petropars.local",
        }
    )
    doctor_user.set_password("Admin12345!")
    doctor_user.save()
    from django.contrib.auth.models import Group
    med_group, _ = Group.objects.get_or_create(name="MedicalOfficers")
    doctor_user.groups.add(med_group)

    Membership.objects.get_or_create(
        user=doctor_user,
        organization=org,
        defaults={"role": Membership.Roles.HSE_INSPECTOR}
    )

    # 3. Workplaces
    wp_olefin, _ = Workplace.objects.get_or_create(
        organization=org,
        code="WP-OLF-01",
        defaults={
            "name": "واحد الفین و جداسازی فرآیندی (Unit-101)",
            "description": "واحد فرآیندی الفین با ریسک بالای H2S و هیدروکربن‌های سنگین",
        }
    )
    wp_chem_wh, _ = Workplace.objects.get_or_create(
        organization=org,
        code="WP-CHM-02",
        defaults={
            "name": "انبار مرکزی مواد شیمیایی و حلال‌ها",
            "description": "سوله نگهداری استاندارد بشکه‌های مواد شیمیایی و حلال‌های آلی",
        }
    )

    # 4. Contractor Company
    contractor, _ = ContractorCompany.objects.get_or_create(
        organization=org,
        name="شرکت مهندسی و ساختمان کیسون",
        defaults={
            "contractor_code": "CON-2026-001",
            "qualification_status": ContractorCompany.QualificationStatus.QUALIFIED,
            "contact_person": "مهندس جواد رضایی",
            "contact_phone": "09121112233",
            "contract_start": datetime.date(2024, 1, 1),
            "contract_end": datetime.date(2027, 12, 29),
            "notes": "عملیات پایپینگ، بازرسی مخازن و تعمیرات اساسی مکانیکی",
            "status": "active",
        }
    )

    # 5. Employees
    emp_ali, _ = Employee.objects.get_or_create(
        organization=org,
        employee_no="EMP-1001",
        defaults={
            "first_name": "علی",
            "last_name": "محمدی",
            "workplace": wp_olefin,
            "job_title": "تکنسین ارشد فرآیند الفین",
        }
    )
    emp_reza, _ = Employee.objects.get_or_create(
        organization=org,
        employee_no="EMP-1002",
        defaults={
            "first_name": "رضا",
            "last_name": "قاسمی",
            "workplace": wp_olefin,
            "job_title": "کارشناس ابزاردقیق",
        }
    )

    # Attendance Records (for Presence / Man-Hours)
    AttendanceRecord.objects.get_or_create(
        organization=org,
        workplace=wp_olefin,
        person_type="employee",
        employee=emp_ali,
        date=timezone.localdate(),
        defaults={
            "check_in": timezone.now() - datetime.timedelta(hours=8),
            "status": "present",
            "notes": "شیفت روز واحد الفین",
        }
    )

    # 6. Equipment & Machinery
    eq_crane, _ = Equipment.objects.get_or_create(
        organization=org,
        code="CRN-250-TAD",
        defaults={
            "name": "جرثقیل ۲۵۰ تن بوم‌خشک تادانو",
            "category": Equipment.Category.LIFTING,
            "workplace": wp_olefin,
            "status": "operational",
            "operating_permit_status": "valid",
            "technical_clearance": "cleared",
        }
    )

    # 7. Chemicals Management
    chem_toluene, _ = ChemicalItem.objects.get_or_create(
        organization=org,
        name="تولوئن خالص صنعتی (Toluene AR)",
        defaults={
            "workplace": wp_chem_wh,
            "cas_number": "108-88-3",
            "un_number": "UN 1294",
            "hazard_classification": ChemicalItem.HazardClassification.FLAMMABLE,
            "storage_location": "مخزن نگهداری حلال‌های فرار شماره ۳",
            "current_stock": 4500.0,
            "unit": "liter",
            "compatibility_group": "Group 3 - Flammable Aromatics",
            "sds_document_url": "/documents/sds/sds-toluene.pdf",
            "exposure_limit_oel": "50 ppm (TWA)",
            "fire_extinguishing_method": "فوم پروتئینی مقاوم به الکل، کپسول پودر خشک BC",
            "spill_response_procedure": "تخلیه ناحیه، مهار با خاک دیاتومه و پرهیز از روان‌سازی در کانال‌ها",
            "is_active": True,
        }
    )

    chem_caustic, _ = ChemicalItem.objects.get_or_create(
        organization=org,
        name="سود سوزآور مایع (Sodium Hydroxide 50%)",
        defaults={
            "workplace": wp_chem_wh,
            "cas_number": "1310-73-2",
            "un_number": "UN 1824",
            "hazard_classification": ChemicalItem.HazardClassification.CORROSIVE,
            "storage_location": "مخزن پلی‌اتیلنی دوپوسته واحد خنثی‌سازی",
            "current_stock": 8000.0,
            "unit": "kg",
            "compatibility_group": "Group 7 - Strong Caustics",
            "sds_document_url": "/documents/sds/sds-caustic.pdf",
            "exposure_limit_oel": "2 mg/m3 (Ceiling)",
            "is_active": True,
        }
    )

    # 8. Emergency Management (Scenarios, Drills, Resources)
    scen_h2s, _ = EmergencyScenario.objects.get_or_create(
        organization=org,
        title="نشت گاز ترش و سولفید هیدروژن در منیفولد ورودی واحد الفین",
        defaults={
            "workplace": wp_olefin,
            "severity_tier": EmergencyScenario.SeverityTier.TIER_2,
            "muster_point": "نقطه تجمع امن بادنمای شمالی (ایستگاه شماره ۱)",
            "evacuation_route": "مسیر بادگیر شمالی به سمت گیت غربی",
            "erp_summary": "به‌صدا درآوردن آژیر ممتد بحران، قطع خودکار خوراک ESDV، استقرار تیم آتش‌نشانی با SCBA",
            "emergency_commander": admin_user,
            "is_active": True,
        }
    )

    drill, _ = EmergencyDrill.objects.get_or_create(
        organization=org,
        scenario=scen_h2s,
        drill_date=timezone.localdate() - datetime.timedelta(days=14),
        defaults={
            "response_time_minutes": 4,
            "target_response_time_minutes": 5,
            "participants_count": 35,
            "success_rating": EmergencyDrill.SuccessRating.EXCELLENT,
            "identified_gaps": "نیاز به تقویت رادیو بی‌سیم در محوطه مخازن کروی",
            "lessons_learned": "استفاده همزمان از ماسک‌های فرار ده‌دقیقه‌ای توسط تمامی پیمانکاران ضروری است",
        }
    )

    res_fire_truck, _ = EmergencyResource.objects.get_or_create(
        organization=org,
        title="خودروی سنگین پیشرو فوم و پودر روزنباور",
        defaults={
            "resource_type": EmergencyResource.ResourceType.FIRE_TRUCK,
            "quantity": 2,
            "location": "ایستگاه مرکزی آتش‌نشانی مجتمع",
            "readiness_status": EmergencyResource.ReadinessStatus.READY,
            "notes": "سرویس ماهیانه پمپ و مخزن فوم انجام شده و آماده به کار است",
        }
    )

    res_scba, _ = EmergencyResource.objects.get_or_create(
        organization=org,
        title="ست هوارسان تنفسی دراگر ۶ لیتری ۳۰۰ بار (SCBA)",
        defaults={
            "resource_type": EmergencyResource.ResourceType.SCBA,
            "quantity": 16,
            "location": "رک اضطراری واحد الفین",
            "readiness_status": EmergencyResource.ReadinessStatus.READY,
        }
    )

    # 9. Occupational Health (Fit Status + Strict Confidential Isolation)
    fit_record, _ = OccupationalHealthFitRecord.objects.get_or_create(
        employee=emp_ali,
        defaults={
            "evaluation_date": timezone.localdate() - datetime.timedelta(days=30),
            "fit_status": OccupationalHealthFitRecord.FitStatus.FIT_WITH_RESTRICTION,
            "work_restrictions": "عدم اشتغال در محیط‌های صوتی بالای ۸۵ دسی‌بل بدون گوشی دوبل و پرهیز از بلند کردن بار بالای ۲۰ کیلوگرم",
            "restriction_notes": "معاینه دوره‌ای ۶ ماهه شنوایی‌سنجی الزامی است",
            "valid_until": timezone.localdate() + datetime.timedelta(days=150),
            "next_checkup_due": timezone.localdate() + datetime.timedelta(days=150),
        }
    )

    # Strictly isolated clinical diagnosis (ONLY for doctor)
    MedicalRecordConfidential.objects.get_or_create(
        employee=emp_ali,
        examination_date=timezone.localdate() - datetime.timedelta(days=30),
        defaults={
            "clinical_diagnosis": "افت شنوایی حسی-عصبی دوطرفه ناشی از نویز ممتد ۴ کیلوهرتز (NIHL Grade 1) و علائم دیسکوپاتی مهره L4-L5",
            "audiogram_data": {"left_ear_db": 42, "right_ear_db": 48, "frequency_notch": "4000Hz"},
            "spirometry_data": {"fvc_percent": 94, "fev1_fvc_ratio": 82},
            "blood_test_data": {"wbc": 6800, "platelets": 240000, "fasting_blood_sugar": 92},
            "physician_notes": "پروتکل حفاظت شنوایی سخت‌گیرانه اجرا گردد. بازرسی ارگونومی ایستگاه کاری ابزاردقیق الزامی است.",
            "physician_name": "دکتر احسان مرادی",
            "doctor_license_no": "MED-IR-88421",
        }
    )

    # 10. Audit & Compliance
    audit_plan, _ = AuditPlan.objects.get_or_create(
        organization=org,
        title="ممیزی جامع سالانه سیستم مدیریت ایمنی و بهداشت شغلی (ISO 45001:2018)",
        defaults={
            "audit_code": "AUD-2026-0001",
            "audit_standard": "ISO 45001:2018",
            "planned_date": timezone.localdate() + datetime.timedelta(days=20),
            "lead_auditor": admin_user,
            "status": AuditPlan.Status.SCHEDULED,
            "scope_summary": "بررسی انطباق فرآیندهای مدیریت ریسک، صدور پرمیت PTW، صلاحیت پیمانکاران و پایش بهداشت حرفه‌ای",
            "executive_summary": "ممیزی دوره‌ای با تمرکز بر رویه‌های مدیریت تغییر و اقدامات اصلاحی CAPA",
        }
    )

    AuditFinding.objects.get_or_create(
        audit_plan=audit_plan,
        description="عدم الصاق برچسب مشخصات تاریخ انقضای تست هیدرواستاتیک روی تعدادی از شیلنگ‌های هوای فشرده",
        defaults={
            "finding_type": AuditFinding.FindingType.MINOR_NC,
            "standard_clause": "8.1.2 - Eliminating hazards and reducing OH&S risks",
            "evidence": "مشاهده چشمی در بازرسی خطوط هوای ابزاردقیق کارگاه",
        }
    )

    # 11. Safety Culture & BBS
    BehaviorObservation.objects.get_or_create(
        organization=org,
        observation_date=timezone.localdate(),
        description="استفاده داوطلبانه و صحیح از دستکش نیتریل ضدحلال و شیلد صورت هنگام نمونه‌گیری از مایع سود سوزآور",
        defaults={
            "observer": admin_user,
            "observation_type": BehaviorObservation.ObservationType.SAFE,
            "category": BehaviorObservation.Category.PPE,
            "immediate_coaching": "تشویق شفاهی اپراتور در حضور تیم شیفت و ثبت کارت تشویقی ایمنی",
        }
    )

    SafetyCultureScore.objects.get_or_create(
        organization=org,
        period="پاییز ۱۴۰۴",
        defaults={
            "overall_score": 88.5,
            "participation_rate": 92.0,
            "safe_behavior_ratio": 94.2,
            "strengths": "مشارکت فعال نیروهای پیمانکار در گزارش‌دهی ناهنجاری‌ها و تمکین به دستورالعمل‌های پرمیت",
            "improvement_plan": "برگزاری کارگاه‌های تعاملی خطرات مواجهه با گاز H2S برای پرسنل جدیدالورود",
        }
    )

    # 12. Strategic HSE Goals & Budget
    HSEStrategicGoal.objects.get_or_create(
        organization=org,
        title="دستیابی به رکورد صفر حادثه تلفاتی و کاهش ضریب تکرار حوادث ناتوان‌کننده (LTIFR < 0.2)",
        defaults={
            "fiscal_year": "1404-1405",
            "pillar": HSEStrategicGoal.Pillar.ZERO_HARM,
            "target_metric": "ضریب تکرار حوادث ناتوان‌کننده (LTIFR)",
            "baseline_value": 0.85,
            "target_value": 0.15,
            "current_value": 0.0,
            "unit": "ضریب در میلیون ساعت",
            "deadline": timezone.localdate() + datetime.timedelta(days=365),
            "priority": HSEStrategicGoal.Priority.CRITICAL,
            "status": HSEStrategicGoal.GoalStatus.ON_TRACK,
            "action_plan_summary": "پیاده‌سازی ارزیابی ۱۱ مرحله‌ای، آموزش اجباری فضای بسته، ممیزی‌های سرزده شبانه",
        }
    )

    HSEStrategicGoal.objects.get_or_create(
        organization=org,
        title="کاهش ۲۰ درصدی ردپای کربن و بازچرخانی ۹۰ درصدی پساب صنعتی تصفیه‌شده",
        defaults={
            "fiscal_year": "1404-1405",
            "pillar": HSEStrategicGoal.Pillar.SUSTAINABILITY,
            "target_metric": "درصد بازچرخانی پساب خروجی",
            "baseline_value": 65.0,
            "target_value": 90.0,
            "current_value": 78.5,
            "unit": "درصد",
            "deadline": timezone.localdate() + datetime.timedelta(days=280),
            "priority": HSEStrategicGoal.Priority.HIGH,
            "status": HSEStrategicGoal.GoalStatus.ON_TRACK,
        }
    )

    HSEBudgetProgram.objects.get_or_create(
        organization=org,
        program_name="نوسازی و تأمین تجهیزات حفاظت فردی تخصصی و ضدجرقه (PPE)",
        defaults={
            "fiscal_year": "1404-1405",
            "category": HSEBudgetProgram.Category.PPE_EQUIPMENT,
            "allocated_amount": 12500.0,
            "spent_amount": 8200.0,
            "notes": "خرید دستکش‌های ضدبرش، هارنس‌های لایف‌لاین و عینک‌های ضدبخار",
        }
    )

    HSEBudgetProgram.objects.get_or_create(
        organization=org,
        program_name="طرح جامع آموزش شایستگی‌های پرمیت و مانورهای بحران",
        defaults={
            "fiscal_year": "1404-1405",
            "category": HSEBudgetProgram.Category.TRAINING,
            "allocated_amount": 8500.0,
            "spent_amount": 5400.0,
            "notes": "قرارداد با مرکز بین‌المللی آموزش ایمنی نفت و گاز",
        }
    )

    # 13. Environmental Sustainability & Resource Tracking
    ResourceConsumptionRecord.objects.get_or_create(
        organization=org,
        record_date=timezone.localdate(),
        resource_type=ResourceConsumptionRecord.ResourceType.ELECTRICITY,
        defaults={
            "workplace": wp_olefin,
            "quantity": 18500.0,
            "carbon_equivalent_kg": 9250.0,
            "notes": "کنتور اصلی برق صنعتی واحد الفین در شیفت نرمال",
        }
    )

    # 14. Management of Change (MOC)
    ChangeRequest.objects.get_or_create(
        organization=org,
        title="تغییر نوع متریال واشر فلنج‌های خط بخار داغ برج تفکیک از آزبستی به اسپیرال وند گرافیت",
        defaults={
            "moc_number": "MOC-2026-0001",
            "workplace": wp_olefin,
            "change_type": "technical",
            "category": "permanent",
            "status": "approved",
            "requested_by": admin_user,
            "description": "ارتقای کلاس فشار و دما و حذف ریسک فیبرهای استنشاقی مضر در تعمیرات دوره‌ای",
            "reason_for_change": "بهبود استاندارد بهداشت حرفه‌ای و ممانعت از نشتی بخار در دماهای بالای ۳۵۰ درجه",
            "risk_assessed": True,
            "risk_assessment_notes": "ارزیابی ریسک فرآیندی انجام شد؛ خطرات نشت حرارتی به حداقل ممکن کاهش یافت.",
        }
    )

    print("🎉 All 20 HSE Modules successfully seeded with interconnected realistic industrial data!")


if __name__ == "__main__":
    seed()
