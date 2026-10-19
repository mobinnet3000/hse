from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.organizations.models import Membership, Organization
from apps.workplaces.models import Workplace


class AuthTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="ali", password="Str0ng-Pass-123")

    def test_login_success_returns_user_without_password(self):
        response = self.client.post(
            reverse("auth-login"),
            {"username": "ali", "password": "Str0ng-Pass-123"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "ali")
        self.assertNotIn("password", response.json())

    def test_login_failure(self):
        response = self.client.post(
            reverse("auth-login"),
            {"username": "ali", "password": "wrong"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "invalid_credentials")

    def test_login_inactive_account_uses_generic_error(self):
        self.user.is_active = False
        self.user.save()
        response = self.client.post(
            reverse("auth-login"),
            {"username": "ali", "password": "Str0ng-Pass-123"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "invalid_credentials")

    def test_me_requires_authentication(self):
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, 403)

    def test_me_returns_current_user(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "ali")

    def test_logout_ends_session(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.post(reverse("auth-logout")).status_code, 204)
        self.assertEqual(self.client.get(reverse("auth-me")).status_code, 403)

    def test_register_creates_standard_user(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "username": "sara",
                "email": "sara@example.com",
                "password": "An0ther-Str0ng-Pass",
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["global_role"], "standard")
        self.assertNotIn("password", response.json())

    def test_register_rejects_weak_password(self):
        response = self.client.post(
            reverse("auth-register"),
            {"username": "sara", "password": "123"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_register_ignores_privilege_fields(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "username": "sara",
                "password": "An0ther-Str0ng-Pass",
                "global_role": "platform_admin",
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["global_role"], "standard")


class OrganizationAccessTests(TestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name="سازمان الف", code="org-a")
        self.org_b = Organization.objects.create(name="سازمان ب", code="org-b")
        self.admin_a = User.objects.create_user(username="admin-a", password="Pass-12345-abc")
        self.member_a = User.objects.create_user(username="member-a", password="Pass-12345-abc")
        self.outsider = User.objects.create_user(username="outsider", password="Pass-12345-abc")
        self.platform = User.objects.create_user(
            username="platform", password="Pass-12345-abc", global_role="platform_admin"
        )
        Membership.objects.create(
            user=self.admin_a,
            organization=self.org_a,
            role=Membership.Roles.ORG_ADMIN,
        )
        Membership.objects.create(
            user=self.member_a,
            organization=self.org_a,
            role=Membership.Roles.HSE_INSPECTOR,
        )
        Membership.objects.create(
            user=self.outsider,
            organization=self.org_b,
            role=Membership.Roles.HSE_MANAGER,
        )
        self.workplace_a = Workplace.objects.create(
            organization=self.org_a, name="کارگاه الف", code="wa"
        )
        self.workplace_b = Workplace.objects.create(
            organization=self.org_b, name="کارگاه ب", code="wb"
        )

    def test_unauthenticated_cannot_list_organizations(self):
        self.assertEqual(self.client.get(reverse("organization-list")).status_code, 403)

    def test_user_sees_only_own_organizations(self):
        self.client.force_login(self.outsider)
        response = self.client.get(reverse("organization-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual([o["code"] for o in response.json()], ["org-b"])

    def test_user_cannot_read_other_organization(self):
        self.client.force_login(self.outsider)
        response = self.client.get(
            reverse("organization-detail", args=[self.org_a.pk])
        )
        self.assertEqual(response.status_code, 404)

    def test_inactive_membership_denies_access(self):
        Membership.objects.filter(user=self.outsider).update(is_active=False)
        self.client.force_login(self.outsider)
        self.assertEqual(
            self.client.get(reverse("organization-list")).json(),
            [],
        )
        self.assertEqual(
            self.client.get(reverse("workplace-list")).json(),
            [],
        )

    def test_inactive_organization_denies_access(self):
        Organization.objects.filter(pk=self.org_b.pk).update(is_active=False)
        self.client.force_login(self.outsider)
        self.assertEqual(self.client.get(reverse("organization-list")).json(), [])

    def test_only_platform_admin_creates_organization(self):
        self.client.force_login(self.admin_a)
        response = self.client.post(
            reverse("organization-list"),
            {"name": "سازمان ج", "code": "org-c"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

        self.client.force_login(self.platform)
        response = self.client.post(
            reverse("organization-list"),
            {"name": "سازمان ج", "code": "org-c"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)

    def test_org_admin_can_update_own_org_but_not_deactivate(self):
        self.client.force_login(self.admin_a)
        response = self.client.patch(
            reverse("organization-detail", args=[self.org_a.pk]),
            {"name": "نام جدید", "is_active": False, "code": "hacked"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.org_a.refresh_from_db()
        self.assertEqual(self.org_a.name, "نام جدید")
        self.assertTrue(self.org_a.is_active)
        self.assertEqual(self.org_a.code, "org-a")

    def test_inspector_cannot_update_organization(self):
        self.client.force_login(self.member_a)
        response = self.client.patch(
            reverse("organization-detail", args=[self.org_a.pk]),
            {"name": "تغییر غیرمجاز"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_membership_list_requires_org_admin(self):
        self.client.force_login(self.member_a)
        response = self.client.get(
            reverse("organization-memberships", args=[self.org_a.pk])
        )
        self.assertEqual(response.status_code, 404)

    def test_org_admin_can_add_membership_but_org_is_forced(self):
        new_user = User.objects.create_user(username="new", password="Pass-12345-abc")
        self.client.force_login(self.admin_a)
        response = self.client.post(
            reverse("organization-memberships", args=[self.org_a.pk]),
            {
                "user": new_user.pk,
                "organization": self.org_b.pk,
                "role": Membership.Roles.HSE_INSPECTOR,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        membership = Membership.objects.get(user=new_user)
        self.assertEqual(membership.organization_id, self.org_a.pk)

    def test_duplicate_membership_rejected(self):
        self.client.force_login(self.admin_a)
        response = self.client.post(
            reverse("organization-memberships", args=[self.org_a.pk]),
            {"user": self.member_a.pk, "role": Membership.Roles.ACTION_OWNER},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "already_member")

    def test_membership_of_other_org_is_hidden(self):
        other_membership = Membership.objects.get(user=self.outsider)
        self.client.force_login(self.admin_a)
        response = self.client.patch(
            reverse("membership-detail", args=[other_membership.pk]),
            {"role": Membership.Roles.ORG_ADMIN},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_cannot_escalate_own_role(self):
        membership = Membership.objects.get(user=self.member_a)
        self.client.force_login(self.member_a)
        response = self.client.patch(
            reverse("membership-detail", args=[membership.pk]),
            {"role": Membership.Roles.ORG_ADMIN},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_org_admin_cannot_change_own_role(self):
        membership = Membership.objects.get(user=self.admin_a)
        self.client.force_login(self.admin_a)
        response = self.client.patch(
            reverse("membership-detail", args=[membership.pk]),
            {"role": Membership.Roles.HSE_INSPECTOR},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_platform_admin_sees_all_organizations(self):
        self.client.force_login(self.platform)
        response = self.client.get(reverse("organization-list"))
        self.assertEqual(len(response.json()), 2)

    def test_platform_admin_can_update_any_organization(self):
        self.client.force_login(self.platform)
        response = self.client.patch(
            reverse("organization-detail", args=[self.org_b.pk]),
            {"is_active": False},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.org_b.refresh_from_db()
        self.assertFalse(self.org_b.is_active)

    def test_org_admin_cannot_manage_memberships_of_other_org(self):
        self.client.force_login(self.admin_a)
        response = self.client.get(
            reverse("organization-memberships", args=[self.org_b.pk])
        )
        self.assertEqual(response.status_code, 404)

    def test_read_only_auditor_can_view_but_not_create_workplace(self):
        auditor = User.objects.create_user(username="auditor", password="Pass-12345-abc")
        Membership.objects.create(
            user=auditor,
            organization=self.org_a,
            role=Membership.Roles.READ_ONLY_AUDITOR,
        )
        self.client.force_login(auditor)
        self.assertEqual(self.client.get(reverse("workplace-list")).status_code, 200)
        response = self.client.post(
            reverse("workplace-list"),
            {"organization": self.org_a.pk, "name": "نفوذ", "code": "n"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_inactive_membership_cannot_manage_memberships(self):
        Membership.objects.filter(user=self.admin_a).update(is_active=False)
        self.client.force_login(self.admin_a)
        response = self.client.get(
            reverse("organization-memberships", args=[self.org_a.pk])
        )
        self.assertEqual(response.status_code, 404)

    def test_unauthenticated_workplace_list_denied(self):
        self.assertEqual(self.client.get(reverse("workplace-list")).status_code, 403)


class WorkplaceAccessTests(TestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name="سازمان الف", code="org-a")
        self.org_b = Organization.objects.create(name="سازمان ب", code="org-b")
        self.admin_a = User.objects.create_user(username="admin-a", password="Pass-12345-abc")
        self.member_a = User.objects.create_user(username="member-a", password="Pass-12345-abc")
        Membership.objects.create(
            user=self.admin_a, organization=self.org_a, role=Membership.Roles.ORG_ADMIN
        )
        Membership.objects.create(
            user=self.member_a, organization=self.org_a, role=Membership.Roles.HSE_INSPECTOR
        )
        self.workplace_a = Workplace.objects.create(
            organization=self.org_a, name="کارگاه الف", code="wa"
        )
        self.workplace_b = Workplace.objects.create(
            organization=self.org_b, name="کارگاه ب", code="wb"
        )

    def test_list_is_scoped_to_membership(self):
        self.client.force_login(self.member_a)
        response = self.client.get(reverse("workplace-list"))
        self.assertEqual([w["code"] for w in response.json()], ["wa"])

    def test_cannot_read_other_org_workplace(self):
        self.client.force_login(self.member_a)
        response = self.client.get(
            reverse("workplace-detail", args=[self.workplace_b.pk])
        )
        self.assertEqual(response.status_code, 404)

    def test_filter_by_other_org_returns_404(self):
        self.client.force_login(self.member_a)
        response = self.client.get(
            reverse("workplace-list"), {"organization": self.org_b.pk}
        )
        self.assertEqual(response.status_code, 404)

    def test_create_requires_org_admin(self):
        self.client.force_login(self.member_a)
        response = self.client.post(
            reverse("workplace-list"),
            {"organization": self.org_a.pk, "name": "کارگاه جدید", "code": "new"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

        self.client.force_login(self.admin_a)
        response = self.client.post(
            reverse("workplace-list"),
            {"organization": self.org_a.pk, "name": "کارگاه جدید", "code": "new"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)

    def test_cannot_create_in_other_org(self):
        self.client.force_login(self.admin_a)
        response = self.client.post(
            reverse("workplace-list"),
            {"organization": self.org_b.pk, "name": "نفوذ", "code": "x"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_duplicate_code_per_org_rejected(self):
        self.client.force_login(self.admin_a)
        response = self.client.post(
            reverse("workplace-list"),
            {"organization": self.org_a.pk, "name": "تکراری", "code": "wa"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_parent_from_other_org_rejected(self):
        self.client.force_login(self.admin_a)
        response = self.client.post(
            reverse("workplace-list"),
            {
                "organization": self.org_a.pk,
                "name": "فرزند",
                "code": "child",
                "parent": self.workplace_b.pk,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_cannot_move_workplace_to_other_org(self):
        self.client.force_login(self.admin_a)
        response = self.client.patch(
            reverse("workplace-detail", args=[self.workplace_a.pk]),
            {"organization": self.org_b.pk},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.workplace_a.refresh_from_db()
        self.assertEqual(self.workplace_a.organization_id, self.org_a.pk)
