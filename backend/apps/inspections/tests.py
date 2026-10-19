from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.checklists.models import Checklist, ChecklistItem
from apps.organizations.models import Membership, Organization
from apps.workplaces.models import Workplace

from .models import Inspection, InspectionResponse


class WorkflowBase(TestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name="سازمان الف", code="org-a")
        self.org_b = Organization.objects.create(name="سازمان ب", code="org-b")
        self.workplace_a = Workplace.objects.create(
            organization=self.org_a, name="کارگاه الف", code="wa"
        )
        self.workplace_b = Workplace.objects.create(
            organization=self.org_b, name="کارگاه ب", code="wb"
        )
        self.manager = User.objects.create_user(username="manager", password="Pass-12345-abc")
        self.inspector = User.objects.create_user(username="inspector", password="Pass-12345-abc")
        self.auditor = User.objects.create_user(username="auditor", password="Pass-12345-abc")
        self.outsider = User.objects.create_user(username="outsider", password="Pass-12345-abc")
        self.owner = User.objects.create_user(username="owner", password="Pass-12345-abc")
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
            user=self.owner, organization=self.org_a, role=Membership.Roles.ACTION_OWNER
        )
        Membership.objects.create(
            user=self.outsider, organization=self.org_b, role=Membership.Roles.HSE_MANAGER
        )
        self.checklist = Checklist.objects.create(
            organization=self.org_a, title="چک‌لیست ایمنی"
        )
        self.required_item = ChecklistItem.objects.create(
            checklist=self.checklist, order=1, text="آیا نرده حفاظتی موجود است؟", is_required=True
        )
        self.required_item_2 = ChecklistItem.objects.create(
            checklist=self.checklist, order=2, text="آیا علائم هشدار نصب شده‌اند؟", is_required=True
        )
        self.optional_item = ChecklistItem.objects.create(
            checklist=self.checklist, order=3, text="توضیح تکمیلی", is_required=False
        )
        self.checklist_b = Checklist.objects.create(
            organization=self.org_b, title="چک‌لیست ب"
        )
        ChecklistItem.objects.create(
            checklist=self.checklist_b, order=1, text="آیتم سازمان ب", is_required=True
        )

    def create_inspection(self, user=None, **overrides):
        self.client.force_login(user or self.inspector)
        payload = {
            "organization": self.org_a.pk,
            "checklist": self.checklist.pk,
            "workplace": self.workplace_a.pk,
            "title": "بازرسی کارگاه",
        }
        payload.update(overrides)
        return self.client.post(
            reverse("inspection-list"), payload, content_type="application/json"
        )

    def start_inspection(self, inspection_id):
        return self.client.patch(
            reverse("inspection-detail", args=[inspection_id]),
            {"status": "in_progress"},
            content_type="application/json",
        )

    def answer_all_required(self, inspection_id):
        inspection = Inspection.objects.get(pk=inspection_id)
        for response in inspection.responses.filter(is_required=True):
            self.client.patch(
                reverse("inspection-response-detail", args=[response.pk]),
                {"result": "conform"},
                content_type="application/json",
            )


