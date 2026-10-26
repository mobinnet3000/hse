from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import F, Q, ProtectedError
from django.utils import timezone
from rest_framework import generics, status as drf_status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import (
    accessible_organization_ids,
    can_conduct_training,
    can_issue_competency,
    can_manage_workforce,
    can_operate_ppe,
    can_view_organization,
)
from apps.core.views_utils import resolve_organization
from apps.organizations.models import Organization
from apps.permits.models import PermitTypeCompetencyRequirement

from .models import (
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
    PPEItem,
    PPEStock,
    TrainingAttendance,
    TrainingCourse,
    TrainingSession,
)
from .serializers import (
    CompetencyCreateSerializer,
    CompetencySerializer,
    CompetencyUpdateSerializer,
    EmployeeCompetencyCreateSerializer,
    EmployeeCompetencySerializer,
    EmployeeCompetencyStatusSerializer,
    EmployeeCreateSerializer,
    EmployeeListSerializer,
    EmployeeUpdateSerializer,
    PermitRequirementCreateSerializer,
    PermitTypeCompetencyRequirementSerializer,
    PPEAssignmentCreateSerializer,
    PPEAssignmentDisposeSerializer,
    PPEAssignmentReplaceSerializer,
    PPEAssignmentReturnSerializer,
    PPEAssignmentSerializer,
    PPEItemCreateSerializer,
    PPEItemSerializer,
    PPEItemUpdateSerializer,
    PPEStockCreateSerializer,
    PPEStockSerializer,
    PPEStockUpdateSerializer,
    TrainingAttendanceCreateSerializer,
    TrainingAttendanceSerializer,
    TrainingAttendanceUpdateSerializer,
    TrainingCourseCreateSerializer,
    TrainingCourseSerializer,
    TrainingCourseUpdateSerializer,
    TrainingSessionCreateSerializer,
    TrainingSessionSerializer,
    TrainingSessionUpdateSerializer,
    AttendanceRecordSerializer,
    ContractorCompanySerializer,
    ContractorDocumentSerializer,
    ContractorEvaluationSerializer,
    ContractorWorkerSerializer,
    EmployeeJobAssignmentSerializer,
    JobPositionSerializer,
)
from .services import (
    change_employee_competency_status,
    create_assignment,
    create_attendance,
    create_competency,
    create_course,
    create_employee,
    create_ppe_item,
    create_session,
    create_stock,
    dispose_assignment,
    issue_employee_competency,
    replace_assignment,
    return_assignment,
    update_attendance,
    update_competency,
    update_course,
    update_employee,
    update_ppe_item,
    update_session,
    update_stock,
    workforce_stats,
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


def _org_from_request(request, check):
    organization_id, error = resolve_organization(request, check)
    if error:
        return None, error
    return Organization.objects.get(pk=organization_id), None


def _serialize(serializer_class, instance, request):
    return serializer_class(instance, context={"request": request}).data


def _filter_org(queryset, request, field="organization_id"):
    organization_id = request.query_params.get("organization")
    if organization_id:
        if organization_id.isdigit() and can_view_organization(request.user, int(organization_id)):
            queryset = queryset.filter(**{field: int(organization_id)})
        else:
            return queryset.none()
    return queryset


def _get_employee(pk, user):
    employee = Employee.objects.select_related("organization", "workplace", "user").filter(pk=pk).first()
    if employee is None or not can_view_organization(user, employee.organization_id):
        return None
    return employee


def _get_course(pk, user):
    course = TrainingCourse.objects.select_related("organization").prefetch_related("competencies", "sessions").filter(pk=pk).first()
    if course is None or not can_view_organization(user, course.organization_id):
        return None
    return course


def _get_session(pk, user):
    session = TrainingSession.objects.select_related("organization", "course", "workplace").filter(pk=pk).first()
    if session is None or not can_view_organization(user, session.organization_id):
        return None
    return session


def _get_attendance(pk, user):
    attendance = TrainingAttendance.objects.select_related("organization", "session", "session__course", "employee", "recorded_by").filter(pk=pk).first()
    if attendance is None or not can_view_organization(user, attendance.organization_id):
        return None
    return attendance


def _get_competency(pk, user):
    competency = Competency.objects.select_related("organization").prefetch_related("accepted_courses").filter(pk=pk).first()
    if competency is None or not can_view_organization(user, competency.organization_id):
        return None
    return competency


def _get_employee_competency(pk, user):
    record = EmployeeCompetency.objects.select_related("organization", "employee", "competency", "source_course", "source_session", "recorded_by").filter(pk=pk).first()
    if record is None or not can_view_organization(user, record.organization_id):
        return None
    return record


def _get_requirement(pk, user):
    requirement = PermitTypeCompetencyRequirement.objects.select_related("organization", "competency").filter(pk=pk).first()
    if requirement is None or not can_view_organization(user, requirement.organization_id):
        return None
    return requirement


def _get_ppe_item(pk, user):
    item = PPEItem.objects.select_related("organization").filter(pk=pk).first()
    if item is None or not can_view_organization(user, item.organization_id):
        return None
    return item


def _get_stock(pk, user):
    stock = PPEStock.objects.select_related("organization", "item", "workplace").filter(pk=pk).first()
    if stock is None or not can_view_organization(user, stock.organization_id):
        return None
    return stock


def _get_assignment(pk, user):
    assignment = PPEAssignment.objects.select_related("organization", "employee", "item", "stock", "issued_by").filter(pk=pk).first()
    if assignment is None or not can_view_organization(user, assignment.organization_id):
        return None
    return assignment


# ---------------------------------------------------------------------------
# Employees
# ---------------------------------------------------------------------------


class EmployeeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = EmployeeListSerializer

    def get_queryset(self):
        queryset = Employee.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("organization", "workplace", "user")
        queryset = _filter_org(queryset, self.request)
        workplace = self.request.query_params.get("workplace")
        if workplace and workplace.isdigit():
            queryset = queryset.filter(workplace_id=int(workplace))
        active = self.request.query_params.get("is_active")
        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=active == "true")
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(employee_no__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(job_title__icontains=search)
                | Q(user__username__icontains=search)
            )
        return queryset.distinct()

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_manage_workforce)
        if error:
            return error
        serializer = EmployeeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = _service_call(
            create_employee,
            organization=organization,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            _serialize(EmployeeListSerializer, employee, request),
            status=drf_status.HTTP_201_CREATED,
        )


class EmployeeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        employee = _get_employee(pk, request.user)
        if employee is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        return Response(_serialize(EmployeeListSerializer, employee, request))

    def patch(self, request, pk):
        employee = _get_employee(pk, request.user)
        if employee is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        if not can_manage_workforce(request.user, employee.organization_id):
            return Response(FORBIDDEN, status=drf_status.HTTP_403_FORBIDDEN)
        serializer = EmployeeUpdateSerializer(employee, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        employee = _service_call(
            update_employee,
            employee=employee,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(_serialize(EmployeeListSerializer, employee, request))


class EmployeeTrainingHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        employee = _get_employee(pk, request.user)
        if employee is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        queryset = TrainingAttendance.objects.filter(employee=employee).select_related(
            "organization", "session", "session__course", "employee", "recorded_by"
        )
        return Response(
            TrainingAttendanceSerializer(
                queryset, many=True, context={"request": request}
            ).data
        )


class EmployeeCompetencyHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        employee = _get_employee(pk, request.user)
        if employee is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        queryset = EmployeeCompetency.objects.filter(employee=employee).select_related(
            "organization", "employee", "competency", "source_course", "source_session", "recorded_by"
        )
        return Response(
            EmployeeCompetencySerializer(
                queryset, many=True, context={"request": request}
            ).data
        )


class EmployeePPEHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        employee = _get_employee(pk, request.user)
        if employee is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        queryset = PPEAssignment.objects.filter(employee=employee).select_related(
            "organization", "employee", "item", "stock", "stock__workplace", "issued_by"
        ).prefetch_related("events", "events__actor")
        return Response(
            PPEAssignmentSerializer(
                queryset, many=True, context={"request": request}
            ).data
        )


# ---------------------------------------------------------------------------
# Training courses, sessions and attendance
# ---------------------------------------------------------------------------


class TrainingCourseListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = TrainingCourseSerializer

    def get_queryset(self):
        queryset = TrainingCourse.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("organization").prefetch_related("competencies", "sessions")
        queryset = _filter_org(queryset, self.request)
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__iexact=category)
        active = self.request.query_params.get("is_active")
        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=active == "true")
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(code__icontains=search)
                | Q(title__icontains=search)
                | Q(category__icontains=search)
                | Q(description__icontains=search)
            )
        return queryset.distinct()

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_manage_workforce)
        if error:
            return error
        serializer = TrainingCourseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course = _service_call(
            create_course,
            organization=organization,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            _serialize(TrainingCourseSerializer, course, request),
            status=drf_status.HTTP_201_CREATED,
        )


class TrainingCourseDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        course = _get_course(pk, request.user)
        if course is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        return Response(_serialize(TrainingCourseSerializer, course, request))

    def patch(self, request, pk):
        course = _get_course(pk, request.user)
        if course is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        if not can_manage_workforce(request.user, course.organization_id):
            return Response(FORBIDDEN, status=drf_status.HTTP_403_FORBIDDEN)
        serializer = TrainingCourseUpdateSerializer(course, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        course = _service_call(
            update_course, course=course, actor=request.user, data=serializer.validated_data
        )
        return Response(_serialize(TrainingCourseSerializer, course, request))


class TrainingSessionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = TrainingSessionSerializer

    def get_queryset(self):
        queryset = TrainingSession.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("organization", "course", "workplace")
        queryset = _filter_org(queryset, self.request)
        course = self.request.query_params.get("course")
        if course and course.isdigit():
            queryset = queryset.filter(course_id=int(course))
        session_status = self.request.query_params.get("status")
        if session_status:
            queryset = queryset.filter(status=session_status)
        date_from = self.request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(scheduled_on__gte=date_from)
        date_to = self.request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(scheduled_on__lte=date_to)
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(instructor_name__icontains=search)
                | Q(course__title__icontains=search)
                | Q(course__code__icontains=search)
            )
        return queryset.distinct()

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_conduct_training)
        if error:
            return error
        serializer = TrainingSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = _service_call(
            create_session,
            organization=organization,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            _serialize(TrainingSessionSerializer, session, request),
            status=drf_status.HTTP_201_CREATED,
        )


class TrainingSessionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        session = _get_session(pk, request.user)
        if session is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        return Response(_serialize(TrainingSessionSerializer, session, request))

    def patch(self, request, pk):
        session = _get_session(pk, request.user)
        if session is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        if not can_conduct_training(request.user, session.organization_id):
            return Response(FORBIDDEN, status=drf_status.HTTP_403_FORBIDDEN)
        serializer = TrainingSessionUpdateSerializer(session, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        session = _service_call(
            update_session, session=session, actor=request.user, data=serializer.validated_data
        )
        return Response(_serialize(TrainingSessionSerializer, session, request))


class TrainingAttendanceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = TrainingAttendanceSerializer

    def get_queryset(self):
        queryset = TrainingAttendance.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("organization", "session", "session__course", "employee", "recorded_by")
        queryset = _filter_org(queryset, self.request)
        session = self.request.query_params.get("session")
        if session and session.isdigit():
            queryset = queryset.filter(session_id=int(session))
        employee = self.request.query_params.get("employee")
        if employee and employee.isdigit():
            queryset = queryset.filter(employee_id=int(employee))
        attendance_status = self.request.query_params.get("attendance_status")
        if attendance_status:
            queryset = queryset.filter(attendance_status=attendance_status)
        result = self.request.query_params.get("assessment_result")
        if result:
            queryset = queryset.filter(assessment_result=result)
        course = self.request.query_params.get("course")
        if course and course.isdigit():
            queryset = queryset.filter(session__course_id=int(course))
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(employee__employee_no__icontains=search)
                | Q(employee__first_name__icontains=search)
                | Q(employee__last_name__icontains=search)
                | Q(session__course__title__icontains=search)
            )
        return queryset.distinct()

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_conduct_training)
        if error:
            return error
        serializer = TrainingAttendanceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = serializer.validated_data["session"]
        if session.organization_id != organization.id:
            raise ValidationError({"session": "نوبت آموزشی باید متعلق به همان سازمان باشد."})
        attendance = _service_call(
            create_attendance,
            session=session,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            _serialize(TrainingAttendanceSerializer, attendance, request),
            status=drf_status.HTTP_201_CREATED,
        )


class TrainingAttendanceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        attendance = _get_attendance(pk, request.user)
        if attendance is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        return Response(_serialize(TrainingAttendanceSerializer, attendance, request))

    def patch(self, request, pk):
        attendance = _get_attendance(pk, request.user)
        if attendance is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        if not can_conduct_training(request.user, attendance.organization_id):
            return Response(FORBIDDEN, status=drf_status.HTTP_403_FORBIDDEN)
        serializer = TrainingAttendanceUpdateSerializer(
            attendance, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        attendance = _service_call(
            update_attendance,
            attendance=attendance,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(_serialize(TrainingAttendanceSerializer, attendance, request))


# ---------------------------------------------------------------------------
# Competencies and permit requirements
# ---------------------------------------------------------------------------


class CompetencyListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = CompetencySerializer

    def get_queryset(self):
        queryset = Competency.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("organization").prefetch_related("accepted_courses", "employee_records")
        queryset = _filter_org(queryset, self.request)
        active = self.request.query_params.get("is_active")
        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=active == "true")
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(code__icontains=search)
                | Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(allowed_activities__icontains=search)
            )
        return queryset.distinct()

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_manage_workforce)
        if error:
            return error
        serializer = CompetencyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        competency = _service_call(
            create_competency,
            organization=organization,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            _serialize(CompetencySerializer, competency, request),
            status=drf_status.HTTP_201_CREATED,
        )


class CompetencyDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        competency = _get_competency(pk, request.user)
        if competency is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        return Response(_serialize(CompetencySerializer, competency, request))

    def patch(self, request, pk):
        competency = _get_competency(pk, request.user)
        if competency is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        if not can_manage_workforce(request.user, competency.organization_id):
            return Response(FORBIDDEN, status=drf_status.HTTP_403_FORBIDDEN)
        serializer = CompetencyUpdateSerializer(
            competency, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        competency = _service_call(
            update_competency,
            competency=competency,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(_serialize(CompetencySerializer, competency, request))


class EmployeeCompetencyListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = EmployeeCompetencySerializer

    def get_queryset(self):
        queryset = EmployeeCompetency.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related(
            "organization", "employee", "competency", "source_course", "source_session", "recorded_by"
        )
        queryset = _filter_org(queryset, self.request)
        employee = self.request.query_params.get("employee")
        if employee and employee.isdigit():
            queryset = queryset.filter(employee_id=int(employee))
        competency = self.request.query_params.get("competency")
        if competency and competency.isdigit():
            queryset = queryset.filter(competency_id=int(competency))
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        expiry = self.request.query_params.get("expiry")
        today = timezone.localdate()
        if expiry == "expired":
            queryset = queryset.filter(
                status=EmployeeCompetency.Status.ACTIVE, expires_on__lt=today
            )
        elif expiry == "expiring":
            queryset = queryset.filter(
                status=EmployeeCompetency.Status.ACTIVE,
                expires_on__gte=today,
                expires_on__lte=today + timedelta(days=30),
            )
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(employee__employee_no__icontains=search)
                | Q(employee__first_name__icontains=search)
                | Q(employee__last_name__icontains=search)
                | Q(competency__name__icontains=search)
                | Q(competency__code__icontains=search)
            )
        return queryset.distinct()

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_issue_competency)
        if error:
            return error
        serializer = EmployeeCompetencyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = _service_call(
            issue_employee_competency,
            organization=organization,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            _serialize(EmployeeCompetencySerializer, record, request),
            status=drf_status.HTTP_201_CREATED,
        )


class EmployeeCompetencyDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        record = _get_employee_competency(pk, request.user)
        if record is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        return Response(_serialize(EmployeeCompetencySerializer, record, request))


class EmployeeCompetencyStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        record = _get_employee_competency(pk, request.user)
        if record is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        if not can_issue_competency(request.user, record.organization_id):
            return Response(FORBIDDEN, status=drf_status.HTTP_403_FORBIDDEN)
        serializer = EmployeeCompetencyStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = _service_call(
            change_employee_competency_status,
            record=record,
            actor=request.user,
            new_status=serializer.validated_data["status"],
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(_serialize(EmployeeCompetencySerializer, record, request))


class PermitRequirementListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = PermitTypeCompetencyRequirementSerializer

    def get_queryset(self):
        queryset = PermitTypeCompetencyRequirement.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("organization", "competency")
        queryset = _filter_org(queryset, self.request)
        permit_type = self.request.query_params.get("permit_type")
        if permit_type:
            queryset = queryset.filter(permit_type=permit_type)
        return queryset.distinct()

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_manage_workforce)
        if error:
            return error
        serializer = PermitRequirementCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        competency = serializer.validated_data["competency"]
        if competency.organization_id != organization.id:
            raise ValidationError({"competency": "صلاحیت باید متعلق به همان سازمان باشد."})
        from apps.auditlog.services import log_event

        requirement = PermitTypeCompetencyRequirement(
            organization=organization,
            created_by=request.user,
            **serializer.validated_data,
        )
        requirement.full_clean()
        try:
            requirement.save()
        except IntegrityError as exc:
            raise ValidationError(
                {"competency": "این صلاحیت برای این نوع مجوز قبلاً تعریف شده است."}
            ) from exc
        log_event(
            organization=organization,
            actor=request.user,
            action="permit_requirement.created",
            entity_type="permit_type_competency_requirement",
            entity_id=requirement.pk,
            details={
                "permit_type": requirement.permit_type,
                "competency_code": competency.code,
            },
        )
        return Response(
            _serialize(PermitTypeCompetencyRequirementSerializer, requirement, request),
            status=drf_status.HTTP_201_CREATED,
        )


class PermitRequirementDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        requirement = _get_requirement(pk, request.user)
        if requirement is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        return Response(
            _serialize(PermitTypeCompetencyRequirementSerializer, requirement, request)
        )

    def delete(self, request, pk):
        requirement = _get_requirement(pk, request.user)
        if requirement is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        if not can_manage_workforce(request.user, requirement.organization_id):
            return Response(FORBIDDEN, status=drf_status.HTTP_403_FORBIDDEN)
        from apps.auditlog.services import log_event

        details = {
            "permit_type": requirement.permit_type,
            "competency_code": requirement.competency.code,
        }
        organization = requirement.organization
        requirement_pk = requirement.pk
        requirement.delete()
        log_event(
            organization=organization,
            actor=request.user,
            action="permit_requirement.deleted",
            entity_type="permit_type_competency_requirement",
            entity_id=requirement_pk,
            details=details,
        )
        return Response(status=drf_status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# PPE
# ---------------------------------------------------------------------------


class PPEItemListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = PPEItemSerializer

    def get_queryset(self):
        queryset = PPEItem.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("organization").prefetch_related("stocks")
        queryset = _filter_org(queryset, self.request)
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__iexact=category)
        active = self.request.query_params.get("is_active")
        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=active == "true")
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(code__icontains=search)
                | Q(name__icontains=search)
                | Q(category__icontains=search)
                | Q(description__icontains=search)
            )
        return queryset.distinct()

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_manage_workforce)
        if error:
            return error
        serializer = PPEItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = _service_call(
            create_ppe_item,
            organization=organization,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            _serialize(PPEItemSerializer, item, request),
            status=drf_status.HTTP_201_CREATED,
        )


class PPEItemDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        item = _get_ppe_item(pk, request.user)
        if item is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        return Response(_serialize(PPEItemSerializer, item, request))

    def patch(self, request, pk):
        item = _get_ppe_item(pk, request.user)
        if item is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        if not can_manage_workforce(request.user, item.organization_id):
            return Response(FORBIDDEN, status=drf_status.HTTP_403_FORBIDDEN)
        serializer = PPEItemUpdateSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        item = _service_call(
            update_ppe_item, item=item, actor=request.user, data=serializer.validated_data
        )
        return Response(_serialize(PPEItemSerializer, item, request))


class PPEStockListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = PPEStockSerializer

    def get_queryset(self):
        queryset = PPEStock.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("organization", "item", "workplace")
        queryset = _filter_org(queryset, self.request)
        item = self.request.query_params.get("item")
        if item and item.isdigit():
            queryset = queryset.filter(item_id=int(item))
        workplace = self.request.query_params.get("workplace")
        if workplace and workplace.isdigit():
            queryset = queryset.filter(workplace_id=int(workplace))
        if self.request.query_params.get("below_minimum") == "true":
            queryset = queryset.filter(quantity_on_hand__lt=F("quantity_minimum"))
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(item__code__icontains=search)
                | Q(item__name__icontains=search)
                | Q(location_name__icontains=search)
            )
        return queryset.distinct()

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_manage_workforce)
        if error:
            return error
        serializer = PPEStockCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        stock = _service_call(
            create_stock,
            organization=organization,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            _serialize(PPEStockSerializer, stock, request),
            status=drf_status.HTTP_201_CREATED,
        )


class PPEStockDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        stock = _get_stock(pk, request.user)
        if stock is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        return Response(_serialize(PPEStockSerializer, stock, request))

    def patch(self, request, pk):
        stock = _get_stock(pk, request.user)
        if stock is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        if not can_manage_workforce(request.user, stock.organization_id):
            return Response(FORBIDDEN, status=drf_status.HTTP_403_FORBIDDEN)
        serializer = PPEStockUpdateSerializer(stock, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        stock = _service_call(
            update_stock, stock=stock, actor=request.user, data=serializer.validated_data
        )
        return Response(_serialize(PPEStockSerializer, stock, request))


class PPEAssignmentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = PPEAssignmentSerializer

    def get_queryset(self):
        queryset = PPEAssignment.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related(
            "organization", "employee", "item", "stock", "stock__workplace", "issued_by"
        ).prefetch_related("events", "events__actor")
        queryset = _filter_org(queryset, self.request)
        employee = self.request.query_params.get("employee")
        if employee and employee.isdigit():
            queryset = queryset.filter(employee_id=int(employee))
        item = self.request.query_params.get("item")
        if item and item.isdigit():
            queryset = queryset.filter(item_id=int(item))
        assignment_status = self.request.query_params.get("status")
        if assignment_status:
            queryset = queryset.filter(status=assignment_status)
        today = timezone.localdate()
        due = self.request.query_params.get("due")
        if due == "overdue":
            queryset = queryset.filter(
                status=PPEAssignment.Status.ACTIVE, replacement_due_on__lt=today
            )
        elif due == "due_soon":
            queryset = queryset.filter(
                status=PPEAssignment.Status.ACTIVE,
                replacement_due_on__gte=today,
                replacement_due_on__lte=today + timedelta(days=PPE_REPLACEMENT_DUE_SOON_DAYS),
            )
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(employee__employee_no__icontains=search)
                | Q(employee__first_name__icontains=search)
                | Q(employee__last_name__icontains=search)
                | Q(item__code__icontains=search)
                | Q(item__name__icontains=search)
                | Q(serial_number__icontains=search)
            )
        return queryset.distinct()

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_operate_ppe)
        if error:
            return error
        serializer = PPEAssignmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = _service_call(
            create_assignment,
            organization=organization,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            _serialize(PPEAssignmentSerializer, assignment, request),
            status=drf_status.HTTP_201_CREATED,
        )


class PPEAssignmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        assignment = _get_assignment(pk, request.user)
        if assignment is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        return Response(_serialize(PPEAssignmentSerializer, assignment, request))


class PPEAssignmentReturnView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        assignment = _get_assignment(pk, request.user)
        if assignment is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        if not can_operate_ppe(request.user, assignment.organization_id):
            return Response(FORBIDDEN, status=drf_status.HTTP_403_FORBIDDEN)
        serializer = PPEAssignmentReturnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = _service_call(
            return_assignment,
            assignment=assignment,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(_serialize(PPEAssignmentSerializer, assignment, request))


class PPEAssignmentReplaceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        assignment = _get_assignment(pk, request.user)
        if assignment is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        if not can_operate_ppe(request.user, assignment.organization_id):
            return Response(FORBIDDEN, status=drf_status.HTTP_403_FORBIDDEN)
        serializer = PPEAssignmentReplaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_assignment = _service_call(
            replace_assignment,
            assignment=assignment,
            actor=request.user,
            data=serializer.validated_data,
        )
        return Response(
            _serialize(PPEAssignmentSerializer, new_assignment, request),
            status=drf_status.HTTP_201_CREATED,
        )


class PPEAssignmentDisposeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        assignment = _get_assignment(pk, request.user)
        if assignment is None:
            return Response(NOT_FOUND, status=drf_status.HTTP_404_NOT_FOUND)
        if not can_operate_ppe(request.user, assignment.organization_id):
            return Response(FORBIDDEN, status=drf_status.HTTP_403_FORBIDDEN)
        serializer = PPEAssignmentDisposeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = _service_call(
            dispose_assignment,
            assignment=assignment,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(_serialize(PPEAssignmentSerializer, assignment, request))


class WorkforceStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization_ids = list(accessible_organization_ids(request.user))
        organization_id = request.query_params.get("organization")
        if organization_id:
            if organization_id.isdigit() and can_view_organization(
                request.user, int(organization_id)
            ):
                organization_ids = [int(organization_id)]
            else:
                organization_ids = []
        return Response(workforce_stats(organization_ids))


# ==============================================================================
# Phase 12: Job Catalog, Contractors & Attendance Views
# ==============================================================================

class JobPositionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = JobPositionSerializer

    def get_queryset(self):
        org_ids = accessible_organization_ids(self.request.user)
        queryset = JobPosition.objects.filter(
            organization_id__in=org_ids
        ).prefetch_related("required_competencies", "assignments")
        queryset = _filter_org(queryset, self.request)
        risk = self.request.query_params.get("risk_level")
        if risk:
            queryset = queryset.filter(risk_level=risk)
        active = self.request.query_params.get("is_active")
        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=(active == "true"))
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(code__icontains=search)
                | Q(department__icontains=search)
            )
        return queryset.distinct()

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_manage_workforce)
        if error:
            return error
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=organization)
        return Response(serializer.data, status=drf_status.HTTP_201_CREATED)


class JobPositionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = JobPositionSerializer

    def get_queryset(self):
        return JobPosition.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).prefetch_related("required_competencies", "assignments")

    def perform_update(self, serializer):
        if not can_manage_workforce(self.request.user, serializer.instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_workforce(self.request.user, instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        if instance.assignments.exists():
            raise ValidationError("امکان حذف شغلی که دارای سابقه انتساب کارمند است وجود ندارد.")
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError("امکان حذف شغلی که دارای وابستگی فعال است وجود ندارد.")


class EmployeeJobAssignmentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = EmployeeJobAssignmentSerializer

    def get_queryset(self):
        org_ids = accessible_organization_ids(self.request.user)
        queryset = EmployeeJobAssignment.objects.filter(
            organization_id__in=org_ids
        ).select_related("employee", "job_position")
        queryset = _filter_org(queryset, self.request)
        employee_id = self.request.query_params.get("employee")
        if employee_id and employee_id.isdigit():
            queryset = queryset.filter(employee_id=int(employee_id))
        job_id = self.request.query_params.get("job_position")
        if job_id and job_id.isdigit():
            queryset = queryset.filter(job_position_id=int(job_id))
        active_only = self.request.query_params.get("active")
        if active_only == "true":
            queryset = queryset.filter(end_date__isnull=True)
        return queryset

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_manage_workforce)
        if error:
            return error
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=organization)
        return Response(serializer.data, status=drf_status.HTTP_201_CREATED)


class EmployeeJobAssignmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EmployeeJobAssignmentSerializer

    def get_queryset(self):
        return EmployeeJobAssignment.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("employee", "job_position")

    def perform_update(self, serializer):
        if not can_manage_workforce(self.request.user, serializer.instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_workforce(self.request.user, instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        instance.delete()


class ContractorCompanyListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = ContractorCompanySerializer

    def get_queryset(self):
        org_ids = accessible_organization_ids(self.request.user)
        queryset = ContractorCompany.objects.filter(
            organization_id__in=org_ids
        ).prefetch_related("workers", "documents", "evaluations")
        queryset = _filter_org(queryset, self.request)
        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(contact_person__icontains=search)
                | Q(registration_no__icontains=search)
            )
        return queryset

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_manage_workforce)
        if error:
            return error
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=organization)
        return Response(serializer.data, status=drf_status.HTTP_201_CREATED)


class ContractorCompanyDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ContractorCompanySerializer

    def get_queryset(self):
        return ContractorCompany.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).prefetch_related("workers", "documents", "evaluations")

    def perform_update(self, serializer):
        if not can_manage_workforce(self.request.user, serializer.instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_workforce(self.request.user, instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        instance.delete()


class ContractorDocumentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = ContractorDocumentSerializer

    def get_queryset(self):
        org_ids = accessible_organization_ids(self.request.user)
        queryset = ContractorDocument.objects.filter(
            organization_id__in=org_ids
        ).select_related("contractor", "verified_by")
        queryset = _filter_org(queryset, self.request)
        contractor_id = self.request.query_params.get("contractor")
        if contractor_id and contractor_id.isdigit():
            queryset = queryset.filter(contractor_id=int(contractor_id))
        doc_type = self.request.query_params.get("document_type")
        if doc_type:
            queryset = queryset.filter(document_type=doc_type)
        status_val = self.request.query_params.get("status")
        if status_val:
            queryset = queryset.filter(status=status_val)
        return queryset

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_manage_workforce)
        if error:
            return error
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=organization)
        return Response(serializer.data, status=drf_status.HTTP_201_CREATED)


class ContractorDocumentDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ContractorDocumentSerializer

    def get_queryset(self):
        return ContractorDocument.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("contractor", "verified_by")

    def perform_update(self, serializer):
        if not can_manage_workforce(self.request.user, serializer.instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_workforce(self.request.user, instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        instance.delete()


class ContractorWorkerListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = ContractorWorkerSerializer

    def get_queryset(self):
        org_ids = accessible_organization_ids(self.request.user)
        queryset = ContractorWorker.objects.filter(
            organization_id__in=org_ids
        ).select_related("contractor")
        queryset = _filter_org(queryset, self.request)
        contractor_id = self.request.query_params.get("contractor")
        if contractor_id and contractor_id.isdigit():
            queryset = queryset.filter(contractor_id=int(contractor_id))
        trade = self.request.query_params.get("trade")
        if trade:
            queryset = queryset.filter(trade__icontains=trade)
        active = self.request.query_params.get("is_active")
        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=(active == "true"))
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(national_id__icontains=search)
                | Q(trade__icontains=search)
            )
        return queryset

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_manage_workforce)
        if error:
            return error
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=organization)
        return Response(serializer.data, status=drf_status.HTTP_201_CREATED)


class ContractorWorkerDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ContractorWorkerSerializer

    def get_queryset(self):
        return ContractorWorker.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("contractor")

    def perform_update(self, serializer):
        if not can_manage_workforce(self.request.user, serializer.instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_workforce(self.request.user, instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        instance.delete()


class ContractorEvaluationListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = ContractorEvaluationSerializer

    def get_queryset(self):
        org_ids = accessible_organization_ids(self.request.user)
        queryset = ContractorEvaluation.objects.filter(
            organization_id__in=org_ids
        ).select_related("contractor", "evaluator")
        queryset = _filter_org(queryset, self.request)
        contractor_id = self.request.query_params.get("contractor")
        if contractor_id and contractor_id.isdigit():
            queryset = queryset.filter(contractor_id=int(contractor_id))
        return queryset

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_manage_workforce)
        if error:
            return error
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=organization, evaluator=request.user)
        return Response(serializer.data, status=drf_status.HTTP_201_CREATED)


class ContractorEvaluationDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ContractorEvaluationSerializer

    def get_queryset(self):
        return ContractorEvaluation.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("contractor", "evaluator")

    def perform_update(self, serializer):
        if not can_manage_workforce(self.request.user, serializer.instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_workforce(self.request.user, instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        instance.delete()


class AttendanceRecordListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = None
    serializer_class = AttendanceRecordSerializer

    def get_queryset(self):
        org_ids = accessible_organization_ids(self.request.user)
        queryset = AttendanceRecord.objects.filter(
            organization_id__in=org_ids
        ).select_related("workplace", "employee", "contractor_worker", "verified_by")
        queryset = _filter_org(queryset, self.request)
        date_param = self.request.query_params.get("date")
        if date_param:
            queryset = queryset.filter(date=date_param)
        workplace = self.request.query_params.get("workplace")
        if workplace and workplace.isdigit():
            queryset = queryset.filter(workplace_id=int(workplace))
        person_type = self.request.query_params.get("person_type")
        if person_type:
            queryset = queryset.filter(person_type=person_type)
        status_val = self.request.query_params.get("status")
        if status_val:
            queryset = queryset.filter(status=status_val)
        return queryset

    def post(self, request, *args, **kwargs):
        organization, error = _org_from_request(request, can_manage_workforce)
        if error:
            return error
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=organization, verified_by=request.user)
        return Response(serializer.data, status=drf_status.HTTP_201_CREATED)


class AttendanceRecordDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AttendanceRecordSerializer

    def get_queryset(self):
        return AttendanceRecord.objects.filter(
            organization_id__in=accessible_organization_ids(self.request.user)
        ).select_related("workplace", "employee", "contractor_worker", "verified_by")

    def perform_update(self, serializer):
        if not can_manage_workforce(self.request.user, serializer.instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_workforce(self.request.user, instance.organization_id):
            raise ValidationError(FORBIDDEN["error"]["message"])
        instance.delete()


class AttendanceRosterView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_ids = list(accessible_organization_ids(request.user))
        org_id = request.query_params.get("organization")
        if org_id:
            if org_id.isdigit() and can_view_organization(request.user, int(org_id)):
                org_ids = [int(org_id)]
            else:
                org_ids = []
        date_str = request.query_params.get("date") or timezone.localdate().isoformat()
        records = AttendanceRecord.objects.filter(
            organization_id__in=org_ids,
            date=date_str,
        ).select_related("workplace", "employee", "contractor_worker")
        total = records.count()
        present = records.filter(status="present").count()
        late = records.filter(status="late").count()
        absent = records.filter(status="absent").count()
        early = records.filter(status="early_departure").count()
        employee_count = records.filter(person_type="employee").count()
        contractor_count = records.filter(person_type="contractor_worker").count()

        return Response({
            "date": date_str,
            "total_recorded": total,
            "present_count": present,
            "late_count": late,
            "absent_count": absent,
            "early_departure_count": early,
            "employee_count": employee_count,
            "contractor_worker_count": contractor_count,
        })

