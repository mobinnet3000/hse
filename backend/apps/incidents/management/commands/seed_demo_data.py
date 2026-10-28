from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import User
from apps.assets.models import CalibrationRecord, Equipment, MaintenancePlan, MaintenanceWorkOrder
from apps.capa.models import CorrectiveAction
from apps.checklists.models import Checklist, ChecklistItem
from apps.findings.models import NonConformity
from apps.incidents.models import Incident, IncidentAttachment
from apps.inspections.models import Inspection, InspectionResponse
from apps.organizations.models import Membership, Organization
from apps.permits.models import Permit, PermitAttachment, PermitTypeCompetencyRequirement, ShiftHandover, SIMOPSConflict
from apps.risks.models import (
    Barrier,
    BarrierAssessment,
    BowTieConsequence,
    BowTieDiagram,
    BowTieThreat,
    HCMSControlMatrix,
    Hazard,
    RiskAssessment,
    RiskAssessmentTemplate,
)
from apps.workforce.models import (
    AttendanceRecord,
    Competency,
    ContractorCompany,
    ContractorDocument,
    ContractorEvaluation,
    ContractorWorker,
    Employee,
    EmployeeCompetency,
    EmployeeJobAssignment,
    JobPosition,
    PPEAssignment,
    PPEAssignmentEvent,
    PPEItem,
    PPEStock,
    TrainingAttendance,
    TrainingCourse,
    TrainingSession,
)
from apps.workplaces.models import Workplace
from apps.environment.models import (
    EnvironmentalAspect,
    EnvironmentalThreshold,
    OccupationalHygieneRecord,
    WasteRecord,
    WastewaterEmissionRecord,
)
from apps.environment.services import (
    evaluate_and_record_hygiene_survey,
    evaluate_and_record_wastewater_emission,
)
from apps.scaffolds.models import Scaffold, ScaffoldInspection, ScaffoldTagLog
from apps.scaffolds.services import record_scaffold_inspection, change_scaffold_tag
from django.core.files.base import ContentFile
from apps.documents.models import (
    ConfidentialityLevel,
    Document,
    DocumentAcknowledgment,
    DocumentCategory,
    DocumentLink,
    DocumentReviewLog,
    DocumentStatus,
    DocumentVersion,
    VersionStatus,
)
from apps.organizations.models import SubscriptionPlan, OrganizationSubscription, ModuleEntitlement
from apps.calculators.models import CalculationRecord
from apps.lifting.models import CraneSpecification, LiftingPlan
from apps.pssr.models import PSSRReview, PSSRChecklistItem, PSSROutstandingAction
from apps.pssr.services import populate_default_checklist
from apps.surveys.models import Survey, SurveyQuestion, SurveyQuestionOption, SurveySubmission, SurveyAnswer
from apps.chat.models import ChatConversation, ChatParticipant, ChatMessage
from apps.fleet_energy.models import FleetVehicle, FleetFuelLog, EnergyConsumptionLog, ExcavationOperation
from apps.findings.models import AnomalyEvidence
from apps.dashboard.models import HSEIndicatorConfig



DEMO_PASSWORD = "Pass-12345-abc"
DEMO_EMAIL_DOMAIN = "@hseguard.local"


