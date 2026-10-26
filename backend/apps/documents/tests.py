import os
import tempfile
from datetime import date, timedelta
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.auditlog.models import AuditEvent
from apps.notifications.models import Notification
from apps.organizations.models import Membership, Organization

from .models import (
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
from .services import (
    approve_document_version,
    archive_document,
    can_access_document,
    create_document_revision,
    create_document_with_initial_version,
    get_document_summary,
    link_document_to_target,
    record_document_acknowledgment,
    reject_document_version,
    restore_document,
    submit_document_for_review,
    validate_uploaded_file,
)

User = get_user_model()


class DocumentControlTests(TestCase):
    def setUp(self):
        self.org1 = Organization.objects.create(name="مجتمع فولاد البرز", code="FOOLAD-01")
        self.org2 = Organization.objects.create(name="پتروشیمی ماهشهر", code="PETRO-02")

        self.manager = User.objects.create_user(
            username="manager1",
            password="Password123!",
            first_name="مدیر",
            last_name="ایمنی",
        )
        self.employee = User.objects.create_user(
            username="worker1",
            password="Password123!",
            first_name="کارشناس",
            last_name="عملیات",
        )
        self.outsider = User.objects.create_user(
            username="outsider",
            password="Password123!",
            first_name="کاربر",
            last_name="غریبه",
        )

        Membership.objects.create(
            user=self.manager,
            organization=self.org1,
            role=Membership.Roles.HSE_MANAGER,
            is_active=True,
        )
        Membership.objects.create(
            user=self.employee,
            organization=self.org1,
            role=Membership.Roles.ACTION_OWNER,
            is_active=True,
        )
        Membership.objects.create(
            user=self.outsider,
            organization=self.org2,
            role=Membership.Roles.HSE_MANAGER,
            is_active=True,
        )

        self.client = APIClient()

    def test_file_validation_safe_extensions_and_sha256(self):
        # 1. Allowed file
        content = b"PDF dummy content for SOP 001"
        safe_file = SimpleUploadedFile("sop_work_at_height.pdf", content, content_type="application/pdf")
        filename, size, sha_hash, mime = validate_uploaded_file(safe_file)
        self.assertEqual(filename, "sop_work_at_height.pdf")
        self.assertEqual(size, len(content))
        self.assertTrue(len(sha_hash) == 64)

        # 2. Disallowed extension
        malicious = SimpleUploadedFile("script.py", b"import os; os.system('bad')", content_type="text/x-python")
        with self.assertRaises(ValidationError):
            validate_uploaded_file(malicious)

    def test_create_document_and_initial_version(self):
        content = b"%PDF-1.4 Mock document bytes"
        pdf_file = SimpleUploadedFile("DOC-SOP-001.pdf", content, content_type="application/pdf")

        doc = create_document_with_initial_version(
            organization=self.org1,
            document_number="DOC-SOP-001",
            title="روش اجرایی کار در ارتفاع",
            category=DocumentCategory.PROCEDURE,
            user=self.manager,
            file_obj=pdf_file,
            version_number="1.0",
            change_summary="نگارش اولیه روش اجرایی",
        )

        self.assertEqual(doc.document_number, "DOC-SOP-001")
        self.assertEqual(doc.status, DocumentStatus.DRAFT)
        self.assertIsNotNone(doc.current_version)
        self.assertEqual(doc.current_version.version_number, "1.0")
        self.assertEqual(doc.current_version.file_size_bytes, len(content))
        self.assertTrue(doc.current_version.file_hash_sha256)

        # Audit event created
        audit = AuditEvent.objects.filter(entity_type="Document", entity_id=doc.id).first()
        self.assertIsNotNone(audit)

    def test_document_number_uniqueness_per_organization(self):
        create_document_with_initial_version(
            organization=self.org1,
            document_number="DOC-SAFE-10",
            title="سند شماره یک",
            category=DocumentCategory.POLICY,
            user=self.manager,
        )

        # Duplicate in same org must raise ValidationError
        with self.assertRaises(ValidationError):
            create_document_with_initial_version(
                organization=self.org1,
                document_number="DOC-SAFE-10",
                title="سند تکراری",
                category=DocumentCategory.POLICY,
                user=self.manager,
            )

        # Same document number in different org is allowed
        doc2 = create_document_with_initial_version(
            organization=self.org2,
            document_number="DOC-SAFE-10",
            title="سند در پتروشیمی",
            category=DocumentCategory.POLICY,
            user=self.outsider,
        )
        self.assertEqual(doc2.document_number, "DOC-SAFE-10")

    def test_lifecycle_submit_approve_and_revision_supersede(self):
        pdf1 = SimpleUploadedFile("v1.pdf", b"Content V1", content_type="application/pdf")
        doc = create_document_with_initial_version(
            organization=self.org1,
            document_number="SOP-ELEC-01",
            title="دستورالعمل ایمنی برق فشار قوی",
            category=DocumentCategory.WORK_INSTRUCTION,
            user=self.manager,
            file_obj=pdf1,
            version_number="1.0",
        )

        # 1. Submit for review
        submit_document_for_review(doc, self.manager)
        doc.refresh_from_db()
        self.assertEqual(doc.status, DocumentStatus.UNDER_REVIEW)

        # 2. Approve version 1.0
        today = timezone.now().date()
        doc = approve_document_version(
            document=doc,
            version=doc.current_version,
            reviewer=self.manager,
            notes="تصویب شد.",
            effective_date=today,
            expiry_date=today + timedelta(days=365),
        )
        self.assertEqual(doc.status, DocumentStatus.EFFECTIVE)
        self.assertEqual(doc.current_version.status, VersionStatus.APPROVED)

        # 3. Create Revision 2.0
        pdf2 = SimpleUploadedFile("v2.pdf", b"Content V2 with extra ground rules", content_type="application/pdf")
        v2 = create_document_revision(
            document=doc,
            file_obj=pdf2,
            version_number="2.0",
            user=self.manager,
            change_summary="افزودن بندهای ارت موقت",
            submit_for_review=True,
        )
        doc.refresh_from_db()
        self.assertEqual(doc.status, DocumentStatus.UNDER_REVIEW)
        self.assertEqual(v2.status, VersionStatus.UNDER_REVIEW)
        # Previous version remains approved until new version is approved
        self.assertEqual(doc.versions.get(version_number="1.0").status, VersionStatus.APPROVED)

        # 4. Approve Version 2.0
        doc = approve_document_version(
            document=doc,
            version=v2,
            reviewer=self.manager,
            notes="نگارش ۲ تصویب شد",
        )
        doc.refresh_from_db()
        self.assertEqual(doc.status, DocumentStatus.EFFECTIVE)
        self.assertEqual(doc.current_version.version_number, "2.0")
        # Previous version 1.0 is now SUPERSEDED
        v1 = doc.versions.get(version_number="1.0")
        self.assertEqual(v1.status, VersionStatus.SUPERSEDED)

    def test_rejection_flow_requires_reason(self):
        pdf = SimpleUploadedFile("v1.pdf", b"Draft text", content_type="application/pdf")
        doc = create_document_with_initial_version(
            organization=self.org1,
            document_number="SOP-CHEM-01",
            title="روش نگهداری اسیدها",
            category=DocumentCategory.PROCEDURE,
            user=self.manager,
            file_obj=pdf,
            version_number="1.0",
        )
        submit_document_for_review(doc, self.manager)

        # Reject without reason must fail
        with self.assertRaises(ValidationError):
            reject_document_version(doc, doc.current_version, self.manager, reason="")

        # Reject with reason
        doc = reject_document_version(
            doc, doc.current_version, self.manager, reason="ماتریس سازگاری شیمیایی ضمیمه نشده است."
        )
        self.assertEqual(doc.status, DocumentStatus.REJECTED)
        self.assertEqual(doc.current_version.status, VersionStatus.REJECTED)

    def test_archive_and_restore_workflow(self):
        doc = create_document_with_initial_version(
            organization=self.org1,
            document_number="LEGACY-POL-01",
            title="خط‌مشی سال ۱۳۹۵",
            category=DocumentCategory.POLICY,
            user=self.manager,
        )

        # Archive requires reason
        with self.assertRaises(ValidationError):
            archive_document(doc, self.manager, reason="")

        doc = archive_document(doc, self.manager, reason="منسوخ شده و طبق برنامه بایگانی ۵ ساله راکد شد.")
        self.assertEqual(doc.status, DocumentStatus.ARCHIVED)
        self.assertIsNotNone(doc.archived_at)

        # Restore
        doc = restore_document(doc, self.manager, reason="جهت بررسی ممیزی تاریخی بازیابی گردید.")
        self.assertEqual(doc.status, DocumentStatus.DRAFT)
        self.assertIsNone(doc.archived_at)

    def test_employee_acknowledgment(self):
        pdf = SimpleUploadedFile("v1.pdf", b"Emergency evacuation plan", content_type="application/pdf")
        doc = create_document_with_initial_version(
            organization=self.org1,
            document_number="EHS-PLAN-01",
            title="طرح واکنش در شرایط اضطراری",
            category=DocumentCategory.PROCEDURE,
            user=self.manager,
            file_obj=pdf,
            version_number="1.0",
            requires_acknowledgment=True,
        )
        approve_document_version(doc, doc.current_version, self.manager, notes="ابلاغ شد.")

        ack = record_document_acknowledgment(
            document=doc,
            user=self.employee,
            signature_note="متن طرح تخلیه را به دقت خواندم.",
        )
        self.assertEqual(ack.document, doc)
        self.assertEqual(ack.user, self.employee)
        self.assertEqual(ack.version, doc.current_version)

        # Duplicate acknowledgment returns existing record without creating duplicate
        ack2 = record_document_acknowledgment(document=doc, user=self.employee)
        self.assertEqual(ack.id, ack2.id)

    def test_tenant_isolation_and_confidentiality(self):
        # Confidential document in org1
        doc_conf = create_document_with_initial_version(
            organization=self.org1,
            document_number="DOC-SEC-01",
            title="گزارش محرمانه حوادث",
            category=DocumentCategory.INSPECTION_AUDIT,
            confidentiality=ConfidentialityLevel.STRICTLY_CONFIDENTIAL,
            user=self.manager,
        )

        # Normal employee cannot access strictly confidential document
        self.assertFalse(can_access_document(self.employee, doc_conf))
        # Manager in org1 can access
        self.assertTrue(can_access_document(self.manager, doc_conf))
        # User in org2 (outsider) cannot access
        self.assertFalse(can_access_document(self.outsider, doc_conf))

        # API isolation check
        self.client.force_authenticate(user=self.outsider)
        resp = self.client.get(f"/api/v1/documents/documents/{doc_conf.id}/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_secure_file_download_endpoint(self):
        pdf = SimpleUploadedFile("safe_test.pdf", b"%PDF-1.5 test streaming content", content_type="application/pdf")
        doc = create_document_with_initial_version(
            organization=self.org1,
            document_number="DOC-TEST-FILE",
            title="سند تستی دانلود",
            category=DocumentCategory.FORM,
            user=self.manager,
            file_obj=pdf,
            version_number="1.0",
        )

        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f"/api/v1/documents/documents/{doc.id}/versions/{doc.current_version_id}/download/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertIn("attachment", resp.headers.get("Content-Disposition", ""))

        # Verify audit log captured the download
        dl_audit = AuditEvent.objects.filter(action="download_document", entity_id=doc.id).first()
        self.assertIsNotNone(dl_audit)

    def test_summary_kpi_endpoint(self):
        create_document_with_initial_version(
            organization=self.org1,
            document_number="SOP-SUM-01",
            title="سند پیش‌نویس",
            category=DocumentCategory.PROCEDURE,
            user=self.manager,
        )

        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(f"/api/v1/documents/summary/?organization={self.org1.id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertGreaterEqual(data["total_documents"], 1)
        self.assertGreaterEqual(data["draft_documents"], 1)
        self.assertIn("categories_breakdown", data)

    def test_cross_domain_link(self):
        doc = create_document_with_initial_version(
            organization=self.org1,
            document_number="DOC-LINK-01",
            title="روش ایمنی داربست",
            category=DocumentCategory.WORK_INSTRUCTION,
            user=self.manager,
        )
        link = link_document_to_target(
            document=doc,
            target_type=DocumentLink.TargetType.SCAFFOLD,
            target_id=101,
            link_title="دستورالعمل داربست‌های مدولار کوره",
            user=self.manager,
        )
        self.assertEqual(link.document, doc)
        self.assertEqual(link.target_type, DocumentLink.TargetType.SCAFFOLD)
        self.assertEqual(link.target_id, 101)

    def test_api_create_document_with_file(self):
        self.client.force_authenticate(user=self.manager)
        pdf = SimpleUploadedFile("initial.pdf", b"%PDF-1.4 initial content", content_type="application/pdf")
        resp = self.client.post(
            "/api/v1/documents/documents/",
            {
                "organization": self.org1.id,
                "document_number": "SOP-API-01",
                "title": "روش آزمون API",
                "category": DocumentCategory.PROCEDURE,
                "confidentiality": ConfidentialityLevel.INTERNAL,
                "department": "ایمنی فنی",
                "file": pdf,
                "version_number": "1.0",
                "change_summary": "آغاز پروژه",
            },
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        doc = Document.objects.get(document_number="SOP-API-01")
        self.assertEqual(doc.title, "روش آزمون API")
        self.assertIsNotNone(doc.current_version)
        self.assertEqual(doc.current_version.version_number, "1.0")

    def test_api_revision_upload_and_review(self):
        doc = create_document_with_initial_version(
            organization=self.org1,
            document_number="SOP-REV-01",
            title="روش اجرایی نسخه ۲",
            category=DocumentCategory.PROCEDURE,
            user=self.manager,
        )

        # 1. Upload revision via API
        self.client.force_authenticate(user=self.manager)
        pdf2 = SimpleUploadedFile("rev2.pdf", b"%PDF-1.4 new version content", content_type="application/pdf")
        resp = self.client.post(
            f"/api/v1/documents/documents/{doc.id}/revisions/",
            {
                "file": pdf2,
                "version_number": "2.0",
                "change_summary": "اصلاح بند ۴",
                "submit_for_review": True,
            },
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        doc.refresh_from_db()
        self.assertEqual(doc.status, DocumentStatus.UNDER_REVIEW)

        # 2. Approve via API
        resp_approve = self.client.post(
            f"/api/v1/documents/documents/{doc.id}/review/",
            {
                "action": "approve",
                "notes": "تأیید نهایی شد",
            },
            format="json",
        )
        self.assertEqual(resp_approve.status_code, status.HTTP_200_OK)
        doc.refresh_from_db()
        self.assertEqual(doc.status, DocumentStatus.EFFECTIVE)
        self.assertEqual(doc.current_version.version_number, "2.0")

    def test_api_archive_and_restore(self):
        doc = create_document_with_initial_version(
            organization=self.org1,
            document_number="SOP-ARCH-01",
            title="سند بایگانی آزمایشی",
            category=DocumentCategory.FORM,
            user=self.manager,
        )
        self.client.force_authenticate(user=self.manager)

        # Archive
        resp = self.client.post(
            f"/api/v1/documents/documents/{doc.id}/archive/",
            {"reason": "فرم قدیمی از رده خارج شد."},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        doc.refresh_from_db()
        self.assertEqual(doc.status, DocumentStatus.ARCHIVED)

        # Restore
        resp_res = self.client.post(
            f"/api/v1/documents/documents/{doc.id}/restore/",
            {"reason": "جهت استعلام ممیزی"},
            format="json",
        )
        self.assertEqual(resp_res.status_code, status.HTTP_200_OK)
        doc.refresh_from_db()
        self.assertEqual(doc.status, DocumentStatus.DRAFT)

    def test_api_acknowledge_and_filter(self):
        pdf = SimpleUploadedFile("sop.pdf", b"SOP text", content_type="application/pdf")
        doc = create_document_with_initial_version(
            organization=self.org1,
            document_number="SOP-ACK-01",
            title="روش اجرایی اضطراری",
            category=DocumentCategory.PROCEDURE,
            user=self.manager,
            file_obj=pdf,
            version_number="1.0",
            requires_acknowledgment=True,
        )
        approve_document_version(doc, doc.current_version, self.manager)

        self.client.force_authenticate(user=self.employee)
        resp_ack = self.client.post(
            f"/api/v1/documents/documents/{doc.id}/acknowledge/",
            {"signature_note": "مطالعه شد."},
            format="json",
        )
        self.assertEqual(resp_ack.status_code, status.HTTP_201_CREATED)

        # Test search filter
        resp_search = self.client.get(f"/api/v1/documents/documents/?search=اضطراری")
        self.assertEqual(resp_search.status_code, status.HTTP_200_OK)
        results = resp_search.json().get("results", resp_search.json())
        self.assertGreaterEqual(len(results), 1)

