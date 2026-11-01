import logging
import os
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

from apps.auditlog.services import log_event
from apps.checklists.models import Checklist, ChecklistItem
from apps.checklists.serializers import ChecklistSerializer
from apps.core.access import (
    accessible_organization_ids,
    can_edit_risks,
    can_manage_checklists,
    can_review,
    is_active_member,
)
from apps.organizations.models import Organization
from apps.risks.models import Hazard
from apps.risks.serializers import HazardSerializer
from apps.workplaces.models import Workplace
from .models import AIAssessment, AIGenerationLog
from .services import (
    analyze_workplace_activities,
    get_ai_status,
    suggest_hierarchy_of_controls,
    suggest_inspection_checklist,
)


def validate_org_access(user, organization_id):
    if not organization_id:
        raise ValidationError({"organization_id": "شناسه سازمان الزامی است."})
    try:
        org = Organization.objects.get(pk=organization_id, is_active=True)
    except Organization.DoesNotExist:
        raise ValidationError({"organization_id": "سازمان معتبر یافت نشد."})

    if not user.is_platform_admin and not is_active_member(user, org.id):
        raise PermissionDenied("شما عضو فعال این سازمان نیستید.")
    return org


class AiStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_id = request.query_params.get("organization_id")
        org_id_int = int(org_id) if org_id and org_id.isdigit() else None
        data = get_ai_status(organization_id=org_id_int)
        return Response(data)


class AiAnalyzeWorkplaceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        org_id = request.data.get("organization_id")
        org = validate_org_access(user, org_id)

        activity_description = (request.data.get("activity_description") or "").strip()
        if not activity_description:
            raise ValidationError({"activity_description": "شرح فعالیت یا فرآیند کاری الزامی است."})

        workplace_id = request.data.get("workplace_id")
        workplace_name = ""
        if workplace_id:
            try:
                wp = Workplace.objects.get(pk=workplace_id, organization=org)
                workplace_name = wp.name
            except Workplace.DoesNotExist:
                raise ValidationError({"workplace_id": "محل کار متعلق به این سازمان نیست."})

        equipment = request.data.get("equipment", "")
        materials = request.data.get("materials", "")

        result = analyze_workplace_activities(
            organization_id=org.id,
            activity_description=activity_description,
            workplace_name=workplace_name,
            equipment=equipment,
            materials=materials,
        )

        log_event(
            organization=org,
            actor=user,
            action="ai.analyze_workplace",
            entity_type="AiAssistant",
            details={
                "activity_len": len(activity_description),
                "hazards_suggested": len(result.get("hazards", [])),
                "workplace": workplace_name,
            },
        )
        return Response(result)


class AiSuggestChecklistView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        org_id = request.data.get("organization_id")
        org = validate_org_access(user, org_id)

        focus_area = (request.data.get("focus_area") or "").strip()
        title_hint = (request.data.get("title_hint") or "").strip()

        result = suggest_inspection_checklist(
            organization_id=org.id,
            focus_area=focus_area,
            title_hint=title_hint,
        )

        log_event(
            organization=org,
            actor=user,
            action="ai.suggest_checklist",
            entity_type="AiAssistant",
            details={
                "focus_area": focus_area,
                "items_count": len(result.get("items", [])),
            },
        )
        return Response(result)


class AiSuggestControlsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        org_id = request.data.get("organization_id")
        org = validate_org_access(user, org_id)

        hazard_title = (request.data.get("hazard_title") or "").strip()
        if not hazard_title:
            raise ValidationError({"hazard_title": "عنوان خطر الزامی است."})

        category = request.data.get("category", "")
        description = request.data.get("description", "")

        result = suggest_hierarchy_of_controls(
            organization_id=org.id,
            hazard_title=hazard_title,
            category=category,
            description=description,
        )

        log_event(
            organization=org,
            actor=user,
            action="ai.suggest_controls",
            entity_type="AiAssistant",
            details={"hazard_title": hazard_title, "category": category},
        )
        return Response(result)


