from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.organizations.models import Organization, Membership
from apps.workplaces.models import Workplace
from apps.checklists.models import Checklist, ChecklistItem
from apps.assets.models import Equipment
from apps.inspections.models import Inspection, InspectionResponse

User = get_user_model()


class InspectionBidirectionalTestCase(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="پتروشیمی خلیج فارس", code="pg-petro")
        self.user = User.objects.create_user(
            username="inspector_lead",
            password="Password123!",
            first_name="سعید",
            last_name="کاظمی",
        )
        Membership.objects.create(
            organization=self.org,
            user=self.user,
            role=Membership.Roles.HSE_INSPECTOR,
            is_active=True,
        )
        self.workplace = Workplace.objects.create(
            organization=self.org,
            name="واحد تقطیر و تفکیک",
        )
        self.equipment = Equipment.objects.create(
            organization=self.org,
            workplace=self.workplace,
            code="CRANE-01",
            name="جرثقیل سقفی ۵۰ تن",
            category="heavy_machinery",
            technical_clearance="cleared",
            operating_permit_status="valid",
        )
        self.checklist = Checklist.objects.create(
            organization=self.org,
            title="چک‌لیست بازرسی تجهیزات بالابری",
            description="بررسی فنی و ایمنی جرثقیل و بالابرها",
        )
        self.item1 = ChecklistItem.objects.create(
            checklist=self.checklist,
            text="بررسی سلامت سیم‌بکسل و درام",
            order=1,
            is_required=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_inspection_completion_blocks_defective_equipment(self):
        # Create inspection with response
        inspection = Inspection.objects.create(
            organization=self.org,
            workplace=self.workplace,
            equipment=self.equipment,
            checklist=self.checklist,
            title="بازرسی هفتگی جرثقیل سقفی",
            inspector=self.user,
            status=Inspection.Status.IN_PROGRESS,
        )
        self.assertTrue(inspection.inspection_code.startswith("INS-"))
        self.assertTrue(inspection.traceability_chain_id.startswith("TRC-INS-"))

        # Add failed response
        resp = InspectionResponse.objects.create(
            inspection=inspection,
            item=self.item1,
            item_text=self.item1.text,
            is_required=True,
            order=1,
            result="fail",
            notes="شکستگی و ساییدگی بیش از حد در سیم‌بکسل",
        )

        # Call complete endpoint
        url = f"/api/v1/inspections/{inspection.id}/complete/"
        res = self.client.post(url, {"overall_result": "fail"}, format="json")
        self.assertEqual(res.status_code, 200)

        inspection.refresh_from_db()
        self.assertEqual(inspection.status, Inspection.Status.COMPLETED)
        self.assertEqual(inspection.overall_result, "fail")
        self.assertEqual(inspection.defects_count, 1)

        # Verify equipment health and clearance are blocked/suspended
        self.equipment.refresh_from_db()
        self.assertEqual(self.equipment.technical_clearance, "blocked")
        self.assertEqual(self.equipment.operating_permit_status, "suspended")
        self.assertIn("تعلیق مجوز به علت مردودی در بازرسی", self.equipment.health_notes)

    def test_equipment_trigger_inspection_endpoint(self):
        # Equipment requests a new inspection
        url = f"/api/v1/assets/equipment/{self.equipment.id}/trigger-inspection/"
        res = self.client.post(
            url,
            {"title": "بازرسی ویژه پس از تعویض قطعه", "checklist_id": self.checklist.id},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIn("inspection_id", data)

        # Verify equipment operating permit is now pending_inspection
        self.equipment.refresh_from_db()
        self.assertEqual(self.equipment.operating_permit_status, "pending_inspection")