class InspectionTests(WorkflowBase):
    def test_create_snapshots_checklist_items(self):
        response = self.create_inspection()
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["status"], "draft")
        self.assertEqual(len(body["responses"]), 3)
        self.assertEqual(
            sorted(item["item_text"] for item in body["responses"]),
            sorted(
                [
                    self.required_item.text,
                    self.required_item_2.text,
                    self.optional_item.text,
                ]
            ),
        )

        self.required_item.text = "متن تغییرکرده"
        self.required_item.save()
        inspection = Inspection.objects.get(pk=body["id"])
        snapshot = inspection.responses.get(item=self.required_item)
        self.assertEqual(snapshot.item_text, "آیا نرده حفاظتی موجود است؟")

    def test_create_requires_organization_membership(self):
        response = self.create_inspection(user=self.outsider)
        self.assertEqual(response.status_code, 404)

    def test_cannot_use_other_org_checklist(self):
        response = self.create_inspection(checklist=self.checklist_b.pk)
        self.assertEqual(response.status_code, 404)

    def test_cannot_use_other_org_workplace(self):
        response = self.create_inspection(workplace=self.workplace_b.pk)
        self.assertEqual(response.status_code, 400)

    def test_empty_checklist_rejected(self):
        empty = Checklist.objects.create(organization=self.org_a, title="خالی")
        response = self.create_inspection(checklist=empty.pk)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "empty_checklist")

    def test_auditor_cannot_create_inspection(self):
        response = self.create_inspection(user=self.auditor)
        self.assertEqual(response.status_code, 404)

    def test_list_scoped_to_organization(self):
        inspection = self.create_inspection().json()
        self.client.force_login(self.outsider)
        self.assertEqual(self.client.get(reverse("inspection-list")).json(), [])
        self.client.force_login(self.inspector)
        ids = [item["id"] for item in self.client.get(reverse("inspection-list")).json()]
        self.assertEqual(ids, [inspection["id"]])

    def test_cannot_read_other_org_inspection(self):
        inspection = self.create_inspection().json()
        self.client.force_login(self.outsider)
        response = self.client.get(reverse("inspection-detail", args=[inspection["id"]]))
        self.assertEqual(response.status_code, 404)

    def test_incomplete_required_responses_prevent_completion(self):
        inspection = self.create_inspection().json()
        self.start_inspection(inspection["id"])
        response = self.client.post(
            reverse("inspection-complete", args=[inspection["id"]])
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "required_responses_missing")

        self.answer_all_required(inspection["id"])
        response = self.client.post(
            reverse("inspection-complete", args=[inspection["id"]])
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "completed")
        self.assertIsNotNone(response.json()["completed_at"])

    def test_cannot_complete_draft_inspection(self):
        inspection = self.create_inspection().json()
        response = self.client.post(
            reverse("inspection-complete", args=[inspection["id"]])
        )
        self.assertEqual(response.status_code, 400)

    def test_invalid_status_transition_rejected(self):
        inspection = self.create_inspection().json()
        response = self.client.patch(
            reverse("inspection-detail", args=[inspection["id"]]),
            {"status": "completed"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_completed_inspection_is_immutable(self):
        inspection = self.create_inspection().json()
        self.start_inspection(inspection["id"])
        self.answer_all_required(inspection["id"])
        self.client.post(reverse("inspection-complete", args=[inspection["id"]]))

        response = self.client.patch(
            reverse("inspection-detail", args=[inspection["id"]]),
            {"notes": "تغییر غیرمجاز"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 409)

        response_id = InspectionResponse.objects.filter(
            inspection_id=inspection["id"]
        ).first().pk
        response = self.client.patch(
            reverse("inspection-response-detail", args=[response_id]),
            {"result": "nonconform"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 409)

    def test_auditor_cannot_answer_or_complete(self):
        inspection = self.create_inspection().json()
        self.client.force_login(self.auditor)
        self.start_inspection(inspection["id"])
        response_id = InspectionResponse.objects.filter(
            inspection_id=inspection["id"]
        ).first().pk
        response = self.client.patch(
            reverse("inspection-response-detail", args=[response_id]),
            {"result": "conform"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_inactive_membership_denied(self):
        inspection = self.create_inspection().json()
        Membership.objects.filter(user=self.inspector).update(is_active=False)
        response = self.client.get(
            reverse("inspection-detail", args=[inspection["id"]])
        )
        self.assertEqual(response.status_code, 404)



class FindingsTests(WorkflowBase):
    def _nonconform_response(self):
        inspection = self.create_inspection().json()
        self.start_inspection(inspection['id'])
        self.answer_all_required(inspection['id'])
        response = InspectionResponse.objects.filter(
            inspection_id=inspection['id'], is_required=True
        ).first()
        response.result = InspectionResponse.Result.NONCONFORM
        response.save()
        self.client.post(reverse('inspection-complete', args=[inspection['id']]))
        return inspection, response

    def test_create_nonconformity_from_inspection_response(self):
        inspection, response = self._nonconform_response()
        result = self.client.post(
            reverse('nonconformity-list'),
            {
                'inspection_response': response.pk,
                'description': 'نرده حفاظتی مفقود است.',
                'severity': 'high',
            },
            content_type='application/json',
        )
        self.assertEqual(result.status_code, 201)
        body = result.json()
        self.assertEqual(body['source'], 'inspection')
        self.assertEqual(body['inspection'], inspection['id'])
        self.assertEqual(body['workplace'], self.workplace_a.pk)
        self.assertEqual(body['status'], 'open')

    def test_duplicate_nonconformity_rejected(self):
        _, response = self._nonconform_response()
        payload = {
            'inspection_response': response.pk,
            'description': 'یافته',
            'severity': 'high',
        }
        first = self.client.post(
            reverse('nonconformity-list'), payload, content_type='application/json'
        )
        self.assertEqual(first.status_code, 201)
        second = self.client.post(
            reverse('nonconformity-list'), payload, content_type='application/json'
        )
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json()['error']['code'], 'duplicate_nonconformity')

    def test_conform_response_cannot_become_nonconformity(self):
        inspection = self.create_inspection().json()
        self.start_inspection(inspection['id'])
        self.answer_all_required(inspection['id'])
        response = InspectionResponse.objects.filter(
            inspection_id=inspection['id']
        ).first()
        result = self.client.post(
            reverse('nonconformity-list'),
            {
                'inspection_response': response.pk,
                'description': 'یافته',
                'severity': 'low',
            },
            content_type='application/json',
        )
        self.assertEqual(result.status_code, 400)
        self.assertEqual(result.json()['error']['code'], 'not_nonconforming')

    def test_manual_create_validates_workplace(self):
        self.client.force_login(self.inspector)
        result = self.client.post(
            reverse('nonconformity-list'),
            {
                'organization': self.org_a.pk,
                'workplace': self.workplace_b.pk,
                'description': 'یافته',
                'severity': 'medium',
            },
            content_type='application/json',
        )
        self.assertEqual(result.status_code, 400)

    def test_responsible_must_be_member(self):
        self.client.force_login(self.inspector)
        result = self.client.post(
            reverse('nonconformity-list'),
            {
                'organization': self.org_a.pk,
                'description': 'یافته',
                'severity': 'medium',
                'responsible': self.outsider.pk,
            },
            content_type='application/json',
        )
        self.assertEqual(result.status_code, 400)
        self.assertEqual(result.json()['error']['code'], 'invalid_responsible')

    def test_status_transitions_and_close_requires_endpoint(self):
        self.client.force_login(self.inspector)
        nc = self.client.post(
            reverse('nonconformity-list'),
            {
                'organization': self.org_a.pk,
                'description': 'یافته',
                'severity': 'medium',
            },
            content_type='application/json',
        ).json()
        url = reverse('nonconformity-detail', args=[nc['id']])
        self.assertEqual(
            self.client.patch(
                url, {'status': 'in_progress'}, content_type='application/json'
            ).json()['status'],
            'in_progress',
        )
        self.assertEqual(
            self.client.patch(
                url, {'status': 'ready_for_review'}, content_type='application/json'
            ).json()['status'],
            'ready_for_review',
        )
        self.assertEqual(
            self.client.patch(
                url, {'status': 'closed'}, content_type='application/json'
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.patch(
                url, {'status': 'open'}, content_type='application/json'
            ).status_code,
            400,
        )

    def test_close_requires_reviewer_permission(self):
        self.client.force_login(self.inspector)
        nc = self.client.post(
            reverse('nonconformity-list'),
            {
                'organization': self.org_a.pk,
                'description': 'یافته',
                'severity': 'high',
            },
            content_type='application/json',
        ).json()
        response = self.client.post(reverse('nonconformity-close', args=[nc['id']]))
        self.assertEqual(response.status_code, 403)

    def test_close_requires_completed_corrective_actions(self):
        self.client.force_login(self.inspector)
        nc = self.client.post(
            reverse('nonconformity-list'),
            {
                'organization': self.org_a.pk,
                'description': 'یافته',
                'severity': 'high',
            },
            content_type='application/json',
        ).json()
        url = reverse('nonconformity-detail', args=[nc['id']])
        self.client.patch(url, {'status': 'in_progress'}, content_type='application/json')
        self.client.patch(url, {'status': 'ready_for_review'}, content_type='application/json')

        self.client.force_login(self.manager)
        response = self.client.post(reverse('nonconformity-close', args=[nc['id']]))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error']['code'], 'no_corrective_actions')

    def test_cross_org_nonconformity_hidden(self):
        self.client.force_login(self.outsider)
        nc = self.client.post(
            reverse('nonconformity-list'),
            {
                'organization': self.org_b.pk,
                'description': 'یافته ب',
                'severity': 'low',
            },
            content_type='application/json',
        ).json()
        self.client.force_login(self.inspector)
        self.assertEqual(
            self.client.get(reverse('nonconformity-detail', args=[nc['id']])).status_code,
            404,
        )

    def test_auditor_cannot_create_or_edit_nonconformity(self):
        self.client.force_login(self.auditor)
        response = self.client.post(
            reverse('nonconformity-list'),
            {
                'organization': self.org_a.pk,
                'description': 'یافته',
                'severity': 'low',
            },
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 404)


class CorrectiveActionTests(WorkflowBase):
    def _nc(self, user=None):
        self.client.force_login(user or self.inspector)
        return self.client.post(
            reverse('nonconformity-list'),
            {
                'organization': self.org_a.pk,
                'description': 'یافته',
                'severity': 'high',
            },
            content_type='application/json',
        ).json()

    def _action(self, nc, responsible=None):
        self.client.force_login(self.manager)
        return self.client.post(
            reverse('corrective-action-list'),
            {
                'non_conformity': nc['id'],
                'description': 'نصب نرده حفاظتی',
                'responsible': (responsible or self.owner).pk,
                'due_date': '2026-12-01',
            },
            content_type='application/json',
        ).json()

    def test_create_action_assigns_organization(self):
        nc = self._nc()
        action = self._action(nc)
        self.assertEqual(action['organization'], self.org_a.pk)
        self.assertEqual(action['status'], 'open')

    def test_action_owner_can_update_own_progress(self):
        nc = self._nc()
        action = self._action(nc)
        self.client.force_login(self.owner)
        response = self.client.patch(
            reverse('corrective-action-detail', args=[action['id']]),
            {'status': 'in_progress'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'in_progress')

    def test_action_owner_cannot_edit_other_actions(self):
        nc = self._nc()
        action = self._action(nc, responsible=self.inspector)
        self.client.force_login(self.owner)
        response = self.client.patch(
            reverse('corrective-action-detail', args=[action['id']]),
            {'status': 'in_progress'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_action_owner_cannot_change_description(self):
        nc = self._nc()
        action = self._action(nc)
        self.client.force_login(self.owner)
        response = self.client.patch(
            reverse('corrective-action-detail', args=[action['id']]),
            {'description': 'تغییر دلخواه'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_pending_verification_requires_result(self):
        nc = self._nc()
        action = self._action(nc)
        self.client.force_login(self.owner)
        url = reverse('corrective-action-detail', args=[action['id']])
        self.client.patch(url, {'status': 'in_progress'}, content_type='application/json')
        response = self.client.patch(
            url, {'status': 'pending_verification'}, content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        response = self.client.patch(
            url,
            {'status': 'pending_verification', 'result_text': 'نرده نصب شد.'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)

    def test_direct_completion_rejected(self):
        nc = self._nc()
        action = self._action(nc)
        self.client.force_login(self.manager)
        response = self.client.patch(
            reverse('corrective-action-detail', args=[action['id']]),
            {'status': 'completed'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_verify_requires_reviewer_and_pending_status(self):
        nc = self._nc()
        action = self._action(nc)
        self.client.force_login(self.manager)
        url = reverse('corrective-action-detail', args=[action['id']])
        self.client.patch(url, {'status': 'in_progress'}, content_type='application/json')
        self.client.patch(
            url,
            {'status': 'pending_verification', 'result_text': 'انجام شد.'},
            content_type='application/json',
        )
        self.client.force_login(self.inspector)
        self.assertEqual(
            self.client.post(reverse('corrective-action-verify', args=[action['id']])).status_code,
            403,
        )
        self.client.force_login(self.manager)
        response = self.client.post(reverse('corrective-action-verify', args=[action['id']]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'completed')
        self.assertTrue(response.json()['effectiveness_verified'])

    def test_cross_org_action_hidden(self):
        self.client.force_login(self.outsider)
        nc = self.client.post(
            reverse("nonconformity-list"),
            {
                "organization": self.org_b.pk,
                "description": "یافته ب",
                "severity": "high",
            },
            content_type="application/json",
        ).json()
        action = self.client.post(
            reverse("corrective-action-list"),
            {"non_conformity": nc["id"], "description": "اقدام"},
            content_type="application/json",
        ).json()
        self.client.force_login(self.inspector)
        self.assertEqual(
            self.client.get(reverse('corrective-action-detail', args=[action['id']])).status_code,
            404,
        )

    def test_actions_require_nonconformity_visibility(self):
        self.client.force_login(self.inspector)
        self.assertEqual(
            self.client.get(reverse('corrective-action-list'), {'organization': self.org_b.pk}).status_code,
            404,
        )



class EndToEndWorkflowTests(WorkflowBase):
    def test_inspection_to_corrective_action_to_closure(self):
        inspection = self.create_inspection().json()
        self.start_inspection(inspection['id'])
        self.answer_all_required(inspection['id'])
        nc_response = InspectionResponse.objects.filter(
            inspection_id=inspection['id'], is_required=True
        ).first()
        self.client.patch(
            reverse('inspection-response-detail', args=[nc_response.pk]),
            {'result': 'nonconform', 'notes': 'نرده مفقود است.'},
            content_type='application/json',
        )
        completed = self.client.post(
            reverse('inspection-complete', args=[inspection['id']])
        )
        self.assertEqual(completed.json()['status'], 'completed')

        nc = self.client.post(
            reverse('nonconformity-list'),
            {
                'inspection_response': nc_response.pk,
                'description': 'نرده حفاظتی مفقود است.',
                'severity': 'high',
                'responsible': self.owner.pk,
            },
            content_type='application/json',
        ).json()
        self.assertEqual(nc['inspection'], inspection['id'])

        nc_url = reverse('nonconformity-detail', args=[nc['id']])
        self.client.patch(nc_url, {'status': 'in_progress'}, content_type='application/json')
        self.client.patch(nc_url, {'status': 'ready_for_review'}, content_type='application/json')

        action = self.client.post(
            reverse('corrective-action-list'),
            {
                'non_conformity': nc['id'],
                'description': 'نصب نرده حفاظتی',
                'responsible': self.owner.pk,
                'due_date': '2026-12-01',
            },
            content_type='application/json',
        ).json()

        self.client.force_login(self.owner)
        action_url = reverse('corrective-action-detail', args=[action['id']])
        self.client.patch(action_url, {'status': 'in_progress'}, content_type='application/json')
        self.client.patch(
            action_url,
            {'status': 'pending_verification', 'result_text': 'نرده نصب شد.'},
            content_type='application/json',
        )

        self.client.force_login(self.manager)
        verified = self.client.post(
            reverse('corrective-action-verify', args=[action['id']])
        )
        self.assertEqual(verified.json()['status'], 'completed')

        closed = self.client.post(reverse('nonconformity-close', args=[nc['id']]))
        self.assertEqual(closed.status_code, 200)
        self.assertEqual(closed.json()['status'], 'closed')
        self.assertIsNotNone(closed.json()['closed_at'])

        from apps.auditlog.models import AuditEvent

        actions = set(
            AuditEvent.objects.filter(organization=self.org_a).values_list('action', flat=True)
        )
        self.assertIn('inspection.complete', actions)
        self.assertIn('nonconformity.close', actions)
        self.assertIn('correctiveaction.verify', actions)
        self.assertNotIn('password', str(AuditEvent.objects.values_list('details', flat=True)))

