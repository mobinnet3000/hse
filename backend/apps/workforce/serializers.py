from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from apps.core.access import (
    can_conduct_training,
    can_issue_competency,
    can_manage_workforce,
    can_operate_ppe,
)
from apps.permits.models import Permit, PermitTypeCompetencyRequirement
from apps.workplaces.models import Workplace

from .models import (
    COMPETENCY_DUE_SOON_DAYS,
    PPE_REPLACEMENT_DUE_SOON_DAYS,
    AttendanceRecord,
    Competency,
    ContractorCompany,
    ContractorDocument,
    ContractorEvaluation,
    ContractorWorker,
    Employee,
    EmployeeCompetency,
    EmployeeJobAssignment,
    JobPosition,
    PPEAssignment,
    PPEAssignmentEvent,
    PPEItem,
    PPEStock,
    TrainingAttendance,
    TrainingCourse,
    TrainingSession,
)


def _request_user(serializer):
    request = serializer.context.get("request")
    return getattr(request, "user", None)


def _full_name(user):
    if not user:
        return None
    return f"{user.first_name} {user.last_name}".strip() or user.username


class UserReferenceSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "full_name"]

    def get_full_name(self, obj):
        return _full_name(obj)


class EmployeeReferenceSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Employee
        fields = ["id", "employee_no", "full_name", "job_title", "is_active"]


class TrainingCourseReferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingCourse
        fields = ["id", "code", "title", "duration_minutes"]


class TrainingSessionReferenceSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = TrainingSession
        fields = ["id", "course", "course_title", "scheduled_on", "status", "status_display"]


class CompetencyReferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Competency
        fields = ["id", "code", "name", "validity_months", "is_active"]


class PPEItemReferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = PPEItem
        fields = ["id", "code", "name", "category", "tracks_serial"]


class PPEStockReferenceSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True, default=None)

    class Meta:
        model = PPEStock
        fields = [
            "id",
            "item",
            "item_code",
            "item_name",
            "workplace",
            "workplace_name",
            "location_name",
            "quantity_on_hand",
            "quantity_minimum",
            "is_active",
        ]


def _employee_latest_competencies(employee):
    records = employee.competency_records.select_related("competency", "source_course", "source_session")
    latest = {}
    for record in records:
        key = record.competency_id
        if key not in latest:
            latest[key] = record
    return list(latest.values())


class EmployeeListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True, default=None)
    user_username = serializers.CharField(source="user.username", read_only=True, default=None)
    user_detail = UserReferenceSerializer(source="user", read_only=True)
    training_count = serializers.SerializerMethodField()
    valid_competency_count = serializers.SerializerMethodField()
    expiring_competency_count = serializers.SerializerMethodField()
    active_ppe_count = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
    can_issue_competency = serializers.SerializerMethodField()
    can_operate_ppe = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "organization",
            "organization_name",
            "workplace",
            "workplace_name",
            "employee_no",
            "first_name",
            "last_name",
            "full_name",
            "job_title",
            "user",
            "user_username",
            "user_detail",
            "is_active",
            "notes",
            "training_count",
            "valid_competency_count",
            "expiring_competency_count",
            "active_ppe_count",
            "is_synthetic",
            "can_manage",
            "can_issue_competency",
            "can_operate_ppe",
            "created_at",
            "updated_at",
        ]

    def get_training_count(self, obj):
        return obj.training_attendances.filter(
            assessment_result=TrainingAttendance.AssessmentResult.PASSED
        ).count()

    def _latest(self, obj):
        if not hasattr(obj, "_latest_competencies"):
            obj._latest_competencies = _employee_latest_competencies(obj)
        return obj._latest_competencies

    def get_valid_competency_count(self, obj):
        return sum(1 for record in self._latest(obj) if record.effective_status in {"valid", "expiring_soon"})

    def get_expiring_competency_count(self, obj):
        return sum(1 for record in self._latest(obj) if record.effective_status == "expiring_soon")

    def get_active_ppe_count(self, obj):
        return obj.ppe_assignments.filter(status=PPEAssignment.Status.ACTIVE).count()

    def get_can_manage(self, obj):
        user = _request_user(self)
        return bool(user and can_manage_workforce(user, obj.organization_id))

    def get_can_issue_competency(self, obj):
        user = _request_user(self)
        return bool(user and can_issue_competency(user, obj.organization_id))

    def get_can_operate_ppe(self, obj):
        user = _request_user(self)
        return bool(user and can_operate_ppe(user, obj.organization_id))


