from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import User
from apps.capa.models import CorrectiveAction
from apps.checklists.models import Checklist, ChecklistItem
from apps.findings.models import NonConformity
from apps.incidents.models import Incident, IncidentAttachment
from apps.inspections.models import Inspection, InspectionResponse
from apps.organizations.models import Membership, Organization
from apps.risks.models import Hazard, RiskAssessment
from apps.workplaces.models import Workplace


class Command(BaseCommand):
    help = "Seeds realistic, idempotent synthetic demo data for HSE Guard (Multi-tenant, Incidents, Hazards, CAPA)."

    def handle(self, *args, **options):
        self.stdout.write("Starting HSE Guard synthetic demo data seeding...")

        # 1. Seed Knowledge Base regulations
        try:
            call_command("seed_knowledge_base")
            self.stdout.write(self.style.SUCCESS("Knowledge base seeded."))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Knowledge base seed skipped: {e}"))

        # 2. Organizations
        org_foolad, _ = Organization.objects.update_or_create(
            code="foolad-alborz",
            defaults={"name": "مجتمع فولاد البرز", "is_active": True},
        )
        org_petro, _ = Organization.objects.update_or_create(
            code="sepehr-petro",
            defaults={"name": "پتروشیمی سپهر", "is_active": True},
        )
        self.stdout.write(self.style.SUCCESS("Organizations verified: foolad-alborz, sepehr-petro."))

        # 3. Users
        def get_or_create_user(username, email, first_name, last_name, is_platform_admin=False):
            role = User.GlobalRoles.PLATFORM_ADMIN if is_platform_admin else User.GlobalRoles.STANDARD
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "global_role": role,
                    "is_staff": is_platform_admin,
                    "is_superuser": is_platform_admin,
                },
            )
            user.set_password("Pass-12345-abc")
            user.global_role = role
            user.is_staff = is_platform_admin
            user.is_superuser = is_platform_admin
            user.save()
            return user

        admin_user = get_or_create_user("admin", "admin@hseguard.local", "مدیر", "سامانه", is_platform_admin=True)
        hse_mgr_user = get_or_create_user("hse_manager", "hse@hseguard.local", "رضا", "حسینی")
        inspector_user = get_or_create_user("inspector", "inspector@hseguard.local", "محمد", "کاظمی")
        supervisor_user = get_or_create_user("supervisor", "supervisor@hseguard.local", "علی", "رستمی")
        viewer_user = get_or_create_user("viewer", "viewer@hseguard.local", "سارا", "تهرانی")

        # Memberships
        # Foolad Alborz
        Membership.objects.update_or_create(
            user=hse_mgr_user, organization=org_foolad,
            defaults={"role": Membership.Roles.HSE_MANAGER, "is_active": True}
        )
        Membership.objects.update_or_create(
            user=inspector_user, organization=org_foolad,
            defaults={"role": Membership.Roles.HSE_INSPECTOR, "is_active": True}
        )
        Membership.objects.update_or_create(
            user=supervisor_user, organization=org_foolad,
            defaults={"role": Membership.Roles.WORKSHOP_SUPERVISOR, "is_active": True}
        )

        # Sepehr Petro
        Membership.objects.update_or_create(
            user=hse_mgr_user, organization=org_petro,
            defaults={"role": Membership.Roles.HSE_MANAGER, "is_active": True}
        )
        Membership.objects.update_or_create(
            user=viewer_user, organization=org_petro,
            defaults={"role": Membership.Roles.READ_ONLY_AUDITOR, "is_active": True}
        )
        self.stdout.write(self.style.SUCCESS("Users and memberships seeded."))

        # 4. Workplaces
        wp_roll, _ = Workplace.objects.update_or_create(
            organization=org_foolad, code="fa-roll",
            defaults={"name": "خط نورد گرم", "is_active": True, "description": "سوله شماره ۱"}
        )
        wp_cast, _ = Workplace.objects.update_or_create(
            organization=org_foolad, code="fa-cast",
            defaults={"name": "کارگاه ریخته‌گری", "is_active": True, "description": "سوله شماره ۳"}
        )
        wp_trans, _ = Workplace.objects.update_or_create(
            organization=org_foolad, code="fa-trans",
            defaults={"name": "واحد ترابری سنگین", "is_active": True, "description": "محوطه لجستیک غربی"}
        )

        wp_olefin, _ = Workplace.objects.update_or_create(
            organization=org_petro, code="sp-olefin",
            defaults={"name": "واحد الفین", "is_active": True, "description": "سایت فرآیندی A"}
        )
        wp_spheres, _ = Workplace.objects.update_or_create(
            organization=org_petro, code="sp-spheres",
            defaults={"name": "مخازن ذخیره‌سازی کروی", "is_active": True, "description": "مزرعه مخازن جنوب"}
        )
        wp_maint, _ = Workplace.objects.update_or_create(
            organization=org_petro, code="sp-maint",
            defaults={"name": "کارگاه تعمیرات مکانیک", "is_active": True, "description": "ساختمان کارگاه مرکزی"}
        )
        self.stdout.write(self.style.SUCCESS("Workplaces seeded."))

        # 5. Hazards & Risk Assessments
        haz_slag, _ = Hazard.objects.update_or_create(
            organization=org_foolad, workplace=wp_cast, title="پاشش ذرات و سرباره مذاب فولاد",
            defaults={"category": Hazard.Category.SAFETY, "description": "خطر پاشش سرباره حین دمش اکسیژن و تخلیه کوره", "created_by": hse_mgr_user}
        )
        RiskAssessment.objects.update_or_create(
            hazard=haz_slag,
            defaults={
                "organization": org_foolad,
                "likelihood": 4, "severity": 4, "score": 16, "level": "critical",
                "status": RiskAssessment.Status.APPROVED,
                "assessed_by": hse_mgr_user, "assessed_at": timezone.now() - timedelta(days=20)
            }
        )

        haz_hydro, _ = Hazard.objects.update_or_create(
            organization=org_foolad, workplace=wp_roll, title="نقص در مدار هیدرولیک و پرتاب شیلنگ فشار قوی",
            defaults={"category": Hazard.Category.SAFETY, "description": "فشار بالای ۲۰۰ بار سیستم محرک غلتک‌های نورد", "created_by": inspector_user}
        )
        RiskAssessment.objects.update_or_create(
            hazard=haz_hydro,
            defaults={
                "organization": org_foolad,
                "likelihood": 3, "severity": 4, "score": 12, "level": "high",
                "status": RiskAssessment.Status.APPROVED,
                "assessed_by": inspector_user, "assessed_at": timezone.now() - timedelta(days=15)
            }
        )

        haz_gas, _ = Hazard.objects.update_or_create(
            organization=org_petro, workplace=wp_olefin, title="نشت بخارات هیدروکربوری و خطر اشتعال",
            defaults={"category": Hazard.Category.CHEMICAL, "description": "امکان تشکیل ابر اشتعال‌زا ناشی از نشت آب‌بندی پمپ‌ها", "created_by": hse_mgr_user}
        )
        RiskAssessment.objects.update_or_create(
            hazard=haz_gas,
            defaults={
                "organization": org_petro,
                "likelihood": 3, "severity": 5, "score": 15, "level": "critical",
                "status": RiskAssessment.Status.APPROVED,
                "assessed_by": hse_mgr_user, "assessed_at": timezone.now() - timedelta(days=10)
            }
        )

        haz_scaffold, _ = Hazard.objects.update_or_create(
            organization=org_petro, workplace=wp_spheres, title="سقوط ابزارآلات حین کار بر روی داربست مخزن",
            defaults={"category": Hazard.Category.SAFETY, "description": "کار در ارتفاع بالای ۱۲ متر در مجاورت مخازن گاز مایع", "created_by": hse_mgr_user}
        )
        RiskAssessment.objects.update_or_create(
            hazard=haz_scaffold,
            defaults={
                "organization": org_petro,
                "likelihood": 3, "severity": 3, "score": 9, "level": "medium",
                "status": RiskAssessment.Status.APPROVED,
                "assessed_by": hse_mgr_user, "assessed_at": timezone.now() - timedelta(days=8)
            }
        )
        self.stdout.write(self.style.SUCCESS("Hazards and Risk Assessments seeded."))

        # 6. CAPA & NonConformity
        nc_slag, _ = NonConformity.objects.update_or_create(
            organization=org_foolad, workplace=wp_cast,
            description="ورود آهن‌قراضه مرطوب به کوره و پاشش سرباره مذاب در مجاورت پاتیل شماره ۲",
            defaults={"severity": NonConformity.Severity.HIGH, "source": NonConformity.Source.MANUAL, "responsible": supervisor_user}
        )
        capa_slag, _ = CorrectiveAction.objects.update_or_create(
            organization=org_foolad, non_conformity=nc_slag,
            description="نصب سقف پوششی بارانداز آهن‌قراضه و تجهیز خط شارژ کوره به سنسور حرارتی رطوبت‌سنج",
            defaults={
                "responsible": supervisor_user,
                "due_date": (timezone.now() + timedelta(days=14)).date(),
                "status": CorrectiveAction.Status.IN_PROGRESS,
                "created_by": hse_mgr_user,
            }
        )

        nc_leak, _ = NonConformity.objects.update_or_create(
            organization=org_foolad, workplace=wp_trans,
            description="نشت روغن هیدرولیک کمپرسی در محوطه بارانداز ترابری",
            defaults={"severity": NonConformity.Severity.LOW, "source": NonConformity.Source.MANUAL, "responsible": supervisor_user}
        )
        capa_leak, _ = CorrectiveAction.objects.update_or_create(
            organization=org_foolad, non_conformity=nc_leak,
            description="تعویض کامل شیلنگ‌های جک تخلیه و تهیه بسته جذب روغن (Spill Kit) برای کلیه تریلرها",
            defaults={
                "responsible": supervisor_user,
                "due_date": (timezone.now() - timedelta(days=2)).date(),
                "status": CorrectiveAction.Status.COMPLETED,
                "result_text": "شیلنگ‌ها تعویض و کیت مهار نشتی در توقفگاه مستقر شد.",
                "effectiveness_verified": True,
                "verified_by": hse_mgr_user,
                "verified_at": timezone.now() - timedelta(days=1),
                "created_by": hse_mgr_user,
            }
        )

        # 7. Incidents & Near-Misses (with is_synthetic=True)
        now = timezone.now()

        # Incident 1: Major accident with root-cause and open CAPA
        inc1, created1 = Incident.objects.update_or_create(
            organization=org_foolad,
            title="پاشش سرباره مذاب در مجاورت پاتیل شماره ۲",
            defaults={
                "workplace": wp_cast,
                "incident_type": Incident.IncidentType.INCIDENT,
                "severity": Incident.Severity.MAJOR,
                "status": Incident.Status.ACTION_REQUIRED,
                "occurred_at": now - timedelta(days=5, hours=3),
                "reported_by": supervisor_user,
                "assigned_investigator": inspector_user,
                "location_details": "ایستگاه شماره ۲ کوره قوس الکتریکی، بالکن نمونه‌گیری",
                "description": "حین افزودن آهک به مذاب و تخلیه پاتیل، به دلیل رطوبت آهن‌قراضه شارژشده، پاشش شدید سرباره رخ داد و یک نفر از ناحیه دست دچار سوختگی درجه دو شد.",
                "immediate_actions_taken": "قطع عملیات کوره، انتقال مصدوم به درمانگاه تخصصی سوختگی، اطفای شعله‌های موضعی کابل‌های مجاور.",
                "injury_count": 1,
                "lost_time_days": 4,
                "environmental_impact": "",
                "property_damage_cost": 25000000.0,
                "root_cause": "نگهداری آهن‌قراضه در فضای روباز بارانداز بدون پوشش ضدباران و شارژ مستقیم ضایعات خیس به کوره داغ.",
                "contributing_factors": "کمبود نظارت واحد انبار، عجله برای جبران توقف خط تولید، نبود رطوبت‌سنج آنلاین در قیف شارژ.",
                "investigation_completed_at": now - timedelta(days=2),
                "review_notes": "بررسی اولیه توسط مدیر HSE تأیید و پرونده جهت ریشه‌یابی به بازرس کارگاه ارجاع شد.",
                "related_hazard": haz_slag,
                "is_synthetic": True,
            }
        )
        inc1.related_corrective_actions.add(capa_slag)

        # Incident 2: Near-miss under investigation in Petrochemical
        inc2, _ = Incident.objects.update_or_create(
            organization=org_petro,
            title="سقوط آچار ضربه‌ای از داربست واحد مخازن کروی",
            defaults={
                "workplace": wp_spheres,
                "incident_type": Incident.IncidentType.NEAR_MISS,
                "severity": Incident.Severity.MODERATE,
                "status": Incident.Status.UNDER_INVESTIGATION,
                "occurred_at": now - timedelta(days=2, hours=1),
                "reported_by": viewer_user,
                "assigned_investigator": hse_mgr_user,
                "location_details": "داربست طبقه سوم مخزن کروی TK-101",
                "description": "حین باز کردن پیچ‌های منهول مخزن کروی در ارتفاع ۱۲ متری، آچار ۲۴ از دست تکنسین رها شد و با برخورد به توری محافظ متوقف گردید بدون برخورد با افراد زیر داربست.",
                "immediate_actions_taken": "محصور کردن محوطه زیر داربست با نوار زرد خطر، بازرسی توری محافظ و تذکر ایمنی ابزار متصل (Tool Lanyard).",
                "injury_count": 0,
                "lost_time_days": 0,
                "environmental_impact": "",
                "property_damage_cost": 0.0,
                "review_notes": "شبه‌حادثه پرپتانسیل؛ نیازمند بازنگری روش اجرایی کار در ارتفاع و الزامی‌کردن بند نگهدارنده ابزار.",
                "related_hazard": haz_scaffold,
                "is_synthetic": True,
            }
        )

        # Incident 3: Unsafe act reported in Steel mill
        inc3, _ = Incident.objects.update_or_create(
            organization=org_foolad,
            title="عدم استفاده از هارنس ایمنی حین تعمیرات بالابر نورد",
            defaults={
                "workplace": wp_roll,
                "incident_type": Incident.IncidentType.UNSAFE_ACT,
                "severity": Incident.Severity.MINOR,
                "status": Incident.Status.REPORTED,
                "occurred_at": now - timedelta(hours=6),
                "reported_by": inspector_user,
                "location_details": "سکوی هدایت غلتک خط نورد گرم شماره ۱",
                "description": "تکنسین برق در ارتفاع ۲.۸ متری مشغول کار روی تابلوی برق سقف کانوایر بود در حالی که هارنس را پوشیده ولی لنیارد را به هیچ نقطه مهاری متصل نکرده بود.",
                "immediate_actions_taken": "توقف بلافاصله کار توسط بازرس HSE و هدایت کارگر به اتصال صحیح لنیارد به کابل لایف‌لاین سقفی.",
                "injury_count": 0,
                "lost_time_days": 0,
                "environmental_impact": "",
                "property_damage_cost": 0.0,
                "related_hazard": haz_hydro,
                "is_synthetic": True,
            }
        )

        # Incident 4: Closed minor incident
        inc4, _ = Incident.objects.update_or_create(
            organization=org_foolad,
            title="نشت روغن هیدرولیک کمپرسی در توقفگاه ترابری",
            defaults={
                "workplace": wp_trans,
                "incident_type": Incident.IncidentType.INCIDENT,
                "severity": Incident.Severity.MINOR,
                "status": Incident.Status.CLOSED,
                "occurred_at": now - timedelta(days=12),
                "reported_by": supervisor_user,
                "assigned_investigator": hse_mgr_user,
                "location_details": "پارکینگ ماشین‌آلات سنگین، خط شارژ گازوئیل",
                "description": "پاره شدن شیلنگ فرسوده جک هیدرولیک کمپرسی منجر به ریزش حدود ۱۰ لیتر روغن روی آسفالت شد.",
                "immediate_actions_taken": "مهار نشتی با پودر جاذب و جلوگیری از ورود روغن به جوب هدایت آب‌های سطحی.",
                "injury_count": 0,
                "lost_time_days": 0,
                "environmental_impact": "آلودگی موضعی ۵ مترمربع از کف توقفگاه که کاملاً پاکسازی شد.",
                "property_damage_cost": 3500000.0,
                "root_cause": "فرسودگی شیلنگ جک و فرارسیدن زمان تعویض بر اساس دفترچه PM بدون تعویض به موقع.",
                "contributing_factors": "تأخیر تأمین قطعه یدکی از انبار مرکزی.",
                "investigation_completed_at": now - timedelta(days=10),
                "review_notes": "اقدام پاکسازی محیطی تایید گردید.",
                "closure_notes": "کلیه اقدامات اصلاحی تکمیل شد و تعویض دوره‌ای شیلنگ‌ها در چک‌لیست بازرسی روزانه رانندگان گنجانده شد.",
                "closed_at": now - timedelta(days=1),
                "is_synthetic": True,
            }
        )
        inc4.related_corrective_actions.add(capa_leak)

        # Add attachments to inc1 and inc2 if not exist
        IncidentAttachment.objects.get_or_create(
            incident=inc1,
            title="تصویر محل برخورد مذاب و کابل‌های سوخته",
            defaults={
                "attachment_type": "photo",
                "file_url": "https://storage.hseguard.local/attachments/incidents/inc-101-slag.jpg",
                "description": "پاشش مذاب به متراژ ۵ متر به اطراف پاتیل",
                "uploaded_by": supervisor_user,
            }
        )
        IncidentAttachment.objects.get_or_create(
            incident=inc2,
            title="گزارش اولیه بازرسی داربست مخزن کروی",
            defaults={
                "attachment_type": "document",
                "file_url": "https://storage.hseguard.local/attachments/incidents/inc-102-scaffold-report.pdf",
                "description": "فرم بازرسی هفتگی داربست و وضعیت توری‌های ضدسقوط",
                "uploaded_by": viewer_user,
            }
        )

        self.stdout.write(self.style.SUCCESS("All synthetic demo data seeded successfully with is_synthetic=True."))
