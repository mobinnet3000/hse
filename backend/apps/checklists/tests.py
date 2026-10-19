from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.checklists.models import Checklist, ChecklistItem
from apps.organizations.models import Membership, Organization


class ChecklistApiBase(TestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name="سازمان الف", code="org-a")
        self.org_b = Organization.objects.create(name="سازمان ب", code="org-b")
        self.manager = User.objects.create_user(username="manager", password="Pass-12345-abc")
        self.inspector = User.objects.create_user(username="inspector", password="Pass-12345-abc")
        self.auditor = User.objects.create_user(username="auditor", password="Pass-12345-abc")
        self.outsider = User.objects.create_user(username="outsider", password="Pass-12345-abc")
        Membership.objects.create(
            user=self.manager, organization=self.org_a, role=Membership.Roles.HSE_MANAGER
        )
        Membership.objects.create(
            user=self.inspector, organization=self.org_a, role=Membership.Roles.HSE_INSPECTOR
        )
        Membership.objects.create(
            user=self.auditor, organization=self.org_a, role=Membership.Roles.READ_ONLY_AUDITOR
        )
        Membership.objects.create(
            user=self.outsider, organization=self.org_b, role=Membership.Roles.HSE_MANAGER
        )
        self.checklist_a = Checklist.objects.create(
            organization=self.org_a, title="چک‌لیست الف"
        )
        self.item_required = ChecklistItem.objects.create(
            checklist=self.checklist_a, order=1, text="آیا نرده موجود است؟", is_required=True
        )
        self.item_optional = ChecklistItem.objects.create(
            checklist=self.checklist_a, order=2, text="توضیح تکمیلی", is_required=False
        )
        self.checklist_b = Checklist.objects.create(
            organization=self.org_b, title="چک‌لیست ب"
        )


class ChecklistTests(ChecklistApiBase):
    def test_unauthenticated_denied(self):
        self.assertEqual(self.client.get(reverse("checklist-list")).status_code, 403)

    def test_list_scoped_to_organization(self):
        self.client.force_login(self.inspector)
        response = self.client.get(reverse("checklist-list"))
        self.assertEqual([c["title"] for c in response.json()], ["چک‌لیست الف"])

    def test_cannot_read_other_org_checklist(self):
        self.client.force_login(self.inspector)
        response = self.client.get(reverse("checklist-detail", args=[self.checklist_b.pk]))
        self.assertEqual(response.status_code, 404)

    def test_manager_creates_checklist_and_items(self):
        self.client.force_login(self.manager)
        response = self.client.post(
            reverse("checklist-list"),
            {"organization": self.org_a.pk, "title": "چک‌لیست جدید"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        checklist_id = response.json()["id"]

        response = self.client.post(
            reverse("checklist-items", args=[checklist_id]),
            {"text": "آیتم اول", "is_required": True},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["order"], 1)

        response = self.client.post(
            reverse("checklist-items", args=[checklist_id]),
            {"text": "آیتم دوم", "is_required": False},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["order"], 2)

    def test_inspector_cannot_create_checklist(self):
        self.client.force_login(self.inspector)
        response = self.client.post(
            reverse("checklist-list"),
            {"organization": self.org_a.pk, "title": "نفوذ"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_auditor_can_view_but_not_edit(self):
        self.client.force_login(self.auditor)
        self.assertEqual(
            self.client.get(reverse("checklist-detail", args=[self.checklist_a.pk])).status_code,
            200,
        )
        response = self.client.patch(
            reverse("checklist-detail", args=[self.checklist_a.pk]),
            {"title": "تغییر"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_cannot_add_item_to_other_org_checklist(self):
        self.client.force_login(self.manager)
        response = self.client.post(
            reverse("checklist-items", args=[self.checklist_b.pk]),
            {"text": "نفوذ"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_item_requires_text(self):
        self.client.force_login(self.manager)
        response = self.client.post(
            reverse("checklist-items", args=[self.checklist_a.pk]),
            {"text": ""},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_update_and_delete_item(self):
        self.client.force_login(self.manager)
        response = self.client.patch(
            reverse("checklist-item-detail", args=[self.item_optional.pk]),
            {"text": "متن جدید", "is_required": True},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["is_required"])
        response = self.client.delete(
            reverse("checklist-item-detail", args=[self.item_optional.pk])
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(ChecklistItem.objects.filter(pk=self.item_optional.pk).exists())

    def test_inactive_membership_denied(self):
        Membership.objects.filter(user=self.inspector).update(is_active=False)
        self.client.force_login(self.inspector)
        self.assertEqual(self.client.get(reverse("checklist-list")).json(), [])