class TrainingCourseSerializer(serializers.ModelSerializer):
    delivery_type_display = serializers.CharField(source="get_delivery_type_display", read_only=True)
    competencies = CompetencyReferenceSerializer(many=True, read_only=True)
    session_count = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = TrainingCourse
        fields = [
            "id",
            "organization",
            "code",
            "title",
            "category",
            "description",
            "objectives",
            "duration_minutes",
            "delivery_type",
            "delivery_type_display",
            "is_mandatory",
            "requires_renewal",
            "validity_months",
            "is_active",
            "competencies",
            "session_count",
            "is_synthetic",
            "can_manage",
            "created_at",
            "updated_at",
        ]

    def get_session_count(self, obj):
        return obj.sessions.count()

    def get_can_manage(self, obj):
        user = _request_user(self)
        return bool(user and can_manage_workforce(user, obj.organization_id))


class TrainingSessionSerializer(serializers.ModelSerializer):
    course_detail = TrainingCourseReferenceSerializer(source="course", read_only=True)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    attendance_count = serializers.SerializerMethodField()
    capacity_remaining = serializers.SerializerMethodField()
    can_train = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = TrainingSession
        fields = [
            "id",
            "organization",
            "course",
            "course_detail",
            "workplace",
            "workplace_name",
            "instructor_name",
            "scheduled_on",
            "duration_minutes",
            "capacity",
            "status",
            "status_display",
            "notes",
            "attendance_count",
            "capacity_remaining",
            "is_synthetic",
            "can_train",
            "can_manage",
            "created_at",
            "updated_at",
        ]

    def get_attendance_count(self, obj):
        return obj.attendances.exclude(
            attendance_status=TrainingAttendance.AttendanceStatus.CANCELLED
        ).count()

    def get_capacity_remaining(self, obj):
        if obj.capacity is None:
            return None
        return max(obj.capacity - self.get_attendance_count(obj), 0)

    def get_can_train(self, obj):
        user = _request_user(self)
        return bool(user and can_conduct_training(user, obj.organization_id))

    def get_can_manage(self, obj):
        user = _request_user(self)
        return bool(user and can_manage_workforce(user, obj.organization_id))


class TrainingAttendanceSerializer(serializers.ModelSerializer):
    employee_detail = EmployeeReferenceSerializer(source="employee", read_only=True)
    session_detail = TrainingSessionReferenceSerializer(source="session", read_only=True)
    attendance_status_display = serializers.CharField(source="get_attendance_status_display", read_only=True)
    assessment_result_display = serializers.CharField(source="get_assessment_result_display", read_only=True)
    is_passed = serializers.BooleanField(read_only=True)
    recorded_by_name = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = TrainingAttendance
        fields = [
            "id",
            "organization",
            "session",
            "session_detail",
            "employee",
            "employee_detail",
            "attendance_status",
            "attendance_status_display",
            "assessment_result",
            "assessment_result_display",
            "score",
            "completed_on",
            "notes",
            "recorded_by",
            "recorded_by_name",
            "is_passed",
            "is_synthetic",
            "can_edit",
            "created_at",
            "updated_at",
        ]

    def get_recorded_by_name(self, obj):
        return _full_name(obj.recorded_by)

    def get_can_edit(self, obj):
        user = _request_user(self)
        return bool(
            user
            and can_conduct_training(user, obj.organization_id)
            and obj.session.status != TrainingSession.Status.CANCELLED
        )


