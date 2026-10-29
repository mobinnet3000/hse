import os
from django.db.models import Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auditlog.services import log_event
from apps.core.access import accessible_organization_ids, active_membership
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
from .serializers import (
    DocumentAcknowledgmentActionSerializer,
    DocumentAcknowledgmentSerializer,
    DocumentArchiveSerializer,
    DocumentCreateSerializer,
    DocumentDetailSerializer,
    DocumentLinkCreateSerializer,
    DocumentLinkSerializer,
    DocumentListSerializer,
    DocumentRestoreSerializer,
    DocumentReviewActionSerializer,
    DocumentReviewLogSerializer,
    DocumentRevisionUploadSerializer,
    DocumentVersionSerializer,
)
from .services import (
    approve_document_version,
    archive_document,
    can_access_document,
    can_manage_document,
    can_review_document,
    create_document_revision,
    create_document_with_initial_version,
    get_document_summary,
    link_document_to_target,
    record_document_acknowledgment,
    reject_document_version,
    restore_document,
    submit_document_for_review,
)


class DocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return DocumentDetailSerializer
        if self.action == "create":
            return DocumentCreateSerializer
        return DocumentListSerializer

    def get_queryset(self):
        user = self.request.user
        org_ids = list(accessible_organization_ids(user))
        if not org_ids:
            return Document.objects.none()

        qs = Document.objects.filter(organization_id__in=org_ids).select_related(
            "organization", "workplace", "owner", "author", "assigned_reviewer", "current_version"
        ).prefetch_related("versions", "acknowledgments", "cross_links", "review_logs")

        org_param = self.request.query_params.get("organization")
        if org_param and org_param.isdigit():
            target_org = int(org_param)
            if target_org in org_ids:
                qs = qs.filter(organization_id=target_org)
            else:
                return qs.none()

        # Category filter
        cat = self.request.query_params.get("category")
        if cat:
            qs = qs.filter(category=cat)

        # Status filter
        doc_status = self.request.query_params.get("status")
        if doc_status:
            qs = qs.filter(status=doc_status)

        # Confidentiality filter
        conf = self.request.query_params.get("confidentiality")
        if conf:
            qs = qs.filter(confidentiality=conf)

        # Department filter
        dept = self.request.query_params.get("department")
        if dept:
            qs = qs.filter(department__icontains=dept)

        # Workplace filter
        wp = self.request.query_params.get("workplace")
        if wp and wp.isdigit():
            qs = qs.filter(workplace_id=int(wp))

        # Filter type quick tabs
        filter_type = self.request.query_params.get("filter_type")
        if filter_type == "effective":
            qs = qs.filter(status__in=[DocumentStatus.EFFECTIVE, DocumentStatus.APPROVED])
        elif filter_type == "pending_review":
            qs = qs.filter(status__in=[DocumentStatus.UNDER_REVIEW, DocumentStatus.SUBMITTED])
        elif filter_type == "draft":
            qs = qs.filter(status=DocumentStatus.DRAFT)
        elif filter_type == "archived":
            qs = qs.filter(status=DocumentStatus.ARCHIVED)
        elif filter_type == "review_due":
            from django.utils import timezone
            from datetime import timedelta
            threshold = timezone.now().date() + timedelta(days=14)
            qs = qs.filter(
                status__in=[DocumentStatus.EFFECTIVE, DocumentStatus.APPROVED],
                next_review_date__isnull=False,
                next_review_date__lte=threshold,
            )
        elif filter_type == "expiring":
            from django.utils import timezone
            from datetime import timedelta
            threshold = timezone.now().date() + timedelta(days=30)
            qs = qs.filter(
                status__in=[DocumentStatus.EFFECTIVE, DocumentStatus.APPROVED],
                expiry_date__isnull=False,
                expiry_date__lte=threshold,
            )

        # Search filter
        search = self.request.query_params.get("search")
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(document_number__icontains=search)
                | Q(tags__icontains=search)
                | Q(description__icontains=search)
            )

        # Enforce Confidentiality access control at queryset level for non-admins
        if not user.is_platform_admin:
            # Check user roles across accessible orgs
            # For documents with STRICTLY_CONFIDENTIAL or CONFIDENTIAL, filter out if user is neither author, owner, nor reviewer, nor manager
            restricted_q = Q(confidentiality__in=[ConfidentialityLevel.PUBLIC, ConfidentialityLevel.INTERNAL])
            restricted_q |= Q(author=user) | Q(owner=user) | Q(assigned_reviewer=user)

            # Check if user has manager/admin role in any of their memberships
            manager_org_ids = user.memberships.filter(
                is_active=True,
                role__in=[Membership.Roles.ORG_ADMIN, Membership.Roles.HSE_MANAGER],
            ).values_list("organization_id", flat=True)
            restricted_q |= Q(organization_id__in=manager_org_ids)

            supervisor_org_ids = user.memberships.filter(
                is_active=True,
                role__in=[Membership.Roles.HSE_INSPECTOR, Membership.Roles.WORKSHOP_SUPERVISOR],
            ).values_list("organization_id", flat=True)
            restricted_q |= Q(
                organization_id__in=supervisor_org_ids,
                confidentiality=ConfidentialityLevel.CONFIDENTIAL,
            )

            qs = qs.filter(restricted_q)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        org_ids = list(accessible_organization_ids(user))
        org_param = self.request.data.get("organization") or self.request.query_params.get("organization")

        if org_param:
            try:
                org_id = int(org_param)
            except (ValueError, TypeError):
                raise ValidationError({"organization": "شناسه سازمان نامعتبر است."})
            if org_id not in org_ids:
                raise PermissionDenied("دسترسی به این سازمان مجاز نیست.")
        elif org_ids:
            org_id = org_ids[0]
        else:
            raise ValidationError({"organization": "سازمان معتبری در دسترس نیست."})

        org = Organization.objects.get(pk=org_id)
        validated_data = serializer.validated_data

        file_obj = self.request.FILES.get("file")
        version_num = validated_data.pop("version_number", "1.0")
        change_sum = validated_data.pop("change_summary", "نسخه اولیه سند")

        doc = create_document_with_initial_version(
            organization=org,
            document_number=validated_data["document_number"],
            title=validated_data["title"],
            category=validated_data["category"],
            user=user,
            description=validated_data.get("description", ""),
            confidentiality=validated_data.get("confidentiality", ConfidentialityLevel.INTERNAL),
            department=validated_data.get("department", ""),
            workplace=validated_data.get("workplace"),
            owner=validated_data.get("owner", user),
            assigned_reviewer=validated_data.get("assigned_reviewer"),
            effective_date=validated_data.get("effective_date"),
            next_review_date=validated_data.get("next_review_date"),
            expiry_date=validated_data.get("expiry_date"),
            retention_years=validated_data.get("retention_years", 5),
            tags=validated_data.get("tags", ""),
            requires_acknowledgment=validated_data.get("requires_acknowledgment", False),
            file_obj=file_obj,
            version_number=version_num,
            change_summary=change_sum,
        )
        serializer.instance = doc

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def revisions(self, request, pk=None):
        """
        Upload a new revision file for the controlled document.
        """
        document = self.get_object()
        serializer = DocumentRevisionUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file_obj = request.FILES.get("file")
        if not file_obj:
            raise ValidationError({"file": "ارسال فایل الزامی است."})

        version = create_document_revision(
            document=document,
            file_obj=file_obj,
            version_number=serializer.validated_data["version_number"],
            user=request.user,
            change_summary=serializer.validated_data.get("change_summary", ""),
            submit_for_review=serializer.validated_data.get("submit_for_review", True),
        )

        return Response(
            {
                "message": f"نگارش {version.version_number} با موفقیت ثبت شد.",
                "version": DocumentVersionSerializer(version).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """
        Submit document for formal review and approval.
        """
        document = self.get_object()
        doc = submit_document_for_review(document, request.user)
        return Response(
            {
                "message": "سند با موفقیت جهت ممیزی و بازنگری ارسال شد.",
                "document": DocumentDetailSerializer(doc).data,
            }
        )

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        """
        Approve or reject document.
        """
        document = self.get_object()
        serializer = DocumentReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action_type = serializer.validated_data["action"]
        version = document.current_version or document.versions.first()
        if not version:
            raise ValidationError("سند فاقد هرگونه فایل نگارش برای بررسی است.")

        if action_type == "approve":
            doc = approve_document_version(
                document=document,
                version=version,
                reviewer=request.user,
                notes=serializer.validated_data.get("notes", ""),
                effective_date=serializer.validated_data.get("effective_date"),
                next_review_date=serializer.validated_data.get("next_review_date"),
                expiry_date=serializer.validated_data.get("expiry_date"),
            )
            return Response(
                {
                    "message": f"سند با موفقیت تصویب گردید و نگارش {version.version_number} ابلاغ شد.",
                    "document": DocumentDetailSerializer(doc).data,
                }
            )
        else:
            reason = serializer.validated_data.get("reason") or serializer.validated_data.get("notes", "")
            doc = reject_document_version(
                document=document,
                version=version,
                reviewer=request.user,
                reason=reason,
            )
            return Response(
                {
                    "message": "سند جهت اصلاحات و بازنگری رد شد.",
                    "document": DocumentDetailSerializer(doc).data,
                }
            )

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        """
        Archive a document with reason.
        """
        document = self.get_object()
        serializer = DocumentArchiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        doc = archive_document(
            document=document,
            user=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(
            {
                "message": "سند با موفقیت بایگانی گردید.",
                "document": DocumentDetailSerializer(doc).data,
            }
        )

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """
        Restore an archived document.
        """
        document = self.get_object()
        serializer = DocumentRestoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        doc = restore_document(
            document=document,
            user=request.user,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(
            {
                "message": "سند با موفقیت از بایگانی خارج شد.",
                "document": DocumentDetailSerializer(doc).data,
            }
        )

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        """
        Employee records acknowledgment / read receipt.
        """
        document = self.get_object()
        serializer = DocumentAcknowledgmentActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ack = record_document_acknowledgment(
            document=document,
            user=request.user,
            signature_note=serializer.validated_data.get("signature_note", ""),
        )
        return Response(
            {
                "message": "تصدیق مطالعه و تعهد به رعایت الزامات با موفقیت ثبت شد.",
                "acknowledgment": DocumentAcknowledgmentSerializer(ack).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def link(self, request, pk=None):
        """
        Link document to other HSE entities (Permit, Asset, Incident, etc.).
        """
        document = self.get_object()
        serializer = DocumentLinkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        d_link = link_document_to_target(
            document=document,
            target_type=serializer.validated_data["target_type"],
            target_id=serializer.validated_data["target_id"],
            link_title=serializer.validated_data.get("link_title", ""),
            link_note=serializer.validated_data.get("link_note", ""),
            user=request.user,
        )
        return Response(
            {
                "message": "پیوند مدرک با موفقیت ثبت گردید.",
                "link": DocumentLinkSerializer(d_link).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="versions/(?P<version_id>[^/.]+)/download")
    def download_version(self, request, pk=None, version_id=None):
        """
        Secure file streaming for a specific version.
        Enforces tenant isolation, confidentiality, nosniff, and audit logging.
        """
        return self._stream_file(request, pk, version_id, is_download=True)

    @action(detail=True, methods=["get"], url_path="versions/(?P<version_id>[^/.]+)/preview")
    def preview_version(self, request, pk=None, version_id=None):
        """
        Secure file inline preview for a specific version.
        """
        return self._stream_file(request, pk, version_id, is_download=False)

    @action(detail=True, methods=["get"], url_path="download")
    def download_current(self, request, pk=None):
        """
        Download the current effective/active version file.
        """
        document = self.get_object()
        if not document.current_version:
            raise Http404("نگارش فایلی برای این سند یافت نشد.")
        return self._stream_file(request, pk, document.current_version_id, is_download=True)

    def _stream_file(self, request, doc_id, version_id, is_download=True):
        document = self.get_object()
        if not can_access_document(request.user, document):
            raise PermissionDenied("دسترسی به فایل این سند مجاز نمی‌باشد.")

        version = get_object_or_404(DocumentVersion, document=document, pk=version_id)
        if not version.file:
            raise Http404("فایل پیوست در سیستم موجود نیست.")

        file_path = version.file.path
        if not os.path.exists(file_path):
            raise Http404("فایل فیزیکی در مخزن امن یافت نشد.")

        # Log audit event for document download
        if is_download:
            log_event(
                organization=document.organization,
                actor=request.user,
                action="download_document",
                entity_type="Document",
                entity_id=document.id,
                details={
                    "version": version.version_number,
                    "filename": version.original_filename,
                },
            )

        response = FileResponse(
            open(file_path, "rb"),
            as_attachment=is_download,
            filename=version.original_filename,
        )
        response["X-Content-Type-Options"] = "nosniff"
        return response


class DocumentSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        org_ids = list(accessible_organization_ids(user))
        if not org_ids:
            return Response(
                {
                    "total_documents": 0,
                    "effective_documents": 0,
                    "under_review_documents": 0,
                    "draft_documents": 0,
                    "rejected_documents": 0,
                    "archived_documents": 0,
                    "expiring_soon": 0,
                    "review_due_soon": 0,
                    "total_acknowledgments": 0,
                    "categories_breakdown": [],
                }
            )

        org_param = request.query_params.get("organization")
        if org_param and org_param.isdigit():
            target_org = int(org_param)
            if target_org in org_ids:
                org_ids = [target_org]
            else:
                return Response(
                    {
                        "total_documents": 0,
                        "effective_documents": 0,
                        "under_review_documents": 0,
                        "draft_documents": 0,
                        "rejected_documents": 0,
                        "archived_documents": 0,
                        "expiring_soon": 0,
                        "review_due_soon": 0,
                        "total_acknowledgments": 0,
                        "categories_breakdown": [],
                    }
                )

        data = get_document_summary(org_ids)
        return Response(data)