class Command(BaseCommand):
    help = "Seeds realistic, idempotent synthetic demo data for HSE Guard (Multi-tenant, Incidents, Hazards, CAPA)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-demo-passwords",
            action="store_true",
            help="Deliberately reset passwords of existing demo-prefixed accounts only.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force seeding demo data even if organizations exist without demo accounts.",
        )

    def handle(self, *args, **options):
        self.stdout.write("Starting HSE Guard synthetic demo data seeding...")
        self.reset_demo_passwords = options.get("reset_demo_passwords", False)
        self.force = options.get("force", False)

        # 1. Seed Knowledge Base regulations
        try:
            call_command("seed_knowledge_base")
            self.stdout.write(self.style.SUCCESS("Knowledge base seeded."))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Knowledge base seed skipped: {e}"))

        # 2. Organizations
        def seed_organization(code, name):
            """Create the demo organization, or refresh it only if it is demo-owned."""
            existing = Organization.objects.filter(code=code).first()
            if existing is not None:
                is_demo_owned = Membership.objects.filter(
                    organization=existing, user__username__startswith="demo_"
                ).exists()
                if not is_demo_owned and not self.force:
                    raise CommandError(
                        f"سازمان «{code}» از قبل وجود دارد و نشانه‌ای از داده دمو ندارد؛ "
                        "برای جلوگیری از بازنویسی داده واقعی، عملیات متوقف شد. از --force برای ادامه استفاده کنید."
                    )
                existing.name = name
                existing.is_active = True
                existing.save(update_fields=["name", "is_active", "updated_at"])
                return existing
            return Organization.objects.create(code=code, name=name, is_active=True)

        org_foolad = seed_organization("foolad-alborz", "مجتمع فولاد البرز")
        org_petro = seed_organization("sepehr-petro", "پتروشیمی سپهر")
        self.stdout.write(self.style.SUCCESS("Organizations verified: foolad-alborz, sepehr-petro."))

        # 3. Users
        def get_or_create_demo_user(username, email, first_name, last_name, is_platform_admin=False):
            role = User.GlobalRoles.PLATFORM_ADMIN if is_platform_admin else User.GlobalRoles.STANDARD
            user = User.objects.filter(username=username).first()
            if user is not None and not user.email.endswith(DEMO_EMAIL_DOMAIN):
                raise CommandError(
                    f"نام کاربری دمو «{username}» قبلاً توسط یک حساب غیردمو استفاده شده است؛ "
                    "برای جلوگیری از تغییر داده واقعی، عملیات متوقف شد."
                )

            if user is None:
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    password=DEMO_PASSWORD,
                )
            else:
                # Never reset an existing account's password implicitly. The
                # demo password is applied only on first creation, unless the
                # operator explicitly opts in with --reset-demo-passwords.
                user.email = email
                user.first_name = first_name
                user.last_name = last_name
                if self.reset_demo_passwords:
                    user.set_password(DEMO_PASSWORD)

            user.global_role = role
            user.is_staff = is_platform_admin
            user.is_superuser = is_platform_admin
            user.save()
            return user

        admin_user = get_or_create_demo_user("demo_admin", "demo_admin@hseguard.local", "مدیر", "سامانه", is_platform_admin=True)
        hse_mgr_user = get_or_create_demo_user("demo_hse_manager", "demo_hse_manager@hseguard.local", "رضا", "حسینی")
        inspector_user = get_or_create_demo_user("demo_inspector", "demo_inspector@hseguard.local", "محمد", "کاظمی")
        supervisor_user = get_or_create_demo_user("demo_supervisor", "demo_supervisor@hseguard.local", "علی", "رستمی")
        petro_supervisor_user = get_or_create_demo_user(
            "demo_petro_supervisor", "demo_petro_supervisor@hseguard.local", "سعید", "کریمی"
        )
        viewer_user = get_or_create_demo_user("demo_viewer", "demo_viewer@hseguard.local", "سارا", "تهرانی")

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
            user=petro_supervisor_user, organization=org_petro,
            defaults={"role": Membership.Roles.WORKSHOP_SUPERVISOR, "is_active": True}
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

        # 5.1. Phase 11: BowTie Diagrams, Barriers & HCMS Matrices
        bt_furnace, _ = BowTieDiagram.objects.update_or_create(
            organization=org_foolad,
            hazard=haz_slag,
            top_event="انفجار و پاشش سرباره و ذرات مذاب از دهانه کوره قوس الکتریکی",
            defaults={
                "description": "مدل‌سازی موانع پیشگیرانه ورود رطوبت و کنترل پرتاب مذاب حین فرآیند دمش اکسیژن",
                "status": BowTieDiagram.Status.ACTIVE,
                "owner": hse_mgr_user,
                "created_by": hse_mgr_user,
                "target_review_date": (timezone.now() + timedelta(days=60)).date(),
            },
        )
        th_moist, _ = BowTieThreat.objects.update_or_create(
            diagram=bt_furnace,
            title="ورود قراضه مرطوب و بسته‌های محبوس آب به حوضچه مذاب کوره",
            defaults={"category": "operational", "order": 1},
        )
        th_cooling, _ = BowTieThreat.objects.update_or_create(
            diagram=bt_furnace,
            title="نشت آب از پانل‌های مسی سیستم خنک‌کاری سقف کوره",
            defaults={"category": "equipment_failure", "order": 2},
        )
        cq_burns, _ = BowTieConsequence.objects.update_or_create(
            diagram=bt_furnace,
            title="سوختگی شدید حرارتی پرسنل و اپراتورهای مستقر در سکوی ذوب",
            defaults={"severity_level": BowTieConsequence.Severity.CRITICAL, "order": 1},
        )
        cq_damage, _ = BowTieConsequence.objects.update_or_create(
            diagram=bt_furnace,
            title="آسیب مکانیکی و سازه‌ای به ترانسفورماتور و تجهیزات جانبی کوره",
            defaults={"severity_level": BowTieConsequence.Severity.HIGH, "order": 2},
        )

        bar_preheat, _ = Barrier.objects.update_or_create(
            diagram=bt_furnace,
            threat=th_moist,
            name="سامانه پیش‌گرمایش و خشک‌کن مداوم قراضه شارژ کوره",
            defaults={
                "barrier_type": Barrier.BarrierType.PREVENTIVE,
                "nature": Barrier.Nature.ENGINEERING,
                "is_critical": True,
                "owner": hse_mgr_user,
                "current_effectiveness": Barrier.Effectiveness.EFFECTIVE,
                "status": Barrier.Status.OPERATIONAL,
                "description": "کوره پیش‌گرم تونلی با مشعل‌های گازسوز جهت تبخیر رطوبت سطحی آهن‌قراضه",
            },
        )
        bar_sensor, _ = Barrier.objects.update_or_create(
            diagram=bt_furnace,
            threat=th_cooling,
            name="حسگرهای اپتیکی مادون قرمز و پایش مداوم دبی آب خنک‌کن",
            defaults={
                "barrier_type": Barrier.BarrierType.PREVENTIVE,
                "nature": Barrier.Nature.ENGINEERING,
                "is_critical": True,
                "owner": supervisor_user,
                "current_effectiveness": Barrier.Effectiveness.INEFFECTIVE,
                "status": Barrier.Status.IMPAIRED,
                "description": "سیستم اینترلاک قطع اضطراری قوس در صورت افت فشار یا نشت مدار خنک‌کاری",
            },
        )
        # Critical barrier failure triggers reassessment flag on hazard!
        haz_slag.reassessment_needed = True
        haz_slag.reassessment_reason = "نقص در مانع کنترلی بحرانی: حسگرهای اپتیکی مادون قرمز و پایش مداوم دبی آب خنک‌کن"
        haz_slag.save(update_fields=["reassessment_needed", "reassessment_reason", "updated_at"])

        Barrier.objects.update_or_create(
            diagram=bt_furnace,
            consequence=cq_burns,
            name="اتاقک کنترل عایق ضد حرارت و جان‌پناه نسوز اپراتوری",
            defaults={
                "barrier_type": Barrier.BarrierType.MITIGATIVE,
                "nature": Barrier.Nature.PHYSICAL,
                "is_critical": False,
                "owner": supervisor_user,
                "current_effectiveness": Barrier.Effectiveness.EFFECTIVE,
                "status": Barrier.Status.OPERATIONAL,
                "description": "شیشه‌های نسوز چندلایه و بدنه عایق سرامیکی جهت ممانعت از پرتاب گدازه به اتاقک",
            },
        )

        # Barrier Assessment records
        BarrierAssessment.objects.get_or_create(
            barrier=bar_sensor,
            assessment_date=(timezone.now() - timedelta(days=2)).date(),
            defaults={
                "effectiveness": Barrier.Effectiveness.INEFFECTIVE,
                "assessed_by": inspector_user,
                "evidence_reference": "گزارش تست دوره‌ای مدار ابزاردقیق IR-EAF-01",
                "notes": "سنسور به علت نشست گرد و غبار نسوز دچار خطای کالیبراسیون شده و فرمان قطع صادر نمی‌کند.",
            },
        )
        BarrierAssessment.objects.get_or_create(
            barrier=bar_preheat,
            assessment_date=(timezone.now() - timedelta(days=10)).date(),
            defaults={
                "effectiveness": Barrier.Effectiveness.EFFECTIVE,
                "assessed_by": inspector_user,
                "evidence_reference": "چک‌لیست بازرسی حرارت‌سنجی تونل شارژ",
                "notes": "دمای قراضه خروجی بالای ۲۵۰ درجه ثبت شد و رطوبت کاملاً صفر است.",
            },
        )

        # HCMS Controls
        HCMSControlMatrix.objects.update_or_create(
            organization=org_foolad,
            hazard=haz_slag,
            control_title="نصب سرپوش مکنده غبار و شیلدهای متحرک ضد پاشش مذاب",
            defaults={
                "barrier": bar_preheat,
                "hierarchy_of_control": HCMSControlMatrix.Hierarchy.ENGINEERING,
                "implementation_status": HCMSControlMatrix.Status.IMPLEMENTED,
                "review_frequency_days": 90,
                "last_reviewed_at": (timezone.now() - timedelta(days=15)).date(),
                "next_review_due": (timezone.now() + timedelta(days=75)).date(),
                "responsible_owner": hse_mgr_user,
                "initial_risk_score": 16,
                "residual_likelihood": 2,
                "residual_severity": 3,
                "residual_score": 6,
                "residual_level": "medium",
            },
        )

        # BowTie for Petrochemical
        bt_gas, _ = BowTieDiagram.objects.update_or_create(
            organization=org_petro,
            hazard=haz_gas,
            top_event="نشت بخارات سنگین هیدروکربوری و اشتعال در ناحیه جداسازی الفین",
            defaults={
                "description": "پایش یکپارچگی خطوط الفین و کنترل موانع جداسازی گازهای قابل اشتعال",
                "status": BowTieDiagram.Status.ACTIVE,
                "owner": petro_supervisor_user,
                "created_by": petro_supervisor_user,
                "target_review_date": (timezone.now() + timedelta(days=90)).date(),
            },
        )
        th_seal, _ = BowTieThreat.objects.update_or_create(
            diagram=bt_gas,
            title="فرسودگی مکانیکال سیل پمپ گردش خوراک الفین",
            defaults={"category": "equipment_failure", "order": 1},
        )
        cq_vce, _ = BowTieConsequence.objects.update_or_create(
            diagram=bt_gas,
            title="انفجار ابر بخار اشتعال‌زا (VCE) و گسترش حریق به مخازن کروی",
            defaults={"severity_level": BowTieConsequence.Severity.CRITICAL, "order": 1},
        )
        Barrier.objects.update_or_create(
            diagram=bt_gas,
            threat=th_seal,
            name="سیستم دابل سیل مکانیکی پلان ۵۳A با گاز نیتروژن تحت فشار",
            defaults={
                "barrier_type": Barrier.BarrierType.PREVENTIVE,
                "nature": Barrier.Nature.ENGINEERING,
                "is_critical": True,
                "owner": petro_supervisor_user,
                "current_effectiveness": Barrier.Effectiveness.EFFECTIVE,
                "status": Barrier.Status.OPERATIONAL,
            },
        )
        Barrier.objects.update_or_create(
            diagram=bt_gas,
            consequence=cq_vce,
            name="سامانه خاموش‌کننده سیلابی آب و فوم (Deluge System)",
            defaults={
                "barrier_type": Barrier.BarrierType.MITIGATIVE,
                "nature": Barrier.Nature.ENGINEERING,
                "is_critical": True,
                "owner": petro_supervisor_user,
                "current_effectiveness": Barrier.Effectiveness.EFFECTIVE,
                "status": Barrier.Status.OPERATIONAL,
            },
        )

        # Risk Assessment Templates
        RiskAssessmentTemplate.objects.get_or_create(
            title="الگوی ارزیابی ریسک فرآیندی کوره قوس و پاتیل مذاب",
            defaults={
                "industry": "صنایع فولاد و متالورژی",
                "category": Hazard.Category.SAFETY,
                "standard_code": "ISO 45001:2018 / NFPA 652",
                "version": "1.0",
                "typical_threats": "ورود رطوبت، افت فشار آب، نوسان قوس الکتریکی",
                "typical_consequences": "پاشش مذاب، حریق ترانسفورماتور، سوختگی پرسنل",
                "recommended_barriers": "کوره خشک‌کن قراضه، سنسورهای دبی آب، دیواره حائل نسوز",
            },
        )
        RiskAssessmentTemplate.objects.get_or_create(
            title="الگوی ارزیابی ریسک نشتی و انفجار واحدهای الفین",
            defaults={
                "industry": "صنایع نفت، گاز و پتروشیمی",
                "category": Hazard.Category.CHEMICAL,
                "standard_code": "API RP 752 / OSHA PSM 1910.119",
                "version": "2.1",
                "typical_threats": "فرسودگی سیل پمپ، نشت فلنج، خطای شیرآلات",
                "typical_consequences": "انفجار ابر بخار (VCE)، آلودگی هوا، حریق فلش",
                "recommended_barriers": "مکانیکال سیل پلان ۵۳، دتکتور مادون قرمز، سیستم دلویج آب و فوم",
            },
        )
        self.stdout.write(self.style.SUCCESS("Phase 11 BowTie, Barriers & HCMS seeded."))

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

        # 8. Checklists & Inspections
        chk_fire, _ = Checklist.objects.update_or_create(
            organization=org_foolad,
            title="چک‌لیست ایمنی عمومی و تجهیزات اطفای حریق",
            defaults={
                "description": "پایش ماهانه کپسول‌های پودر و گاز، جعبه‌های F و مسیرهای دسترسی اضطراری",
                "is_active": True,
                "created_by": hse_mgr_user,
            },
        )
        for idx, text in enumerate([
            "بررسی فشارسنج و قرار داشتن عقربه در ناحیه سبز گیج",
            "سالم بودن پلمپ، ضامن و بست نگه‌دارنده شیلنگ تخلیه",
            "عدم وجود مانع یا دپوی کالا در مقابل کپسول‌ها و فایرباکس‌ها",
            "اعتبار تاریخ آخرین تست هیدروستاتیک و شارژ دوره‌ای سالانه",
        ], 1):
            ChecklistItem.objects.update_or_create(
                checklist=chk_fire, order=idx,
                defaults={"text": text, "is_required": True},
            )

        chk_ppe_cast, _ = Checklist.objects.update_or_create(
            organization=org_foolad,
            title="چک‌لیست نظارت بر تجهیزات حفاظت فردی (PPE) کارگاه ریخته‌گری",
            defaults={
                "description": "انطباق البسه نسوز، شیلد و گترهای اپراتورهای کوره قوس و پاتیل مذاب",
                "is_active": True,
                "created_by": hse_mgr_user,
            },
        )
        for idx, text in enumerate([
            "استفاده از شیلد محافظ صورت و عینک ضد پاشش مذاب حین تخلیه",
            "پوشش کامل گتر آلومینایز و دستکش چرمی ساق‌بلند نسوز",
            "استفاده از کفش ایمنی با سرپنجه فولادی و زیره مقاوم به حرارت",
            "سلامت و فیت بودن ماسک‌های تنفسی فیلتردار ضد گاز و ذرات فلزی",
        ], 1):
            ChecklistItem.objects.update_or_create(
                checklist=chk_ppe_cast, order=idx,
                defaults={"text": text, "is_required": True},
            )

        chk_scaffold, _ = Checklist.objects.update_or_create(
            organization=org_petro,
            title="چک‌لیست ایمنی داربست‌بندی و کار در ارتفاع",
            defaults={
                "description": "الزامات فنی سازه داربست، تخته‌ها، لوله‌های مهار و سیستم ضدسقوط",
                "is_active": True,
                "created_by": hse_mgr_user,
            },
        )
        for idx, text in enumerate([
            "نصب و سلامت تگ داربست معتبر (Scaffold Tag) سبز رنگ با امضای ناظر",
            "تکمیل بودن نرده حفاظتی میانی و بالایی به ارتفاع ۹۰ و ۱۱۰ سانتی‌متر",
            "وجود قرنیز لبه‌دار (Toe-board) به ارتفاع حداقل ۱۵ سانتی‌متر دور سکو",
            "استفاده کلیه نفرات از کمربند ایمنی فول‌بادی و اتصال به لایف‌لاین",
        ], 1):
            ChecklistItem.objects.update_or_create(
                checklist=chk_scaffold, order=idx,
                defaults={"text": text, "is_required": True},
            )

        now_time = timezone.now()
        insp_fire, _ = Inspection.objects.update_or_create(
            organization=org_foolad,
            checklist=chk_fire,
            title="بازرسی ماهانه تجهیزات اطفای حریق خط نورد گرم",
            defaults={
                "workplace": wp_roll,
                "inspector": inspector_user,
                "created_by": hse_mgr_user,
                "scheduled_at": now_time - timedelta(days=5),
                "performed_at": now_time - timedelta(days=5),
                "completed_at": now_time - timedelta(days=5),
                "status": Inspection.Status.COMPLETED,
                "notes": "کپسول‌های بخش غربی نیازمند بازبینی برچسب شارژ بودند.",
            },
        )
        for item in chk_fire.items.all():
            res_val = InspectionResponse.Result.CONFORM if item.order != 4 else InspectionResponse.Result.NONCONFORM
            InspectionResponse.objects.update_or_create(
                inspection=insp_fire,
                item=item,
                defaults={
                    "item_text": item.text,
                    "order": item.order,
                    "is_required": item.is_required,
                    "result": res_val,
                    "notes": "برچسب شارژ منقضی شده و نیازمند تمدید است." if res_val == InspectionResponse.Result.NONCONFORM else "مطابق و تأیید شد.",
                },
            )

        insp_ppe, _ = Inspection.objects.update_or_create(
            organization=org_foolad,
            checklist=chk_ppe_cast,
            title="پایش میدانی استفاده از PPE در کارگاه ریخته‌گری",
            defaults={
                "workplace": wp_cast,
                "inspector": supervisor_user,
                "created_by": hse_mgr_user,
                "scheduled_at": now_time - timedelta(days=2),
                "performed_at": now_time - timedelta(days=2),
                "completed_at": now_time - timedelta(days=2),
                "status": Inspection.Status.COMPLETED,
                "notes": "کلیه پرسنل شیفت از ادوات کامل و سالم برخوردار بودند.",
            },
        )
        for item in chk_ppe_cast.items.all():
            InspectionResponse.objects.update_or_create(
                inspection=insp_ppe,
                item=item,
                defaults={
                    "item_text": item.text,
                    "order": item.order,
                    "is_required": item.is_required,
                    "result": InspectionResponse.Result.CONFORM,
                    "notes": "وضعیت مطلوب ارزیابی شد.",
                },
            )

        insp_scaff, _ = Inspection.objects.update_or_create(
            organization=org_petro,
            checklist=chk_scaffold,
            title="بازرسی هفتگی داربست مخازن کروی واحد ذخیره‌سازی",
            defaults={
                "workplace": wp_spheres,
                "inspector": petro_supervisor_user,
                "created_by": hse_mgr_user,
                "scheduled_at": now_time - timedelta(days=1),
                "performed_at": now_time - timedelta(days=1),
                "status": Inspection.Status.IN_PROGRESS,
                "notes": "بررسی اولیه انجام شده و اصلاح قرنیز شمالی در دست اقدام است.",
            },
        )
        self.stdout.write(self.style.SUCCESS("Checklists and inspections seeded."))

        # 9. Permits to Work (PTW) & Shift Handover
        def seed_permit(reference_code, defaults):
            """Create or refresh a synthetic permit without touching real data."""
            existing = Permit.objects.filter(reference_code=reference_code).first()
            if existing is not None and not existing.is_synthetic:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped demo permit {reference_code}: reference code belongs to a real permit."
                    )
                )
                return None
            payload = {**defaults, "is_synthetic": True}
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.save()
                return existing
            return Permit.objects.create(reference_code=reference_code, **payload)

        def seed_handover(lookup, defaults):
            """Create or refresh only synthetic handovers; real records are untouched."""
            payload = {**defaults, "is_synthetic": True}
            existing = ShiftHandover.objects.filter(is_synthetic=True, **lookup).first()
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.save()
                return existing
            return ShiftHandover.objects.create(**lookup, **payload)

        ptw1 = seed_permit(
            "PTW-202610-0101",
            {
                "organization": org_foolad,
                "workplace": wp_roll,
                "permit_type": Permit.PermitType.HOT_WORK,
                "title": "جوشکاری و تقویت شاسی نقاله خنک‌کننده نورد",
                "description": "جوشکاری تقویتی تیرهای حائل و تعویض بلبرینگ یاتاقان موتور نقاله.",
                "work_area": "سوله شماره ۱، لاین میانی نقاله خنک‌کننده",
                "equipment_involved": "موتور گیربکس و غلتک نقاله کوره",
                "valid_from": now - timedelta(hours=2),
                "valid_until": now + timedelta(hours=6),
                "actual_start": now - timedelta(hours=1, minutes=45),
                "requester": supervisor_user,
                "responsible_supervisor": supervisor_user,
                "approver": hse_mgr_user,
                "status": Permit.Status.ACTIVE,
                "assigned_workers": "مرتضی باقری (جوشکار)، احمد سهرابی (کمک‌جوشکار)",
                "precautions_taken": "محل جوشکاری با چادر نسوز عایق‌بندی شد. کپسول آتش‌نشانی CO2 در فاصله ۳ متری مستقر گردید.",
                "required_ppe": "ماسک تنفسی با فیلتر بخارات فلزی، دستکش چرمی ساق‌بلند، شیلد جوشکاری",
                "gas_testing_required": False,
                "isolation_loto_required": True,
                "isolation_loto_details": "سوئیچ اصلی برق قطع، قفل قرمز شماره ۱۲ و تگ هشدار نصب شد.",
                "controls_verified": True,
                "controls_verified_by": inspector_user,
                "controls_verified_at": now - timedelta(hours=1, minutes=50),
                "is_synthetic": True,
            }
        )
        if ptw1 is not None:
            ptw1.related_hazards.set([haz_hydro])

        ptw2 = seed_permit(
            "PTW-202610-0102",
            {
                "organization": org_foolad,
                "workplace": wp_cast,
                "permit_type": Permit.PermitType.WORK_AT_HEIGHT,
                "title": "تعمیر ریل و روشنایی جرثقیل سقفی ۳۰ تنی در ارتفاع ۱۵ متری",
                "description": "سرویس دوره‌ای کابل‌های انتقال برق و تعویض پروژکتورهای LED بالای ریل جرثقیل.",
                "work_area": "تاج سوله ریخته‌گری، تیر حمال شمالی",
                "equipment_involved": "جرثقیل سقفی شماره ۲ و باس‌بار ۳۸۰ ولت",
                "valid_from": now + timedelta(hours=4),
                "valid_until": now + timedelta(hours=12),
                "requester": supervisor_user,
                "responsible_supervisor": supervisor_user,
                "approver": hse_mgr_user,
                "status": Permit.Status.APPROVED,
                "assigned_workers": "محسن نوری، بهروز رفیعی",
                "precautions_taken": "نصب لایف‌لاین افقی فولادی در امتداد ریل جهت مهار هارنس.",
                "required_ppe": "هارنس ایمنی فول‌بادی دو قلابه با ضربه‌گیر، کلاه بنددار، کفش ضدلغزش",
                "gas_testing_required": False,
                "isolation_loto_required": True,
                "isolation_loto_details": "برق کل باس‌بار جرثقیل قطع و کلید سکسیونر در تابلوی توزیع قفل شد.",
                "is_synthetic": True,
            }
        )

        ptw3 = seed_permit(
            "PTW-202610-0103",
            {
                "organization": org_foolad,
                "workplace": wp_trans,
                "permit_type": Permit.PermitType.EXCAVATION,
                "title": "گودبرداری خط لوله اطفای حریق محوطه ترابری",
                "description": "حفاری کانال به عمق ۲.۵ متر جهت تعویض لوله فرسوده آتش‌نشانی.",
                "work_area": "جنب پارکینگ ترابری سنگین",
                "equipment_involved": "بیل مکانیکی کوماتسو ۲۲۰ و کمپکتور دستی",
                "valid_from": now - timedelta(days=1),
                "valid_until": now + timedelta(days=2),
                "actual_start": now - timedelta(hours=20),
                "requester": supervisor_user,
                "responsible_supervisor": supervisor_user,
                "approver": hse_mgr_user,
                "status": Permit.Status.SUSPENDED,
                "suspension_reason": "بارش باران شدید و ریزش دیواره خاکی، نیاز به سازه نگهبان و تخلیه آب انباشته.",
                "assigned_workers": "پیمانکاری حفار سازه (۴ نفر)",
                "precautions_taken": "نوار خطر زرد و علائم هشدار پیرامون کانال نصب گردید.",
                "required_ppe": "چکمه ایمنی، کلاه، جلیقه شبرنگ",
                "is_synthetic": True,
            }
        )

        ptw4 = seed_permit(
            "PTW-202610-0104",
            {
                "organization": org_foolad,
                "workplace": wp_roll,
                "permit_type": Permit.PermitType.HOT_WORK,
                "title": "برشکاری گارد محافظ گیربکس نورد",
                "description": "برش حرارتی ورق محافظ آسیب‌دیده با مشعل استیلن.",
                "work_area": "انتهای خط نورد، سکوی بازرسی",
                "valid_from": now - timedelta(days=3, hours=4),
                "valid_until": now - timedelta(days=3),
                "actual_start": now - timedelta(days=3, hours=3, minutes=30),
                "actual_completion": now - timedelta(days=3, hours=1),
                "closed_at": now - timedelta(days=3, hours=1),
                "requester": supervisor_user,
                "responsible_supervisor": supervisor_user,
                "approver": hse_mgr_user,
                "closed_by": hse_mgr_user,
                "status": Permit.Status.CLOSED,
                "closure_summary": "عملیات بدون حادثه پایان یافت و پس از ۲ ساعت دیده‌بانی حریق، ترخیص اعلام گردید.",
                "is_synthetic": True,
            }
        )

        ptw5 = seed_permit(
            "PTW-202610-0201",
            {
                "organization": org_petro,
                "workplace": wp_spheres,
                "permit_type": Permit.PermitType.CONFINED_SPACE,
                "title": "ورود به مخزن کروی TK-201 جهت ضخامت‌سنجی آلتراسونیک",
                "description": "تخلیه کامل، شستشوی شیمیایی و ورود تیم بازرسی فنی به داخل مخزن کروی گاز مایع.",
                "work_area": "مخزن کروی گاز مایع TK-201",
                "equipment_involved": "دریچه منهول زیرین و فوقانی مخزن، ونتیلاتور دمنده هوا",
                "valid_from": now - timedelta(hours=3),
                "valid_until": now + timedelta(hours=5),
                "actual_start": now - timedelta(hours=2),
                "requester": petro_supervisor_user,
                "responsible_supervisor": petro_supervisor_user,
                "approver": hse_mgr_user,
                "status": Permit.Status.ACTIVE,
                "assigned_workers": "امیر قاسمی (کارشناس NDT)، داوود کیانی (مراقب منهول)",
                "precautions_taken": "تهویه اجباری مداوم با بلوور ضدانفجار برقرار شد. مراقب منهول خارج مخزن مستقر است.",
                "required_ppe": "سیستم تنفسی هوارسان، چراغ‌قوه ضدجرقه EX، هارنس نجات",
                "gas_testing_required": True,
                "gas_testing_results": "O2: 20.9%, LEL: 0%, H2S: 0 ppm, CO: 0 ppm (سنجش ساعت 08:30 تایید شد)",
                "isolation_loto_required": True,
                "isolation_loto_details": "اسپید کور در کلیه خطوط ورودی/خروجی نصب و ولوها زنجیر و قفل شدند.",
                "controls_verified": True,
                "controls_verified_by": hse_mgr_user,
                "controls_verified_at": now - timedelta(hours=2, minutes=15),
                "is_synthetic": True,
            }
        )

        if ptw1 is not None:
            PermitAttachment.objects.get_or_create(
                permit=ptw1,
                title="چک‌لیست کنترل شرایط پیش از کار گرم و ایمنی حریق",
                defaults={
                    "attachment_type": "checklist",
                    "file_url": "https://storage.hseguard.local/attachments/permits/ptw-101-hotwork-check.pdf",
                    "description": "بررسی فاصله‌گذاری کپسول‌ها و عایق‌کاری نسوز",
                    "uploaded_by": supervisor_user,
                }
            )
        if ptw5 is not None:
            PermitAttachment.objects.get_or_create(
                permit=ptw5,
                title="گواهی نتایج گازسنجی چندگانه مخزن کروی",
                defaults={
                    "attachment_type": "gas_test",
                    "file_url": "https://storage.hseguard.local/attachments/permits/ptw-201-gas-cert.pdf",
                    "description": "گزارش دستگاه سنجش Drager با امضای افسر گازسنجی",
                    "uploaded_by": hse_mgr_user,
                }
            )

        sh1 = seed_handover(
            {
                "organization": org_foolad,
                "workplace": wp_roll,
                "shift_date": now.date() - timedelta(days=1),
                "shift_type": ShiftHandover.ShiftType.EVENING,
            },
            {
                "outgoing_supervisor": supervisor_user,
                "incoming_supervisor": inspector_user,
                "status": ShiftHandover.Status.ACKNOWLEDGED,
                "handover_notes": "شیفت عصر با روند پایدار سپری شد. نورد سبک با ظرفیت ۸۵ تن بر ساعت فعال بود.",
                "safety_concerns": "روشنایی اضطراری خروجی شرقی بازبینی گردد.",
                "equipment_status": "کوره پیشگرم در حالت استاندارد. نقاله خنک‌کننده آماده تعمیرات روز بعد.",
                "outstanding_actions_summary": "تعویض کابل ارت ایستگاه جوشکاری در برنامه شیفت صبح فردا.",
                "acknowledged_by": inspector_user,
                "acknowledged_at": now - timedelta(days=1, hours=8),
                "acknowledgement_notes": "گزارش تحویل گرفته شد، موارد ایمنی در آغاز شیفت شب بازبینی گردید.",
                "is_synthetic": True,
            }
        )

        sh2 = seed_handover(
            {
                "organization": org_foolad,
                "workplace": wp_roll,
                "shift_date": now.date(),
                "shift_type": ShiftHandover.ShiftType.MORNING,
            },
            {
                "outgoing_supervisor": supervisor_user,
                "incoming_supervisor": inspector_user,
                "status": ShiftHandover.Status.SUBMITTED,
                "handover_notes": "شیفت صبح با اجرای یک مورد مجوز کار گرم فعال به پایان رسید. قطعه تعمیرشده در حال تست است.",
                "safety_concerns": "محوطه کار گرم نقاله هنوز تحت دیده‌بانی حریق قرار دارد. پرسنل از تردد غیرضروری خودداری نمایند.",
                "equipment_status": "خط نورد شماره ۱ فعال است. الکتروموتور نقاله با لرزش طبیعی کار می‌کند.",
                "outstanding_actions_summary": "مختومه‌سازی مجوز کار گرم پس از تأیید نهایی افسر HSE در شیفت عصر انجام شود.",
                "is_synthetic": True,
            }
        )
        if ptw1 is not None:
            sh2.active_permits.set([ptw1])

        # 10. Assets, preventive maintenance and calibration
        def seed_equipment(organization, code, defaults):
            existing = Equipment.objects.filter(organization=organization, code=code).first()
            if existing is not None and not existing.is_synthetic:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped demo equipment {code}: code belongs to a real asset."
                    )
                )
                return None
            payload = {**defaults, "is_synthetic": True, "created_by": hse_mgr_user}
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.save()
                return existing
            return Equipment.objects.create(
                organization=organization, code=code, **payload
            )

        def seed_calibration(equipment, certificate_number, defaults):
            record = CalibrationRecord.objects.filter(
                equipment=equipment, certificate_number=certificate_number
            ).first()
            if record is not None and not record.is_synthetic:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped demo calibration {certificate_number}: record is not synthetic."
                    )
                )
                return record
            payload = {**defaults, "is_synthetic": True, "performed_by": inspector_user}
            if record is not None:
                for field, value in payload.items():
                    setattr(record, field, value)
                record.save()
                return record
            return CalibrationRecord.objects.create(
                equipment=equipment,
                organization=equipment.organization,
                certificate_number=certificate_number,
                **payload,
            )

        def seed_plan(equipment, title, defaults):
            plan = MaintenancePlan.objects.filter(
                equipment=equipment, title=title, is_synthetic=True
            ).first()
            payload = {**defaults, "is_synthetic": True, "created_by": hse_mgr_user}
            if plan is not None:
                for field, value in payload.items():
                    setattr(plan, field, value)
                plan.save()
                return plan
            return MaintenancePlan.objects.create(
                equipment=equipment,
                organization=equipment.organization,
                title=title,
                **payload,
            )

        def seed_work_order(equipment, title, defaults):
            order = MaintenanceWorkOrder.objects.filter(
                equipment=equipment, title=title, is_synthetic=True
            ).first()
            payload = {**defaults, "is_synthetic": True, "created_by": hse_mgr_user}
            if order is not None:
                for field, value in payload.items():
                    setattr(order, field, value)
                order.save()
                return order
            return MaintenanceWorkOrder.objects.create(
                equipment=equipment,
                organization=equipment.organization,
                title=title,
                **payload,
            )

        # Foolad Alborz assets
        ext_fa = seed_equipment(
            org_foolad,
            "FA-EXT-001",
            {
                "name": "کپسول آتش‌نشانی CO2 ۶ کیلوگرمی",
                "category": Equipment.Category.FIRE_EXTINGUISHER,
                "workplace": wp_roll,
                "manufacturer": "Pars Fire",
                "model_number": "CO2-6",
                "serial_number": "PF-6-1401-018",
                "status": Equipment.Status.READY,
                "description": "کپسول ثابت ایستگاه کنترل خط نورد.",
                "calibration_required": False,
            },
        )
        if ext_fa is not None:
            ext_fa.related_hazards.set([haz_hydro])
            if ptw1 is not None:
                ext_fa.related_permits.set([ptw1])
            plan_ext = seed_plan(
                ext_fa,
                "بازرسی ماهانه کپسول و فشارسنج",
                {
                    "interval_days": 30,
                    "instructions": "بررسی فشار، پلمب، شیلنگ و برچسب بازرسی؛ ثبت در فرم PM-EXT.",
                    "responsible": supervisor_user,
                    "start_date": now.date() - timedelta(days=45),
                    "next_due_date": now.date() + timedelta(days=5),
                    "is_active": True,
                },
            )
            for days_ago, label in ((55, "بازرسی دو ماه پیش"), (25, "بازرسی ماه گذشته")):
                seed_work_order(
                    ext_fa,
                    label,
                    {
                        "plan": plan_ext,
                        "work_type": MaintenanceWorkOrder.WorkType.PREVENTIVE,
                        "status": MaintenanceWorkOrder.Status.COMPLETED,
                        "assigned_to": supervisor_user,
                        "scheduled_date": now.date() - timedelta(days=days_ago),
                        "completed_date": now.date() - timedelta(days=days_ago),
                        "findings": "فشار در محدوده سبز؛ پلمب و شیلنگ سالم.",
                        "result": "بازرسی انجام و برگه PM تکمیل شد.",
                    },
                )

        gas_fa = seed_equipment(
            org_foolad,
            "FA-GAS-001",
            {
                "name": "گازسنج چندگانه چهارکاره ایستگاه ریخته‌گری",
                "category": Equipment.Category.GAS_DETECTION,
                "workplace": wp_cast,
                "manufacturer": "Dräger",
                "model_number": "X-am 5000",
                "serial_number": "DR-X5000-9912",
                "status": Equipment.Status.READY,
                "description": "دستگاه قابل حمل سنجش O2، LEL، H2S و CO.",
                "calibration_required": True,
            },
        )
        if gas_fa is not None:
            gas_fa.related_hazards.set([haz_slag, haz_gas])
            seed_calibration(
                gas_fa,
                "CAL-FA-GAS-1404-03",
                {
                    "performed_on": now.date() - timedelta(days=250),
                    "next_due_on": now.date() - timedelta(days=180),
                    "provider": "آزمایشگاه معتمد فن‌گاز",
                    "result": CalibrationRecord.Result.PASSED,
                    "notes": "کالیبراسیون دوره قبلی.",
                },
            )
            seed_calibration(
                gas_fa,
                "CAL-FA-GAS-1405-01",
                {
                    "performed_on": now.date() - timedelta(days=20),
                    "next_due_on": now.date() + timedelta(days=160),
                    "provider": "آزمایشگاه معتمد فن‌گاز",
                    "result": CalibrationRecord.Result.PASSED,
                    "notes": "گازهای مرجع معتبر؛ خطای مجاز در محدوده استاندارد.",
                },
            )

        gas_expired_fa = seed_equipment(
            org_foolad,
            "FA-GAS-002",
            {
                "name": "گازسنج قابل حمل واحد ترابری",
                "category": Equipment.Category.GAS_DETECTION,
                "workplace": wp_trans,
                "manufacturer": "Honeywell",
                "model_number": "BW-Multi",
                "serial_number": "HW-BW-1187",
                "status": Equipment.Status.OUT_OF_SERVICE,
                "description": "گازسنج یدکی؛ کالیبراسیون آن منقضی شده است.",
                "calibration_required": True,
            },
        )
        if gas_expired_fa is not None:
            seed_calibration(
                gas_expired_fa,
                "CAL-FA-GAS-1404-11",
                {
                    "performed_on": now.date() - timedelta(days=390),
                    "next_due_on": now.date() - timedelta(days=25),
                    "provider": "آزمایشگاه معتمد فن‌گاز",
                    "result": CalibrationRecord.Result.PASSED,
                    "notes": "کالیبراسیون منقضی؛ تجهیز تا انجام مجدد خارج از سرویس است.",
                },
            )

        harness_fa = seed_equipment(
            org_foolad,
            "FA-LIFT-001",
            {
                "name": "تسمه بارگیری دو رشته‌ای ۵ تن",
                "category": Equipment.Category.LIFTING,
                "workplace": wp_roll,
                "manufacturer": "Kito",
                "model_number": "SL-5T",
                "serial_number": "KT-5T-441",
                "status": Equipment.Status.READY,
                "description": "تسمه متناسب با بارهای نورد؛ نیازمند بازرسی و کالیبراسیون بار.",
                "calibration_required": True,
            },
        )
        if harness_fa is not None:
            seed_calibration(
                harness_fa,
                "CAL-FA-LIFT-1405-02",
                {
                    "performed_on": now.date() - timedelta(days=170),
                    "next_due_on": now.date() + timedelta(days=15),
                    "provider": "شرکت بازرسی فنی ایمن‌سنج",
                    "result": CalibrationRecord.Result.PASSED,
                    "notes": "بازرسی بار و برچسب ظرفیت تأیید شد.",
                },
            )
            seed_plan(
                harness_fa,
                "بازرسی سالانه تسمه و برچسب ظرفیت",
                {
                    "interval_days": 365,
                    "instructions": "بازرسی بصری بافت، خوردگی، تغییر شکل قلاب و خوانا بودن برچسب ظرفیت.",
                    "responsible": inspector_user,
                    "start_date": now.date() - timedelta(days=170),
                    "next_due_date": now.date() + timedelta(days=15),
                    "is_active": True,
                },
            )

        compressor_fa = seed_equipment(
            org_foolad,
            "FA-COMP-001",
            {
                "name": "کمپرسور هوای تنفسی کارگاه ریخته‌گری",
                "category": Equipment.Category.ELECTRICAL,
                "workplace": wp_cast,
                "manufacturer": "Atlas Copco",
                "model_number": "GA-30",
                "serial_number": "AC-GA30-7781",
                "status": Equipment.Status.UNDER_MAINTENANCE,
                "description": "کمپرسور تغذیه خط هوای تنفسی؛ سرویس پیشگیرانه عقب‌افتاده دارد.",
                "calibration_required": False,
            },
        )
        if compressor_fa is not None:
            plan_comp = seed_plan(
                compressor_fa,
                "سرویس ۵۰۰ ساعته کمپرسور",
                {
                    "interval_days": 90,
                    "instructions": "تعویض فیلتر روغن و هوا، کنترل نشتی و ثبت فشار خروجی.",
                    "responsible": supervisor_user,
                    "start_date": now.date() - timedelta(days=120),
                    "next_due_date": now.date() - timedelta(days=30),
                    "is_active": True,
                },
            )
            seed_work_order(
                compressor_fa,
                "سرویس عقب‌افتاده کمپرسور هوای تنفسی",
                {
                    "plan": plan_comp,
                    "work_type": MaintenanceWorkOrder.WorkType.PREVENTIVE,
                    "status": MaintenanceWorkOrder.Status.PLANNED,
                    "assigned_to": supervisor_user,
                    "scheduled_date": now.date() - timedelta(days=30),
                    "description": "سرویس ۵۰۰ ساعته به دلیل تأخیر قطعه یدکی انجام نشده است.",
                },
            )

        # Sepehr Petro assets
        gas_sp = seed_equipment(
            org_petro,
            "SP-GAS-001",
            {
                "name": "گازسنج چهارکاره واحد الفین",
                "category": Equipment.Category.GAS_DETECTION,
                "workplace": wp_olefin,
                "manufacturer": "Dräger",
                "model_number": "X-am 8000",
                "serial_number": "DR-X8000-2201",
                "status": Equipment.Status.READY,
                "description": "گازسنج عملیاتی تیم ورود به فضای بسته.",
                "calibration_required": True,
            },
        )
        if gas_sp is not None:
            gas_sp.related_hazards.set([haz_gas])
            if ptw5 is not None:
                gas_sp.related_permits.set([ptw5])
            seed_calibration(
                gas_sp,
                "CAL-SP-GAS-1405-07",
                {
                    "performed_on": now.date() - timedelta(days=10),
                    "next_due_on": now.date() + timedelta(days=170),
                    "provider": "آزمایشگاه مرکزی پتروشیمی سپهر",
                    "result": CalibrationRecord.Result.PASSED,
                    "notes": "کالیبراسیون با گاز مرجع و تأیید افسر HSE.",
                },
            )
            seed_plan(
                gas_sp,
                "کالیبراسیون و تست ضربه روزانه",
                {
                    "interval_days": 180,
                    "instructions": "تست ضربه روزانه و کالیبراسیون تخصصی هر ۱۸۰ روز.",
                    "responsible": petro_supervisor_user,
                    "start_date": now.date() - timedelta(days=10),
                    "next_due_date": now.date() + timedelta(days=170),
                    "is_active": True,
                },
            )

        rescue_sp = seed_equipment(
            org_petro,
            "SP-RESC-001",
            {
                "name": "دستگاه تنفسی هوارسان امداد و نجات",
                "category": Equipment.Category.RESCUE,
                "workplace": wp_maint,
                "manufacturer": "MSA",
                "model_number": "AirHawk II",
                "serial_number": "MSA-AH2-093",
                "status": Equipment.Status.OUT_OF_SERVICE,
                "description": "کالیبراسیون ناموفق؛ تا بررسی فنی و تعمیر، خارج از سرویس است.",
                "calibration_required": True,
            },
        )
        if rescue_sp is not None:
            seed_calibration(
                rescue_sp,
                "CAL-SP-RESC-1405-02",
                {
                    "performed_on": now.date() - timedelta(days=5),
                    "next_due_on": now.date() + timedelta(days=175),
                    "provider": "شرکت ایمن‌سازان صنعتی",
                    "result": CalibrationRecord.Result.FAILED,
                    "notes": "نشتی در مدار هوارسان؛ تجهیز خارج از سرویس شد و نیازمند تعمیر است.",
                },
            )

        extinguisher_sp = seed_equipment(
            org_petro,
            "SP-EXT-001",
            {
                "name": "کپسول آتش‌نشانی پودری ۱۲ کیلوگرمی",
                "category": Equipment.Category.FIRE_EXTINGUISHER,
                "workplace": wp_spheres,
                "manufacturer": "Sepahan Fire",
                "model_number": "P12",
                "serial_number": "SF-P12-552",
                "status": Equipment.Status.READY,
                "description": "کپسول پودری مزرعه مخازن کروی.",
                "calibration_required": False,
            },
        )
        if extinguisher_sp is not None:
            seed_plan(
                extinguisher_sp,
                "بازرسی ماهانه کپسول پودری",
                {
                    "interval_days": 30,
                    "instructions": "کنترل فشار، پلمب، سلامت شیلنگ و نازل.",
                    "responsible": petro_supervisor_user,
                    "start_date": now.date() - timedelta(days=20),
                    "next_due_date": now.date() + timedelta(days=10),
                    "is_active": True,
                },
            )

        # 11. Workforce: employees, training, competency and PPE
        def seed_employee(organization, employee_no, defaults):
            existing = Employee.objects.filter(
                organization=organization, employee_no=employee_no
            ).first()
            if existing is not None and not existing.is_synthetic:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped demo employee {employee_no}: employee number belongs to a real record."
                    )
                )
                return None
            payload = {**defaults, "is_synthetic": True}
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.full_clean()
                existing.save()
                return existing
            employee = Employee(
                organization=organization, employee_no=employee_no, **payload
            )
            employee.full_clean()
            employee.save()
            return employee

        def seed_course(organization, code, defaults):
            existing = TrainingCourse.objects.filter(
                organization=organization, code=code
            ).first()
            if existing is not None and not existing.is_synthetic:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped demo course {code}: course code belongs to a real record."
                    )
                )
                return None
            payload = {**defaults, "is_synthetic": True, "created_by": hse_mgr_user}
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.full_clean()
                existing.save()
                return existing
            course = TrainingCourse(
                organization=organization, code=code, **payload
            )
            course.full_clean()
            course.save()
            return course

        def seed_session(organization, course, scheduled_on, defaults):
            existing = TrainingSession.objects.filter(
                organization=organization,
                course=course,
                scheduled_on=scheduled_on,
                is_synthetic=True,
            ).first()
            payload = {
                **defaults,
                "is_synthetic": True,
                "created_by": hse_mgr_user,
            }
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.full_clean()
                existing.save()
                return existing
            session = TrainingSession(
                organization=organization,
                course=course,
                scheduled_on=scheduled_on,
                **payload,
            )
            session.full_clean()
            session.save()
            return session

        def seed_attendance(session, employee, defaults):
            existing = TrainingAttendance.objects.filter(
                session=session, employee=employee
            ).first()
            if existing is not None and not existing.is_synthetic:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped real attendance for {employee.employee_no} in {session.course.code}."
                    )
                )
                return None
            payload = {**defaults, "is_synthetic": True, "recorded_by": hse_mgr_user}
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.full_clean()
                existing.save()
                return existing
            attendance = TrainingAttendance(
                organization=session.organization,
                session=session,
                employee=employee,
                **payload,
            )
            attendance.full_clean()
            attendance.save()
            return attendance

        def seed_competency(organization, code, defaults):
            existing = Competency.objects.filter(
                organization=organization, code=code
            ).first()
            if existing is not None and not existing.is_synthetic:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped demo competency {code}: code belongs to a real record."
                    )
                )
                return None
            accepted_courses = defaults.pop("accepted_courses", [])
            payload = {**defaults, "is_synthetic": True, "created_by": hse_mgr_user}
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.full_clean()
                existing.save()
                existing.accepted_courses.set(accepted_courses)
                return existing
            competency = Competency(
                organization=organization, code=code, **payload
            )
            competency.full_clean()
            competency.save()
            competency.accepted_courses.set(accepted_courses)
            return competency

        def seed_employee_competency(employee, competency, achieved_on, defaults):
            existing = EmployeeCompetency.objects.filter(
                employee=employee,
                competency=competency,
                achieved_on=achieved_on,
                is_synthetic=True,
            ).first()
            payload = {
                **defaults,
                "is_synthetic": True,
                "recorded_by": hse_mgr_user,
            }
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.full_clean()
                existing.save()
                return existing
            record = EmployeeCompetency(
                organization=employee.organization,
                employee=employee,
                competency=competency,
                achieved_on=achieved_on,
                **payload,
            )
            record.full_clean()
            record.save()
            return record

        def seed_requirement(organization, permit_type, competency):
            existing = PermitTypeCompetencyRequirement.objects.filter(
                organization=organization,
                permit_type=permit_type,
                competency=competency,
            ).first()
            if existing is not None and not existing.is_synthetic:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped real competency requirement for {permit_type}."
                    )
                )
                return existing
            payload = {
                "notes": "الزام صلاحیت تعریف‌شده برای نمونه نمایشی فاز ۱۰",
                "is_synthetic": True,
                "created_by": hse_mgr_user,
            }
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.save()
                return existing
            return PermitTypeCompetencyRequirement.objects.create(
                organization=organization,
                permit_type=permit_type,
                competency=competency,
                **payload,
            )

        def seed_ppe_item(organization, code, defaults):
            existing = PPEItem.objects.filter(
                organization=organization, code=code
            ).first()
            if existing is not None and not existing.is_synthetic:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped demo PPE item {code}: code belongs to a real record."
                    )
                )
                return None
            payload = {**defaults, "is_synthetic": True, "created_by": hse_mgr_user}
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.full_clean()
                existing.save()
                return existing
            item = PPEItem(organization=organization, code=code, **payload)
            item.full_clean()
            item.save()
            return item

        def seed_stock(organization, item, workplace, location_name, quantity, minimum):
            existing = PPEStock.objects.filter(
                organization=organization,
                item=item,
                workplace=workplace,
                location_name=location_name,
            ).first()
            if existing is not None and not existing.is_synthetic:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped real PPE stock for {item.code} at {location_name}."
                    )
                )
                return existing
            payload = {
                "quantity_on_hand": quantity,
                "quantity_minimum": minimum,
                "is_active": True,
                "is_synthetic": True,
            }
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.save()
                return existing
            return PPEStock.objects.create(
                organization=organization,
                item=item,
                workplace=workplace,
                location_name=location_name,
                **payload,
            )

        def seed_assignment(employee, item, stock, issued_on, defaults):
            serial_number = defaults.pop("serial_number", "")
            if serial_number:
                existing = PPEAssignment.objects.filter(
                    organization=employee.organization,
                    item=item,
                    serial_number=serial_number,
                    is_synthetic=True,
                ).first()
            else:
                existing = PPEAssignment.objects.filter(
                    organization=employee.organization,
                    employee=employee,
                    item=item,
                    serial_number=serial_number,
                    issued_on=issued_on,
                    is_synthetic=True,
                ).first()
            # Real assignments with a similar natural key are never overwritten;
            # a separately marked synthetic row is created instead.
            payload = {
                **defaults,
                "employee": employee,
                "stock": stock,
                "issued_on": issued_on,
                "serial_number": serial_number,
                "is_synthetic": True,
                "issued_by": hse_mgr_user,
            }
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.full_clean()
                existing.save()
                return existing
            assignment = PPEAssignment(
                organization=employee.organization,
                item=item,
                **payload,
            )
            assignment.full_clean()
            assignment.save()
            return assignment

        def seed_ppe_event(assignment, event_type, occurred_on, defaults):
            existing = PPEAssignmentEvent.objects.filter(
                assignment=assignment,
                event_type=event_type,
                occurred_on=occurred_on,
                is_synthetic=True,
            ).first()
            payload = {**defaults, "is_synthetic": True, "actor": hse_mgr_user}
            if existing is not None:
                for field, value in payload.items():
                    setattr(existing, field, value)
                existing.save()
                return existing
            return PPEAssignmentEvent.objects.create(
                organization=assignment.organization,
                assignment=assignment,
                event_type=event_type,
                occurred_on=occurred_on,
                **payload,
            )

        today = now.date()

        # Foolad Alborz people (with and without login accounts)
        emp_morteza = seed_employee(
            org_foolad,
            "EMP-FA-001",
            {
                "first_name": "مرتضی",
                "last_name": "باقری",
                "job_title": "جوشکار ارشد",
                "workplace": wp_roll,
                "user": None,
                "is_active": True,
                "notes": "کارمند بدون حساب ورود؛ آموزش و PPE در سامانه ثبت می‌شود.",
            },
        )
        emp_ahmad = seed_employee(
            org_foolad,
            "EMP-FA-002",
            {
                "first_name": "احمد",
                "last_name": "سهرابی",
                "job_title": "کمک‌جوشکار",
                "workplace": wp_roll,
                "user": None,
                "is_active": True,
                "notes": "",
            },
        )
        emp_mohsen = seed_employee(
            org_foolad,
            "EMP-FA-003",
            {
                "first_name": "محسن",
                "last_name": "نوری",
                "job_title": "تکنسین کار در ارتفاع",
                "workplace": wp_cast,
                "user": None,
                "is_active": True,
                "notes": "",
            },
        )
        emp_behrooz = seed_employee(
            org_foolad,
            "EMP-FA-004",
            {
                "first_name": "بهروز",
                "last_name": "رفیعی",
                "job_title": "ریگر و کارگر ارتفاع",
                "workplace": wp_cast,
                "user": None,
                "is_active": True,
                "notes": "صلاحیت کار در ارتفاع منقضی شده و نیازمند تمدید است.",
            },
        )
        emp_ali = seed_employee(
            org_foolad,
            "EMP-FA-005",
            {
                "first_name": "علی",
                "last_name": "رستمی",
                "job_title": "سرپرست کارگاه",
                "workplace": wp_roll,
                "user": supervisor_user,
                "is_active": True,
                "notes": "",
            },
        )

        # Sepehr Petro people
        emp_amir = seed_employee(
            org_petro,
            "EMP-SP-001",
            {
                "first_name": "امیر",
                "last_name": "قاسمی",
                "job_title": "کارشناس NDT",
                "workplace": wp_spheres,
                "user": None,
                "is_active": True,
                "notes": "",
            },
        )
        emp_davood = seed_employee(
            org_petro,
            "EMP-SP-002",
            {
                "first_name": "داوود",
                "last_name": "کیانی",
                "job_title": "مراقب ورود به فضای بسته",
                "workplace": wp_spheres,
                "user": None,
                "is_active": True,
                "notes": "",
            },
        )
        emp_saeed = seed_employee(
            org_petro,
            "EMP-SP-003",
            {
                "first_name": "سعید",
                "last_name": "کریمی",
                "job_title": "سرپرست تعمیرات",
                "workplace": wp_maint,
                "user": petro_supervisor_user,
                "is_active": True,
                "notes": "",
            },
        )
        emp_sara = seed_employee(
            org_petro,
            "EMP-SP-004",
            {
                "first_name": "سارا",
                "last_name": "تهرانی",
                "job_title": "کارشناس HSE",
                "workplace": wp_maint,
                "user": viewer_user,
                "is_active": True,
                "notes": "",
            },
        )
        emp_navid = seed_employee(
            org_petro,
            "EMP-SP-005",
            {
                "first_name": "نوید",
                "last_name": "شریفی",
                "job_title": "کارگر عملیات",
                "workplace": wp_olefin,
                "user": None,
                "is_active": True,
                "notes": "بدون صلاحیت معتبر برای کار گرم/فضای بسته.",
            },
        )

        # Training courses
        course_hot = seed_course(
            org_foolad,
            "TR-FA-HOT",
            {
                "title": "جوشکاری، برش و ایمنی کار گرم",
                "category": "ایمنی آتش و کار گرم",
                "description": "اصول پیشگیری از حریق، دیده‌بانی، تجهیزات جوشکاری و ارزیابی محیط.",
                "objectives": "شناسایی خطرات کار گرم و اجرای کنترل‌های پیش از شروع کار",
                "duration_minutes": 480,
                "delivery_type": TrainingCourse.DeliveryType.PRACTICAL,
                "is_mandatory": True,
                "requires_renewal": True,
                "validity_months": 24,
                "is_active": True,
            },
        )
        course_height = seed_course(
            org_foolad,
            "TR-FA-HEIGHT",
            {
                "title": "کار در ارتفاع و استفاده از هارنس",
                "category": "سقوط و کار در ارتفاع",
                "description": "کنترل سقوط، لایف‌لاین، بازرسی هارنس و اصول نجات.",
                "objectives": "اجرای ایمن کار در ارتفاع و استفاده صحیح از سیستم‌های حفاظت سقوط",
                "duration_minutes": 480,
                "delivery_type": TrainingCourse.DeliveryType.PRACTICAL,
                "is_mandatory": True,
                "requires_renewal": True,
                "validity_months": 24,
                "is_active": True,
            },
        )
        course_loto = seed_course(
            org_foolad,
            "TR-FA-LOTO",
            {
                "title": "ایزولاسیون انرژی و قفل و تگ‌گذاری",
                "category": "ایمنی برق و انرژی",
                "description": "شناسایی منابع انرژی، قفل‌گذاری و آزمون صفر انرژی.",
                "objectives": "اجرای LOTO برای تجهیزات صنعتی",
                "duration_minutes": 240,
                "delivery_type": TrainingCourse.DeliveryType.IN_PERSON,
                "is_mandatory": True,
                "requires_renewal": True,
                "validity_months": 36,
                "is_active": True,
            },
        )
        course_cs = seed_course(
            org_petro,
            "TR-SP-CS",
            {
                "title": "ورود ایمن به فضای بسته",
                "category": "فضای بسته",
                "description": "ارزیابی اتمسفر، تهویه، مجوز ورود، مراقب و طرح نجات.",
                "objectives": "ورود و کار ایمن در مخازن و فضاهای بسته",
                "duration_minutes": 480,
                "delivery_type": TrainingCourse.DeliveryType.PRACTICAL,
                "is_mandatory": True,
                "requires_renewal": True,
                "validity_months": 24,
                "is_active": True,
            },
        )
        course_gas = seed_course(
            org_petro,
            "TR-SP-GAS",
            {
                "title": "گازسنجی و پایش اتمسفر",
                "category": "پایش اتمسفر",
                "description": "کالیبراسیون، تست ضربه و تفسیر نتایج O2، LEL، H2S و CO.",
                "objectives": "اندازه‌گیری و تفسیر صحیح اتمسفر قبل از ورود",
                "duration_minutes": 240,
                "delivery_type": TrainingCourse.DeliveryType.BLENDED,
                "is_mandatory": True,
                "requires_renewal": True,
                "validity_months": 24,
                "is_active": True,
            },
        )
        course_first_aid = seed_course(
            org_petro,
            "TR-SP-FIRST",
            {
                "title": "کمک‌های اولیه و واکنش اضطراری",
                "category": "واکنش اضطراری",
                "description": "ارزیابی صحنه، احیای پایه و انتقال مصدوم.",
                "objectives": "واکنش اولیه ایمن در حوادث",
                "duration_minutes": 240,
                "delivery_type": TrainingCourse.DeliveryType.IN_PERSON,
                "is_mandatory": False,
                "requires_renewal": True,
                "validity_months": 36,
                "is_active": True,
            },
        )

        # Delivery sessions
        sess_hot = seed_session(
            org_foolad,
            course_hot,
            today - timedelta(days=60),
            {
                "workplace": wp_roll,
                "instructor_name": "استاد جعفری — مرکز آموزش فنی",
                "duration_minutes": 480,
                "capacity": 12,
                "status": TrainingSession.Status.COMPLETED,
                "notes": "دوره عملی با تمرین دیده‌بانی حریق در محوطه امن.",
            },
        )
        sess_height = seed_session(
            org_foolad,
            course_height,
            today - timedelta(days=30),
            {
                "workplace": wp_cast,
                "instructor_name": "تیم آموزش ایمنی ارتفاع",
                "duration_minutes": 480,
                "capacity": 10,
                "status": TrainingSession.Status.COMPLETED,
                "notes": "شامل بازرسی هارنس و تمرین نجات از ارتفاع.",
            },
        )
        sess_cs = seed_session(
            org_petro,
            course_cs,
            today - timedelta(days=20),
            {
                "workplace": wp_olefin,
                "instructor_name": "مرکز آموزش پتروشیمی سپهر",
                "duration_minutes": 480,
                "capacity": 8,
                "status": TrainingSession.Status.COMPLETED,
                "notes": "تمرین ورود به فضای بسته شبیه‌سازی‌شده.",
            },
        )
        sess_first = seed_session(
            org_petro,
            course_first_aid,
            today - timedelta(days=10),
            {
                "workplace": wp_maint,
                "instructor_name": "مربی کمک‌های اولیه صنعتی",
                "duration_minutes": 240,
                "capacity": 15,
                "status": TrainingSession.Status.COMPLETED,
                "notes": "",
            },
        )
        seed_session(
            org_petro,
            course_gas,
            today + timedelta(days=7),
            {
                "workplace": wp_olefin,
                "instructor_name": "آزمایشگاه پایش اتمسفر",
                "duration_minutes": 240,
                "capacity": 12,
                "status": TrainingSession.Status.SCHEDULED,
                "notes": "دوره آینده؛ نتیجه قبولی نباید قبل از برگزاری ثبت شود.",
            },
        )

        # Attendance / assessment history
        if emp_morteza and sess_hot:
            seed_attendance(
                sess_hot,
                emp_morteza,
                {
                    "attendance_status": TrainingAttendance.AttendanceStatus.ATTENDED,
                    "assessment_result": TrainingAttendance.AssessmentResult.PASSED,
                    "score": 92,
                    "completed_on": sess_hot.scheduled_on,
                    "notes": "قبولی با نمره ۹۲.",
                },
            )
        if emp_ahmad and sess_hot:
            seed_attendance(
                sess_hot,
                emp_ahmad,
                {
                    "attendance_status": TrainingAttendance.AttendanceStatus.ATTENDED,
                    "assessment_result": TrainingAttendance.AssessmentResult.PASSED,
                    "score": 81,
                    "completed_on": sess_hot.scheduled_on,
                    "notes": "قبولی مشروط به تمدید صلاحیت.",
                },
            )
        if emp_mohsen and sess_height:
            seed_attendance(
                sess_height,
                emp_mohsen,
                {
                    "attendance_status": TrainingAttendance.AttendanceStatus.ATTENDED,
                    "assessment_result": TrainingAttendance.AssessmentResult.PASSED,
                    "score": 88,
                    "completed_on": sess_height.scheduled_on,
                    "notes": "",
                },
            )
        if emp_behrooz and sess_height:
            seed_attendance(
                sess_height,
                emp_behrooz,
                {
                    "attendance_status": TrainingAttendance.AttendanceStatus.ATTENDED,
                    "assessment_result": TrainingAttendance.AssessmentResult.FAILED,
                    "score": 44,
                    "completed_on": sess_height.scheduled_on,
                    "notes": "نیاز به آموزش مجدد و ارزیابی دوباره.",
                },
            )
        if emp_amir and sess_cs:
            seed_attendance(
                sess_cs,
                emp_amir,
                {
                    "attendance_status": TrainingAttendance.AttendanceStatus.ATTENDED,
                    "assessment_result": TrainingAttendance.AssessmentResult.PASSED,
                    "score": 95,
                    "completed_on": sess_cs.scheduled_on,
                    "notes": "",
                },
            )
        if emp_davood and sess_cs:
            seed_attendance(
                sess_cs,
                emp_davood,
                {
                    "attendance_status": TrainingAttendance.AttendanceStatus.ATTENDED,
                    "assessment_result": TrainingAttendance.AssessmentResult.PASSED,
                    "score": 87,
                    "completed_on": sess_cs.scheduled_on,
                    "notes": "",
                },
            )
        if emp_navid and sess_cs:
            seed_attendance(
                sess_cs,
                emp_navid,
                {
                    "attendance_status": TrainingAttendance.AttendanceStatus.ABSENT,
                    "assessment_result": TrainingAttendance.AssessmentResult.PENDING,
                    "score": None,
                    "completed_on": None,
                    "notes": "غیبت در جلسه عملی؛ صلاحیت صادر نشد.",
                },
            )
        if emp_sara and sess_first:
            seed_attendance(
                sess_first,
                emp_sara,
                {
                    "attendance_status": TrainingAttendance.AttendanceStatus.ATTENDED,
                    "assessment_result": TrainingAttendance.AssessmentResult.PASSED,
                    "score": 90,
                    "completed_on": sess_first.scheduled_on,
                    "notes": "",
                },
            )

        # Competency definitions
        comp_hot = seed_competency(
            org_foolad,
            "CMP-FA-HOT",
            {
                "name": "صلاحیت کار گرم",
                "description": "مجوز انجام جوشکاری، برش و عملیات تولید جرقه.",
                "allowed_activities": "جوشکاری، برشکاری، سنگ‌زنی و کار گرم در واحدهای فرآیندی",
                "is_mandatory": True,
                "validity_months": 24,
                "accepted_courses": [course_hot],
                "is_active": True,
            },
        )
        comp_height = seed_competency(
            org_foolad,
            "CMP-FA-HEIGHT",
            {
                "name": "صلاحیت کار در ارتفاع",
                "description": "توانایی کار در ارتفاع بالای ۱.۸ متر با سیستم حفاظت سقوط.",
                "allowed_activities": "کار روی داربست، سکو، تیر و تجهیزات بالای ارتفاع",
                "is_mandatory": True,
                "validity_months": 24,
                "accepted_courses": [course_height],
                "is_active": True,
            },
        )
        comp_loto = seed_competency(
            org_foolad,
            "CMP-FA-LOTO",
            {
                "name": "صلاحیت ایزولاسیون انرژی",
                "description": "اجرای قفل و تگ‌گذاری و آزمون صفر انرژی.",
                "allowed_activities": "تعمیر و نگهداری تجهیزات دارای انرژی الکتریکی/مکانیکی",
                "is_mandatory": True,
                "validity_months": 36,
                "accepted_courses": [course_loto],
                "is_active": True,
            },
        )
        comp_cs = seed_competency(
            org_petro,
            "CMP-SP-CS",
            {
                "name": "صلاحیت ورود به فضای بسته",
                "description": "ورود ایمن به مخازن، برج‌ها و فضاهای بسته.",
                "allowed_activities": "ورود به فضای بسته، بازرسی داخلی مخزن و NDT",
                "is_mandatory": True,
                "validity_months": 24,
                "accepted_courses": [course_cs],
                "is_active": True,
            },
        )
        comp_gas = seed_competency(
            org_petro,
            "CMP-SP-GAS",
            {
                "name": "صلاحیت گازسنجی",
                "description": "کار با گازسنج و تفسیر نتایج پایش اتمسفر.",
                "allowed_activities": "گازسنجی ورود به فضای بسته و پایش منطقه",
                "is_mandatory": True,
                "validity_months": 24,
                "accepted_courses": [course_gas],
                "is_active": True,
            },
        )
        comp_first_aid = seed_competency(
            org_petro,
            "CMP-SP-FIRST",
            {
                "name": "صلاحیت کمک‌های اولیه",
                "description": "واکنش اولیه و احیای پایه در صحنه حادثه.",
                "allowed_activities": "کمک‌های اولیه و پشتیبانی واکنش اضطراری",
                "is_mandatory": False,
                "validity_months": 36,
                "accepted_courses": [course_first_aid],
                "is_active": True,
            },
        )

        # Historic and effective employee competency records
        if emp_morteza and comp_hot:
            seed_employee_competency(
                emp_morteza,
                comp_hot,
                today - timedelta(days=800),
                {
                    "expires_on": today - timedelta(days=70),
                    "source_course": course_hot,
                    "certificate_number": "CERT-FA-HOT-OLD",
                    "status": EmployeeCompetency.Status.ACTIVE,
                    "notes": "دوره قبلی منقضی شده و برای تاریخچه حفظ می‌شود.",
                },
            )
            seed_employee_competency(
                emp_morteza,
                comp_hot,
                today - timedelta(days=60),
                {
                    "expires_on": today + timedelta(days=670),
                    "source_course": course_hot,
                    "source_session": sess_hot,
                    "certificate_number": "CERT-FA-HOT-1405-01",
                    "status": EmployeeCompetency.Status.ACTIVE,
                    "notes": "تمدید معتبر پس از دوره جدید.",
                },
            )
        if emp_ahmad and comp_hot:
            seed_employee_competency(
                emp_ahmad,
                comp_hot,
                today - timedelta(days=700),
                {
                    "expires_on": today + timedelta(days=10),
                    "source_course": course_hot,
                    "source_session": sess_hot,
                    "certificate_number": "CERT-FA-HOT-1405-02",
                    "status": EmployeeCompetency.Status.ACTIVE,
                    "notes": "نزدیک انقضا؛ برای نمایش هشدار ۳۰ روزه.",
                },
            )
        if emp_mohsen and comp_height:
            seed_employee_competency(
                emp_mohsen,
                comp_height,
                today - timedelta(days=30),
                {
                    "expires_on": today + timedelta(days=700),
                    "source_course": course_height,
                    "source_session": sess_height,
                    "certificate_number": "CERT-FA-HEIGHT-1405-03",
                    "status": EmployeeCompetency.Status.ACTIVE,
                    "notes": "",
                },
            )
        if emp_behrooz and comp_height:
            seed_employee_competency(
                emp_behrooz,
                comp_height,
                today - timedelta(days=750),
                {
                    "expires_on": today - timedelta(days=20),
                    "source_course": course_height,
                    "certificate_number": "CERT-FA-HEIGHT-OLD",
                    "status": EmployeeCompetency.Status.ACTIVE,
                    "notes": "منقضی؛ برای آزمون رد صلاحیت مجوز کار در ارتفاع.",
                },
            )
        if emp_ali and comp_hot:
            seed_employee_competency(
                emp_ali,
                comp_hot,
                today - timedelta(days=100),
                {
                    "expires_on": today + timedelta(days=630),
                    "source_course": course_hot,
                    "certificate_number": "CERT-FA-HOT-SUP",
                    "status": EmployeeCompetency.Status.ACTIVE,
                    "notes": "",
                },
            )
        if emp_ali and comp_height:
            seed_employee_competency(
                emp_ali,
                comp_height,
                today - timedelta(days=100),
                {
                    "expires_on": today + timedelta(days=630),
                    "source_course": course_height,
                    "certificate_number": "CERT-FA-HEIGHT-SUP",
                    "status": EmployeeCompetency.Status.ACTIVE,
                    "notes": "",
                },
            )
        if emp_amir and comp_cs:
            seed_employee_competency(
                emp_amir,
                comp_cs,
                today - timedelta(days=20),
                {
                    "expires_on": today + timedelta(days=710),
                    "source_course": course_cs,
                    "source_session": sess_cs,
                    "certificate_number": "CERT-SP-CS-1405-01",
                    "status": EmployeeCompetency.Status.ACTIVE,
                    "notes": "",
                },
            )
        if emp_davood and comp_cs:
            seed_employee_competency(
                emp_davood,
                comp_cs,
                today - timedelta(days=20),
                {
                    "expires_on": today + timedelta(days=710),
                    "source_course": course_cs,
                    "source_session": sess_cs,
                    "certificate_number": "CERT-SP-CS-1405-02",
                    "status": EmployeeCompetency.Status.ACTIVE,
                    "notes": "",
                },
            )
        if emp_saeed and comp_cs:
            seed_employee_competency(
                emp_saeed,
                comp_cs,
                today - timedelta(days=200),
                {
                    "expires_on": today + timedelta(days=530),
                    "source_course": course_cs,
                    "certificate_number": "CERT-SP-CS-SUP",
                    "status": EmployeeCompetency.Status.ACTIVE,
                    "notes": "",
                },
            )
        if emp_sara and comp_first_aid:
            seed_employee_competency(
                emp_sara,
                comp_first_aid,
                today - timedelta(days=30),
                {
                    "expires_on": today + timedelta(days=1050),
                    "source_course": course_first_aid,
                    "source_session": sess_first,
                    "certificate_number": "CERT-SP-FIRST-1405-01",
                    "status": EmployeeCompetency.Status.SUSPENDED,
                    "notes": "تعلیق موقت برای بررسی اداری؛ در اعتبارسنجی معتبر شمرده نمی‌شود.",
                },
            )
        if emp_davood and comp_gas:
            seed_employee_competency(
                emp_davood,
                comp_gas,
                today - timedelta(days=400),
                {
                    "expires_on": today + timedelta(days=300),
                    "source_course": course_gas,
                    "certificate_number": "CERT-SP-GAS-REVOKED",
                    "status": EmployeeCompetency.Status.REVOKED,
                    "notes": "لغوشده؛ برای آزمون عدم پذیرش صلاحیت.",
                },
            )

        # PTW competency rules and structured crews
        if comp_hot:
            seed_requirement(org_foolad, Permit.PermitType.HOT_WORK, comp_hot)
        if comp_height:
            seed_requirement(org_foolad, Permit.PermitType.WORK_AT_HEIGHT, comp_height)
        if comp_cs:
            seed_requirement(org_petro, Permit.PermitType.CONFINED_SPACE, comp_cs)

        if ptw1 is not None:
            ptw1.assigned_employees.set([emp for emp in (emp_morteza, emp_ahmad) if emp])
        if ptw2 is not None:
            ptw2.assigned_employees.set([emp for emp in (emp_mohsen, emp_behrooz) if emp])
        if ptw3 is not None:
            ptw3.assigned_employees.set([emp for emp in (emp_behrooz,) if emp])
        if ptw4 is not None:
            ptw4.assigned_employees.set([emp for emp in (emp_morteza,) if emp])
        if ptw5 is not None:
            ptw5.assigned_employees.set([emp for emp in (emp_amir, emp_davood) if emp])

        ptw6 = seed_permit(
            "PTW-202610-0106",
            {
                "organization": org_foolad,
                "workplace": wp_cast,
                "permit_type": Permit.PermitType.HOT_WORK,
                "title": "کار گرم تیم پیمانکاری بدون فهرست ساختاریافته کارکنان",
                "description": "نمونه نمایشی برای وضعیت نامشخص صلاحیت؛ فقط نام در متن آزاد ثبت شده است.",
                "work_area": "محوطه ریخته‌گری، ضلع شرقی",
                "equipment_involved": "دستگاه جوش سیار",
                "valid_from": now + timedelta(hours=2),
                "valid_until": now + timedelta(hours=8),
                "requester": hse_mgr_user,
                "responsible_supervisor": None,
                "status": Permit.Status.UNDER_REVIEW,
                "assigned_workers": "تیم پیمانکاری آرمان (نام و شماره پرسنلی ساختاریافته ثبت نشده است)",
                "precautions_taken": "محوطه جداسازی و کپسول اطفا مستقر شده است.",
                "required_ppe": "شیلد جوشکاری، دستکش چرمی، ماسک تنفسی",
                "gas_testing_required": False,
                "isolation_loto_required": False,
                "is_synthetic": True,
            },
        )
        if ptw6 is not None:
            ptw6.assigned_employees.clear()

        # PPE catalogue
        ppe_helmet_fa = seed_ppe_item(
            org_foolad,
            "PPE-FA-HELMET",
            {
                "name": "کلاه ایمنی صنعتی",
                "category": "حفاظت سر",
                "description": "کلاه ایمنی با بند چانه و قابلیت نصب عینک.",
                "usage_requirements": "تنظیم بند، بازرسی شیلد و جایگزینی پس از ضربه.",
                "sizes": "M, L, XL",
                "replacement_interval_days": 730,
                "inspection_required": True,
                "is_durable": True,
                "tracks_serial": False,
                "is_active": True,
            },
        )
        ppe_glove_fa = seed_ppe_item(
            org_foolad,
            "PPE-FA-GLOVE",
            {
                "name": "دستکش ضدبرش و حرارت",
                "category": "حفاظت دست",
                "description": "دستکش چرمی مناسب کار گرم و جابه‌جایی قطعات.",
                "usage_requirements": "بازرسی پارگی و تعویض پس از سوختگی یا سایش.",
                "sizes": "9, 10, 11",
                "replacement_interval_days": 30,
                "inspection_required": False,
                "is_durable": False,
                "tracks_serial": False,
                "is_active": True,
            },
        )
        ppe_harness_fa = seed_ppe_item(
            org_foolad,
            "PPE-FA-HARNESS",
            {
                "name": "هارنس تمام‌بدن ایمنی",
                "category": "حفاظت در برابر سقوط",
                "description": "هارنس دو قلابه با حلقه پشتی و تسمه‌های تنظیم.",
                "usage_requirements": "بازرسی قبل از هر استفاده، اتصال به لایف‌لاین معتبر.",
                "sizes": "Universal",
                "replacement_interval_days": 730,
                "inspection_required": True,
                "is_durable": True,
                "tracks_serial": True,
                "is_active": True,
            },
        )
        ppe_resp_fa = seed_ppe_item(
            org_foolad,
            "PPE-FA-RESP",
            {
                "name": "ماسک تنفسی نیم‌صورت با فیلتر",
                "category": "حفاظت تنفس",
                "description": "ماسک نیم‌صورت برای بخارات و ذرات.",
                "usage_requirements": "تست تناسب، تعویض فیلتر و بازرسی سوپاپ.",
                "sizes": "S, M, L",
                "replacement_interval_days": 180,
                "inspection_required": True,
                "is_durable": True,
                "tracks_serial": True,
                "is_active": True,
            },
        )
        ppe_helmet_sp = seed_ppe_item(
            org_petro,
            "PPE-SP-HELMET",
            {
                "name": "کلاه ایمنی پتروشیمی",
                "category": "حفاظت سر",
                "description": "کلاه ایمنی مقاوم به حرارت با برچسب واحد.",
                "usage_requirements": "بازرسی روزانه و تنظیم بند.",
                "sizes": "M, L",
                "replacement_interval_days": 730,
                "inspection_required": True,
                "is_durable": True,
                "tracks_serial": False,
                "is_active": True,
            },
        )
        ppe_resp_sp = seed_ppe_item(
            org_petro,
            "PPE-SP-RESP",
            {
                "name": "ماسک تنفسی تمام‌صورت",
                "category": "حفاظت تنفس",
                "description": "ماسک تمام‌صورت با فیلتر ترکیبی.",
                "usage_requirements": "تست تناسب سالانه و بازرسی فیلتر.",
                "sizes": "M, L",
                "replacement_interval_days": 365,
                "inspection_required": True,
                "is_durable": True,
                "tracks_serial": True,
                "is_active": True,
            },
        )
        ppe_glove_sp = seed_ppe_item(
            org_petro,
            "PPE-SP-GLOVE",
            {
                "name": "دستکش شیمیایی",
                "category": "حفاظت دست",
                "description": "دستکش مقاوم به مواد شیمیایی سبک.",
                "usage_requirements": "بررسی نشتی قبل از استفاده.",
                "sizes": "9, 10",
                "replacement_interval_days": 30,
                "inspection_required": False,
                "is_durable": False,
                "tracks_serial": False,
                "is_active": True,
            },
        )

        # PPE stock: one below-minimum and one empty location
        stock_helmet_fa = seed_stock(
            org_foolad, ppe_helmet_fa, wp_roll, "انبار خط نورد", 28, 10
        ) if ppe_helmet_fa else None
        stock_glove_fa = seed_stock(
            org_foolad, ppe_glove_fa, wp_cast, "انبار کارگاه ریخته‌گری", 12, 20
        ) if ppe_glove_fa else None
        stock_harness_fa = seed_stock(
            org_foolad, ppe_harness_fa, wp_cast, "انبار تجهیزات ارتفاع", 4, 2
        ) if ppe_harness_fa else None
        stock_resp_fa = seed_stock(
            org_foolad, ppe_resp_fa, wp_roll, "انبار تنفسی", 0, 4
        ) if ppe_resp_fa else None
        stock_helmet_sp = seed_stock(
            org_petro, ppe_helmet_sp, wp_maint, "انبار مرکزی HSE", 18, 5
        ) if ppe_helmet_sp else None
        stock_resp_sp = seed_stock(
            org_petro, ppe_resp_sp, wp_olefin, "انبار واحد الفین", 7, 3
        ) if ppe_resp_sp else None
        stock_glove_sp = seed_stock(
            org_petro, ppe_glove_sp, wp_maint, "انبار مرکزی HSE", 30, 10
        ) if ppe_glove_sp else None

        # PPE assignment history
        def make_events(assignment, specs):
            for event_type, occurred_on, defaults in specs:
                seed_ppe_event(assignment, event_type, occurred_on, defaults)

        if emp_morteza and ppe_helmet_fa and stock_helmet_fa:
            a = seed_assignment(
                emp_morteza,
                ppe_helmet_fa,
                stock_helmet_fa,
                today - timedelta(days=10),
                {
                    "quantity": 1,
                    "serial_number": "",
                    "condition_on_issue": "نو",
                    "replacement_due_on": today + timedelta(days=720),
                    "status": PPEAssignment.Status.ACTIVE,
                    "notes": "کلاه اختصاصی کارگاه جوشکاری.",
                },
            )
            make_events(a, [(PPEAssignmentEvent.EventType.ISSUED, today - timedelta(days=10), {"quantity": 1, "condition": "نو"})])
        if emp_morteza and ppe_glove_fa and stock_glove_fa:
            old_glove = seed_assignment(
                emp_morteza,
                ppe_glove_fa,
                stock_glove_fa,
                today - timedelta(days=95),
                {
                    "quantity": 2,
                    "serial_number": "",
                    "condition_on_issue": "نو",
                    "replacement_due_on": today - timedelta(days=65),
                    "status": PPEAssignment.Status.REPLACED,
                    "returned_on": today - timedelta(days=3),
                    "return_condition": "ساییدگی؛ تعویض شد.",
                    "notes": "",
                },
            )
            make_events(old_glove, [
                (PPEAssignmentEvent.EventType.ISSUED, today - timedelta(days=95), {"quantity": 2, "condition": "نو"}),
                (PPEAssignmentEvent.EventType.REPLACED, today - timedelta(days=3), {"quantity": 2, "condition": "ساییدگی"}),
            ])
            new_glove = seed_assignment(
                emp_morteza,
                ppe_glove_fa,
                stock_glove_fa,
                today - timedelta(days=3),
                {
                    "quantity": 2,
                    "serial_number": "",
                    "condition_on_issue": "نو",
                    "replacement_due_on": today + timedelta(days=27),
                    "status": PPEAssignment.Status.ACTIVE,
                    "notes": "تعویض دوره‌ای؛ موعد تعویض نزدیک است.",
                },
            )
            make_events(new_glove, [(PPEAssignmentEvent.EventType.ISSUED, today - timedelta(days=3), {"quantity": 2, "condition": "نو"})])
        if emp_ahmad and ppe_helmet_fa and stock_helmet_fa:
            a = seed_assignment(
                emp_ahmad,
                ppe_helmet_fa,
                stock_helmet_fa,
                today - timedelta(days=15),
                {
                    "quantity": 1,
                    "serial_number": "",
                    "condition_on_issue": "سالم",
                    "replacement_due_on": today + timedelta(days=715),
                    "status": PPEAssignment.Status.ACTIVE,
                    "notes": "",
                },
            )
            make_events(a, [(PPEAssignmentEvent.EventType.ISSUED, today - timedelta(days=15), {"quantity": 1, "condition": "سالم"})])
        if emp_mohsen and ppe_harness_fa and stock_harness_fa:
            a = seed_assignment(
                emp_mohsen,
                ppe_harness_fa,
                stock_harness_fa,
                today - timedelta(days=200),
                {
                    "quantity": 1,
                    "serial_number": "HRN-FA-001",
                    "condition_on_issue": "سالم",
                    "replacement_due_on": today + timedelta(days=20),
                    "status": PPEAssignment.Status.ACTIVE,
                    "notes": "نیازمند بازرسی دوره‌ای پیش از کار بعدی.",
                },
            )
            make_events(a, [(PPEAssignmentEvent.EventType.ISSUED, today - timedelta(days=200), {"quantity": 1, "condition": "سالم"})])
        if emp_behrooz and ppe_harness_fa and stock_harness_fa:
            a = seed_assignment(
                emp_behrooz,
                ppe_harness_fa,
                stock_harness_fa,
                today - timedelta(days=100),
                {
                    "quantity": 1,
                    "serial_number": "HRN-FA-002",
                    "condition_on_issue": "سالم",
                    "replacement_due_on": today + timedelta(days=630),
                    "status": PPEAssignment.Status.RETURNED,
                    "returned_on": today - timedelta(days=2),
                    "return_condition": "سالم؛ پایان کار پروژه",
                    "notes": "",
                },
            )
            make_events(a, [
                (PPEAssignmentEvent.EventType.ISSUED, today - timedelta(days=100), {"quantity": 1, "condition": "سالم"}),
                (PPEAssignmentEvent.EventType.RETURNED, today - timedelta(days=2), {"quantity": 1, "condition": "سالم"}),
            ])
        if emp_sara and ppe_helmet_sp and stock_helmet_sp:
            a = seed_assignment(
                emp_sara,
                ppe_helmet_sp,
                stock_helmet_sp,
                today - timedelta(days=5),
                {
                    "quantity": 1,
                    "serial_number": "",
                    "condition_on_issue": "نو",
                    "replacement_due_on": today + timedelta(days=725),
                    "status": PPEAssignment.Status.ACTIVE,
                    "notes": "",
                },
            )
            make_events(a, [(PPEAssignmentEvent.EventType.ISSUED, today - timedelta(days=5), {"quantity": 1, "condition": "نو"})])
        if emp_davood and ppe_resp_sp and stock_resp_sp:
            a = seed_assignment(
                emp_davood,
                ppe_resp_sp,
                stock_resp_sp,
                today - timedelta(days=150),
                {
                    "quantity": 1,
                    "serial_number": "RESP-SP-001",
                    "condition_on_issue": "سالم",
                    "replacement_due_on": today + timedelta(days=15),
                    "status": PPEAssignment.Status.ACTIVE,
                    "notes": "موعد تعویض نزدیک است.",
                },
            )
            make_events(a, [(PPEAssignmentEvent.EventType.ISSUED, today - timedelta(days=150), {"quantity": 1, "condition": "سالم"})])
        if emp_navid and ppe_glove_sp and stock_glove_sp:
            a = seed_assignment(
                emp_navid,
                ppe_glove_sp,
                stock_glove_sp,
                today - timedelta(days=40),
                {
                    "quantity": 1,
                    "serial_number": "",
                    "condition_on_issue": "سالم",
                    "replacement_due_on": today - timedelta(days=10),
                    "status": PPEAssignment.Status.ACTIVE,
                    "notes": "موعد تعویض گذشته؛ برای هشدار نمایشی.",
                },
            )
            make_events(a, [(PPEAssignmentEvent.EventType.ISSUED, today - timedelta(days=40), {"quantity": 1, "condition": "سالم"})])

        self.stdout.write(
            self.style.SUCCESS(
                "Phase 10 workforce demo data seeded: employees, training, competencies, PTW rules and PPE."
            )
        )

        # ==========================================
        # Phase 12: Workforce Extension, Jobs, Contractors & Attendance
        # ==========================================
        def seed_job_position(org, code, defaults):
            job, _ = JobPosition.objects.update_or_create(
                organization=org,
                code=code,
                defaults={**defaults, "is_synthetic": True},
            )
            return job

        job_elec = seed_job_position(
            org_foolad,
            "JOB-FA-ELEC",
            {
                "title": "تکنسین ارشد برق و ابزار دقیق",
                "department": "تعمیرات و نگهداری",
                "description": "نصب، تعمیر و بازرسی تابلوهای برق فشار متوسط و سیستم‌های کنترل.",
                "risk_level": JobPosition.RiskLevel.HIGH,
                "required_qualifications": "مدرک کارشناسی برق، گواهینامه ایمنی فشار قوی و کار در ارتفاع.",
                "is_active": True,
            },
        )
        job_mech = seed_job_position(
            org_foolad,
            "JOB-FA-MECH",
            {
                "title": "مکانیک تجهیزات دوار و پمپ‌ها",
                "department": "تعمیرات مکانیک",
                "description": "تعمیر و نگهداری پمپ‌های هیدرولیک و کمپرسورهای خط نورد.",
                "risk_level": JobPosition.RiskLevel.MEDIUM,
                "required_qualifications": "کاردانی مکانیک صنعتی با ۵ سال تجربه در صنایع فولادی.",
                "is_active": True,
            },
        )
        job_proc = seed_job_position(
            org_petro,
            "JOB-SP-PROC",
            {
                "title": "اپراتور ارشد اتاق کنترل پتروشیمی",
                "department": "بهره‌برداری",
                "description": "پایش فرآیندهای واحد اولفین و سیستم‌های ESD/DCS.",
                "risk_level": JobPosition.RiskLevel.CRITICAL,
                "required_qualifications": "مهندسی شیمی یا کنترل فرآیند، صلاحیت کار در فضاهای دارای ریسک آتش‌سوزی.",
                "is_active": True,
            },
        )

        # Job assignments
        if emp_morteza:
            EmployeeJobAssignment.objects.update_or_create(
                organization=org_foolad,
                employee=emp_morteza,
                job_position=job_elec,
                defaults={
                    "is_primary": True,
                    "start_date": today - timedelta(days=180),
                    "end_date": None,
                    "notes": "انتصاب اصلی به عنوان سرپرست برق شیفت.",
                    "is_synthetic": True,
                },
            )
        if emp_behrooz:
            EmployeeJobAssignment.objects.update_or_create(
                organization=org_foolad,
                employee=emp_behrooz,
                job_position=job_mech,
                defaults={
                    "is_primary": True,
                    "start_date": today - timedelta(days=365),
                    "end_date": None,
                    "notes": "مسئول پمپ‌های فشار قوی.",
                    "is_synthetic": True,
                },
            )
        if emp_sara:
            EmployeeJobAssignment.objects.update_or_create(
                organization=org_petro,
                employee=emp_sara,
                job_position=job_proc,
                defaults={
                    "is_primary": True,
                    "start_date": today - timedelta(days=200),
                    "end_date": None,
                    "notes": "شیفت الف واحد اولفین.",
                    "is_synthetic": True,
                },
            )

        # Contractor Companies
        def seed_contractor(org, name, defaults):
            cont, _ = ContractorCompany.objects.update_or_create(
                organization=org,
                name=name,
                defaults={**defaults, "is_synthetic": True},
            )
            return cont

        cont_paydar = seed_contractor(
            org_foolad,
            "شرکت مهندسی پایدار سازه البرز",
            {
                "registration_no": "REG-99120",
                "economic_code": "10103456789",
                "contact_person": "مهندس احمدی",
                "contact_phone": "02188990011",
                "contact_email": "info@paydarsazeh.ir",
                "status": ContractorCompany.Status.APPROVED,
                "safety_score": 92.50,
                "contract_start": today - timedelta(days=90),
                "contract_end": today + timedelta(days=275),
                "notes": "پیمانکار رتبه یک تعمیرات مکانیکی و سازه‌های فلزی.",
            },
        )

        cont_ariana = seed_contractor(
            org_foolad,
            "پیمانکاری آریانا صنعت گاز",
            {
                "registration_no": "REG-88410",
                "economic_code": "10105678901",
                "contact_person": "مهندس مرادی",
                "contact_phone": "02188443322",
                "contact_email": "contact@arianagas.ir",
                "status": ContractorCompany.Status.PENDING,
                "safety_score": 78.00,
                "contract_start": today - timedelta(days=30),
                "contract_end": today + timedelta(days=150),
                "notes": "در حال ارزیابی صلاحیت ایمنی برای خطوط انتقال گاز.",
            },
        )

        # Contractor Documents
        ContractorDocument.objects.update_or_create(
            organization=org_foolad,
            contractor=cont_paydar,
            document_type=ContractorDocument.DocumentType.HSE_PLAN,
            defaults={
                "title": "طرح سلامت، ایمنی و محیط زیست (HSE Plan)",
                "valid_until": today + timedelta(days=200),
                "status": ContractorDocument.Status.VERIFIED,
                "verification_notes": "تأییدشده توسط اداره بازرسی HSE کارخانه فولاد.",
                "is_synthetic": True,
            },
        )
        ContractorDocument.objects.update_or_create(
            organization=org_foolad,
            contractor=cont_paydar,
            document_type=ContractorDocument.DocumentType.INSURANCE_POLICY,
            defaults={
                "title": "بیمه‌نامه مسئولیت مدنی کارفرما در قبال کارکنان",
                "valid_until": today + timedelta(days=120),
                "status": ContractorDocument.Status.VERIFIED,
                "verification_notes": "شماره بیمه‌نامه: INS-9843-IR",
                "is_synthetic": True,
            },
        )

        # Contractor Workers
        worker_ali, _ = ContractorWorker.objects.update_or_create(
            organization=org_foolad,
            contractor=cont_paydar,
            national_id="0019876543",
            defaults={
                "first_name": "صادق",
                "last_name": "کریمی",
                "mobile": "09121112233",
                "trade": "جوشکار تخصصی خطوط انتقال",
                "is_active": True,
                "is_synthetic": True,
            },
        )
        worker_reza, _ = ContractorWorker.objects.update_or_create(
            organization=org_foolad,
            contractor=cont_paydar,
            national_id="0023456789",
            defaults={
                "first_name": "پیمان",
                "last_name": "رضایی",
                "mobile": "09123334455",
                "trade": "کمک جوشکار و سنگ‌زن",
                "is_active": True,
                "is_synthetic": True,
            },
        )

        # Contractor Evaluation
        ContractorEvaluation.objects.update_or_create(
            organization=org_foolad,
            contractor=cont_paydar,
            evaluation_date=today - timedelta(days=15),
            defaults={
                "score": 92.50,
                "criteria_scores": {"ppe_compliance": 95, "ptw_discipline": 90, "incident_rate": 92.5},
                "findings": "انضباط و پایبندی عالی به رویه‌های صدور مجوز کار و استفاده از تجهیزات ایمنی فردی.",
                "is_synthetic": True,
            },
        )

        # Attendance Records for today
        now_dt = timezone.now()
        AttendanceRecord.objects.update_or_create(
            organization=org_foolad,
            person_type=AttendanceRecord.PersonType.EMPLOYEE,
            employee=emp_morteza,
            date=today,
            defaults={
                "workplace": wp_roll,
                "check_in": now_dt.replace(hour=7, minute=45, second=0, microsecond=0),
                "entry_source": AttendanceRecord.EntrySource.GATE_SCANNER,
                "status": AttendanceRecord.Status.PRESENT,
                "notes": "ورود سر شیفت صبح با احراز هویت بیومتریک.",
                "is_synthetic": True,
            },
        )
        AttendanceRecord.objects.update_or_create(
            organization=org_foolad,
            person_type=AttendanceRecord.PersonType.EMPLOYEE,
            employee=emp_behrooz,
            date=today,
            defaults={
                "workplace": wp_cast,
                "check_in": now_dt.replace(hour=8, minute=20, second=0, microsecond=0),
                "entry_source": AttendanceRecord.EntrySource.GATE_SCANNER,
                "status": AttendanceRecord.Status.LATE,
                "notes": "۲۰ دقیقه تأخیر به‌دلیل بازرسی تجهیزات حفاظتی در گیت.",
                "is_synthetic": True,
            },
        )
        AttendanceRecord.objects.update_or_create(
            organization=org_foolad,
            person_type=AttendanceRecord.PersonType.CONTRACTOR_WORKER,
            contractor_worker=worker_ali,
            date=today,
            defaults={
                "workplace": wp_roll,
                "check_in": now_dt.replace(hour=7, minute=50, second=0, microsecond=0),
                "entry_source": AttendanceRecord.EntrySource.GATE_SCANNER,
                "status": AttendanceRecord.Status.PRESENT,
                "notes": "ورود اکیپ جوشکاری پیمانکار پایدار سازه با مجوز کار گرم معتبر.",
                "is_synthetic": True,
            },
        )

        # ==========================================
        # Phase 13: Advanced Permit to Work & SIMOPS Conflicts
        # ==========================================
        if ptw1 is not None and cont_paydar is not None:
            ptw1.contractor = cont_paydar
            ptw1.weather_condition_ok = True
            ptw1.weather_notes = "وضعیت جوی کاملاً آرام، سرعت باد ۸ کیلومتر بر ساعت، دمای ۲۲ درجه، تهویه مطلوب سوله نورد."
            ptw1.save(update_fields=["contractor", "weather_condition_ok", "weather_notes"])

        ptw_hot_sp = seed_permit(
            "PTW-202610-0202",
            {
                "organization": org_petro,
                "workplace": wp_spheres,
                "permit_type": Permit.PermitType.HOT_WORK,
                "title": "جوشکاری فلنج منیفولد خروجی مجاور مخزن کروی TK-201",
                "description": "برشکاری و تعویض فلنج ۶ اینچ خط تخلیه گاز مجاور مخزن کروی فعال.",
                "work_area": "محوطه پیرامونی مخزن کروی TK-201 - لاین تخلیه اضطراری",
                "equipment_involved": "دستگاه جوش اینورتر، فرز آهنگری، اسپید کور عایق",
                "valid_from": now - timedelta(hours=1),
                "valid_until": now + timedelta(hours=7),
                "requester": petro_supervisor_user,
                "responsible_supervisor": petro_supervisor_user,
                "approver": hse_mgr_user,
                "status": Permit.Status.APPROVED,
                "assigned_workers": "صادق کریمی (سرپرست جوشکاری)",
                "gas_testing_required": True,
                "gas_testing_results": "LEL: 0%, H2S: 0 ppm در محدوده اطراف لوله",
                "isolation_loto_required": True,
                "isolation_loto_details": "خط لوله بلانک شده و شیر اصلی گاز پلمپ و قفل گردید.",
                "weather_condition_ok": True,
                "weather_notes": "سرعت باد زیر ۱۰ نات، بدون صاعقه و بارش.",
            },
        )

        if ptw5 is not None and ptw_hot_sp is not None:
            SIMOPSConflict.objects.update_or_create(
                organization=org_petro,
                permit_a=ptw5,
                permit_b=ptw_hot_sp,
                workplace=wp_spheres,
                defaults={
                    "conflict_type": SIMOPSConflict.ConflictType.INCOMPATIBLE_TYPES,
                    "severity": SIMOPSConflict.Severity.CRITICAL_BLOCK,
                    "description": "تداخل بحرانی: همزمانی عملیات ورود به فضای بسته (مخزن گاز مایع TK-201) و عملیات جوشکاری/کار گرم در محدوده خطر انفجاری.",
                    "is_resolved": False,
                    "override_approved": False,
                    "is_synthetic": True,
                },
            )

        ptw_elec_sp = seed_permit(
            "PTW-202610-0203",
            {
                "organization": org_petro,
                "workplace": wp_spheres,
                "permit_type": Permit.PermitType.ELECTRICAL_ISOLATION,
                "title": "کابل‌کشی سیستم ابزار دقیق و تله‌متری مخازن گاز",
                "description": "عبور کابل‌های ضدجرقه فشار ضعیف سیستم پایش سطح مخازن.",
                "work_area": "سینی کابل محوطه مخازن کروی",
                "equipment_involved": "کابل‌کش دستی، مولتی‌متر دیجیتال",
                "valid_from": now - timedelta(hours=2),
                "valid_until": now + timedelta(hours=4),
                "requester": petro_supervisor_user,
                "responsible_supervisor": petro_supervisor_user,
                "approver": hse_mgr_user,
                "status": Permit.Status.ACTIVE,
                "assigned_workers": "پیمان اسدی",
                "weather_condition_ok": True,
            },
        )

        if ptw5 is not None and ptw_elec_sp is not None:
            SIMOPSConflict.objects.update_or_create(
                organization=org_petro,
                permit_a=ptw5,
                permit_b=ptw_elec_sp,
                workplace=wp_spheres,
                defaults={
                    "conflict_type": SIMOPSConflict.ConflictType.SPATIAL_OVERLAP,
                    "severity": SIMOPSConflict.Severity.WARNING,
                    "description": "هشدار همزمانی فعالیت برقی در مجاورت فضای بسته؛ تردد پرسنل در مسیر ورودی منهول.",
                    "is_resolved": False,
                    "override_approved": True,
                    "override_by": petro_supervisor_user,
                    "override_reason": "کانال کابل در فاصله ۳۰ متری مخزن قرار داشته و مسیر تردد کاملاً تفکیک و ایمن‌سازی شده است.",
                    "override_at": now_dt - timedelta(hours=1, minutes=30),
                    "is_synthetic": True,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Phase 13 PTW & SIMOPS demo data seeded: contractor linkages, weather checks, and SIMOPS conflict radar matrix."
            )
        )

        # ==========================================
        # Phase 14: Environmental Management & Occupational Hygiene
        # ==========================================
        # 1. Environmental Thresholds
        th_cod, _ = EnvironmentalThreshold.objects.update_or_create(
            organization=org_foolad,
            category=EnvironmentalThreshold.Category.WASTEWATER,
            parameter="COD",
            defaults={
                "name": "حداکثر مجاز COD پساب صنعتی خروجی",
                "limit_type": EnvironmentalThreshold.LimitType.MAX_LIMIT,
                "limit_value": 100.00,
                "unit": "mg/L",
                "standard_reference": "استاندارد خروجی فاضلاب سازمان حفاظت محیط زیست",
                "is_active": True,
                "is_synthetic": True,
            },
        )

        th_ph, _ = EnvironmentalThreshold.objects.update_or_create(
            organization=org_foolad,
            category=EnvironmentalThreshold.Category.WASTEWATER,
            parameter="PH",
            defaults={
                "name": "دامنه مجاز pH پساب صنعتی",
                "limit_type": EnvironmentalThreshold.LimitType.RANGE,
                "min_value": 6.50,
                "limit_value": 8.50,
                "unit": "pH",
                "standard_reference": "استاندارد خروجی فاضلاب سازمان حفاظت محیط زیست",
                "is_active": True,
                "is_synthetic": True,
            },
        )

        th_noise, _ = EnvironmentalThreshold.objects.update_or_create(
            organization=org_foolad,
            category=EnvironmentalThreshold.Category.NOISE,
            parameter="NOISE_DBA",
            defaults={
                "name": "حد مجاز صوت مواجهه ۸ ساعته شغلی",
                "limit_type": EnvironmentalThreshold.LimitType.MAX_LIMIT,
                "limit_value": 85.00,
                "unit": "dBA",
                "standard_reference": "حدود مجاز مواجهه شغلی (OEL) وزارت بهداشت",
                "is_active": True,
                "is_synthetic": True,
            },
        )

        th_wbgt, _ = EnvironmentalThreshold.objects.update_or_create(
            organization=org_foolad,
            category=EnvironmentalThreshold.Category.HEAT_STRESS,
            parameter="WBGT_C",
            defaults={
                "name": "حد مجاز استرس حرارتی مشاغل سنگین",
                "limit_type": EnvironmentalThreshold.LimitType.MAX_LIMIT,
                "limit_value": 28.00,
                "unit": "°C WBGT",
                "standard_reference": "حدود مواجهه شغلی با عوامل گرمازا (OEL)",
                "is_active": True,
                "is_synthetic": True,
            },
        )

        # 2. Environmental Aspects (ISO 14001)
        asp1, _ = EnvironmentalAspect.objects.update_or_create(
            organization=org_foolad,
            workplace=wp_roll,
            activity_or_process="ذوب ضایعات در کوره قوس الکتریکی",
            aspect="انتشار غبار فلزی و گازهای مونوکسید کربن و SO2",
            defaults={
                "impact": "آلودگی هوای اتمسفر و آسیب به سیستم تنفسی پرسنل و ساکنان مجاور",
                "condition": EnvironmentalAspect.Condition.NORMAL,
                "severity_score": 4,
                "probability_score": 4,
                "control_measures": "نصب غبارگیرهای بگ‌هاوس و فیلتراسیون با پایش مداوم افت فشار بگ‌ها",
                "is_synthetic": True,
            },
        )

        asp2, _ = EnvironmentalAspect.objects.update_or_create(
            organization=org_foolad,
            workplace=wp_roll,
            activity_or_process="خنک‌کاری غلتک‌های خط نورد با آب صنعتی",
            aspect="تولید پساب صنعتی حاوی روغن هیدرولیک و ذرات پوسته اکسیدی",
            defaults={
                "impact": "آلودگی منابع آب سطحی، خاک و ایجاد لجن‌های هیدروکربنی",
                "condition": EnvironmentalAspect.Condition.NORMAL,
                "severity_score": 4,
                "probability_score": 3,
                "control_measures": "انتقال پساب به حوضچه اسکیمر روغن و ته‌نشینی لجن و سپس بازچرخانی ۹۰ درصدی آب",
                "is_synthetic": True,
            },
        )

        asp3, _ = EnvironmentalAspect.objects.update_or_create(
            organization=org_foolad,
            workplace=wp_cast,
            activity_or_process="تخلیه سرباره داغ از پاتیل مذاب ریخته‌گری",
            aspect="ریزش ناگهانی و انفجار سرباره در مجاورت رطوبت",
            defaults={
                "impact": "آتش‌سوزی گسترده صنعتی و پرتاب ترکش‌های مذاب در محیط کارخانه",
                "condition": EnvironmentalAspect.Condition.EMERGENCY,
                "severity_score": 5,
                "probability_score": 2,
                "control_measures": "بازرسی خشک بودن کامل چاله سرباره و ممنوعیت تردد افراد غیرمجاز حین پاتیل‌ریزی",
                "is_synthetic": True,
            },
        )

        asp4, _ = EnvironmentalAspect.objects.update_or_create(
            organization=org_foolad,
            workplace=wp_roll,
            activity_or_process="بسته‌بندی بندیل‌های میلگرد و تسمه",
            aspect="تولید ضایعات تسمه فولادی و پالت‌های چوبی شکسته",
            defaults={
                "impact": "انباشت ضایعات جامد غیرخطرناک و اشغال فضای سایت",
                "condition": EnvironmentalAspect.Condition.NORMAL,
                "severity_score": 1,
                "probability_score": 3,
                "control_measures": "تفکیک در مبدأ و فروش به کارگاه‌های بازیافت چوب و ذوب مجدد تسمه‌ها",
                "is_synthetic": True,
            },
        )

        # 3. Waste Records
        WasteRecord.objects.update_or_create(
            organization=org_foolad,
            workplace=wp_roll,
            waste_name="روغن سوخته هیدرولیک ISO VG 68",
            defaults={
                "waste_type": WasteRecord.WasteType.HAZARDOUS,
                "quantity": 650.00,
                "unit": WasteRecord.Unit.LITER,
                "storage_location": "انبار مسقف پسماندهای ویژه سوله ۴",
                "generation_date": today - timedelta(days=8),
                "status": WasteRecord.Status.STORED,
                "notes": "نگهداری در بشکه‌های ۲۲۰ لیتری فلزی بر روی پالت مقاوم به نشت و دارای حوضچه مهار.",
                "is_synthetic": True,
            },
        )

        WasteRecord.objects.update_or_create(
            organization=org_foolad,
            workplace=wp_roll,
            waste_name="لجن‌های آلوده به هیدروکربن‌های نفتی",
            defaults={
                "waste_type": WasteRecord.WasteType.HAZARDOUS,
                "quantity": 2.40,
                "unit": WasteRecord.Unit.TON,
                "storage_location": "محوطه حوضچه آرامش تصفیه پساب",
                "generation_date": today - timedelta(days=20),
                "status": WasteRecord.Status.DISPOSED,
                "consignment_number": "MAN-1405-098",
                "contractor": cont_paydar,
                "disposal_facility": "مجتمع مدیریت و امحاء پسماندهای ویژه کویر",
                "disposal_method": "سوزاندن در کوره زباله‌سوز دوار حرارت بالا با فیلتراسیون گاز خروجی",
                "disposal_date": today - timedelta(days=5),
                "notes": "حمل ایمن با کامیون دارای پلاک حمل مواد خطرناک و برگه اطلاعات ایمنی مواد (MSDS).",
                "is_synthetic": True,
            },
        )

        WasteRecord.objects.update_or_create(
            organization=org_foolad,
            workplace=wp_cast,
            waste_name="سرباره خنک‌شده کوره قوس الکتریکی",
            defaults={
                "waste_type": WasteRecord.WasteType.NON_HAZARDOUS,
                "quantity": 18.50,
                "unit": WasteRecord.Unit.TON,
                "storage_location": "دپوی روباز سرباره ضلع غربی کارخانه",
                "generation_date": today - timedelta(days=3),
                "status": WasteRecord.Status.TRANSFERRED,
                "consignment_number": "MAN-1405-112",
                "notes": "انتقال به کارخانه سیمان جهت استفاده به عنوان پوزولان و مصالح زیرسازی جاده.",
                "is_synthetic": True,
            },
        )

        # 4. Wastewater & Emissions (with automated exceedance NonConformity creation)
        evaluate_and_record_wastewater_emission(
            organization=org_foolad,
            workplace=wp_roll,
            sampling_point="حوضچه خروجی تصفیه‌خانه بیولوژیکی",
            category=WastewaterEmissionRecord.Category.WASTEWATER,
            sample_date=today - timedelta(days=4),
            parameter="PH",
            measured_value=7.35,
            unit="pH",
            threshold=th_ph,
            laboratory_name="آزمایشگاه معتمد محیط زیست آب آزما البرز",
            test_report_number="LAB-REP-1405-412",
            notes="کیفیت خروجی پساب از نظر اسیدیته کاملاً در محدوده استاندارد تخلیه به آب‌های سطحی است.",
            actor=hse_mgr_user,
            auto_create_nonconformity=True,
            is_synthetic=True,
        )

        evaluate_and_record_wastewater_emission(
            organization=org_foolad,
            workplace=wp_roll,
            sampling_point="کانال سرریز حوضچه اسکیمر نورد",
            category=WastewaterEmissionRecord.Category.WASTEWATER,
            sample_date=today - timedelta(days=2),
            parameter="COD",
            measured_value=178.50,  # Exceeds 100 mg/L limit
            unit="mg/L",
            threshold=th_cod,
            laboratory_name="آزمایشگاه معتمد محیط زیست آب آزما البرز",
            test_report_number="LAB-REP-1405-498",
            notes="تخطی از حد استاندارد به علت خرابی اسکیمر مکانیکی چربی‌گیر لاین خنک‌کننده.",
            actor=hse_mgr_user,
            auto_create_nonconformity=True,
            is_synthetic=True,
        )

        # 5. Occupational Hygiene Surveys
        evaluate_and_record_hygiene_survey(
            organization=org_foolad,
            workplace=wp_roll,
            category=OccupationalHygieneRecord.Category.LIGHTING,
            location_details="کابین کنترل مرکزی خط نورد",
            survey_date=today - timedelta(days=10),
            surveyor_name="مهندس کاظمی (کارشناس بهداشت حرفه‌ای)",
            measured_value=480.00,
            unit="Lux",
            control_recommendation="شدت روشنایی موضعی و عمومی با استاندارد ۵۰۰ لوکس اتاق کنترل تطابق دارد.",
            actor=hse_mgr_user,
            auto_create_nonconformity=True,
            is_synthetic=True,
        )

        evaluate_and_record_hygiene_survey(
            organization=org_foolad,
            workplace=wp_roll,
            category=OccupationalHygieneRecord.Category.NOISE,
            location_details="کارگاه تراش غلتک‌ها",
            survey_date=today - timedelta(days=7),
            surveyor_name="مهندس کاظمی (کارشناس بهداشت حرفه‌ای)",
            measured_value=81.20,
            unit="dBA",
            threshold=th_noise,
            control_recommendation="میزان تراز صوتی در محدوده هشدار (بالای ۸۰ دسی‌بل)؛ پایش ادواری ۳ ماهه الزامی است.",
            actor=hse_mgr_user,
            auto_create_nonconformity=True,
            is_synthetic=True,
        )

        evaluate_and_record_hygiene_survey(
            organization=org_foolad,
            workplace=wp_roll,
            category=OccupationalHygieneRecord.Category.NOISE,
            location_details="سکوی اپراتوری استند شماره ۳ نورد مقاطع سنگین",
            survey_date=today - timedelta(days=1),
            surveyor_name="مهندس کاظمی (کارشناس بهداشت حرفه‌ای)",
            measured_value=93.60,  # Exceeds 85 dBA
            unit="dBA",
            threshold=th_noise,
            control_recommendation="تجهیز اجباری اپراتورها به ایرماف با تضعیف SNR>=30dB، عایق‌کاری آکوستیک کابین و کاهش زمان شیفت در ایستگاه.",
            actor=hse_mgr_user,
            auto_create_nonconformity=True,
            is_synthetic=True,
        )

        evaluate_and_record_hygiene_survey(
            organization=org_foolad,
            workplace=wp_cast,
            category=OccupationalHygieneRecord.Category.HEAT_STRESS,
            location_details="سکوی تخلیه پاتیل مذاب ایستگاه ریخته‌گری",
            survey_date=today - timedelta(days=1),
            surveyor_name="مهندس کاظمی (کارشناس بهداشت حرفه‌ای)",
            measured_value=31.40,  # Exceeds 28.0 WBGT
            unit="°C WBGT",
            threshold=th_wbgt,
            control_recommendation="برقراری پروتکل کار در گرما: شیفت چرخشی ۲۵٪ کار و ۷۵٪ استراحت در اتاق خنک، توزیع شربت آبلیمو و پایش علائم دهیدراتاسیون.",
            actor=hse_mgr_user,
            auto_create_nonconformity=True,
            is_synthetic=True,
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Phase 14 Environmental & Occupational Hygiene demo data seeded: thresholds, aspects, hazardous waste, emission exceedances with CAPA, and hygiene surveys."
            )
        )

        # 15. Phase 15: Scaffold Tag Management & Specialized Inspections
        # -------------------------------------------------------------
        # 1. Green Tag Scaffold (SCF-CAST-001) - Modular System in Cast workshop, fully inspected and safe
        scf_green, _ = Scaffold.objects.update_or_create(
            organization=org_foolad,
            tag_number="SCF-CAST-001",
            defaults={
                "workplace": wp_cast,
                "scaffold_type": Scaffold.ScaffoldType.MODULAR_SYSTEM,
                "load_duty": Scaffold.LoadDuty.HEAVY_DUTY,
                "location_details": "تاج سوله ریخته‌گری، پای ستون شرقی جهت تعمیر ریل جرثقیل سقفی",
                "height_meters": 14.50,
                "length_meters": 12.00,
                "width_meters": 2.50,
                "contractor": cont_paydar,
                "erected_by": "تیم داربست‌بندی شرکت مهندسی پایدار سازه",
                "erection_date": today - timedelta(days=2),
                "intended_use": "دسترسی به ریل و روشنایی جرثقیل سقفی ۳۰ تنی",
                "tag_status": Scaffold.TagStatus.GREEN_SAFE,
                "current_tag_valid_until": timezone.now() + timedelta(days=5),
                "inspection_interval_days": 7,
                "last_inspection_date": today - timedelta(days=2),
                "next_inspection_due": today + timedelta(days=5),
                "is_synthetic": True,
            },
        )

        # Link Green Scaffold to Height Permit ptw2
        if ptw2 and ptw2.is_synthetic:
            ptw2.scaffold = scf_green
            ptw2.save(update_fields=["scaffold"])

        # Record valid inspection for scf_green
        record_scaffold_inspection(
            scaffold=scf_green,
            inspector_name="مهندس قاسمی (بازرس ارشد ایمنی)",
            result_tag=Scaffold.TagStatus.GREEN_SAFE,
            inspection_date=today - timedelta(days=2),
            validity_days=7,
            base_plates_ok=True,
            bracing_ok=True,
            guardrails_ok=True,
            toeboards_ok=True,
            planks_decking_ok=True,
            ties_anchors_ok=True,
            ladder_access_ok=True,
            findings="کلیه اجزای سازه‌ای و مهارها سالم و منطبق با استاندارد BS EN 12811 ارزیابی گردید.",
            restrictions_notes="",
            inspector=hse_mgr_user,
            is_synthetic=True,
        )

        # 2. Yellow Tag Scaffold (SCF-ROLL-002) - Tube & Coupler in Roll workshop, restricted access
        scf_yellow, _ = Scaffold.objects.update_or_create(
            organization=org_foolad,
            tag_number="SCF-ROLL-002",
            defaults={
                "workplace": wp_roll,
                "scaffold_type": Scaffold.ScaffoldType.TUBE_COUPLER,
                "load_duty": Scaffold.LoadDuty.MEDIUM_DUTY,
                "location_details": "دیواره خروجی کوره پیش‌گرم نورد مقاطع",
                "height_meters": 8.00,
                "length_meters": 6.00,
                "width_meters": 2.00,
                "contractor": cont_paydar,
                "erected_by": "اکبر حیدری (سرپرست داربست‌بندی)",
                "erection_date": today - timedelta(days=1),
                "intended_use": "عایق‌کاری جداره حرارتی کوره نورد",
                "tag_status": Scaffold.TagStatus.YELLOW_RESTRICTED,
                "current_tag_valid_until": timezone.now() + timedelta(days=6),
                "yellow_restrictions": "فقط نفرات داربست‌بند با هارنس متصل به لایف‌لاین مستقل مجاز به کار روی سکوی سوم هستند.",
                "inspection_interval_days": 7,
                "last_inspection_date": today - timedelta(days=1),
                "next_inspection_due": today + timedelta(days=6),
                "is_synthetic": True,
            },
        )

        record_scaffold_inspection(
            scaffold=scf_yellow,
            inspector_name="مهندس قاسمی (بازرس ارشد ایمنی)",
            result_tag=Scaffold.TagStatus.YELLOW_RESTRICTED,
            inspection_date=today - timedelta(days=1),
            validity_days=7,
            base_plates_ok=True,
            bracing_ok=True,
            guardrails_ok=True,
            toeboards_ok=True,
            planks_decking_ok=True,
            ties_anchors_ok=True,
            ladder_access_ok=True,
            findings="برپایی سکوی سوم نیمه‌کاره است؛ تگ زرد الصاق و تردد محدود گردید.",
            restrictions_notes="فقط نفرات داربست‌بند با هارنس متصل به لایف‌لاین مستقل مجاز به کار روی سکوی سوم هستند.",
            inspector=hse_mgr_user,
            is_synthetic=True,
        )

        # 3. Red Tag Scaffold (SCF-ROLL-003) - Mobile Tower in Roll workshop, unsafe with failed checks & overdue
        scf_red, _ = Scaffold.objects.update_or_create(
            organization=org_foolad,
            tag_number="SCF-ROLL-003",
            defaults={
                "workplace": wp_roll,
                "scaffold_type": Scaffold.ScaffoldType.MOBILE_TOWER,
                "load_duty": Scaffold.LoadDuty.LIGHT_DUTY,
                "location_details": "انبار ضایعات و قطعات یدکی نورد سنگین",
                "height_meters": 6.20,
                "length_meters": 3.00,
                "width_meters": 3.00,
                "contractor": None,
                "erected_by": "واحد تأسیسات داخلی کارخانه",
                "erection_date": today - timedelta(days=20),
                "intended_use": "رنگ‌آمیزی ستون‌ها و دریچه‌های هوارسان",
                "tag_status": Scaffold.TagStatus.RED_UNSAFE,
                "current_tag_valid_until": None,
                "yellow_restrictions": "",
                "inspection_interval_days": 7,
                "last_inspection_date": today - timedelta(days=14),
                "next_inspection_due": today - timedelta(days=7),  # Overdue by 7 days
                "is_synthetic": True,
            },
        )

        record_scaffold_inspection(
            scaffold=scf_red,
            inspector_name="مهندس قاسمی (بازرس ارشد ایمنی)",
            result_tag=Scaffold.TagStatus.RED_UNSAFE,
            inspection_date=today - timedelta(days=14),
            validity_days=7,
            base_plates_ok=True,
            bracing_ok=False,  # Failed check
            guardrails_ok=False,  # Failed check
            toeboards_ok=False,  # Failed check
            planks_decking_ok=True,
            ties_anchors_ok=True,
            ladder_access_ok=True,
            findings="عدم نصب تخته پاخور، شل بودن بادبندهای قطری و فقدان لوله حفاظ میانی در ارتفاع ۶ متری. تگ قرمز الصاق و کارگاه مسدود شد.",
            restrictions_notes="",
            inspector=hse_mgr_user,
            is_synthetic=True,
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Phase 15 Scaffold Tag Management demo data seeded: 3-tag lifecycle (green safe, yellow restricted, red unsafe), 7-point inspections, tag logs, and PTW height linkage."
            )
        )

        # ==========================================
        # Phase 16: HSE Document Control, Versioning & Secure Archive
        # ==========================================
        self.stdout.write(self.style.NOTICE("Seeding Phase 16: HSE Document Control, Versioning & Secure Archive..."))

        # Helper to create/get sample file content
        def sample_pdf_content(title_text, version_label):
            return ContentFile(
                f"%PDF-1.4 HSE GUARD CONTROLLED DOCUMENT\nDocument: {title_text}\nVersion: {version_label}\nSecurity: Tamper-Evident SHA-256\n".encode("utf-8"),
                name=f"{version_label}.pdf",
            )

        # 1. Approved Effective Procedure with Multiple Revisions (DOC-SOP-HSE-001)
        doc_height, _ = Document.objects.update_or_create(
            organization=org_foolad,
            document_number="DOC-SOP-HSE-001",
            defaults={
                "title": "دستورالعمل جامع ایمنی کار در ارتفاع و پیشگیری از سقوط",
                "description": "پروتکل اجرایی الزامات کار در ارتفاع بالای ۱.۸ متر، استفاده از هارنس، لایف‌لاین، بازرسی تگ داربست و سامانه توقف سقوط.",
                "category": DocumentCategory.PROCEDURE,
                "confidentiality": ConfidentialityLevel.INTERNAL,
                "status": DocumentStatus.EFFECTIVE,
                "department": "واحد ایمنی و حفاظت فنی",
                "workplace": wp_roll,
                "owner": hse_mgr_user,
                "author": inspector_user,
                "assigned_reviewer": hse_mgr_user,
                "effective_date": today - timedelta(days=15),
                "next_review_date": today + timedelta(days=350),
                "expiry_date": today + timedelta(days=715),
                "retention_years": 7,
                "tags": "ارتفاع, داربست, هارنس, لایف‌لاین, سقوط",
                "requires_acknowledgment": True,
                "is_synthetic": True,
            },
        )

        # Revision 1.0 (Superseded)
        v1_height, _ = DocumentVersion.objects.update_or_create(
            document=doc_height,
            version_number="1.0",
            defaults={
                "file": sample_pdf_content("کار در ارتفاع", "v1.0"),
                "original_filename": "SOP_Work_At_Height_v1.0.pdf",
                "file_size_bytes": 1024 * 125,
                "file_hash_sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
                "mime_type": "application/pdf",
                "change_summary": "تدوین اولیه دستورالعمل طبق آیین‌نامه ایمنی کار در ارتفاع وزارت تعاون، کار و رفاه اجتماعی",
                "uploaded_by": inspector_user,
                "status": VersionStatus.SUPERSEDED,
                "reviewed_by": hse_mgr_user,
                "reviewed_at": timezone.now() - timedelta(days=90),
                "review_notes": "نگارش اولیه تصویب شد.",
                "is_synthetic": True,
            },
        )

        # Revision 2.0 (Approved, Current Effective)
        v2_height, _ = DocumentVersion.objects.update_or_create(
            document=doc_height,
            version_number="2.0",
            defaults={
                "file": sample_pdf_content("کار در ارتفاع", "v2.0"),
                "original_filename": "SOP_Work_At_Height_v2.0_Final.pdf",
                "file_size_bytes": 1024 * 240,
                "file_hash_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "mime_type": "application/pdf",
                "change_summary": "یکپارچه‌سازی فرآیند با سیستم بازرسی ۷ گانه تگ داربست (فاز ۱۵) و اعمال کنترل‌های صلاحیت نفرات مجاز داربست‌بندی",
                "uploaded_by": inspector_user,
                "status": VersionStatus.APPROVED,
                "reviewed_by": hse_mgr_user,
                "reviewed_at": timezone.now() - timedelta(days=15),
                "review_notes": "بازنگری با موفقیت انجام شد؛ بندهای بازرسی تگ داربست و الزام هارنس متصل به لایف‌لاین مستقل تأیید گردید.",
                "is_synthetic": True,
            },
        )
        if doc_height.current_version != v2_height:
            doc_height.current_version = v2_height
            doc_height.save(update_fields=["current_version"])

        # Review Logs for doc_height
        DocumentReviewLog.objects.get_or_create(
            document=doc_height,
            version=v1_height,
            action=DocumentReviewLog.Action.APPROVED,
            defaults={"reviewer": hse_mgr_user, "decision_reason": "تصویب نگارش ۱.۰ اولیه"},
        )
        DocumentReviewLog.objects.get_or_create(
            document=doc_height,
            version=v1_height,
            action=DocumentReviewLog.Action.SUPERSEDED,
            defaults={"reviewer": hse_mgr_user, "decision_reason": "جایگزین‌شده با نگارش جدید ۲.۰"},
        )
        DocumentReviewLog.objects.get_or_create(
            document=doc_height,
            version=v2_height,
            action=DocumentReviewLog.Action.APPROVED,
            defaults={"reviewer": hse_mgr_user, "decision_reason": "تصویب و ابلاغ نگارش ۲.۰"},
        )

        # 2. Draft Awaiting Review (DOC-WI-CS-004)
        doc_cs, _ = Document.objects.update_or_create(
            organization=org_foolad,
            document_number="DOC-WI-CS-004",
            defaults={
                "title": "دستورالعمل فنی ورود به فضاهای بسته و مخازن فرآیندی (Confined Space)",
                "description": "چک‌لیست اتمسفر سنجی اکسیژن/گازهای قابل اشتعال، قفل و نشانه‌گذاری (LOTO) و الزام نفر مراقب بیرونی (Standby Person).",
                "category": DocumentCategory.WORK_INSTRUCTION,
                "confidentiality": ConfidentialityLevel.INTERNAL,
                "status": DocumentStatus.UNDER_REVIEW,
                "department": "بهره‌برداری کوره و تأسیسات گاز",
                "workplace": wp_cast,
                "owner": supervisor_user,
                "author": supervisor_user,
                "assigned_reviewer": hse_mgr_user,
                "retention_years": 5,
                "tags": "فضای بسته, مخزن, اکسیژن, گازسنجی, LOTO",
                "requires_acknowledgment": True,
                "is_synthetic": True,
            },
        )
        v1_cs, _ = DocumentVersion.objects.update_or_create(
            document=doc_cs,
            version_number="1.0",
            defaults={
                "file": sample_pdf_content("ورود به فضای بسته", "v1.0"),
                "original_filename": "WI_Confined_Space_Entry_Draft.pdf",
                "file_size_bytes": 1024 * 180,
                "file_hash_sha256": "8a35626a54041b3dfaef3d2efad7c5055b85a363db761005a3089d81d45145b2",
                "mime_type": "application/pdf",
                "change_summary": "پیش‌نویس اولیه ارسالی جهت ممیزی مدیر ایمنی و اعمال ملاحظات دستگاه‌های گازسنج پرتابل ۴ گازه",
                "uploaded_by": supervisor_user,
                "status": VersionStatus.UNDER_REVIEW,
                "is_synthetic": True,
            },
        )
        if doc_cs.current_version != v1_cs:
            doc_cs.current_version = v1_cs
            doc_cs.save(update_fields=["current_version"])

        DocumentReviewLog.objects.get_or_create(
            document=doc_cs,
            version=v1_cs,
            action=DocumentReviewLog.Action.SUBMITTED,
            defaults={"reviewer": supervisor_user, "decision_reason": "ارسال اولیه جهت بررسی و ابلاغ سازمانی"},
        )

        # 3. Rejected Document with Review Reason (DOC-SOP-HOT-002)
        doc_hot, _ = Document.objects.update_or_create(
            organization=org_foolad,
            document_number="DOC-SOP-HOT-002",
            defaults={
                "title": "دستورالعمل ایمنی عملیات گرم، جوشکاری و برش‌کاری در مجاورت مواد اشتعال‌پذیر",
                "description": "الزامات ایمنی پروانه کار گرم، فاصله ایمنی ۱۱ متری و تجهیزات اطفاء حریق پشتیبان.",
                "category": DocumentCategory.PROCEDURE,
                "confidentiality": ConfidentialityLevel.INTERNAL,
                "status": DocumentStatus.REJECTED,
                "department": "تعمیرات مکانیک و نورد",
                "workplace": wp_roll,
                "owner": supervisor_user,
                "author": supervisor_user,
                "assigned_reviewer": hse_mgr_user,
                "retention_years": 5,
                "tags": "جوشکاری, برشکاری, حریق, کار گرم, اطفاء",
                "requires_acknowledgment": False,
                "is_synthetic": True,
            },
        )
        v1_hot, _ = DocumentVersion.objects.update_or_create(
            document=doc_hot,
            version_number="1.0",
            defaults={
                "file": sample_pdf_content("کار گرم و برشکاری", "v1.0"),
                "original_filename": "SOP_Hot_Work_Safety_Draft.pdf",
                "file_size_bytes": 1024 * 95,
                "file_hash_sha256": "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
                "mime_type": "application/pdf",
                "change_summary": "تدوین اولیه روش اجرایی کار گرم",
                "uploaded_by": supervisor_user,
                "status": VersionStatus.REJECTED,
                "reviewed_by": hse_mgr_user,
                "reviewed_at": timezone.now() - timedelta(days=2),
                "review_notes": "ماتریس ارزیابی فاصله ایمنی از مخازن گاز هیدروژن و فرم پایش مستمر دیده‌بان آتش (Fire Watch) تکمیل نشده است؛ لطفاً پس از افزودن چک‌لیست مجدداً ارسال فرمایید.",
                "is_synthetic": True,
            },
        )
        if doc_hot.current_version != v1_hot:
            doc_hot.current_version = v1_hot
            doc_hot.save(update_fields=["current_version"])

        DocumentReviewLog.objects.get_or_create(
            document=doc_hot,
            version=v1_hot,
            action=DocumentReviewLog.Action.REJECTED,
            defaults={
                "reviewer": hse_mgr_user,
                "decision_reason": "ماتریس ارزیابی فاصله ایمنی از مخازن گاز هیدروژن و فرم پایش مستمر دیده‌بان آتش (Fire Watch) تکمیل نشده است.",
            },
        )

        # 4. Expiring Certificate (DOC-CERT-ISO-45001) - Expiring in 12 days
        doc_iso, _ = Document.objects.update_or_create(
            organization=org_foolad,
            document_number="DOC-CERT-ISO-45001",
            defaults={
                "title": "گواهینامه بین‌المللی سیستم مدیریت ایمنی و بهداشت حرفه‌ای ISO 45001:2018",
                "description": "گواهینامه تمدید سالانه استقرار الزامات بین‌المللی OHSAS صادر شده توسط مرجع معتبر توف نورد (TÜV NORD).",
                "category": DocumentCategory.CERTIFICATE,
                "confidentiality": ConfidentialityLevel.INTERNAL,
                "status": DocumentStatus.EFFECTIVE,
                "department": "مدیریت تضمین کیفیت و HSE کل",
                "owner": hse_mgr_user,
                "author": hse_mgr_user,
                "assigned_reviewer": hse_mgr_user,
                "effective_date": today - timedelta(days=353),
                "next_review_date": today + timedelta(days=10),
                "expiry_date": today + timedelta(days=12),  # Expiring soon!
                "retention_years": 10,
                "tags": "ISO45001, استاندارد, گواهینامه, توف, ممیزی",
                "requires_acknowledgment": False,
                "is_synthetic": True,
            },
        )
        v1_iso, _ = DocumentVersion.objects.update_or_create(
            document=doc_iso,
            version_number="1.0",
            defaults={
                "file": sample_pdf_content("گواهینامه ISO 45001", "v1.0"),
                "original_filename": "ISO_45001_Certificate_Alborz_Steel.pdf",
                "file_size_bytes": 1024 * 310,
                "file_hash_sha256": "4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce",
                "mime_type": "application/pdf",
                "change_summary": "ثبت گواهینامه صادره ممیزی خارجی دوره ۲۰۲۵-۲۰۲۶",
                "uploaded_by": hse_mgr_user,
                "status": VersionStatus.APPROVED,
                "reviewed_by": hse_mgr_user,
                "reviewed_at": timezone.now() - timedelta(days=353),
                "review_notes": "گواهینامه معتبر ثبت شد.",
                "is_synthetic": True,
            },
        )
        if doc_iso.current_version != v1_iso:
            doc_iso.current_version = v1_iso
            doc_iso.save(update_fields=["current_version"])

        # 5. Expired Environmental Record (DOC-CERT-ENV-2023) - Expired 20 days ago
        doc_env_exp, _ = Document.objects.update_or_create(
            organization=org_foolad,
            document_number="DOC-CERT-ENV-2023",
            defaults={
                "title": "تأییدیه دوره‌ای سنجش آلاینده‌های خروجی دودکش کوره نورد و غبارگیرها ۱۴۰۳",
                "description": "نتایج آنالیز آزمایشگاه معتمد سازمان حفاظت محیط زیست پیرامون غلظت ذرات معلق (PM) و گازهای SO2 و NOx خروجی.",
                "category": DocumentCategory.ENVIRONMENTAL_RECORD,
                "confidentiality": ConfidentialityLevel.INTERNAL,
                "status": DocumentStatus.EXPIRED,
                "department": "واحد بهداشت حرفه‌ای و محیط زیست",
                "workplace": wp_roll,
                "owner": hse_mgr_user,
                "author": inspector_user,
                "effective_date": today - timedelta(days=385),
                "next_review_date": today - timedelta(days=30),
                "expiry_date": today - timedelta(days=20),  # Expired
                "retention_years": 5,
                "tags": "محیط زیست, دودکش, ذرات معلق, آلایندگی, آزمایشگاه معتمد",
                "requires_acknowledgment": False,
                "is_synthetic": True,
            },
        )
        v1_env, _ = DocumentVersion.objects.update_or_create(
            document=doc_env_exp,
            version_number="1.0",
            defaults={
                "file": sample_pdf_content("تأییدیه محیط زیستی دودکش", "v1.0"),
                "original_filename": "Emission_Stack_Test_Report_1403.pdf",
                "file_size_bytes": 1024 * 145,
                "file_hash_sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
                "mime_type": "application/pdf",
                "change_summary": "گزارش سنجش سه ماهه چهارم ۱۴۰۳",
                "uploaded_by": inspector_user,
                "status": VersionStatus.APPROVED,
                "reviewed_by": hse_mgr_user,
                "reviewed_at": timezone.now() - timedelta(days=385),
                "is_synthetic": True,
            },
        )
        if doc_env_exp.current_version != v1_env:
            doc_env_exp.current_version = v1_env
            doc_env_exp.save(update_fields=["current_version"])

        # 6. Confidential Document with Restricted Access (DOC-CONF-INV-2026-09)
        doc_confidential, _ = Document.objects.update_or_create(
            organization=org_foolad,
            document_number="DOC-CONF-INV-2026-09",
            defaults={
                "title": "گزارش محرمانه تحلیل ریشه‌ای (RCA) و بازرسی حقوقی حادثه سقوط سرباره پاتیل",
                "description": "گزارش فنی و حقوقی ویژه هیئت‌مدیره؛ دربرگیرنده تحلیل خطای انسانی، شبیه‌سازی حرارتی و استعلامات شرکت بیمه.",
                "category": DocumentCategory.INSPECTION_AUDIT,
                "confidentiality": ConfidentialityLevel.STRICTLY_CONFIDENTIAL,
                "status": DocumentStatus.EFFECTIVE,
                "department": "کمیته عالی سوانح و حوادث صنعتی",
                "workplace": wp_cast,
                "owner": hse_mgr_user,
                "author": hse_mgr_user,
                "effective_date": today - timedelta(days=10),
                "retention_years": 15,
                "tags": "محرمانه, حقوقی, RCA, بیمه, پاتیل, سرباره",
                "requires_acknowledgment": False,
                "is_synthetic": True,
            },
        )
        v1_conf, _ = DocumentVersion.objects.update_or_create(
            document=doc_confidential,
            version_number="1.0",
            defaults={
                "file": sample_pdf_content("گزارش محرمانه حادثه", "v1.0"),
                "original_filename": "Confidential_RCA_Incident_Report_Slag_Drop.pdf",
                "file_size_bytes": 1024 * 450,
                "file_hash_sha256": "ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d",
                "mime_type": "application/pdf",
                "change_summary": "نسخه نهایی گزارش محرمانه تحلیل حادثه پس از استماع اظهارات اپراتورها",
                "uploaded_by": hse_mgr_user,
                "status": VersionStatus.APPROVED,
                "reviewed_by": hse_mgr_user,
                "reviewed_at": timezone.now() - timedelta(days=10),
                "review_notes": "تأییدیه هیئت بررسی سوانح",
                "is_synthetic": True,
            },
        )
        if doc_confidential.current_version != v1_conf:
            doc_confidential.current_version = v1_conf
            doc_confidential.save(update_fields=["current_version"])

        # 7. Document Requiring Employee Acknowledgment (DOC-ERP-PLAN-001)
        doc_erp, _ = Document.objects.update_or_create(
            organization=org_foolad,
            document_number="DOC-ERP-PLAN-001",
            defaults={
                "title": "طرح جامع واکنش در شرایط اضطراری، حریق و تخلیه اضطراری سایت (ERP)",
                "description": "دستورالعمل موقعیت نقاط تجمع امن (Muster Points)، فرکانس رادیویی تیم‌های امداد و نجات و وظایف سرپرستان کارگاه هنگام آژیر خطر.",
                "category": DocumentCategory.POLICY,
                "confidentiality": ConfidentialityLevel.INTERNAL,
                "status": DocumentStatus.EFFECTIVE,
                "department": "مدیریت بحران و پدافند غیرعامل",
                "owner": hse_mgr_user,
                "author": hse_mgr_user,
                "effective_date": today - timedelta(days=60),
                "next_review_date": today + timedelta(days=300),
                "retention_years": 10,
                "tags": "ERP, بحران, تخلیه, آژیر, حریق, نقطه تجمع",
                "requires_acknowledgment": True,
                "is_synthetic": True,
            },
        )
        v1_erp, _ = DocumentVersion.objects.update_or_create(
            document=doc_erp,
            version_number="1.0",
            defaults={
                "file": sample_pdf_content("طرح واکنش اضطراری ERP", "v1.0"),
                "original_filename": "Emergency_Response_Plan_ERP_Alborz.pdf",
                "file_size_bytes": 1024 * 512,
                "file_hash_sha256": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
                "mime_type": "application/pdf",
                "change_summary": "ابلاغ سراسری طرح واکنش در شرایط اضطراری ویرایش ۱۴۰۵",
                "uploaded_by": hse_mgr_user,
                "status": VersionStatus.APPROVED,
                "reviewed_by": hse_mgr_user,
                "reviewed_at": timezone.now() - timedelta(days=60),
                "is_synthetic": True,
            },
        )
        if doc_erp.current_version != v1_erp:
            doc_erp.current_version = v1_erp
            doc_erp.save(update_fields=["current_version"])

        # Employee Acknowledgments (Read receipts)
        DocumentAcknowledgment.objects.get_or_create(
            document=doc_erp,
            version=v1_erp,
            user=supervisor_user,
            defaults={
                "signature_note": "کلیه مسیرهای فرار کارگاه نورد و موقعیت جعبه‌های F بازبینی شد و پرسنل توجیه شدند.",
                "is_synthetic": True,
            },
        )
        DocumentAcknowledgment.objects.get_or_create(
            document=doc_erp,
            version=v1_erp,
            user=inspector_user,
            defaults={
                "signature_note": "فایل را مطالعه کردم و آموزش سناریوهای پناه‌گیری به تکنسین‌ها داده شد.",
                "is_synthetic": True,
            },
        )

        # 8. Archived Document and Complete Revision History (DOC-LEGACY-WASTE-2019)
        doc_archived, _ = Document.objects.update_or_create(
            organization=org_foolad,
            document_number="DOC-LEGACY-WASTE-2019",
            defaults={
                "title": "آیین‌نامه مدیریت پسماندهای ویژه و بازیافت ضایعات فلزی (نسخه قدیم ۱۳۹۸)",
                "description": "دستورالعمل قدیمی تفکیک قراضه و براده‌های روغنی پیش از راه‌اندازی خط تصفیه پساب صنعتی مدرن.",
                "category": DocumentCategory.ENVIRONMENTAL_RECORD,
                "confidentiality": ConfidentialityLevel.INTERNAL,
                "status": DocumentStatus.ARCHIVED,
                "department": "مدیریت خدمات عمومی و پسماند",
                "workplace": wp_roll,
                "owner": hse_mgr_user,
                "author": inspector_user,
                "archived_at": timezone.now() - timedelta(days=45),
                "archived_reason": "منسوخ‌شدن فرم‌های دستی و جایگزینی با سیستم دیجیتال پسماند فاز ۱۴؛ اتمام دوره راکد نگهداری ۵ ساله سازمانی.",
                "archived_by": hse_mgr_user,
                "retention_years": 5,
                "tags": "پسماند, ضایعات, بازیافت, قدیمی, بایگانی",
                "requires_acknowledgment": False,
                "is_synthetic": True,
            },
        )
        v1_arch, _ = DocumentVersion.objects.update_or_create(
            document=doc_archived,
            version_number="1.0",
            defaults={
                "file": sample_pdf_content("آیین‌نامه قدیمی پسماند", "v1.0"),
                "original_filename": "Legacy_Waste_Management_1398.pdf",
                "file_size_bytes": 1024 * 85,
                "file_hash_sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                "mime_type": "application/pdf",
                "change_summary": "نسخه مصوب سال ۱۳۹۸",
                "uploaded_by": inspector_user,
                "status": VersionStatus.ARCHIVED,
                "is_synthetic": True,
            },
        )
        if doc_archived.current_version != v1_arch:
            doc_archived.current_version = v1_arch
            doc_archived.save(update_fields=["current_version"])

        DocumentReviewLog.objects.get_or_create(
            document=doc_archived,
            version=v1_arch,
            action=DocumentReviewLog.Action.ARCHIVED,
            defaults={
                "reviewer": hse_mgr_user,
                "decision_reason": "بایگانی بر اساس استقرار فاز ۱۴ مدیریت زیست‌محیطی",
            },
        )

        # 9. Cross-Organization Tenant Isolation Document (in org_petro)
        doc_petro, _ = Document.objects.update_or_create(
            organization=org_petro,
            document_number="PETRO-SOP-POLY-01",
            defaults={
                "title": "دستورالعمل ایمنی فرآیندی واحد پلیمریزاسیون پتروشیمی سپهر",
                "description": "پروتکل اختصاصی نظارت بر فشار رآکتور، سیستم مهار اضطراری شعله (Flare) و شستشوی خطوط منومر.",
                "category": DocumentCategory.PROCEDURE,
                "confidentiality": ConfidentialityLevel.INTERNAL,
                "status": DocumentStatus.EFFECTIVE,
                "department": "مهندسی فرآیند پتروشیمی",
                "owner": petro_supervisor_user,
                "author": petro_supervisor_user,
                "effective_date": today - timedelta(days=40),
                "next_review_date": today + timedelta(days=320),
                "retention_years": 8,
                "tags": "پتروشیمی, پلیمریزاسیون, فلر, فرآیند, منومر",
                "requires_acknowledgment": True,
                "is_synthetic": True,
            },
        )
        v1_petro, _ = DocumentVersion.objects.update_or_create(
            document=doc_petro,
            version_number="1.0",
            defaults={
                "file": sample_pdf_content("پلیمریزاسیون پتروشیمی", "v1.0"),
                "original_filename": "Petro_Polymerization_Safety_v1.0.pdf",
                "file_size_bytes": 1024 * 380,
                "file_hash_sha256": "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
                "mime_type": "application/pdf",
                "change_summary": "تدوین اولیه دستورالعمل پلیمریزاسیون سپهر",
                "uploaded_by": petro_supervisor_user,
                "status": VersionStatus.APPROVED,
                "is_synthetic": True,
            },
        )
        if doc_petro.current_version != v1_petro:
            doc_petro.current_version = v1_petro
            doc_petro.save(update_fields=["current_version"])

        # 10. Cross-Domain Links: Link Height SOP to Scaffold and PTW
        DocumentLink.objects.get_or_create(
            document=doc_height,
            target_type=DocumentLink.TargetType.SCAFFOLD,
            target_id=1,
            defaults={"link_title": "الزام بازرسی تگ داربست", "link_note": "بند ۴.۲ دستورالعمل کار در ارتفاع"},
        )
        DocumentLink.objects.get_or_create(
            document=doc_height,
            target_type=DocumentLink.TargetType.PERMIT,
            target_id=1,
            defaults={"link_title": "مجوز کار در ارتفاع", "link_note": "پیوست الزامی پروانه کار گرم"},
        )

        # =========================================================================
        # PHASE 17 SEEDING: COMPLETE PLATFORM FINALIZATION & MISSING MODULES
        # =========================================================================
        self.stdout.write("Seeding Phase 17 modules (Subscriptions, Calculators, Lifting, PSSR, Surveys, Chat, Fleet & Energy)...")

        # 1. Subscriptions & Module Entitlements
        plan_free, _ = SubscriptionPlan.objects.update_or_create(
            code="free",
            defaults={
                "name": "طرح پایه رایگان",
                "price_monthly_irr": 0,
                "max_users": 10,
                "max_workplaces": 2,
                "included_modules": [],
                "is_active": True,
            },
        )
        plan_pro, _ = SubscriptionPlan.objects.update_or_create(
            code="pro",
            defaults={
                "name": "طرح حرفه‌ای صنعتی",
                "price_monthly_irr": 15000000,
                "max_users": 50,
                "max_workplaces": 10,
                "included_modules": [
                    "lifting_plans",
                    "pssr",
                    "surveys",
                    "chat",
                    "fleet_energy",
                    "anomalies",
                    "indicators",
                ],
                "is_active": True,
            },
        )
        plan_ent, _ = SubscriptionPlan.objects.update_or_create(
            code="enterprise",
            defaults={
                "name": "طرح جامع پیشرفته پتروشیمی و فولاد",
                "price_monthly_irr": 35000000,
                "max_users": 200,
                "max_workplaces": 50,
                "included_modules": list(ModuleEntitlement.COMMERCIAL_MODULES.keys()),
                "is_active": True,
            },
        )

        sub_foolad, _ = OrganizationSubscription.objects.update_or_create(
            organization=org_foolad,
            defaults={
                "plan": plan_pro,
                "status": OrganizationSubscription.Status.ACTIVE,
                "valid_from": timezone.now().date() - timedelta(days=30),
                "valid_until": timezone.now().date() + timedelta(days=335),
            },
        )

        for mod_code in ModuleEntitlement.COMMERCIAL_MODULES:
            ModuleEntitlement.objects.update_or_create(
                organization=org_foolad,
                module_code=mod_code,
                defaults={
                    "is_enabled": True,
                    "source": ModuleEntitlement.Source.PLAN,
                    "valid_until": timezone.now().date() + timedelta(days=335),
                },
            )

        # 2. Engineering Calculators Records
        CalculationRecord.objects.get_or_create(
            organization=org_foolad,
            calculator_type=CalculationRecord.CalculatorType.HSE_RATES,
            title="محاسبه نرخ شاخص‌های حوادث فصل بهار ۱۴۰۵",
            defaults={
                "user": hse_mgr_user,
                "input_params": {
                    "exposure_hours": 250000,
                    "lost_time_injuries": 1,
                    "total_recordable_incidents": 3,
                    "lost_days": 14,
                },
                "results": {
                    "ltifr": 4.0,
                    "trir": 12.0,
                    "severity_rate": 56.0,
                    "fsi": 0.473,
                },
                "notes": "گزارش ۳ ماهه نورد البرز جهت ارسال به اداره کار و امور اجتماعی",
                "is_synthetic": True,
            },
        )
        CalculationRecord.objects.get_or_create(
            organization=org_foolad,
            calculator_type=CalculationRecord.CalculatorType.RIGGING_CRANE,
            title="محاسبه کشش اسلینگ باربرداری شمش‌های ریخته‌گری",
            defaults={
                "user": supervisor_user,
                "input_params": {
                    "load_weight_kg": 12000,
                    "num_legs": 2,
                    "angle_to_horizontal_deg": 60,
                },
                "results": {
                    "tension_per_leg_kg": 6928.2,
                    "warning": None,
                },
                "notes": "استفاده از اسلینگ زنجیری گرید ۸۰ دوشاخه",
                "is_synthetic": True,
            },
        )
        CalculationRecord.objects.get_or_create(
            organization=org_foolad,
            calculator_type=CalculationRecord.CalculatorType.NOISE,
            title="ترکیب تراز فشار صوت ایستگاه سنگ‌زنی و برشکاری",
            defaults={
                "user": inspector_user,
                "input_params": {"sound_levels_dba": [85.0, 88.0, 82.0]},
                "results": {"combined_spl_dba": 90.35},
                "notes": "تراز بالاتر از حد مجاز ۸۵ دسی‌بل - الزام گوشی محافظ صوت",
                "is_synthetic": True,
            },
        )

        # 3. Lifting Plans & Crane Specifications
        crane_tadano, _ = CraneSpecification.objects.update_or_create(
            organization=org_foolad,
            model_name="Tadano GR-550XL (بوم ۵۵ تن)",
            defaults={
                "manufacturer": "Tadano",
                "max_capacity_tonnes": 55.0,
                "boom_length_min_m": 10.7,
                "boom_length_max_m": 42.0,
                "load_chart_data": [
                    {"boom_length_m": 16.0, "radius_m": 6.0, "capacity_kg": 28000.0},
                    {"boom_length_m": 16.0, "radius_m": 8.0, "capacity_kg": 22000.0},
                    {"boom_length_m": 16.0, "radius_m": 10.0, "capacity_kg": 17000.0},
                    {"boom_length_m": 24.0, "radius_m": 12.0, "capacity_kg": 12000.0},
                    {"boom_length_m": 24.0, "radius_m": 16.0, "capacity_kg": 8500.0},
                ],
                "is_active": True,
                "is_synthetic": True,
            },
        )
        crane_liebherr, _ = CraneSpecification.objects.update_or_create(
            organization=org_foolad,
            model_name="Liebherr LTM 1100-4.2 (بوم ۱۰۰ تن)",
            defaults={
                "manufacturer": "Liebherr",
                "max_capacity_tonnes": 100.0,
                "boom_length_min_m": 11.5,
                "boom_length_max_m": 60.0,
                "load_chart_data": [
                    {"boom_length_m": 22.0, "radius_m": 8.0, "capacity_kg": 45000.0},
                    {"boom_length_m": 22.0, "radius_m": 12.0, "capacity_kg": 32000.0},
                    {"boom_length_m": 30.0, "radius_m": 16.0, "capacity_kg": 20000.0},
                    {"boom_length_m": 38.0, "radius_m": 20.0, "capacity_kg": 14000.0},
                ],
                "is_active": True,
                "is_synthetic": True,
            },
        )

        lift_1, _ = LiftingPlan.objects.update_or_create(
            organization=org_foolad,
            plan_number="LP-2026-001",
            defaults={
                "workplace": wp_roll,
                "title": "باربرداری و استقرار مخزن روغن هیدرولیک نورد",
                "category": LiftingPlan.LiftCategory.STANDARD,
                "status": LiftingPlan.Status.APPROVED,
                "planned_date": timezone.now().date() + timedelta(days=2),
                "crane": crane_tadano,
                "boom_length_m": 16.0,
                "lift_radius_m": 8.0,
                "load_description": "مخزن هیدرولیک فشار قوی روغن دستگاه رولیک",
                "load_weight_kg": 10000.0,
                "rigging_hardware_weight_kg": 350.0,
                "hook_block_weight_kg": 450.0,
                "total_gross_weight_kg": 10800.0,
                "crane_capacity_at_radius_kg": 22000.0,
                "crane_utilization_pct": 49.1,
                "sling_type": LiftingPlan.SlingType.WIRE_ROPE,
                "num_sling_legs": 2,
                "sling_angle_to_horizontal_deg": 60.0,
                "sling_rated_wll_kg": 8500.0,
                "tension_per_leg_kg": 6235.4,
                "allowable_ground_pressure_kpa": 350.0,
                "outrigger_pad_area_sqm": 1.2,
                "ground_bearing_pressure_kpa": 125.0,
                "wind_speed_limit_mps": 9.0,
                "created_by": supervisor_user,
                "approved_by": hse_mgr_user,
                "approval_notes": "طرح مورد بررسی مهندسی قرار گرفت و تایید شد.",
            },
        )
        lift_2, _ = LiftingPlan.objects.update_or_create(
            organization=org_foolad,
            plan_number="LP-2026-002",
            defaults={
                "workplace": wp_cast,
                "title": "باربرداری بحرانی ترانسفورماتور پست ۶۳ کیلوولت کارگاه ریخته‌گری",
                "category": LiftingPlan.LiftCategory.CRITICAL,
                "status": LiftingPlan.Status.UNDER_REVIEW,
                "planned_date": timezone.now().date() + timedelta(days=5),
                "crane": crane_liebherr,
                "boom_length_m": 22.0,
                "lift_radius_m": 12.0,
                "load_description": "ترانسفورماتور اصلی کوره القایی به همراه روغن عایق",
                "load_weight_kg": 26000.0,
                "rigging_hardware_weight_kg": 800.0,
                "hook_block_weight_kg": 1200.0,
                "total_gross_weight_kg": 28000.0,
                "crane_capacity_at_radius_kg": 32000.0,
                "crane_utilization_pct": 87.5,
                "sling_type": LiftingPlan.SlingType.CHAIN,
                "num_sling_legs": 4,
                "sling_angle_to_horizontal_deg": 60.0,
                "sling_rated_wll_kg": 20000.0,
                "tension_per_leg_kg": 16165.8,
                "allowable_ground_pressure_kpa": 400.0,
                "outrigger_pad_area_sqm": 2.0,
                "ground_bearing_pressure_kpa": 185.0,
                "wind_speed_limit_mps": 7.5,
                "created_by": supervisor_user,
            },
        )

        # 4. PSSR (Pre-Startup Safety Review)
        pssr_1, created = PSSRReview.objects.update_or_create(
            organization=org_foolad,
            pssr_number="PSSR-2026-001",
            defaults={
                "workplace": wp_roll,
                "project_or_system_name": "بررسی ایمنی پیش از راه‌اندازی خط تکمیلی نورد شماره ۲",
                "review_type": PSSRReview.ReviewType.MAJOR_MODIFICATION,
                "status": PSSRReview.Status.IN_PROGRESS,
                "target_startup_date": timezone.now().date() + timedelta(days=4),
                "leader": hse_mgr_user,
                "is_synthetic": True,
            },
        )
        if created or not pssr_1.checklist_items.exists():
            populate_default_checklist(pssr_1)
            pssr_1.checklist_items.filter(category="mechanical_completion").update(
                verification_status=PSSRChecklistItem.VerificationStatus.COMPLIANT,
                verified_by=supervisor_user,
            )
            pssr_1.checklist_items.filter(category="process_safety").update(
                verification_status=PSSRChecklistItem.VerificationStatus.COMPLIANT,
                verified_by=hse_mgr_user,
            )
            PSSROutstandingAction.objects.get_or_create(
                pssr=pssr_1,
                title="نصب حفاظ مشبک رولیک ورودی اره برش داغ",
                defaults={
                    "description": "حفاظ فیزیکی بر اساس استاندارد ISO 14120 نصب و قفل میکروسوئیچ تست گردد.",
                    "responsible": supervisor_user,
                    "target_date": timezone.now().date() + timedelta(days=2),
                    "is_pre_startup": True,
                    "status": PSSROutstandingAction.ActionStatus.OPEN,
                },
            )

        # 5. Surveys & Scored Exams
        survey_culture, _ = Survey.objects.update_or_create(
            organization=org_foolad,
            title="سنجش دوره‌ای فرهنگ و مشارکت ایمنی پرسنل (Safety Culture Index)",
            defaults={
                "survey_type": Survey.SurveyType.SAFETY_CLIMATE,
                "is_anonymous": True,
                "description": "نظرسنجی کاملاً ناشناس جهت سنجش ادراک ایمنی و گزارش‌دهی آزادانه در خطوط تولید",
                "is_active": True,
                "is_synthetic": True,
            },
        )
        q1, _ = SurveyQuestion.objects.update_or_create(
            survey=survey_culture,
            order=1,
            defaults={
                "question_text": "آیا مدیران و سرپرستان ارشد در عمل به رعایت دستورالعمل‌های HSE پایبند هستند؟",
                "question_type": SurveyQuestion.QuestionType.RATING_SCALE,
                "points": 5.0,
                "is_required": True,
            },
        )
        q2, _ = SurveyQuestion.objects.update_or_create(
            survey=survey_culture,
            order=2,
            defaults={
                "question_text": "در صورت مشاهده شرایط ناایمن، تا چه حد بدون ترس از سرزنش آن را گزارش می‌کنید؟",
                "question_type": SurveyQuestion.QuestionType.RATING_SCALE,
                "points": 5.0,
                "is_required": True,
            },
        )
        q3, _ = SurveyQuestion.objects.update_or_create(
            survey=survey_culture,
            order=3,
            defaults={
                "question_text": "پیشنهاد عملیاتی شما جهت ارتقای بهداشت و ایمنی در واحد شما چیست؟",
                "question_type": SurveyQuestion.QuestionType.TEXT,
                "points": 0.0,
                "is_required": False,
            },
        )

        exam_height, _ = Survey.objects.update_or_create(
            organization=org_foolad,
            title="آزمون سنجش شایستگی الزامات ایمنی کار در ارتفاع و نجات پرسنل",
            defaults={
                "survey_type": Survey.SurveyType.EXAM,
                "is_anonymous": False,
                "pass_percentage": 75.0,
                "description": "آزمون کتبی ۴ گزینه‌ای برای تمدید صلاحیت کار روی داربست و ارتفاع",
                "is_active": True,
                "is_synthetic": True,
            },
        )
        eq1, _ = SurveyQuestion.objects.update_or_create(
            survey=exam_height,
            order=1,
            defaults={
                "question_text": "طبق آیین‌نامه کار در ارتفاع، حداقل ارتفاع نیازمند سامانه متوقف‌کننده سقوط چقدر است؟",
                "question_type": SurveyQuestion.QuestionType.SINGLE_CHOICE,
                "points": 25.0,
                "is_required": True,
            },
        )
        SurveyQuestionOption.objects.update_or_create(
            question=eq1,
            order=1,
            defaults={"option_text": "۱.۲ متر", "is_correct": False, "score_weight": 0.0},
        )
        SurveyQuestionOption.objects.update_or_create(
            question=eq1,
            order=2,
            defaults={"option_text": "۱.۸ متر و بالاتر", "is_correct": True, "score_weight": 25.0},
        )
        SurveyQuestionOption.objects.update_or_create(
            question=eq1,
            order=3,
            defaults={"option_text": "۲.۵ متر", "is_correct": False, "score_weight": 0.0},
        )

        eq2, _ = SurveyQuestion.objects.update_or_create(
            survey=exam_height,
            order=2,
            defaults={
                "question_text": "حداقل مقاومت نقطه لنگرگاه (Anchor Point) برای اتصال هارنس چقدر باید باشد؟",
                "question_type": SurveyQuestion.QuestionType.SINGLE_CHOICE,
                "points": 25.0,
                "is_required": True,
            },
        )
        SurveyQuestionOption.objects.update_or_create(
            question=eq2,
            order=1,
            defaults={"option_text": "۱۰ کیلونیوتن", "is_correct": False, "score_weight": 0.0},
        )
        SurveyQuestionOption.objects.update_or_create(
            question=eq2,
            order=2,
            defaults={"option_text": "۲۲.۲ کیلونیوتن (حدود ۲.۲ تن)", "is_correct": True, "score_weight": 25.0},
        )

        # 6. Internal Chat & Collaboration
        conv_safety, _ = ChatConversation.objects.update_or_create(
            organization=org_foolad,
            title="کانال پایش و هماهنگی اضطراری شیفت",
            defaults={
                "conversation_type": ChatConversation.ConversationType.CHANNEL,
                "created_by": hse_mgr_user,
                "is_synthetic": True,
            },
        )
        ChatParticipant.objects.update_or_create(
            conversation=conv_safety, user=hse_mgr_user,
            defaults={"role": ChatParticipant.Role.ADMIN}
        )
        ChatParticipant.objects.update_or_create(
            conversation=conv_safety, user=supervisor_user,
            defaults={"role": ChatParticipant.Role.MEMBER}
        )
        ChatParticipant.objects.update_or_create(
            conversation=conv_safety, user=inspector_user,
            defaults={"role": ChatParticipant.Role.MEMBER}
        )
        ChatMessage.objects.get_or_create(
            conversation=conv_safety,
            sender=hse_mgr_user,
            content="با توجه به اخطار هواشناسی مبنی بر وزش باد شدید (بیش از ۱۲ متر بر ثانیه)، کلیه عملیات باربرداری تاپیک جرثقیل و داربست در محوطه باز متوقف گردید.",
            defaults={"is_synthetic": True},
        )
        ChatMessage.objects.get_or_create(
            conversation=conv_safety,
            sender=supervisor_user,
            content="پیام دریافت شد. جک‌های جرثقیل جمع و بوم در حالت خوابیده و ایمن قفل شد. کارگران به سالن سرپوشیده منتقل شدند.",
            defaults={"is_synthetic": True},
        )

        # 7. Fleet, Energy & Excavation
        veh_patrol, _ = FleetVehicle.objects.update_or_create(
            organization=org_foolad,
            vehicle_code="VP-01",
            defaults={
                "plate_number": "ایران ۶۸ - ۲۵۴ ب ۱۲",
                "model_name": "تویوتا هایلوکس دو دیفرانسیل گشت ایمنی",
                "vehicle_type": FleetVehicle.VehicleType.PICKUP,
                "fuel_type": FleetVehicle.FuelType.GASOLINE,
                "current_odometer_km": 48250.0,
                "is_active": True,
                "is_synthetic": True,
            },
        )
        FleetFuelLog.objects.get_or_create(
            organization=org_foolad,
            vehicle=veh_patrol,
            log_date=timezone.now().date() - timedelta(days=5),
            defaults={
                "odometer_km": 47800.0,
                "fuel_liters": 65.0,
                "total_cost_irr": 1950000,
                "distance_traveled_km": 540.0,
                "consumption_rate_l_per_100km": 12.04,
                "is_synthetic": True,
            },
        )
        FleetFuelLog.objects.get_or_create(
            organization=org_foolad,
            vehicle=veh_patrol,
            log_date=timezone.now().date() - timedelta(days=1),
            defaults={
                "odometer_km": 48250.0,
                "fuel_liters": 52.0,
                "total_cost_irr": 1560000,
                "distance_traveled_km": 450.0,
                "consumption_rate_l_per_100km": 11.56,
                "is_synthetic": True,
            },
        )

        EnergyConsumptionLog.objects.get_or_create(
            organization=org_foolad,
            workplace=wp_roll,
            meter_identifier="MTR-ROLL-MAIN-01",
            period_start=timezone.now().date() - timedelta(days=30),
            defaults={
                "utility_type": EnergyConsumptionLog.UtilityType.ELECTRICITY,
                "period_end": timezone.now().date(),
                "consumption_value": 185000.0,
                "unit": "kWh",
                "tariff_rate_irr": 5000.0,
                "is_synthetic": True,
            },
        )

        ExcavationOperation.objects.update_or_create(
            organization=org_foolad,
            reference_code="EXC-2026-001",
            defaults={
                "workplace": wp_cast,
                "project_name": "احداث حوضچه پمپ هیدرولیک کوره",
                "soil_type": ExcavationOperation.SoilType.TYPE_B,
                "depth_m": 2.8,
                "top_width_m": 4.5,
                "bottom_width_m": 2.0,
                "length_m": 12.0,
                "protective_system": ExcavationOperation.ProtectiveSystem.SHORING,
                "status": ExcavationOperation.Status.ACTIVE,
                "is_synthetic": True,
            },
        )

        # 8. Anomalies
        NonConformity.objects.filter(organization=org_foolad, reference_number__isnull=True).update(
            reference_number="ANO-2026-0001",
            anomaly_type=NonConformity.AnomalyType.UNSAFE_CONDITION,
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Phase 17 full modules seeded: Subscriptions, Entitlements, Calculators, Lifting, PSSR, Surveys, Chat, Fleet & Energy."
            )
        )

        self.stdout.write(self.style.SUCCESS("All synthetic demo data seeded successfully with is_synthetic=True."))
