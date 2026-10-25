from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import (
    accessible_organization_ids,
    can_calibrate_equipment,
    can_conduct_asset_work,
    can_manage_equipment,
    can_view_organization,
)
from apps.core.views_utils import resolve_organization
from apps.organizations.models import Organization

from .models import (
    MAINTENANCE_DUE_SOON_DAYS,
    CalibrationRecord,
    Equipment,
    MaintenancePlan,
    MaintenanceWorkOrder,
)
from .serializers import (
    CalibrationRecordCreateSerializer,
    CalibrationRecordSerializer,
    EquipmentCreateSerializer,
    EquipmentDetailSerializer,
    EquipmentListSerializer,
    EquipmentStatusActionSerializer,
    EquipmentUpdateSerializer,
    MaintenancePlanCreateSerializer,
    MaintenancePlanSerializer,
    MaintenancePlanUpdateSerializer,
    MaintenanceWorkOrderCreateSerializer,
    MaintenanceWorkOrderSerializer,
    WorkOrderCancelSerializer,
    WorkOrderCompleteSerializer,
)
from .services import (
    cancel_maintenance_work_order,
    change_equipment_status,
    complete_maintenance_work_order,
    create_equipment,
    create_maintenance_plan,
    create_maintenance_work_order,
    equipment_stats,
    record_calibration,
    start_maintenance_work_order,
    update_equipment,
    update_maintenance_plan,
)


NOT_FOUND = {"error": {"code": "not_found", "message": "موردی یافت نشد."}}
FORBIDDEN = {
    "error": {"code": "permission_denied", "message": "اجازه انجام این عملیات را ندارید."}
}


def _service_call(fn, **kwargs):
    try:
        return fn(**kwargs)
    except DjangoValidationError as exc:
        messages = getattr(exc, "messages", None) or [str(exc)]
        raise ValidationError(messages)


def get_equipment_or_404(pk, user):
    equipment = (
        Equipment.objects.select_related("organization", "workplace", "created_by")
        .prefetch_related("calibrations", "maintenance_plans", "work_orders")
        .filter(pk=pk)
        .first()
    )
    if equipment is None or not can_view_organization(user, equipment.organization_id):
        return None
    return equipment


def filter_equipment_queryset(queryset, request):
    organization_id = request.query_params.get("organization")
    if organization_id:
        if organization_id.isdigit() and can_view_organization(
            request.user, int(organization_id)
        ):
            queryset = queryset.filter(organization_id=int(organization_id))
        else:
            return Equipment.objects.none()

    workplace_id = request.query_params.get("workplace")
    if workplace_id and workplace_id.isdigit():
        queryset = queryset.filter(workplace_id=int(workplace_id))

    category = request.query_params.get("category")
    if category:
        queryset = queryset.filter(category=category)

    equipment_status = request.query_params.get("status")
    if equipment_status:
        queryset = queryset.filter(status=equipment_status)

    search = (request.query_params.get("search") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(code__icontains=search)
            | Q(name__icontains=search)
            | Q(serial_number__icontains=search)
            | Q(manufacturer__icontains=search)
            | Q(model_number__icontains=search)
        )

    calibration_status = request.query_params.get("calibration_status")
    if calibration_status:
        ids = [item.id for item in queryset if item.calibration_status == calibration_status]
        queryset = queryset.filter(pk__in=ids)

    today = timezone.localdate()
    due = request.query_params.get("due")
    if due == "maintenance_overdue":
        queryset = queryset.filter(
            maintenance_plans__is_active=True,
            maintenance_plans__next_due_date__lt=today,
        ).distinct()
    elif due == "maintenance_due_soon":
        queryset = queryset.filter(
            maintenance_plans__is_active=True,
            maintenance_plans__next_due_date__gte=today,
            maintenance_plans__next_due_date__lte=today
            + timedelta(days=MAINTENANCE_DUE_SOON_DAYS),
        ).distinct()
    elif due in {"calibration_expired", "calibration_due_soon"}:
        target_status = "expired" if due == "calibration_expired" else "due_soon"
        ids = [item.id for item in queryset if item.calibration_status == target_status]
        queryset = queryset.filter(pk__in=ids)

    return queryset


class EquipmentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_serializer_class(self):
        return EquipmentListSerializer

    def get_queryset(self):
        queryset = (
            Equipment.objects.filter(
                organization_id__in=accessible_organization_ids(self.request.user)
            )
            .select_related("organization", "workplace")
            .prefetch_related("calibrations")
        )
        return filter_equipment_queryset(queryset, self.request)

    def post(self, request, *args, **kwargs):
        organization_id, error = resolve_organization(request, can_manage_equipment)
        if error:
            return error
        organization = Organization.objects.get(pk=organization_id)
        serializer = EquipmentCreateSerializer(
            data=request.data,
            context={"request": request, "organization": organization},
        )
        serializer.is_valid(raise_exception=True)
        equipment = _service_call(
            create_equipment,
            organization=organization,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            EquipmentDetailSerializer(equipment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class EquipmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        equipment = get_equipment_or_404(pk, request.user)
        if equipment is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(
            EquipmentDetailSerializer(equipment, context={"request": request}).data
        )

    def patch(self, request, pk):
        equipment = get_equipment_or_404(pk, request.user)
        if equipment is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_manage_equipment(request.user, equipment.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        if "status" in request.data:
            raise ValidationError(
                {"status": "تغییر وضعیت فقط از طریق endpoint اختصاصی status مجاز است."}
            )
        if "code" in request.data:
            raise ValidationError({"code": "کد تجهیز پس از ثبت قابل تغییر نیست."})
        serializer = EquipmentUpdateSerializer(
            equipment, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        equipment = _service_call(
            update_equipment,
            equipment=equipment,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            EquipmentDetailSerializer(equipment, context={"request": request}).data
        )


class EquipmentStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        equipment = get_equipment_or_404(pk, request.user)
        if equipment is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_manage_equipment(request.user, equipment.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        serializer = EquipmentStatusActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        equipment = _service_call(
            change_equipment_status,
            equipment=equipment,
            actor=request.user,
            new_status=serializer.validated_data["status"],
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(
            EquipmentDetailSerializer(equipment, context={"request": request}).data
        )


class EquipmentStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Equipment.objects.filter(
            organization_id__in=accessible_organization_ids(request.user)
        ).prefetch_related("calibrations")
        queryset = filter_equipment_queryset(queryset, request)
        return Response(equipment_stats(queryset))


class MaintenancePlanListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_serializer_class(self):
        return MaintenancePlanSerializer

    def get_queryset(self):
        queryset = MaintenancePlan.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("equipment", "organization", "responsible")
        equipment_id = self.request.query_params.get("equipment")
        if equipment_id and equipment_id.isdigit():
            queryset = queryset.filter(equipment_id=int(equipment_id))
        organization_id = self.request.query_params.get("organization")
        if organization_id:
            if organization_id.isdigit() and can_view_organization(
                self.request.user, int(organization_id)
            ):
                queryset = queryset.filter(organization_id=int(organization_id))
            else:
                return MaintenancePlan.objects.none()
        active = self.request.query_params.get("is_active")
        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=active == "true")
        due = self.request.query_params.get("due")
        today = timezone.localdate()
        if due == "overdue":
            queryset = queryset.filter(is_active=True, next_due_date__lt=today)
        elif due == "due_soon":
            queryset = queryset.filter(
                is_active=True,
                next_due_date__gte=today,
                next_due_date__lte=today
                + timedelta(days=MAINTENANCE_DUE_SOON_DAYS),
            )
        return queryset

    def post(self, request, *args, **kwargs):
        serializer = MaintenancePlanCreateSerializer(
            data=request.data,
            context={
                "request": request,
                "organization_ids": list(accessible_organization_ids(request.user)),
            },
        )
        serializer.is_valid(raise_exception=True)
        equipment = serializer.validated_data["equipment"]
        if not can_manage_equipment(request.user, equipment.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        plan = _service_call(
            create_maintenance_plan,
            equipment=equipment,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            MaintenancePlanSerializer(plan, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MaintenancePlanDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_plan(self, pk, user):
        plan = (
            MaintenancePlan.objects.select_related("equipment", "organization", "responsible")
            .filter(pk=pk)
            .first()
        )
        if plan is None or not can_view_organization(user, plan.organization_id):
            return None
        return plan

    def get(self, request, pk):
        plan = self.get_plan(pk, request.user)
        if plan is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(MaintenancePlanSerializer(plan, context={"request": request}).data)

    def patch(self, request, pk):
        plan = self.get_plan(pk, request.user)
        if plan is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_manage_equipment(request.user, plan.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        serializer = MaintenancePlanUpdateSerializer(
            plan, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        plan = _service_call(
            update_maintenance_plan,
            plan=plan,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(MaintenancePlanSerializer(plan, context={"request": request}).data)


class MaintenanceWorkOrderListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_serializer_class(self):
        return MaintenanceWorkOrderSerializer

    def get_queryset(self):
        queryset = MaintenanceWorkOrder.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("equipment", "plan", "assigned_to", "organization")
        equipment_id = self.request.query_params.get("equipment")
        if equipment_id and equipment_id.isdigit():
            queryset = queryset.filter(equipment_id=int(equipment_id))
        organization_id = self.request.query_params.get("organization")
        if organization_id:
            if organization_id.isdigit() and can_view_organization(
                self.request.user, int(organization_id)
            ):
                queryset = queryset.filter(organization_id=int(organization_id))
            else:
                return MaintenanceWorkOrder.objects.none()
        work_order_status = self.request.query_params.get("status")
        if work_order_status:
            queryset = queryset.filter(status=work_order_status)
        plan_id = self.request.query_params.get("plan")
        if plan_id and plan_id.isdigit():
            queryset = queryset.filter(plan_id=int(plan_id))
        return queryset

    def post(self, request, *args, **kwargs):
        serializer = MaintenanceWorkOrderCreateSerializer(
            data=request.data,
            context={
                "request": request,
                "organization_ids": list(accessible_organization_ids(request.user)),
            },
        )
        serializer.is_valid(raise_exception=True)
        equipment = serializer.validated_data["equipment"]
        if not can_conduct_asset_work(request.user, equipment.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        order = _service_call(
            create_maintenance_work_order,
            equipment=equipment,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            MaintenanceWorkOrderSerializer(order, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MaintenanceWorkOrderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_order(self, pk, user):
        order = (
            MaintenanceWorkOrder.objects.select_related(
                "equipment", "plan", "assigned_to", "organization"
            )
            .filter(pk=pk)
            .first()
        )
        if order is None or not can_view_organization(user, order.organization_id):
            return None
        return order

    def get(self, request, pk):
        order = self.get_order(pk, request.user)
        if order is None:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(
            MaintenanceWorkOrderSerializer(order, context={"request": request}).data
        )


class MaintenanceWorkOrderStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        order = MaintenanceWorkOrder.objects.filter(pk=pk).first()
        if order is None or not can_view_organization(request.user, order.organization_id):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_conduct_asset_work(request.user, order.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        order = _service_call(start_maintenance_work_order, order=order, actor=request.user)
        return Response(
            MaintenanceWorkOrderSerializer(order, context={"request": request}).data
        )


class MaintenanceWorkOrderCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        order = MaintenanceWorkOrder.objects.filter(pk=pk).first()
        if order is None or not can_view_organization(request.user, order.organization_id):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_conduct_asset_work(request.user, order.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        serializer = WorkOrderCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = _service_call(
            complete_maintenance_work_order,
            order=order,
            actor=request.user,
            completed_date=serializer.validated_data.get("completed_date"),
            findings=serializer.validated_data.get("findings", ""),
            result=serializer.validated_data["result"],
        )
        return Response(
            MaintenanceWorkOrderSerializer(order, context={"request": request}).data
        )


class MaintenanceWorkOrderCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        order = MaintenanceWorkOrder.objects.filter(pk=pk).first()
        if order is None or not can_view_organization(request.user, order.organization_id):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not can_conduct_asset_work(request.user, order.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        serializer = WorkOrderCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = _service_call(
            cancel_maintenance_work_order,
            order=order,
            actor=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(
            MaintenanceWorkOrderSerializer(order, context={"request": request}).data
        )


class CalibrationListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_serializer_class(self):
        return CalibrationRecordSerializer

    def get_queryset(self):
        queryset = CalibrationRecord.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("equipment", "organization", "performed_by")
        equipment_id = self.request.query_params.get("equipment")
        if equipment_id and equipment_id.isdigit():
            queryset = queryset.filter(equipment_id=int(equipment_id))
        organization_id = self.request.query_params.get("organization")
        if organization_id:
            if organization_id.isdigit() and can_view_organization(
                self.request.user, int(organization_id)
            ):
                queryset = queryset.filter(organization_id=int(organization_id))
            else:
                return CalibrationRecord.objects.none()
        result = self.request.query_params.get("result")
        if result:
            queryset = queryset.filter(result=result)
        return queryset

    def post(self, request, *args, **kwargs):
        serializer = CalibrationRecordCreateSerializer(
            data=request.data,
            context={
                "request": request,
                "organization_ids": list(accessible_organization_ids(request.user)),
            },
        )
        serializer.is_valid(raise_exception=True)
        equipment = serializer.validated_data["equipment"]
        if not can_calibrate_equipment(request.user, equipment.organization_id):
            return Response(FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        record = _service_call(
            record_calibration,
            equipment=equipment,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            CalibrationRecordSerializer(record, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CalibrationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        record = (
            CalibrationRecord.objects.select_related("equipment", "organization", "performed_by")
            .filter(pk=pk)
            .first()
        )
        if record is None or not can_view_organization(user=request.user, organization_id=record.organization_id):
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(
            CalibrationRecordSerializer(record, context={"request": request}).data
        )