class AiApplyHazardView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        org_id = request.data.get("organization_id")
        org = validate_org_access(user, org_id)

        if not can_edit_risks(user, org.id):
            raise PermissionDenied("مجوز ایجاد مخاطره در این سازمان را ندارید.")

        title = (request.data.get("title") or "").strip()
        if not title:
            raise ValidationError({"title": "عنوان مخاطره الزامی است."})

        category = request.data.get("category") or Hazard.Category.SAFETY
        if category not in dict(Hazard.Category.choices):
            category = Hazard.Category.OTHER

        workplace_id = request.data.get("workplace_id")
        workplace = None
        if workplace_id:
            try:
                workplace = Workplace.objects.get(pk=workplace_id, organization=org)
            except Workplace.DoesNotExist:
                raise ValidationError({"workplace_id": "محل کار معتبر نیست."})

        hazard = Hazard.objects.create(
            organization=org,
            workplace=workplace,
            title=title,
            description=request.data.get("description", ""),
            category=category,
            source=request.data.get("source", "پیشنهاد هوش مصنوعی HSE Guard (تأییدشده توسط کارشناس)"),
            causes=request.data.get("causes", ""),
            consequences=request.data.get("consequences", ""),
            existing_controls=request.data.get("existing_controls", ""),
            status=Hazard.Status.DRAFT,
            created_by=user,
        )

        log_event(
            organization=org,
            actor=user,
            action="ai.hazard_accepted",
            entity_type="Hazard",
            entity_id=hazard.id,
            details={"title": hazard.title, "category": hazard.category},
        )

        serializer = HazardSerializer(hazard, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AiApplyChecklistView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        org_id = request.data.get("organization_id")
        org = validate_org_access(user, org_id)

        if not can_manage_checklists(user, org.id):
            raise PermissionDenied("مجوز ثبت چک‌لیست در این سازمان را ندارید.")

        title = (request.data.get("title") or "").strip()
        if not title:
            raise ValidationError({"title": "عنوان چک‌لیست الزامی است."})

        description = request.data.get("description", "")
        raw_items = request.data.get("items") or []
        if not isinstance(raw_items, list) or len(raw_items) == 0:
            raise ValidationError({"items": "حداقل یک ردیف بازرسی برای چک‌لیست الزامی است."})

        checklist = Checklist.objects.create(
            organization=org,
            title=title,
            description=description,
            is_active=True,
            created_by=user,
        )

        created_items = []
        for index, itm in enumerate(raw_items, start=1):
            text = itm.get("text", "").strip() if isinstance(itm, dict) else str(itm).strip()
            if not text:
                continue
            is_req = itm.get("is_required", True) if isinstance(itm, dict) else True
            created_items.append(
                ChecklistItem(
                    checklist=checklist,
                    order=index,
                    text=text,
                    is_required=is_req,
                )
            )

        if created_items:
            ChecklistItem.objects.bulk_create(created_items)

        log_event(
            organization=org,
            actor=user,
            action="ai.checklist_accepted",
            entity_type="Checklist",
            entity_id=checklist.id,
            details={"title": checklist.title, "items_count": len(created_items)},
        )

        serializer = ChecklistSerializer(checklist, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AIAssessmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org_ids = list(accessible_organization_ids(user))
        if not org_ids:
            return AIAssessment.objects.none()

        qs = AIAssessment.objects.filter(organization_id__in=org_ids).select_related(
            "organization", "workplace", "created_by", "approved_by", "generated_checklist"
        ).prefetch_related("generation_logs")

        org_param = self.request.query_params.get("organization")
        if org_param and org_param.isdigit():
            target_org = int(org_param)
            if target_org in org_ids:
                qs = qs.filter(organization_id=target_org)
            else:
                return AIAssessment.objects.none()

        wp_param = self.request.query_params.get("workplace")
        if wp_param and wp_param.isdigit():
            qs = qs.filter(workplace_id=int(wp_param))

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        search_param = self.request.query_params.get("search")
        if search_param:
            from django.db.models import Q
            qs = qs.filter(Q(title__icontains=search_param) | Q(input_data__icontains=search_param))

        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            from .serializers import AIAssessmentCreateUpdateSerializer
            return AIAssessmentCreateUpdateSerializer
        if self.action == "retrieve":
            from .serializers import AIAssessmentDetailSerializer
            return AIAssessmentDetailSerializer
        from .serializers import AIAssessmentListSerializer
        return AIAssessmentListSerializer

    def perform_create(self, serializer):
        user = self.request.user
        org = serializer.validated_data.get("organization")
        if not org:
            org_ids = list(accessible_organization_ids(user))
            if not org_ids:
                raise PermissionDenied("هیچ سازمان فعالی برای این کاربر یافت نشد.")
            from apps.organizations.models import Organization
            org = Organization.objects.get(pk=org_ids[0])

        if not is_active_member(user, org.id) and not user.is_platform_admin:
            raise PermissionDenied("شما عضو فعال این سازمان نیستید.")

        assessment = serializer.save(organization=org, created_by=user, status=AIAssessment.Status.DRAFT)
        log_event(
            organization=org,
            actor=user,
            action="ai.assessment_created",
            entity_type="AIAssessment",
            entity_id=assessment.id,
            details={"title": assessment.title},
        )

    @action(detail=True, methods=["post"])
    def analyze(self, request, pk=None):
        from .models import AIAssessment, AIGenerationLog
        from .serializers import AIAssessmentDetailSerializer
        from .avalai_client import (
            call_avalai_chat_completions,
            get_avalai_config,
            SYSTEM_PROMPT_WORKPLACE_ANALYSIS,
            _build_user_prompt,
            AvalAIError,
        )
        from .schema_validator import (
            validate_and_normalize_ai_response,
            generate_scenario_mock_analysis,
        )

        assessment = self.get_object()
        user = request.user
        if not is_active_member(user, assessment.organization_id) and not user.is_platform_admin:
            raise PermissionDenied("شما عضو فعال این سازمان نیستید.")

        assessment.status = AIAssessment.Status.PROCESSING
        assessment.error_message = ""
        assessment.save(update_fields=["status", "error_message", "updated_at"])

        cfg = get_avalai_config()
        user_prompt = _build_user_prompt(assessment.input_data or {})

        force_offline = False
        if isinstance(request.data, dict) and request.data.get("force_offline"):
            force_offline = True
        elif os.getenv("AVALAI_OFFLINE_MODE", "").lower() in ("true", "1", "yes"):
            force_offline = True

        try:
            # If no API key configured, test placeholder, or offline requested, provide deterministic analysis
            if force_offline or not cfg["api_key"] or cfg["api_key"] == "<TEST_KEY_PLACEHOLDER>":
                wp_name = assessment.workplace.name if assessment.workplace else assessment.title
                normalized_result = generate_scenario_mock_analysis(workplace_name=wp_name)
                metadata = {
                    "provider": "avalai-offline-engine",
                    "model": cfg["model"] or "deepseek-v4.1-flash",
                    "request_id": f"sim-{assessment.id}",
                    "status_code": 200,
                    "duration_ms": 120.0,
                    "prompt_tokens": 1500,
                    "completion_tokens": 1800,
                    "total_tokens": 3300,
                    "finish_reason": "stop",
                }
            else:
                raw_text, metadata, duration_ms = call_avalai_chat_completions(
                    system_prompt=SYSTEM_PROMPT_WORKPLACE_ANALYSIS,
                    user_prompt=user_prompt,
                    model=cfg["model"],
                    timeout=cfg["timeout"],
                    max_retries=cfg["max_retries"],
                    max_output_tokens=cfg["max_output_tokens"],
                )
                normalized_result = validate_and_normalize_ai_response(raw_text)

            metadata["prompt_sent"] = user_prompt
            if force_offline or not cfg["api_key"] or cfg["api_key"] == "<TEST_KEY_PLACEHOLDER>":
                metadata["mode"] = "offline_fallback"
            else:
                metadata["mode"] = "live_avalai_api"
                metadata["raw_response_preview"] = raw_text[:3000] if len(raw_text) > 3000 else raw_text

            assessment.analysis_result = normalized_result
            assessment.checklist_draft = normalized_result.get("checklist", {})
            assessment.ai_model = metadata.get("model", cfg["model"])
            assessment.provider_metadata = metadata
            assessment.status = AIAssessment.Status.ANALYZED
            assessment.save(update_fields=["analysis_result", "checklist_draft", "ai_model", "provider_metadata", "status", "updated_at"])

            AIGenerationLog.objects.create(
                assessment=assessment,
                provider=metadata.get("provider", "avalai"),
                endpoint=f"{cfg['base_url']}/chat/completions",
                model=assessment.ai_model,
                status_code=metadata.get("status_code", 200),
                duration_ms=metadata.get("duration_ms", 0.0),
                prompt_tokens=metadata.get("prompt_tokens"),
                completion_tokens=metadata.get("completion_tokens"),
                total_tokens=metadata.get("total_tokens"),
                request_id=metadata.get("request_id", ""),
                is_success=True,
            )

            log_event(
                organization=assessment.organization,
                actor=user,
                action="ai.workplace_analyzed",
                entity_type="AIAssessment",
                entity_id=assessment.id,
                details={
                    "hazards_identified": len(normalized_result.get("hazards", [])),
                    "checklist_sections": len(normalized_result.get("checklist", {}).get("sections", [])),
                    "model": assessment.ai_model,
                    "architecture": "single_stage_generation",
                },
            )

            return Response(AIAssessmentDetailSerializer(assessment).data)

        except AvalAIError as e:
            assessment.status = AIAssessment.Status.ANALYSIS_FAILED
            assessment.error_message = str(e)
            assessment.save(update_fields=["status", "error_message", "updated_at"])

            AIGenerationLog.objects.create(
                assessment=assessment,
                provider="avalai",
                endpoint=f"{cfg['base_url']}/chat/completions",
                model=cfg["model"],
                is_success=False,
                error_message=str(e),
            )
            return Response(
                {"error": {"code": "ai_analysis_failed", "message": f"خطا در پردازش هوش مصنوعی: {str(e)}"}},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as e:
            logger.exception("AI Workplace Assessment Analyze unexpected error: %s", e)
            assessment.status = AIAssessment.Status.ANALYSIS_FAILED
            assessment.error_message = f"خطای پیش‌بینی نشده: {str(e)}"
            assessment.save(update_fields=["status", "error_message", "updated_at"])
            return Response(
                {"error": {"code": "server_error", "message": f"خطا در پردازش داخلی ارزیابی: {str(e)}"}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["get", "put", "patch"])
    def checklist_draft(self, request, pk=None):
        assessment = self.get_object()
        if request.method == "GET":
            return Response(assessment.checklist_draft or {})

        from .serializers import ChecklistDraftUpdateSerializer
        serializer = ChecklistDraftUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        draft = assessment.checklist_draft or {}
        if "title" in serializer.validated_data:
            draft["title"] = serializer.validated_data["title"]
        if "description" in serializer.validated_data:
            draft["description"] = serializer.validated_data["description"]
        draft["sections"] = serializer.validated_data["sections"]

        assessment.checklist_draft = draft
        if assessment.status in (AIAssessment.Status.ANALYZED, AIAssessment.Status.VALIDATED):
            assessment.status = AIAssessment.Status.EDITING
        assessment.save(update_fields=["checklist_draft", "status", "updated_at"])

        return Response(assessment.checklist_draft)

    @action(detail=True, methods=["get", "put", "patch"], url_path="checklist-draft")
    def checklist_draft_kebab(self, request, pk=None):
        return self.checklist_draft(request, pk)

    @action(detail=True, methods=["post"])
    def validate_draft(self, request, pk=None):
        assessment = self.get_object()
        draft = assessment.checklist_draft or {}
        sections = draft.get("sections", [])
        if not sections:
            return Response(
                {"is_valid": False, "errors": ["پیش‌نویس چک‌لیست فاقد هرگونه بخش بازرسی است."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total_items = 0
        errors = []
        for s_idx, sec in enumerate(sections, 1):
            if not sec.get("title", "").strip():
                errors.append(f"عنوان بخش شماره {s_idx} نمی‌تواند خالی باشد.")
            items = sec.get("items", [])
            total_items += len(items)
            for i_idx, itm in enumerate(items, 1):
                if not itm.get("title", "").strip():
                    errors.append(f"عنوان بند شماره {i_idx} در بخش {sec.get('title')} الزامی است.")

        if total_items == 0:
            errors.append("حداقل یک بند بازرسی برای اعتبارسنجی چک‌لیست الزامی است.")

        if errors:
            return Response({"is_valid": False, "errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        assessment.status = AIAssessment.Status.VALIDATED
        assessment.save(update_fields=["status", "updated_at"])
        return Response({"is_valid": True, "message": "پیش‌نویس چک‌لیست با موفقیت اعتبارسنجی شد و آماده تأیید نهایی است."})

    @action(detail=True, methods=["post"], url_path="validate-draft")
    def validate_draft_kebab(self, request, pk=None):
        return self.validate_draft(request, pk)

    @action(detail=True, methods=["post"], url_path="validate")
    def validate(self, request, pk=None):
        return self.validate_draft(request, pk)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        from .serializers import AIAssessmentApprovalSerializer, AIAssessmentDetailSerializer
        assessment = self.get_object()
        user = request.user
        if not can_review(user, assessment.organization_id):
            raise PermissionDenied("مجوز تأیید نهایی ارزیابی HSE را ندارید.")

        serializer = AIAssessmentApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from django.utils import timezone
        assessment.approved_by = user
        assessment.approved_at = timezone.now()
        assessment.approval_notes = serializer.validated_data.get("approval_notes", "")
        assessment.status = AIAssessment.Status.APPROVED
        assessment.save(update_fields=["approved_by", "approved_at", "approval_notes", "status", "updated_at"])

        log_event(
            organization=assessment.organization,
            actor=user,
            action="ai.assessment_approved",
            entity_type="AIAssessment",
            entity_id=assessment.id,
            details={"approved_by": user.username, "title": assessment.title},
        )

        return Response(AIAssessmentDetailSerializer(assessment).data)

    @action(detail=True, methods=["post"])
    def generate_checklist(self, request, pk=None):
        assessment = self.get_object()
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            from .checklist_generator import generate_real_checklist_from_assessment
            checklist = generate_real_checklist_from_assessment(assessment, request.user)
        except DjangoValidationError as e:
            msg = e.messages[0] if hasattr(e, "messages") and e.messages else str(e)
            return Response({"error": {"code": "validation_error", "message": msg}}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "message": "چک‌لیست رسمی با موفقیت ایجاد شد و در ماژول بازرسی‌ها قابل استفاده است.",
                "checklist_id": checklist.id,
                "checklist_title": checklist.title,
                "items_count": checklist.items.count(),
                "created_at": checklist.created_at,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="generate-checklist")
    def generate_checklist_kebab(self, request, pk=None):
        return self.generate_checklist(request, pk)

    @action(detail=True, methods=["get"])
    def result(self, request, pk=None):
        assessment = self.get_object()
        return Response(assessment.analysis_result or {})

    @action(detail=False, methods=["get", "post"])
    def service_status(self, request):
        from .avalai_client import get_avalai_service_status
        return Response(get_avalai_service_status())

    @action(detail=False, methods=["get", "post"], url_path="service-status")
    def service_status_kebab(self, request):
        return self.service_status(request)

    @action(detail=False, methods=["post"], url_path="test-connection")
    def test_connection(self, request):
        from .avalai_client import test_avalai_connection
        return Response(test_avalai_connection())

    @action(detail=False, methods=["get"])
    def statistics(self, request):
        user = self.request.user
        org_ids = list(accessible_organization_ids(user))
        qs = AIAssessment.objects.filter(organization_id__in=org_ids)

        return Response({
            "total_assessments": qs.count(),
            "draft_count": qs.filter(status=AIAssessment.Status.DRAFT).count(),
            "analyzed_count": qs.filter(status__in=[AIAssessment.Status.ANALYZED, AIAssessment.Status.EDITING]).count(),
            "approved_count": qs.filter(status=AIAssessment.Status.APPROVED).count(),
            "generated_checklists_count": qs.filter(status=AIAssessment.Status.CHECKLIST_GENERATED).count(),
        })

