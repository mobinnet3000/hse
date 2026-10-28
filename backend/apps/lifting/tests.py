import datetime
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.organizations.models import Membership, Organization
from apps.workplaces.models import Workplace
from .models import CraneSpecification, LiftingPlan
from .services import LiftingSafetyError, approve_lifting_plan, reject_lifting_plan, submit_lifting_plan

User = get_user_model()


class LiftingPlanWorkflowTestCase(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="سازمان باربرداری", is_active=True)
        self.workplace = Workplace.objects.create(name="سایت نصب تجهیزات", organization=self.org)
        self.planner = User.objects.create_user(
            username="lift_planner",
            password="pass",
            first_name="طراح",
            last_name="لیفتینگ",
        )
        self.approver = User.objects.create_user(
            username="lift_approver",
            password="pass",
            first_name="مدیر",
            last_name="تایید",
        )
        Membership.objects.create(
            user=self.planner, organization=self.org, role=Membership.Roles.ACTION_OWNER
        )
        Membership.objects.create(
            user=self.approver, organization=self.org, role=Membership.Roles.WORKSHOP_SUPERVISOR
        )

        self.crane = CraneSpecification.objects.create(
            organization=self.org,
            model_name="Liebherr LTM 1050",
            max_capacity_tonnes=50.0,
            boom_length_min_m=10.0,
            boom_length_max_m=38.0,
            load_chart_data=[
                {"boom_length_m": 20.0, "radius_m": 8.0, "capacity_kg": 15000.0},
                {"boom_length_m": 20.0, "radius_m": 12.0, "capacity_kg": 8000.0},
            ],
        )

    def test_plan_recalculation(self):
        plan = LiftingPlan.objects.create(
            organization=self.org,
            workplace=self.workplace,
            plan_number="LP-2026-001",
            title="نصب ترانسفورماتور",
            planned_date=datetime.date.today(),
            crane=self.crane,
            boom_length_m=20.0,
            lift_radius_m=8.0,
            load_description="ترانس برق",
            load_weight_kg=10000.0,
            rigging_hardware_weight_kg=500.0,
            hook_block_weight_kg=500.0,
            num_sling_legs=2,
            sling_angle_to_horizontal_deg=60.0,
            created_by=self.planner,
        )
        plan.recalculate_engineering_parameters()
        self.assertEqual(plan.total_gross_weight_kg, 11000.0)
        self.assertEqual(plan.crane_capacity_at_radius_kg, 15000.0)
        # 11000 / 15000 = 73.33%
        self.assertAlmostEqual(plan.crane_utilization_pct, 73.33, places=1)
        # Tension per leg = 11000 / (2 * sin(60)) = 11000 / 1.732 = ~6350.85 kg
        self.assertAlmostEqual(plan.tension_per_leg_kg, 6350.85, delta=2.0)

    def test_approval_blocked_on_overload(self):
        plan = LiftingPlan.objects.create(
            organization=self.org,
            workplace=self.workplace,
            plan_number="LP-OVERLOAD",
            title="باربرداری بیش از حد ظرفیت",
            planned_date=datetime.date.today(),
            crane=self.crane,
            boom_length_m=20.0,
            lift_radius_m=12.0,  # capacity is 8000 kg
            load_description="سازمان سنگین",
            load_weight_kg=9000.0,  # 9000 > 8000 -> 112.5%
            created_by=self.planner,
        )
        submit_lifting_plan(plan, self.planner)

        with self.assertRaises(LiftingSafetyError) as ctx:
            approve_lifting_plan(plan, self.approver)
        self.assertTrue("112.5" in str(ctx.exception) or "۱۰۰" in str(ctx.exception) or "بحرانی" in str(ctx.exception))

    def test_approval_blocked_on_ground_pressure(self):
        plan = LiftingPlan.objects.create(
            organization=self.org,
            workplace=self.workplace,
            plan_number="LP-PRESSURE",
            title="فشار نامناسب زمین",
            planned_date=datetime.date.today(),
            crane=self.crane,
            boom_length_m=20.0,
            lift_radius_m=8.0,
            load_weight_kg=5000.0,
            outrigger_pad_area_sqm=0.1,  # very small pad
            allowable_ground_pressure_kpa=100.0,  # strict ground
            created_by=self.planner,
        )
        submit_lifting_plan(plan, self.planner)

        with self.assertRaises(LiftingSafetyError) as ctx:
            approve_lifting_plan(plan, self.approver)
        self.assertIn("ظرفیت باربری مجاز زمین", str(ctx.exception))

    def test_successful_approval_and_logs(self):
        plan = LiftingPlan.objects.create(
            organization=self.org,
            workplace=self.workplace,
            plan_number="LP-SAFE",
            title="باربرداری ایمن استاندارد",
            planned_date=datetime.date.today(),
            crane=self.crane,
            boom_length_m=20.0,
            lift_radius_m=8.0,
            load_weight_kg=4000.0,
            allowable_ground_pressure_kpa=500.0,
            sling_rated_wll_kg=10000.0,
            shackle_rated_wll_kg=10000.0,
            created_by=self.planner,
        )
        submit_lifting_plan(plan, self.planner)
        self.assertEqual(plan.status, LiftingPlan.Status.UNDER_REVIEW)

        approved = approve_lifting_plan(plan, self.approver, approval_notes="تایید مهندسی انجام شد.")
        self.assertEqual(approved.status, LiftingPlan.Status.APPROVED)
        self.assertEqual(approved.approved_by, self.approver)
        self.assertEqual(approved.approval_logs.count(), 2)


class LiftingPlanAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="سازمان باربرداری ۲", is_active=True)
        self.workplace = Workplace.objects.create(name="کارگاه ۱", organization=self.org)
        self.user = User.objects.create_user(username="api_user", password="pwd")
        Membership.objects.create(user=self.user, organization=self.org, role=Membership.Roles.WORKSHOP_SUPERVISOR)
        self.client.force_authenticate(user=self.user)

    def test_simulation_data_endpoint(self):
        plan = LiftingPlan.objects.create(
            organization=self.org,
            workplace=self.workplace,
            plan_number="LP-SIM-01",
            title="تست شبیه‌سازی",
            planned_date=datetime.date.today(),
            boom_length_m=20.0,
            lift_radius_m=10.0,
            load_weight_kg=3000.0,
            created_by=self.user,
        )
        response = self.client.get(f"/api/v1/lifting/plans/{plan.id}/simulation_data/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["lift_radius_m"], 10.0)
        self.assertEqual(response.data["boom_length_m"], 20.0)
        self.assertIn("tip_height_m", response.data)