class EmployeeCompetencySerializer(serializers.ModelSerializer):
    employee_detail = EmployeeReferenceSerializer(source="employee", read_only=True)
    competency_detail = CompetencyReferenceSerializer(source="competency", read_only=True)
    source_course_title = serializers.CharField(source="source_course.title", read_only=True, default=None)
    source_session_label = serializers.SerializerMethodField()
    effective_status = serializers.CharField(read_only=True)
    effective_status_display = serializers.SerializerMethodField()
    days_until_expiry = serializers.IntegerField(read_only=True)
    is_valid = serializers.BooleanField(read_only=True)
    recorded_by_name = serializers.SerializerMethodField()
    can_issue = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeCompetency
        fields = [
            "id",
            "organization",
            "employee",
            "employee_detail",
            "competency",
            "competency_detail",
            "achieved_on",
            "expires_on",
            "source_course",
            "source_course_title",
            "source_session",
            "source_session_label",
            "certificate_number",
            "status",
            "effective_status",
            "effective_status_display",
            "days_until_expiry",
            "is_valid",
            "notes",
            "recorded_by",
            "recorded_by_name",
            "is_synthetic",
            "can_issue",
            "created_at",
            "updated_at",
        ]

    def get_source_session_label(self, obj):
        if not obj.source_session:
            return None
        return f"{obj.source_session.course.title} — {obj.source_session.scheduled_on}"

    def get_effective_status_display(self, obj):
        labels = {
            "valid": "معتبر",
            "expiring_soon": "معتبر / نزدیک انقضا",
            "expired": "منقضی",
            "suspended": "تعلیق‌شده",
            "revoked": "لغوشده",
        }
        return labels.get(obj.effective_status, obj.effective_status)

    def get_recorded_by_name(self, obj):
        return _full_name(obj.recorded_by)

    def get_can_issue(self, obj):
        user = _request_user(self)
        return bool(user and can_issue_competency(user, obj.organization_id))


class CompetencySerializer(serializers.ModelSerializer):
    accepted_courses_detail = TrainingCourseReferenceSerializer(source="accepted_courses", many=True, read_only=True)
    valid_record_count = serializers.SerializerMethodField()
    expired_record_count = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = Competency
        fields = [
            "id",
            "organization",
            "code",
            "name",
            "description",
            "allowed_activities",
            "is_mandatory",
            "validity_months",
            "accepted_courses",
            "accepted_courses_detail",
            "is_active",
            "valid_record_count",
            "expired_record_count",
            "is_synthetic",
            "can_manage",
            "created_at",
            "updated_at",
        ]

    def _latest_records(self, obj):
        if not hasattr(obj, "_latest_employee_records"):
            latest = {}
            for record in obj.employee_records.select_related("employee").order_by(
                "employee_id", "-achieved_on", "-id"
            ):
                latest.setdefault(record.employee_id, record)
            obj._latest_employee_records = list(latest.values())
        return obj._latest_employee_records

    def get_valid_record_count(self, obj):
        return sum(1 for record in self._latest_records(obj) if record.is_valid)

    def get_expired_record_count(self, obj):
        return sum(1 for record in self._latest_records(obj) if record.effective_status == "expired")

    def get_can_manage(self, obj):
        user = _request_user(self)
        return bool(user and can_manage_workforce(user, obj.organization_id))


class PermitTypeCompetencyRequirementSerializer(serializers.ModelSerializer):
    competency_detail = CompetencyReferenceSerializer(source="competency", read_only=True)
    permit_type_display = serializers.CharField(source="get_permit_type_display", read_only=True)
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = PermitTypeCompetencyRequirement
        fields = [
            "id",
            "organization",
            "permit_type",
            "permit_type_display",
            "competency",
            "competency_detail",
            "notes",
            "is_synthetic",
            "can_manage",
            "created_at",
        ]

    def get_can_manage(self, obj):
        user = _request_user(self)
        return bool(user and can_manage_workforce(user, obj.organization_id))


class PPEItemSerializer(serializers.ModelSerializer):
    stock_total = serializers.SerializerMethodField()
    active_assignment_count = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = PPEItem
        fields = [
            "id",
            "organization",
            "code",
            "name",
            "category",
            "description",
            "usage_requirements",
            "sizes",
            "replacement_interval_days",
            "inspection_required",
            "is_durable",
            "tracks_serial",
            "is_active",
            "stock_total",
            "active_assignment_count",
            "is_synthetic",
            "can_manage",
            "created_at",
            "updated_at",
        ]

    def get_stock_total(self, obj):
        return sum(stock.quantity_on_hand for stock in obj.stocks.all())

    def get_active_assignment_count(self, obj):
        return obj.assignments.filter(status=PPEAssignment.Status.ACTIVE).count()

    def get_can_manage(self, obj):
        user = _request_user(self)
        return bool(user and can_manage_workforce(user, obj.organization_id))


