from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.organizations.models import (
    Membership,
    ModuleEntitlement,
    Organization,
    OrganizationSubscription,
    SubscriptionPlan,
    SubscriptionPaymentRequest,
)


class SubscriptionEntitlementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org_a = Organization.objects.create(name="شرکت نفت فلات قاره", code="iooc-p17")
        self.org_b = Organization.objects.create(name="پالایشگاه ستاره خلیج فارس", code="pgs-p17")

        self.user_a = User.objects.create_user(username="sub_user_a", password="Pass-12345-abc")
        self.user_b = User.objects.create_user(username="sub_user_b", password="Pass-12345-abc")

        Membership.objects.create(user=self.user_a, organization=self.org_a, role=Membership.Roles.HSE_MANAGER)
        Membership.objects.create(user=self.user_b, organization=self.org_b, role=Membership.Roles.HSE_MANAGER)

        self.plan_starter = SubscriptionPlan.objects.create(
            name="پلن پایه و رایگان",
            code="starter-free",
            description="دسترسی به ماژول‌های اصلی و ضروری",
            price_monthly_irr=0.0,
            included_modules=["dashboard", "permits", "inspections", "incidents", "risks"],
        )
        self.plan_enterprise = SubscriptionPlan.objects.create(
            name="پلن جامع سازمانی",
            code="enterprise-pro",
            description="دسترسی نامحدود به کلیه ماژول‌های تخصصی",
            price_monthly_irr=150000000.0,
            included_modules=["all"],
        )

    def test_list_subscription_plans(self):
        self.client.force_login(self.user_a)
        res = self.client.get("/api/v1/organizations/plans/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertGreaterEqual(len(data), 2)
        codes = [p["code"] for p in data]
        self.assertIn("starter-free", codes)
        self.assertIn("enterprise-pro", codes)

    def test_organization_subscription_and_entitlements(self):
        import datetime
        from django.utils import timezone
        self.client.force_login(self.user_a)
        # Create active subscription
        sub = OrganizationSubscription.objects.create(
            organization=self.org_a,
            plan=self.plan_enterprise,
            status=OrganizationSubscription.Status.ACTIVE,
            valid_until=timezone.now().date() + datetime.timedelta(days=365),
        )
        ent = ModuleEntitlement.objects.create(
            organization=self.org_a,
            module_code="lifting_simulator",
            is_enabled=True,
        )

        res_sub = self.client.get(f"/api/v1/organizations/{self.org_a.id}/subscription/")
        self.assertEqual(res_sub.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sub.json()["plan_code"], "enterprise-pro")

        res_ent = self.client.get(f"/api/v1/organizations/{self.org_a.id}/entitlements/")
        self.assertEqual(res_ent.status_code, status.HTTP_200_OK)
        ent_data = res_ent.json()
        self.assertTrue(any(e["module_code"] == "lifting_simulator" for e in ent_data))

    def test_subscription_tenant_isolation(self):
        self.client.force_login(self.user_a)
        # Attempt to access Org B subscription
        res = self.client.get(f"/api/v1/organizations/{self.org_b.id}/subscription/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        res_ent = self.client.get(f"/api/v1/organizations/{self.org_b.id}/entitlements/")
        self.assertEqual(res_ent.status_code, status.HTTP_404_NOT_FOUND)
