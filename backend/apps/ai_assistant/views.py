from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auditlog.services import log_event
from apps.checklists.models import Checklist, ChecklistItem
from apps.checklists.serializers import ChecklistSerializer
from apps.core.access import can_edit_risks, can_manage_checklists, is_active_member
from apps.organizations.models import Organization
from apps.risks.models import Hazard
from apps.risks.serializers import HazardSerializer
from apps.workplaces.models import Workplace
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