class PPEStockSerializer(serializers.ModelSerializer):
    item_detail = PPEItemReferenceSerializer(source="item", read_only=True)
    workplace_name = serializers.CharField(source="workplace.name", read_only=True, default=None)
    is_below_minimum = serializers.BooleanField(read_only=True)
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = PPEStock
        fields = [
            "id",
            "organization",
            "item",
            "item_detail",
            "workplace",
            "workplace_name",
            "location_name",
            "quantity_on_hand",
            "quantity_minimum",
            "is_below_minimum",
            "is_active",
            "is_synthetic",
            "can_manage",
            "created_at",
            "updated_at",
        ]

    def get_can_manage(self, obj):
        user = _request_user(self)
        return bool(user and can_manage_workforce(user, obj.organization_id))


class PPEAssignmentEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source="get_event_type_display", read_only=True)
    event_date = serializers.DateField(source="occurred_on", read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = PPEAssignmentEvent
        fields = [
            "id",
            "event_type",
            "event_type_display",
            "occurred_on",
            "event_date",
            "quantity",
            "condition",
            "notes",
            "actor",
            "actor_name",
            "is_synthetic",
            "created_at",
        ]

    def get_actor_name(self, obj):
        return _full_name(obj.actor)


class PPEAssignmentSerializer(serializers.ModelSerializer):
    employee_detail = EmployeeReferenceSerializer(source="employee", read_only=True)
    item_detail = PPEItemReferenceSerializer(source="item", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_category = serializers.CharField(source="item.category", read_only=True)
    stock_detail = PPEStockReferenceSerializer(source="stock", read_only=True)
    stock_location = serializers.CharField(source="stock.location_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    usage_status = serializers.CharField(read_only=True)
    usage_status_display = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    is_due_soon = serializers.SerializerMethodField()
    issued_by_name = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()
    can_return = serializers.SerializerMethodField()
    can_replace = serializers.SerializerMethodField()
    can_dispose = serializers.SerializerMethodField()

    class Meta:
        model = PPEAssignment
        fields = [
            "id",
            "organization",
            "employee",
            "employee_detail",
            "item",
            "item_detail",
            "item_code",
            "item_name",
            "item_category",
            "stock",
            "stock_detail",
            "stock_location",
            "quantity",
            "serial_number",
            "issued_on",
            "condition_on_issue",
            "replacement_due_on",
            "returned_on",
            "return_condition",
            "status",
            "status_display",
            "usage_status",
            "usage_status_display",
            "is_overdue",
            "is_due_soon",
            "issued_by",
            "issued_by_name",
            "notes",
            "events",
            "is_synthetic",
            "can_return",
            "can_replace",
            "can_dispose",
            "created_at",
            "updated_at",
        ]

    def get_usage_status_display(self, obj):
        labels = {
            "in_use": "در استفاده",
            "due_soon": "نزدیک موعد تعویض",
            "overdue": "موعد تعویض گذشته",
            "returned": "برگشت‌داده‌شده",
            "replaced": "تعویض‌شده",
            "disposed": "خارج از سرویس",
        }
        return labels.get(obj.usage_status, obj.usage_status)

    def get_is_due_soon(self, obj):
        return obj.usage_status == "due_soon"

    def get_issued_by_name(self, obj):
        return _full_name(obj.issued_by)

    def get_events(self, obj):
        events = obj.events.select_related("actor").all()
        return PPEAssignmentEventSerializer(events, many=True).data

    def _active_and_allowed(self, obj):
        user = _request_user(self)
        return bool(
            user
            and can_operate_ppe(user, obj.organization_id)
            and obj.status == PPEAssignment.Status.ACTIVE
        )

    def get_can_return(self, obj):
        return self._active_and_allowed(obj)

    def get_can_replace(self, obj):
        return self._active_and_allowed(obj)

    def get_can_dispose(self, obj):
        return self._active_and_allowed(obj)


# ---------------------------------------------------------------------------
# Request serializers
# ---------------------------------------------------------------------------


class EmployeeCreateSerializer(serializers.ModelSerializer):
    workplace = serializers.PrimaryKeyRelatedField(
        queryset=Workplace.objects.all(), required=False, allow_null=True
    )
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Employee
        fields = [
            "employee_no",
            "first_name",
            "last_name",
            "job_title",
            "workplace",
            "user",
            "is_active",
            "notes",
        ]


class EmployeeUpdateSerializer(EmployeeCreateSerializer):
    pass


class TrainingCourseCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingCourse
        fields = [
            "code",
            "title",
            "category",
            "description",
            "objectives",
            "duration_minutes",
            "delivery_type",
            "is_mandatory",
            "requires_renewal",
            "validity_months",
            "is_active",
        ]


class TrainingCourseUpdateSerializer(TrainingCourseCreateSerializer):
    pass


class TrainingSessionCreateSerializer(serializers.ModelSerializer):
    course = serializers.PrimaryKeyRelatedField(queryset=TrainingCourse.objects.all())
    workplace = serializers.PrimaryKeyRelatedField(
        queryset=Workplace.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = TrainingSession
        fields = [
            "course",
            "workplace",
            "instructor_name",
            "scheduled_on",
            "duration_minutes",
            "capacity",
            "status",
            "notes",
        ]

    def validate_instructor_name(self, value):
        if not (value or "").strip():
            raise serializers.ValidationError("نام مدرس یا مسئول برگزاری الزامی است.")
        return value.strip()


class TrainingSessionUpdateSerializer(TrainingSessionCreateSerializer):
    course = serializers.PrimaryKeyRelatedField(read_only=True)
    instructor_name = serializers.CharField(required=False)


class TrainingAttendanceCreateSerializer(serializers.ModelSerializer):
    session = serializers.PrimaryKeyRelatedField(queryset=TrainingSession.objects.all())
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all())

    class Meta:
        model = TrainingAttendance
        fields = [
            "session",
            "employee",
            "attendance_status",
            "assessment_result",
            "score",
            "completed_on",
            "notes",
        ]


class TrainingAttendanceUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingAttendance
        fields = [
            "attendance_status",
            "assessment_result",
            "score",
            "completed_on",
            "notes",
        ]


class CompetencyCreateSerializer(serializers.ModelSerializer):
    accepted_courses = serializers.PrimaryKeyRelatedField(
        queryset=TrainingCourse.objects.all(), many=True, required=False
    )

    class Meta:
        model = Competency
        fields = [
            "code",
            "name",
            "description",
            "allowed_activities",
            "is_mandatory",
            "validity_months",
            "accepted_courses",
            "is_active",
        ]


class CompetencyUpdateSerializer(CompetencyCreateSerializer):
    pass


class EmployeeCompetencyCreateSerializer(serializers.ModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all())
    competency = serializers.PrimaryKeyRelatedField(queryset=Competency.objects.all())
    source_course = serializers.PrimaryKeyRelatedField(
        queryset=TrainingCourse.objects.all(), required=False, allow_null=True
    )
    source_session = serializers.PrimaryKeyRelatedField(
        queryset=TrainingSession.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = EmployeeCompetency
        fields = [
            "employee",
            "competency",
            "achieved_on",
            "expires_on",
            "source_course",
            "source_session",
            "certificate_number",
            "notes",
        ]


class EmployeeCompetencyStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=EmployeeCompetency.Status.choices)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class PermitRequirementCreateSerializer(serializers.ModelSerializer):
    competency = serializers.PrimaryKeyRelatedField(queryset=Competency.objects.all())

    class Meta:
        model = PermitTypeCompetencyRequirement
        fields = ["permit_type", "competency", "notes"]


class PPEItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PPEItem
        fields = [
            "code",
            "name",
            "category",
            "description",
            "usage_requirements",
            "sizes",
            "replacement_interval_days",
            "inspection_required",
            "is_durable",
            "tracks_serial",
            "is_active",
        ]


class PPEItemUpdateSerializer(PPEItemCreateSerializer):
    pass


class PPEStockCreateSerializer(serializers.ModelSerializer):
    item = serializers.PrimaryKeyRelatedField(queryset=PPEItem.objects.all())
    workplace = serializers.PrimaryKeyRelatedField(
        queryset=Workplace.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = PPEStock
        fields = [
            "item",
            "workplace",
            "location_name",
            "quantity_on_hand",
            "quantity_minimum",
            "is_active",
        ]


class PPEStockUpdateSerializer(PPEStockCreateSerializer):
    item = serializers.PrimaryKeyRelatedField(read_only=True)


class PPEAssignmentCreateSerializer(serializers.ModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all())
    item = serializers.PrimaryKeyRelatedField(queryset=PPEItem.objects.all())
    stock = serializers.PrimaryKeyRelatedField(queryset=PPEStock.objects.all())

    class Meta:
        model = PPEAssignment
        fields = [
            "employee",
            "item",
            "stock",
            "quantity",
            "serial_number",
            "issued_on",
            "condition_on_issue",
            "replacement_due_on",
            "notes",
        ]


class PPEAssignmentReturnSerializer(serializers.Serializer):
    returned_on = serializers.DateField(required=False)
    condition = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    restock = serializers.BooleanField(
        required=False,
        default=True,
        help_text="اگر تجهیز سالم و قابل استفاده نیست، False ارسال کنید تا موجودی قابل استفاده افزایش نیابد.",
    )


class PPEAssignmentReplaceSerializer(serializers.Serializer):
    serial_number = serializers.CharField(required=False, allow_blank=True, default="")
    issued_on = serializers.DateField(required=False)
    condition_on_issue = serializers.CharField(required=False, allow_blank=True, default="سالم")
    replacement_due_on = serializers.DateField(required=False, allow_null=True)
    return_condition = serializers.CharField(required=False, allow_blank=True, default="")
    restock_old = serializers.BooleanField(
        required=False,
        default=False,
        help_text="تجهیز تعویض‌شده به‌طور پیش‌فرض به موجودی قابل استفاده برنمی‌گردد.",
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class PPEAssignmentDisposeSerializer(serializers.Serializer):
    condition = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")


# ==============================================================================
# Phase 12: Job Catalog, Contractors & Attendance Serializers
# ==============================================================================

class JobPositionSerializer(serializers.ModelSerializer):
    risk_level_display = serializers.CharField(source="get_risk_level_display", read_only=True)
    required_competency_details = serializers.SerializerMethodField()
    assignments_count = serializers.SerializerMethodField()

    class Meta:
        model = JobPosition
        fields = [
            "id",
            "organization",
            "code",
            "title",
            "description",
            "department",
            "risk_level",
            "risk_level_display",
            "required_competencies",
            "required_competency_details",
            "required_qualifications",
            "is_active",
            "assignments_count",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "created_at", "updated_at"]

    def get_required_competency_details(self, obj):
        return [
            {"id": c.id, "code": c.code, "name": c.name}
            for c in obj.required_competencies.all()
        ]

    def get_assignments_count(self, obj):
        return obj.assignments.filter(end_date__isnull=True).count()


class EmployeeJobAssignmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    job_position_title = serializers.CharField(source="job_position.title", read_only=True)
    job_position_code = serializers.CharField(source="job_position.code", read_only=True)

    class Meta:
        model = EmployeeJobAssignment
        fields = [
            "id",
            "organization",
            "employee",
            "employee_name",
            "job_position",
            "job_position_title",
            "job_position_code",
            "start_date",
            "end_date",
            "is_primary",
            "notes",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "created_at", "updated_at"]

    def validate(self, attrs):
        start = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد."})
        return attrs


class ContractorCompanySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    workers_count = serializers.SerializerMethodField()
    documents_count = serializers.SerializerMethodField()

    class Meta:
        model = ContractorCompany
        fields = [
            "id",
            "organization",
            "name",
            "registration_no",
            "economic_code",
            "contact_person",
            "contact_phone",
            "contact_email",
            "contract_start",
            "contract_end",
            "status",
            "status_display",
            "safety_score",
            "notes",
            "workers_count",
            "documents_count",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "created_at", "updated_at"]

    def get_workers_count(self, obj):
        return obj.workers.filter(is_active=True).count()

    def get_documents_count(self, obj):
        return obj.documents.count()


class ContractorDocumentSerializer(serializers.ModelSerializer):
    contractor_name = serializers.CharField(source="contractor.name", read_only=True)
    document_type_display = serializers.CharField(source="get_document_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    verified_by_name = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = ContractorDocument
        fields = [
            "id",
            "organization",
            "contractor",
            "contractor_name",
            "document_type",
            "document_type_display",
            "title",
            "file_url",
            "valid_from",
            "valid_until",
            "status",
            "status_display",
            "verified_by",
            "verified_by_name",
            "verification_notes",
            "is_expired",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "created_at", "updated_at"]

    def get_verified_by_name(self, obj):
        return _full_name(obj.verified_by)

    def get_is_expired(self, obj):
        if obj.valid_until:
            return obj.valid_until < timezone.localdate()
        return False


class ContractorWorkerSerializer(serializers.ModelSerializer):
    contractor_name = serializers.CharField(source="contractor.name", read_only=True)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = ContractorWorker
        fields = [
            "id",
            "organization",
            "contractor",
            "contractor_name",
            "national_id",
            "first_name",
            "last_name",
            "full_name",
            "mobile",
            "trade",
            "badge_number",
            "is_active",
            "medical_clearance_date",
            "medical_expiry_date",
            "safety_induction_date",
            "notes",
            "is_synthetic",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "created_at", "updated_at"]


class ContractorEvaluationSerializer(serializers.ModelSerializer):
    contractor_name = serializers.CharField(source="contractor.name", read_only=True)
    evaluator_name = serializers.SerializerMethodField()
    recommendation_display = serializers.CharField(source="get_recommendation_display", read_only=True)

    class Meta:
        model = ContractorEvaluation
        fields = [
            "id",
            "organization",
            "contractor",
            "contractor_name",
            "evaluation_date",
            "evaluator",
            "evaluator_name",
            "score",
            "criteria_scores",
            "findings",
            "recommendation",
            "recommendation_display",
            "is_synthetic",
            "created_at",
        ]
        read_only_fields = ["id", "organization", "evaluator", "created_at"]

    def get_evaluator_name(self, obj):
        return _full_name(obj.evaluator)


class AttendanceRecordSerializer(serializers.ModelSerializer):
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    person_type_display = serializers.CharField(source="get_person_type_display", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    contractor_worker_name = serializers.CharField(source="contractor_worker.full_name", read_only=True)
    entry_source_display = serializers.CharField(source="get_entry_source_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    verified_by_name = serializers.SerializerMethodField()
    person_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "organization",
            "workplace",
            "workplace_name",
            "person_type",
            "person_type_display",
            "employee",
            "employee_name",
            "contractor_worker",
            "contractor_worker_name",
            "person_name",
            "date",
            "check_in",
            "check_out",
            "entry_source",
            "entry_source_display",
            "status",
            "status_display",
            "verified_by",
            "verified_by_name",
            "notes",
            "is_synthetic",
            "created_at",
        ]
        read_only_fields = ["id", "organization", "verified_by", "created_at"]

    def get_verified_by_name(self, obj):
        return _full_name(obj.verified_by)

    def get_person_name(self, obj):
        if obj.employee:
            return obj.employee.full_name
        if obj.contractor_worker:
            return obj.contractor_worker.full_name
        return "نامشخص"

    def validate(self, attrs):
        check_in = attrs.get("check_in") or getattr(self.instance, "check_in", None)
        check_out = attrs.get("check_out") or getattr(self.instance, "check_out", None)
        if check_in and check_out and check_out < check_in:
            raise serializers.ValidationError({"check_out": "زمان خروج نمی‌تواند قبل از زمان ورود باشد."})
        return attrs

