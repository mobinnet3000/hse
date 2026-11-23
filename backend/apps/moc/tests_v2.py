from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from apps.organizations.models import Organization, Membership
from apps.moc.models import ChangeRequest
from apps.moc.services import (
    submit_change_request,
    record_risk_assessment_for_moc,
    authorize_change_request,
    close_change_request,
)
from apps.core.traceability import TraceabilityChain, TraceabilityNode

User = get_user_model()


class MOCTestCase(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="مجتمع گاز و پتروشیمی نمونه", code="gas-petro-sample")
        self.user = User.objects.create_user(
            username="moc_officer",
            password="Password123!",
            first_name="امین",
            last_name="رضایی",
        )
        Membership.objects.create(
            organization=self.org,
            user=self.user,
            role=Membership.Roles.ORG_ADMIN,
            is_active=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_change_request_and_traceability(self):
        moc = ChangeRequest.objects.create(
            organization=self.org,
            title="تغییر متریال پایپینگ خط اسید سولفوریک",
            change_type=ChangeRequest.ChangeType.PROCESS,
            category=ChangeRequest.Category.TEMPORARY,
            reason_for_change="خوردگی شدید لوله‌های کربن استیل و نیاز به ارتقا به آلیاژ اینکونل",
            description="تعویض ۶۰ متر خط لوله با سایز ۳ اینچ",
            requested_by=self.user,
            risk_assessment_required=True,
            project_name="فاز توسعه الف",
            area="واحد اسید",
        )
        self.assertTrue(moc.moc_number.startswith("MOC-"))
        self.assertTrue(moc.traceability_chain_id.startswith("TRC-MOC-"))

        # Verify traceability node exists
        chain = TraceabilityChain.objects.filter(tracking_code=moc.traceability_chain_id).first()
        self.assertIsNotNone(chain)
        nodes = TraceabilityNode.objects.filter(chain=chain)
        self.assertTrue(nodes.exists())

    def test_submit_change_request(self):
        moc = ChangeRequest.objects.create(
            organization=self.org,
            title="اصلاح رویه راه‌اندازی کمپرسور",
            change_type=ChangeRequest.ChangeType.PROCEDURAL,
            category=ChangeRequest.Category.PERMANENT,
            reason_for_change="به‌روزرسانی دستورالعمل پس از تعمیرات اساسی",
            description="تنظیم چک‌لیست جدید PSSR",
            requested_by=self.user,
        )
        submitted_moc = submit_change_request(moc=moc, user=self.user)
        self.assertEqual(submitted_moc.status, ChangeRequest.Status.SUBMITTED)

    def test_authorization_requires_risk_approval_invariant(self):
        moc = ChangeRequest.objects.create(
            organization=self.org,
            title="نصب مخزن جدید گازوئیل",
            change_type=ChangeRequest.ChangeType.EQUIPMENT,
            category=ChangeRequest.Category.PERMANENT,
            reason_for_change="افزایش ظرفیت ذخیره‌سازی ژنراتور اضطراری",
            description="مخزن ۵۰ متر مکعبی دوجداره",
            requested_by=self.user,
            risk_assessment_required=True,
            risk_assessed=False,
            risk_approved=False,
        )
        # Attempt to authorize without risk approval must raise ValidationError
        with self.assertRaises(ValidationError) as ctx:
            authorize_change_request(moc=moc, approver=self.user)
        self.assertIn("تأییدیه ارزیابی ریسک", str(ctx.exception))

        # Now assess and approve risk
        record_risk_assessment_for_moc(
            moc=moc,
            assessor=self.user,
            risk_notes="ارزیابی ریسک حریق و نشتی با FMEA انجام شد و ضرایب کنترل در حد ALARP تایید گردید.",
            is_approved=True,
        )
        self.assertTrue(moc.risk_assessed)
        self.assertTrue(moc.risk_approved)

        # Now authorization must succeed
        authorized_moc = authorize_change_request(moc=moc, approver=self.user)
        self.assertEqual(authorized_moc.status, ChangeRequest.Status.APPROVED)

    def test_close_change_request(self):
        moc = ChangeRequest.objects.create(
            organization=self.org,
            title="تغییر پیمانکار سرویس دوره‌ای",
            change_type=ChangeRequest.ChangeType.ORGANIZATIONAL,
            category=ChangeRequest.Category.TEMPORARY,
            reason_for_change="جایگزینی اکیپ فنی",
            description="ورود اکیپ دارای گواهینامه معتبر",
            requested_by=self.user,
            status=ChangeRequest.Status.IMPLEMENTED,
        )
        closed_moc = close_change_request(
            moc=moc,
            user=self.user,
            closure_notes="پیمانکار جدید مستقر شده و الزامات HSE با موفقیت بازرسی و ثبت گردید.",
        )
        self.assertEqual(closed_moc.status, ChangeRequest.Status.CLOSED)
        self.assertIsNotNone(closed_moc.closed_at)
