import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from django.contrib.auth import get_user_model
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
from apps.core.traceability import TraceabilityChain, TraceabilityNode

User = get_user_model()

def run():
    print("=== شروع ایجاد داده‌های صنعتی واقعی Risk Register v2 ===")

    # 1. سازمان و کاربران
    org, _ = Organization.objects.get_or_create(
        code="PETRO_PARS",
        defaults={"name": "شرکت پتروشیمی پارس جنوبی"}
    )

    admin_user = User.objects.filter(is_superuser=True).first()
    if not admin_user:
        admin_user = User.objects.create_superuser(
            username="admin",
            email="admin@hseguard.local",
            password="adminpassword123"
        )
        print("کاربر ادمین ساخته شد: admin / adminpassword123")

    Membership.objects.get_or_create(
        user=admin_user,
        organization=org,
        defaults={"role": Membership.Roles.ORG_ADMIN}
    )

    # 2. پرونده اول: پتروشیمی (فضای بسته و گاز سمی H2S)
    reg1, created = RiskRegister.objects.get_or_create(
        organization=org,
        register_code="RR-PETRO-2026-001",
        defaults={
            "title": "ارزیابی ریسک جامع تعمیرات اساسی (Overhaul) و ورود به فضای بسته مخزن الفین TK-402",
            "revision": 1,
            "status": RiskRegister.RegisterStatus.APPROVED,
            "project_name": "طرح توسعه فاز ۱۴ پارس جنوبی",
            "department": "اداره ایمنی و آتش‌نشانی و بهره‌برداری",
            "site_location": "سایت ۱ - مخزن کروی ذخیره‌سازی TK-402",
            "area": "ناحیه فرآیندی Unit-100",
            "project_phase": "تعمیرات اساسی (Overhaul)",
            "operation_type": "عملیات گرم و ورود به فضای بسته",
            "client_name": "شرکت ملی نفت ایران",
            "contractor_name": "شرکت مهندسی و ساختمان کیسون",
            "created_by": admin_user,
            "approved_by": admin_user,
        }
    )
    print(f"پرونده ۱: {reg1.register_code} ({'ساخته شد' if created else 'موجود بود'})")

    # فعالیت ۱: بستن لاین‌ها و ورود به مخزن
    task1, _ = RiskActivityTask.objects.get_or_create(
        register=reg1,
        activity_title="تخلیه، شستشو، ایزولاسیون مکانیکی (LOTO) و ورود به مخزن کروی",
        task_name="نصب اسپکتیکل بلایند و گازسنجی اتمسفر داخلی",
        defaults={
            "activity_description": "عملیات ایزولاسیون تمام ورودی و خروجی‌های هیدروکربوری و تهویه مستمر قبل از ورود نفرات",
            "job_steps": [
                "توقف فرآیند و تخلیه کامل مایعات به مشعل (Flare)",
                "شستشو با آب و بخارزنی (Steaming) به مدت ۴۸ ساعت",
                "نصب بلایندهای کورکننده با حضور سرپرست بهره‌برداری",
                "تهویه هوا با بلوئر ضدجرقه (Air Mover)",
                "گازسنجی اولیه توسط بازرس مجاز HSE و صدور پروانه CSE",
                "ورود تیم تنظیف با تجهیزات کامل SCBA"
            ],
            "work_method": "روش اجرایی استاندارد ورود به فضای بسته SOP-HSE-CSE-012",
            "equipment": "دستگاه گازسنج ۴ کاره، فن ضدجرقه، دمنده باد، ترانس ایزوله ۱۲ ولت",
            "materials": "هوای فشرده تنفسی، نیتروژن صنعتی، مواد شوینده بیولوژیک",
            "personnel_count": 6,
            "competency": "دارای گواهینامه معتبر کار در فضای بسته و امداد و نجات",
            "duration_frequency": "به مدت ۷ روز کاری در دو شیفت",
            "simops": "همزمانی با بازرسی فنی جداره و پرتونگاری رادیوگرافی در شیفت شب",
            "operating_conditions": "دمای محیط ۴۲ درجه سانتی‌گراد، رطوبت ۷۵٪، فضای کاملاً محبوس"
        }
    )

    # خطر ۱: گاز سمی H2S
    hazard1, _ = HazardSource.objects.get_or_create(
        activity_task=task1,
        domain=HazardSource.HazardDomain.PROCESS_SAFETY,
        category="اتمسفر سمی و کمبود اکسیژن (H2S / O2 Deficit)",
        defaults={
            "description": "انتشار ناگهانی گاز کشنده سولفید هیدروژن از لجن‌های ته‌نشین‌شده کف مخزن حین هم‌زدن"
        }
    )

    # سناریوی ۱
    sc1, _ = RiskScenario.objects.get_or_create(
        hazard=hazard1,
        scenario_title="تجمع موضعی گاز سمی H2S بالاتر از 100ppm و مسمومیت حاد کارگران در فضای بسته",
        defaults={
            "undesired_event": "افت سطح هوشیاری، شوک تنفسی و سقوط افراد در داخل مخزن",
            "initiating_event": "به هم خوردن لجن کف مخزن توسط برس کارگران و آزادسازی توده گاز محبوس",
            "direct_causes": "عدم استفاده از سیستم تهویه موضعی اگزاست و ناکافی بودن دفعات گازسنجی",
            "root_causes": "نقص در نظارت ایمنی بر پروانه کار و عدم تأمین ماسک‌های نجات اضطراری EEBD",
            "escalation_factors": "دسترسی سخت به هول ورود و خروج، تاخیر در واکنش تیم امداد و نجات",
            "event_sequence": [
                "آزادسازی آنی گاز سولفید هیدروژن",
                "به صدا درآمدن آلارم گازسنج پرسنلی کارگر ۱",
                "استنشاق بخارات توسط کارگر ۲ و سقوط به کف مخزن",
                "ورود ناایمن همکار برای نجات بدون تجهیز تنفسی",
                "گرفتاری هر دو نفر در عمق مخزن"
            ],
            "scenario_conditions": "فضای تاریک، لغزندگی کف مخزن، دمای بالای ۴۰ درجه",
            "exposure_pathway": "استنشاق ریوی شدید"
        }
    )

    # کنترل‌های موجود سناریوی ۱
    RiskControl.objects.get_or_create(
        scenario=sc1,
        description="استقرار مستمر نفر دیدبان ایمنی (HSE Hole Watcher) مجهز به ارتباط رادیویی",
        defaults={
            "hierarchy": RiskControl.HierarchyOfControl.ADMINISTRATIVE,
            "control_type": "نظارت انسانی و پروتکل ایمنی",
            "control_owner": "سرپرست ایمنی سایت",
            "inspection_frequency": "لحظه‌ای و مستمر",
            "is_effective": True,
            "effectiveness_evidence": "چک‌لیست ثبت تردد و وضعیت علائم حیاتی افراد در هول واچ"
        }
    )

    RiskControl.objects.get_or_create(
        scenario=sc1,
        description="تهویه تحت فشار منفی هوا با مکنده ضدجرقه ۲۴ ساعته",
        defaults={
            "hierarchy": RiskControl.HierarchyOfControl.ENGINEERING,
            "control_type": "کنترل مهندسی مکانیکی",
            "control_owner": "مهندسی تعمیرات مکانیک",
            "inspection_frequency": "هر شیفت کاری",
            "is_effective": True,
            "effectiveness_evidence": "کالیبراسیون دوره‌ای فن و اندازه‌گیری دبی مکش هوا"
        }
    )

    # ارزیابی ابعاد چهارگانه HAER
    haer_data_initial = [
        ("human", 4, 5),       # RPN = 20 (Critical)
        ("asset", 3, 4),       # RPN = 12 (High)
        ("environment", 2, 3), # RPN = 6 (Medium)
        ("reputation", 3, 5),  # RPN = 15 (High)
    ]
    for dim, l, s in haer_data_initial:
        DimensionScoreSet.objects.update_or_create(
            scenario=sc1,
            phase="initial",
            dimension=dim,
            defaults={"likelihood": l, "severity": s}
        )

    haer_data_current = [
        ("human", 2, 4),       # RPN = 8 (Medium)
        ("asset", 2, 3),       # RPN = 6 (Medium)
        ("environment", 1, 2), # RPN = 2 (Low)
        ("reputation", 1, 4),  # RPN = 4 (Low)
    ]
    for dim, l, s in haer_data_current:
        DimensionScoreSet.objects.update_or_create(
            scenario=sc1,
            phase="current",
            dimension=dim,
            defaults={"likelihood": l, "severity": s}
        )

    # اقدام اصلاحی / تکمیلی (CAPA)
    RiskTreatmentAction.objects.get_or_create(
        scenario=sc1,
        action_description="تجهیز تمامی کارکنان داخل مخزن به دستگاه تنفسی خط هوایی (Airline) به همراه سیلندر نجات ۱۰ دقیقه‌ای فرار EEBD و دتکتور تله‌متری آنلاین",
        defaults={
            "hierarchy": RiskControl.HierarchyOfControl.ENGINEERING,
            "priority": "urgent",
            "due_date": "2026-12-01",
            "status": "completed",
            "completion_evidence": "تحویل تجهیزات و مانور آموزشی عملیاتی در تاریخ ۲۸ آبان",
            "verification_result": "تأیید کارایی خط هوایی و عدم اختلال حرکتی کارگران"
        }
    )

    # ارزیابی باقیمانده (Residual)
    haer_data_residual = [
        ("human", 1, 3, 3),       # RPN = 3 (Low) - Target 3
        ("asset", 1, 2, 2),       # RPN = 2 (Low) - Target 2
        ("environment", 1, 1, 1), # RPN = 1 (Low) - Target 1
        ("reputation", 1, 2, 2),  # RPN = 2 (Low) - Target 2
    ]
    for dim, l, s, trg in haer_data_residual:
        DimensionScoreSet.objects.update_or_create(
            scenario=sc1,
            phase="residual",
            dimension=dim,
            defaults={"likelihood": l, "severity": s, "target_rpn": trg}
        )

    # 3. ثبت زنجیره ردیابی نمونه
    chain, _ = TraceabilityChain.objects.get_or_create(
        organization=org,
        tracking_code="TRC-PARS-OVERHAUL-01",
        defaults={
            "title": "زنجیره جامع ردیابی عملیات ورود به فضای بسته مخزن کروی TK-402",
            "origin_module": "risks",
            "origin_object_id": str(reg1.id),
            "status": "verified"
        }
    )

    TraceabilityNode.objects.get_or_create(
        chain=chain,
        from_module="risks",
        from_id=str(reg1.id),
        to_module="ptw",
        to_id="PTW-HOT-CSE-9901",
        defaults={
            "relation_type": "direct",
            "description": "الحاق الزامات کنترلی ارزیابی ریسک به پروانه کار گرم و ورود به فضای بسته",
            "actor": admin_user
        }
    )

    TraceabilityNode.objects.get_or_create(
        chain=chain,
        from_module="ptw",
        from_id="PTW-HOT-CSE-9901",
        to_module="capa",
        to_id="CAPA-SAFETY-440",
        defaults={
            "relation_type": "automatic",
            "description": "ارجاع به اقدام اصلاحی نصب دتکتورهای آنلاین تله‌متری",
            "actor": admin_user
        }
    )

    print("=== پایان موفقیت‌آمیز لود دیتای سناریوهای صنعتی واقعی Risk Register v2 ===")

if __name__ == "__main__":
    run()
