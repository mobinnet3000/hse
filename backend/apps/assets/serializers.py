from rest_framework import serializers

from apps.capa.models import CorrectiveAction
from apps.core.access import (
    can_calibrate_equipment,
    can_conduct_asset_work,
    can_manage_equipment,
    is_active_member,
)
from apps.permits.models import Permit
from apps.risks.models import Hazard
from apps.workplaces.models import Workplace

from .models import (
    CalibrationRecord,
    Equipment,
    MaintenancePlan,
    MaintenanceWorkOrder,
)


CALIBRATION_STATUS_LABELS = {
    "not_required": "کالیبراسیون لازم نیست",
    "missing": "کالیبراسیون ثبت‌نشده",
    "valid": "کالیبراسیون معتبر",
    "due_soon": "نزدیک سررسید کالیبراسیون",
    "expired": "کالیبراسیون منقضی",
    "failed": "کالیبراسیون ناموفق",
}


def _full_name(user):
    if not user:
        return None
    return f"{user.first_name} {user.last_name}".strip() or user.username


def _request_user(serializer):
    request = serializer.context.get("request")
    return getattr(request, "user", None)


class HazardReferenceSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Hazard
        fields = ["id", "title", "category", "category_display", "status", "status_display"]


class PermitReferenceSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Permit
        fields = ["id", "reference_code", "title", "status", "status_display", "valid_until"]


class EquipmentListSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True, default=None)
    calibration_status = serializers.CharField(read_only=True)
    calibration_status_display = serializers.SerializerMethodField()
    calibration_due_on = serializers.DateField(read_only=True)
    is_calibration_valid = serializers.BooleanField(read_only=True)
    open_work_orders_count = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
    can_conduct_work = serializers.SerializerMethodField()
    can_calibrate = serializers.SerializerMethodField()

    class Meta:
        model = Equipment
        fields = [
            "id",
            "organization",
            "workplace",
            "workplace_name",
            "code",
            "name",
            "category",
            "category_display",
            "category_detail",
            "manufacturer",
            "model_number",
            "serial_number",
            "status",
            "status_display",
            "calibration_required",
            "calibration_status",
            "calibration_status_display",
            "calibration_due_on",
            "is_calibration_valid",
            "open_work_orders_count",
            "is_synthetic",
            "can_manage",
            "can_conduct_work",
            "can_calibrate",
            "created_at",
            "updated_at",
        ]

    def get_calibration_status_display(self, obj):
        return CALIBRATION_STATUS_LABELS.get(obj.calibration_status, obj.calibration_status)

    def get_open_work_orders_count(self, obj):
        return obj.work_orders.filter(
            status__in=[MaintenanceWorkOrder.Status.PLANNED, MaintenanceWorkOrder.Status.IN_PROGRESS]
        ).count()

    def get_can_manage(self, obj):
        user = _request_user(self)
        return bool(user and can_manage_equipment(user, obj.organization_id))

    def get_can_conduct_work(self, obj):
        user = _request_user(self)
        return bool(user and can_conduct_asset_work(user, obj.organization_id))

    def get_can_calibrate(self, obj):
        user = _request_user(self)
        return bool(user and can_calibrate_equipment(user, obj.organization_id))


class MaintenancePlanSerializer(serializers.ModelSerializer):
    equipment_code = serializers.CharField(source="equipment.code", read_only=True)
    equipment_name = serializers.CharField(source="equipment.name", read_only=True)
    responsible_name = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    is_due_soon = serializers.BooleanField(read_only=True)

    class Meta:
        model = MaintenancePlan
        fields = [
            "id",
            "organization",
            "equipment",
            "equipment_code",
            "equipment_name",
            "title",
            "interval_days",
            "instructions",
            "responsible",
            "responsible_name",
            "start_date",
            "next_due_date",
            "is_active",
            "is_overdue",
            "is_due_soon",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]

    def get_responsible_name(self, obj):
        return _full_name(obj.responsible)


class MaintenanceWorkOrderSerializer(serializers.ModelSerializer):
    equipment_code = serializers.CharField(source="equipment.code", read_only=True)
    equipment_name = serializers.CharField(source="equipment.name", read_only=True)
    plan_title = serializers.CharField(source="plan.title", read_only=True, default=None)
    work_type_display = serializers.CharField(source="get_work_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    can_start = serializers.SerializerMethodField()
    can_complete = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()

    class Meta:
        model = MaintenanceWorkOrder
        fields = [
            "id",
            "organization",
            "equipment",
            "equipment_code",
            "equipment_name",
            "plan",
            "plan_title",
            "title",
            "work_type",
            "work_type_display",
            "status",
            "status_display",
            "assigned_to",
            "assigned_to_name",
            "scheduled_date",
            "completed_date",
            "description",
            "findings",
            "result",
            "cancellation_reason",
            "is_synthetic",
            "can_start",
            "can_complete",
            "can_cancel",
            "created_at",
            "updated_at",
        ]

    def get_assigned_to_name(self, obj):
        return _full_name(obj.assigned_to)

    def get_can_start(self, obj):
        user = _request_user(self)
        return bool(
            user
            and can_conduct_asset_work(user, obj.organization_id)
            and obj.status == MaintenanceWorkOrder.Status.PLANNED
        )

    def get_can_complete(self, obj):
        user = _request_user(self)
        return bool(
            user
            and can_conduct_asset_work(user, obj.organization_id)
            and obj.status
            in {MaintenanceWorkOrder.Status.PLANNED, MaintenanceWorkOrder.Status.IN_PROGRESS}
        )

    def get_can_cancel(self, obj):
        return self.get_can_complete(obj)


class CalibrationRecordSerializer(serializers.ModelSerializer):
    equipment_code = serializers.CharField(source="equipment.code", read_only=True)
    equipment_name = serializers.CharField(source="equipment.name", read_only=True)
    result_display = serializers.CharField(source="get_result_display", read_only=True)
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CalibrationRecord
        fields = [
            "id",
            "organization",
            "equipment",
            "equipment_code",
            "equipment_name",
            "performed_on",
            "next_due_on",
            "provider",
            "certificate_number",
            "result",
            "result_display",
            "notes",
            "document_reference",
            "performed_by",
            "performed_by_name",
            "created_at",
        ]

    def get_performed_by_name(self, obj):
        return _full_name(obj.performed_by)


class EquipmentDetailSerializer(EquipmentListSerializer):
    related_hazards = HazardReferenceSerializer(many=True, read_only=True)
    related_permits = PermitReferenceSerializer(many=True, read_only=True)
    maintenance_plans = serializers.SerializerMethodField()
    work_orders = serializers.SerializerMethodField()
    calibrations = serializers.SerializerMethodField()
    related_incidents = serializers.SerializerMethodField()
    related_inspections = serializers.SerializerMethodField()
    related_nonconformities = serializers.SerializerMethodField()
    related_corrective_actions = serializers.SerializerMethodField()

    class Meta(EquipmentListSerializer.Meta):
        fields = EquipmentListSerializer.Meta.fields + [
            "description",
            "specifications",
            "purchase_date",
            "installation_date",
            "related_hazards",
            "related_permits",
            "maintenance_plans",
            "work_orders",
            "calibrations",
            "related_incidents",
            "related_inspections",
            "related_nonconformities",
            "related_corrective_actions",
        ]

    def get_maintenance_plans(self, obj):
        return MaintenancePlanSerializer(
            obj.maintenance_plans.all(), many=True, context=self.context
        ).data

    def get_work_orders(self, obj):
        return MaintenanceWorkOrderSerializer(
            obj.work_orders.select_related("plan", "assigned_to").all()[:50],
            many=True,
            context=self.context,
        ).data

    def get_calibrations(self, obj):
        return CalibrationRecordSerializer(
            obj.calibrations.select_related("performed_by").all()[:50],
            many=True,
            context=self.context,
        ).data

    def get_related_incidents(self, obj):
        return [
            {
                "id": item.id,
                "title": item.title,
                "status": item.status,
                "status_display": item.get_status_display(),
                "occurred_at": item.occurred_at,
            }
            for item in obj.incidents.all()[:20]
        ]

    def get_related_inspections(self, obj):
        return [
            {
                "id": item.id,
                "title": item.title or f"بازرسی #{item.id}",
                "status": item.status,
                "status_display": item.get_status_display(),
                "created_at": item.created_at,
            }
            for item in obj.inspections.all()[:20]
        ]

    def get_related_nonconformities(self, obj):
        return [
            {
                "id": item.id,
                "description": item.description[:200],
                "severity": item.severity,
                "severity_display": item.get_severity_display(),
                "status": item.status,
                "status_display": item.get_status_display(),
                "created_at": item.created_at,
            }
            for item in obj.non_conformities.all()[:20]
        ]

    def get_related_corrective_actions(self, obj):
        actions = (
            CorrectiveAction.objects.filter(non_conformity__equipment=obj)
            .select_related("non_conformity")
            .order_by("-created_at")[:20]
        )
        return [
            {
                "id": action.id,
                "description": action.description[:200],
                "status": action.status,
                "status_display": action.get_status_display(),
                "due_date": action.due_date,
                "nonconformity_id": action.non_conformity_id,
            }
            for action in actions
        ]


class EquipmentCreateSerializer(serializers.ModelSerializer):
    related_hazards = serializers.PrimaryKeyRelatedField(
        queryset=Hazard.objects.all(), many=True, required=False
    )
    related_permits = serializers.PrimaryKeyRelatedField(
        queryset=Permit.objects.all(), many=True, required=False
    )

    class Meta:
        model = Equipment
        fields = [
            "workplace",
            "code",
            "name",
            "category",
            "category_detail",
            "manufacturer",
            "model_number",
            "serial_number",
            "purchase_date",
            "installation_date",
            "status",
            "description",
            "specifications",
            "calibration_required",
            "related_hazards",
            "related_permits",
        ]
        extra_kwargs = {"status": {"required": False}}

    def validate(self, attrs):
        organization = self.context.get("organization")
        if organization is None:
            raise serializers.ValidationError({"organization": "سازمان مشخص نیست."})
        workplace = attrs.get("workplace")
        if workplace and workplace.organization_id != organization.id:
            raise serializers.ValidationError({"workplace": "محل استقرار باید متعلق به همان سازمان باشد."})
        for hazard in attrs.get("related_hazards", []):
            if hazard.organization_id != organization.id:
                raise serializers.ValidationError({"related_hazards": "مخاطره منتخب متعلق به همین سازمان نیست."})
        for permit in attrs.get("related_permits", []):
            if permit.organization_id != organization.id:
                raise serializers.ValidationError({"related_permits": "مجوز کار منتخب متعلق به همین سازمان نیست."})
        code = (attrs.get("code") or "").strip()
        if not code:
            raise serializers.ValidationError({"code": "کد تجهیز الزامی است."})
        purchase = attrs.get("purchase_date")
        installation = attrs.get("installation_date")
        if purchase and installation and installation < purchase:
            raise serializers.ValidationError({"installation_date": "تاریخ نصب نمی‌تواند قبل از تاریخ خرید باشد."})
        return attrs


class EquipmentUpdateSerializer(serializers.ModelSerializer):
    related_hazards = serializers.PrimaryKeyRelatedField(
        queryset=Hazard.objects.all(), many=True, required=False
    )
    related_permits = serializers.PrimaryKeyRelatedField(
        queryset=Permit.objects.all(), many=True, required=False
    )

    class Meta:
        model = Equipment
        fields = [
            "workplace",
            "name",
            "category",
            "category_detail",
            "manufacturer",
            "model_number",
            "serial_number",
            "purchase_date",
            "installation_date",
            "description",
            "specifications",
            "calibration_required",
            "related_hazards",
            "related_permits",
        ]

    def validate(self, attrs):
        equipment = self.instance
        organization = equipment.organization
        workplace = attrs.get("workplace", equipment.workplace)
        if workplace and workplace.organization_id != organization.id:
            raise serializers.ValidationError({"workplace": "محل استقرار باید متعلق به همان سازمان باشد."})
        for hazard in attrs.get("related_hazards", []):
            if hazard.organization_id != organization.id:
                raise serializers.ValidationError({"related_hazards": "مخاطره منتخب متعلق به همین سازمان نیست."})
        for permit in attrs.get("related_permits", []):
            if permit.organization_id != organization.id:
                raise serializers.ValidationError({"related_permits": "مجوز کار منتخب متعلق به همین سازمان نیست."})
        purchase = attrs.get("purchase_date", equipment.purchase_date)
        installation = attrs.get("installation_date", equipment.installation_date)
        if purchase and installation and installation < purchase:
            raise serializers.ValidationError({"installation_date": "تاریخ نصب نمی‌تواند قبل از تاریخ خرید باشد."})
        return attrs


class EquipmentStatusActionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Equipment.Status.choices)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class MaintenancePlanCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenancePlan
        fields = [
            "equipment",
            "title",
            "interval_days",
            "instructions",
            "responsible",
            "start_date",
            "is_active",
        ]

    def validate(self, attrs):
        equipment = attrs.get("equipment")
        responsible = attrs.get("responsible")
        if equipment is None:
            raise serializers.ValidationError({"equipment": "تجهیز الزامی است."})
        if equipment.organization_id not in self.context.get("organization_ids", []):
            raise serializers.ValidationError({"equipment": "تجهیز یافت نشد."})
        if responsible is not None and not is_active_member(responsible, equipment.organization_id):
            raise serializers.ValidationError({"responsible": "مسئول باید عضو فعال همان سازمان باشد."})
        return attrs


class MaintenancePlanUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenancePlan
        fields = [
            "title",
            "interval_days",
            "instructions",
            "responsible",
            "start_date",
            "is_active",
        ]

    def validate(self, attrs):
        responsible = attrs.get("responsible", self.instance.responsible)
        if responsible is not None and not is_active_member(
            responsible, self.instance.organization_id
        ):
            raise serializers.ValidationError({"responsible": "مسئول باید عضو فعال همان سازمان باشد."})
        return attrs


class MaintenanceWorkOrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceWorkOrder
        fields = [
            "equipment",
            "plan",
            "title",
            "work_type",
            "assigned_to",
            "scheduled_date",
            "description",
        ]
        extra_kwargs = {
            "title": {"required": False, "allow_blank": True},
            "work_type": {"required": False},
            "scheduled_date": {"required": False},
        }

    def validate(self, attrs):
        equipment = attrs.get("equipment")
        plan = attrs.get("plan")
        assigned_to = attrs.get("assigned_to")
        if equipment is None:
            raise serializers.ValidationError({"equipment": "تجهیز الزامی است."})
        if equipment.organization_id not in self.context.get("organization_ids", []):
            raise serializers.ValidationError({"equipment": "تجهیز یافت نشد."})
        if plan is not None and plan.equipment_id != equipment.id:
            raise serializers.ValidationError({"plan": "برنامه نگهداری باید متعلق به همین تجهیز باشد."})
        if assigned_to is not None and not is_active_member(
            assigned_to, equipment.organization_id
        ):
            raise serializers.ValidationError({"assigned_to": "مسئول انجام باید عضو فعال همان سازمان باشد."})
        return attrs


class WorkOrderCompleteSerializer(serializers.Serializer):
    completed_date = serializers.DateField(required=False)
    findings = serializers.CharField(required=False, allow_blank=True, default="")
    result = serializers.CharField(required=True, allow_blank=False)


class WorkOrderCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True, allow_blank=False)


class CalibrationRecordCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalibrationRecord
        fields = [
            "equipment",
            "performed_on",
            "next_due_on",
            "provider",
            "certificate_number",
            "result",
            "notes",
            "document_reference",
        ]

    def validate(self, attrs):
        equipment = attrs.get("equipment")
        if equipment is None:
            raise serializers.ValidationError({"equipment": "تجهیز الزامی است."})
        if equipment.organization_id not in self.context.get("organization_ids", []):
            raise serializers.ValidationError({"equipment": "تجهیز یافت نشد."})
        performed = attrs.get("performed_on")
        next_due = attrs.get("next_due_on")
        if performed and next_due and next_due <= performed:
            raise serializers.ValidationError(
                {"next_due_on": "تاریخ سررسید کالیبراسیون باید بعد از تاریخ انجام باشد."}
            )
        return attrs
