from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.auditlog.services import log_event
from apps.core.access import (
    can_conduct_training,
    can_issue_competency,
    can_manage_workforce,
    can_operate_ppe,
    is_active_member,
)
from apps.notifications.services import notify_user
from apps.organizations.models import Membership
from apps.permits.models import Permit, PermitTypeCompetencyRequirement

from .models import (
    COMPETENCY_DUE_SOON_DAYS,
    PPE_REPLACEMENT_DUE_SOON_DAYS,
    Competency,
    Employee,
    EmployeeCompetency,
    PPEAssignment,
    PPEAssignmentEvent,
    PPEItem,
    PPEStock,
    TrainingAttendance,
    TrainingCourse,
    TrainingSession,
)


def _ensure_member(user, organization_id):
    if not user or not user.is_authenticated or not is_active_member(user, organization_id):
        raise ValidationError("شما عضو فعال این سازمان نیستید.")


def _ensure_manager(user, organization_id):
    _ensure_member(user, organization_id)
    if not can_manage_workforce(user, organization_id):
        raise ValidationError("اجازه مدیریت آموزش، کارکنان یا تجهیزات حفاظت فردی را ندارید.")


def _ensure_trainer(user, organization_id):
    _ensure_member(user, organization_id)
    if not can_conduct_training(user, organization_id):
        raise ValidationError("اجازه ثبت نوبت آموزشی یا نتیجه حضور را ندارید.")


def _ensure_competency_issuer(user, organization_id):
    _ensure_member(user, organization_id)
    if not can_issue_competency(user, organization_id):
        raise ValidationError("اجازه صدور یا تغییر وضعیت صلاحیت را ندارید.")


def _ensure_ppe_operator(user, organization_id):
    _ensure_member(user, organization_id)
    if not can_operate_ppe(user, organization_id):
        raise ValidationError("اجازه تحویل، برگشت یا تعویض PPE را ندارید.")


def _ensure_user_membership(user, organization_id, field_label="حساب کاربری"):
    if user is None:
        return
    if not Membership.objects.filter(
        user=user, organization_id=organization_id, is_active=True
    ).exists():
        raise ValidationError(f"{field_label} باید عضو فعال همان سازمان باشد.")


def _validate_workplace(workplace, organization_id):
    if workplace is not None and workplace.organization_id != organization_id:
        raise ValidationError({"workplace": "محل کار باید متعلق به همان سازمان باشد."})


def _check_code_available(model, organization_id, code, exclude_pk=None, field="code"):
    queryset = model.objects.filter(
        organization_id=organization_id, **{f"{field}__iexact": code}
    )
    if exclude_pk:
        queryset = queryset.exclude(pk=exclude_pk)
    if queryset.exists():
        raise ValidationError("شناسه/کد در این سازمان تکراری است.")


def _save_with_duplicate_guard(instance, duplicate_message):
    try:
        instance.save()
    except IntegrityError as exc:
        raise ValidationError(duplicate_message) from exc


# ---------------------------------------------------------------------------
# Employees
# ---------------------------------------------------------------------------


@transaction.atomic
def create_employee(*, organization, actor, data):
    _ensure_manager(actor, organization.id)
    payload = dict(data)
    payload.pop("organization", None)
    employee_no = (payload.get("employee_no") or "").strip()
    if not employee_no:
        raise ValidationError({"employee_no": "شناسه پرسنلی الزامی است."})
    payload["employee_no"] = employee_no
    _check_code_available(Employee, organization.id, employee_no, field="employee_no")
    _validate_workplace(payload.get("workplace"), organization.id)
    _ensure_user_membership(payload.get("user"), organization.id)

    employee = Employee(organization=organization, **payload)
    employee.full_clean()
    _save_with_duplicate_guard(employee, "شناسه پرسنلی در این سازمان تکراری است.")
    log_event(
        organization=organization,
        actor=actor,
        action="employee.created",
        entity_type="employee",
        entity_id=employee.pk,
        details={
            "employee_no": employee.employee_no,
            "full_name": employee.full_name,
            "workplace_id": employee.workplace_id,
            "linked_user_id": employee.user_id,
        },
    )
    return employee


@transaction.atomic
def update_employee(*, employee, actor, data):
    _ensure_manager(actor, employee.organization_id)
    payload = dict(data)
    payload.pop("organization", None)
    if "employee_no" in payload and payload["employee_no"] != employee.employee_no:
        raise ValidationError({"employee_no": "شناسه پرسنلی پس از ثبت قابل تغییر نیست."})
    payload.pop("employee_no", None)
    _validate_workplace(payload.get("workplace", employee.workplace), employee.organization_id)
    if "user" in payload:
        _ensure_user_membership(payload.get("user"), employee.organization_id)

    for field, value in payload.items():
        setattr(employee, field, value)
    employee.full_clean()
    _save_with_duplicate_guard(employee, "حساب کاربری انتخابی قبلاً به کارمند دیگری متصل شده است.")
    log_event(
        organization=employee.organization,
        actor=actor,
        action="employee.updated",
        entity_type="employee",
        entity_id=employee.pk,
        details={"employee_no": employee.employee_no, "fields": sorted(payload.keys())},
    )
    return employee


# ---------------------------------------------------------------------------
# Training catalogue and sessions
# ---------------------------------------------------------------------------


@transaction.atomic
def create_course(*, organization, actor, data):
    _ensure_manager(actor, organization.id)
    payload = dict(data)
    payload.pop("organization", None)
    code = (payload.get("code") or "").strip()
    if not code:
        raise ValidationError({"code": "کد دوره الزامی است."})
    payload["code"] = code
    _check_code_available(TrainingCourse, organization.id, code)
    course = TrainingCourse(organization=organization, created_by=actor, **payload)
    course.full_clean()
    _save_with_duplicate_guard(course, "کد دوره آموزشی در این سازمان تکراری است.")
    log_event(
        organization=organization,
        actor=actor,
        action="training_course.created",
        entity_type="training_course",
        entity_id=course.pk,
        details={"code": course.code, "title": course.title, "is_mandatory": course.is_mandatory},
    )
    return course


@transaction.atomic
def update_course(*, course, actor, data):
    _ensure_manager(actor, course.organization_id)
    payload = dict(data)
    payload.pop("organization", None)
    if "code" in payload and payload["code"] != course.code:
        raise ValidationError({"code": "کد دوره پس از ثبت قابل تغییر نیست."})
    payload.pop("code", None)
    for field, value in payload.items():
        setattr(course, field, value)
    course.full_clean()
    course.save()
    log_event(
        organization=course.organization,
        actor=actor,
        action="training_course.updated",
        entity_type="training_course",
        entity_id=course.pk,
        details={"code": course.code, "fields": sorted(payload.keys())},
    )
    return course


def _validate_session_payload(organization, course, workplace, status, scheduled_on, capacity):
    if course.organization_id != organization.id:
        raise ValidationError({"course": "دوره باید متعلق به همان سازمان باشد."})
    if not course.is_active and status != TrainingSession.Status.CANCELLED:
        raise ValidationError({"course": "دوره غیرفعال را نمی‌توان برای برگزاری جدید انتخاب کرد."})
    _validate_workplace(workplace, organization.id)
    if status == TrainingSession.Status.COMPLETED and scheduled_on > timezone.localdate():
        raise ValidationError(
            {"status": "نوبت آموزشی آینده را نمی‌توان پیش از برگزاری، برگزارشده علامت زد."}
        )
    if capacity is not None and capacity < 1:
        raise ValidationError({"capacity": "ظرفیت باید حداقل ۱ باشد."})


@transaction.atomic
def create_session(*, organization, actor, data):
    _ensure_trainer(actor, organization.id)
    payload = dict(data)
    payload.pop("organization", None)
    course = payload.get("course")
    if course is None:
        raise ValidationError({"course": "دوره الزامی است."})
    if payload.get("duration_minutes") is None:
        payload["duration_minutes"] = course.duration_minutes
    _validate_session_payload(
        organization,
        course,
        payload.get("workplace"),
        payload.get("status", TrainingSession.Status.SCHEDULED),
        payload.get("scheduled_on"),
        payload.get("capacity"),
    )
    session = TrainingSession(organization=organization, created_by=actor, **payload)
    session.full_clean()
    session.save()
    log_event(
        organization=organization,
        actor=actor,
        action="training_session.created",
        entity_type="training_session",
        entity_id=session.pk,
        details={
            "course_code": course.code,
            "scheduled_on": str(session.scheduled_on),
            "venue_workplace_id": session.workplace_id,
        },
    )
    return session


@transaction.atomic
def update_session(*, session, actor, data):
    _ensure_trainer(actor, session.organization_id)
    payload = dict(data)
    payload.pop("organization", None)
    payload.pop("course", None)
    if "capacity" in payload:
        active_attendees = session.attendances.exclude(
            attendance_status=TrainingAttendance.AttendanceStatus.CANCELLED
        ).count()
        if payload["capacity"] is not None and payload["capacity"] < active_attendees:
            raise ValidationError(
                {"capacity": "ظرفیت نمی‌تواند کمتر از تعداد شرکت‌کنندگان ثبت‌شده باشد."}
            )
    _validate_session_payload(
        session.organization,
        session.course,
        payload.get("workplace", session.workplace),
        payload.get("status", session.status),
        payload.get("scheduled_on", session.scheduled_on),
        payload.get("capacity", session.capacity),
    )
    for field, value in payload.items():
        setattr(session, field, value)
    session.full_clean()
    session.save()
    log_event(
        organization=session.organization,
        actor=actor,
        action="training_session.updated",
        entity_type="training_session",
        entity_id=session.pk,
        details={"course_code": session.course.code, "status": session.status, "fields": sorted(payload.keys())},
    )
    return session


# ---------------------------------------------------------------------------
# Training attendance and history
# ---------------------------------------------------------------------------


@transaction.atomic
def create_attendance(*, session, actor, data):
    _ensure_trainer(actor, session.organization_id)
    payload = dict(data)
    payload.pop("session", None)
    payload.pop("organization", None)
    payload["recorded_by"] = actor
    employee = payload.get("employee")
    if employee is None:
        raise ValidationError({"employee": "کارمند الزامی است."})
    if employee.organization_id != session.organization_id:
        raise ValidationError({"employee": "کارمند باید متعلق به همان سازمان باشد."})
    if not employee.is_active:
        raise ValidationError({"employee": "برای کارمند غیرفعال نباید شرکت در دوره جدید ثبت شود."})

    attendance = TrainingAttendance(
        organization=session.organization, session=session, **payload
    )
    attendance.full_clean()
    _save_with_duplicate_guard(
        attendance, "نتیجه این کارمند برای این نوبت قبلاً ثبت شده است."
    )
    log_event(
        organization=session.organization,
        actor=actor,
        action="training_attendance.created",
        entity_type="training_attendance",
        entity_id=attendance.pk,
        details={
            "session_id": session.pk,
            "employee_no": employee.employee_no,
            "attendance_status": attendance.attendance_status,
            "assessment_result": attendance.assessment_result,
        },
    )
    return attendance


@transaction.atomic
def update_attendance(*, attendance, actor, data):
    _ensure_trainer(actor, attendance.organization_id)
    payload = dict(data)
    for immutable in ("session", "employee", "organization"):
        payload.pop(immutable, None)
    previous_result = attendance.assessment_result
    for field, value in payload.items():
        setattr(attendance, field, value)
    attendance.recorded_by = actor
    attendance.full_clean()
    attendance.save()
    log_event(
        organization=attendance.organization,
        actor=actor,
        action="training_attendance.updated",
        entity_type="training_attendance",
        entity_id=attendance.pk,
        details={
            "session_id": attendance.session_id,
            "employee_no": attendance.employee.employee_no,
            "previous_result": previous_result,
            "assessment_result": attendance.assessment_result,
            "attendance_status": attendance.attendance_status,
        },
    )
    return attendance


# ---------------------------------------------------------------------------
# Competency definitions and employee records
# ---------------------------------------------------------------------------


@transaction.atomic
def create_competency(*, organization, actor, data):
    _ensure_manager(actor, organization.id)
    payload = dict(data)
    payload.pop("organization", None)
    courses = payload.pop("accepted_courses", [])
    code = (payload.get("code") or "").strip()
    if not code:
        raise ValidationError({"code": "کد صلاحیت الزامی است."})
    payload["code"] = code
    _check_code_available(Competency, organization.id, code)
    for course in courses:
        if course.organization_id != organization.id:
            raise ValidationError({"accepted_courses": "دوره‌های مرتبط باید متعلق به همان سازمان باشند."})
    competency = Competency(organization=organization, created_by=actor, **payload)
    competency.full_clean()
    _save_with_duplicate_guard(competency, "کد صلاحیت در این سازمان تکراری است.")
    competency.accepted_courses.set(courses)
    log_event(
        organization=organization,
        actor=actor,
        action="competency.created",
        entity_type="competency",
        entity_id=competency.pk,
        details={"code": competency.code, "name": competency.name, "validity_months": competency.validity_months},
    )
    return competency


@transaction.atomic
def update_competency(*, competency, actor, data):
    _ensure_manager(actor, competency.organization_id)
    payload = dict(data)
    payload.pop("organization", None)
    if "code" in payload and payload["code"] != competency.code:
        raise ValidationError({"code": "کد صلاحیت پس از ثبت قابل تغییر نیست."})
    payload.pop("code", None)
    courses = payload.pop("accepted_courses", None)
    if courses is not None:
        for course in courses:
            if course.organization_id != competency.organization_id:
                raise ValidationError({"accepted_courses": "دوره‌های مرتبط باید متعلق به همان سازمان باشند."})
    for field, value in payload.items():
        setattr(competency, field, value)
    competency.full_clean()
    competency.save()
    if courses is not None:
        competency.accepted_courses.set(courses)
    log_event(
        organization=competency.organization,
        actor=actor,
        action="competency.updated",
        entity_type="competency",
        entity_id=competency.pk,
        details={"code": competency.code, "fields": sorted(payload.keys())},
    )
    return competency


@transaction.atomic
def issue_employee_competency(*, organization, actor, data):
    _ensure_competency_issuer(actor, organization.id)
    payload = dict(data)
    payload.pop("organization", None)
    employee = payload.get("employee")
    competency = payload.get("competency")
    source_course = payload.get("source_course")
    source_session = payload.get("source_session")
    if employee is None or competency is None:
        raise ValidationError("کارمند و نوع صلاحیت الزامی هستند.")
    if employee.organization_id != organization.id:
        raise ValidationError({"employee": "کارمند باید متعلق به همان سازمان باشد."})
    if competency.organization_id != organization.id:
        raise ValidationError({"competency": "صلاحیت باید متعلق به همان سازمان باشد."})
    if not employee.is_active:
        raise ValidationError({"employee": "برای کارمند غیرفعال صلاحیت جدید صادر نکنید."})
    if not competency.is_active:
        raise ValidationError({"competency": "صلاحیت غیرفعال قابل صدور نیست."})
    if source_course is not None and source_course.organization_id != organization.id:
        raise ValidationError({"source_course": "دوره منبع باید متعلق به همان سازمان باشد."})
    accepted_course_ids = set(competency.accepted_courses.values_list("id", flat=True))
    if source_course is not None and accepted_course_ids and source_course.id not in accepted_course_ids:
        raise ValidationError(
            {"source_course": "دوره منبع در فهرست دوره‌های قابل قبول این صلاحیت نیست."}
        )
    if source_session is not None:
        if source_session.organization_id != organization.id:
            raise ValidationError({"source_session": "نوبت منبع باید متعلق به همان سازمان باشد."})
        if accepted_course_ids and source_session.course_id not in accepted_course_ids:
            raise ValidationError(
                {"source_session": "دوره نوبت منبع در فهرست دوره‌های قابل قبول این صلاحیت نیست."}
            )
        if not source_session.attendances.filter(
            employee=employee,
            attendance_status=TrainingAttendance.AttendanceStatus.ATTENDED,
            assessment_result=TrainingAttendance.AssessmentResult.PASSED,
            session__status=TrainingSession.Status.COMPLETED,
        ).exists():
            raise ValidationError(
                {"source_session": "برای اتصال صلاحیت به نوبت، قبولی و حضور معتبر همان کارمند الزامی است."}
            )

    record = EmployeeCompetency(
        organization=organization,
        status=EmployeeCompetency.Status.ACTIVE,
        recorded_by=actor,
        **payload,
    )
    record.full_clean()
    record.save()
    log_event(
        organization=organization,
        actor=actor,
        action="employee_competency.issued",
        entity_type="employee_competency",
        entity_id=record.pk,
        details={
            "employee_no": employee.employee_no,
            "competency_code": competency.code,
            "achieved_on": str(record.achieved_on),
            "expires_on": str(record.expires_on) if record.expires_on else None,
        },
    )
    return record


@transaction.atomic
def change_employee_competency_status(*, record, actor, new_status, reason=""):
    _ensure_competency_issuer(actor, record.organization_id)
    if new_status not in EmployeeCompetency.Status.values:
        raise ValidationError("وضعیت صلاحیت نامعتبر است.")
    if record.status == EmployeeCompetency.Status.REVOKED:
        raise ValidationError("صلاحیت لغوشده نهایی است و قابل فعال‌سازی مجدد نیست؛ صلاحیت جدید صادر کنید.")
    if new_status == EmployeeCompetency.Status.ACTIVE and record.effective_status == "expired":
        raise ValidationError("صلاحیت منقضی را نمی‌توان فعال کرد؛ ابتدا صلاحیت جدید/تمدید صادر کنید.")
    old_status = record.status
    record.status = new_status
    record.save(update_fields=["status", "updated_at"])
    log_event(
        organization=record.organization,
        actor=actor,
        action="employee_competency.status_changed",
        entity_type="employee_competency",
        entity_id=record.pk,
        details={
            "employee_no": record.employee.employee_no,
            "competency_code": record.competency.code,
            "from": old_status,
            "to": new_status,
            "reason": reason,
        },
    )
    return record


def latest_employee_competency(employee, competency):
    return (
        employee.competency_records.filter(competency=competency)
        .select_related("competency", "source_course", "source_session")
        .order_by("-achieved_on", "-id")
        .first()
    )


def employee_competency_status(employee, competency):
    record = latest_employee_competency(employee, competency)
    if record is None:
        return {
            "status": "missing",
            "status_display": "صلاحیت ثبت‌نشده",
            "expires_on": None,
            "record_id": None,
        }
    labels = {
        "valid": "معتبر",
        "expiring_soon": "معتبر / نزدیک انقضا",
        "expired": "منقضی",
        "suspended": "تعلیق‌شده",
        "revoked": "لغوشده",
    }
    status = record.effective_status
    return {
        "status": status,
        "status_display": labels.get(status, status),
        "expires_on": record.expires_on,
        "record_id": record.pk,
    }


COMPETENCY_STATUS_LABELS = {
    "valid": "معتبر",
    "expiring_soon": "نزدیک انقضا",
    "expired": "منقضی",
    "suspended": "تعلیق‌شده",
    "revoked": "لغوشده",
    "missing": "ثبت‌نشده",
    "inactive_employee": "کارمند غیرفعال",
}


SOURCE_LABELS = {
    "assigned_employee": "فهرست ساختاریافته مجوز",
    "requester": "درخواست‌دهنده مجوز",
    "responsible_supervisor": "سرپرست اجرایی",
}


def _permit_people(permit):
    people = {}
    for employee in permit.assigned_employees.select_related("user").all():
        people[employee.pk] = {"employee": employee, "source": "assigned_employee"}
    for user, source in (
        (permit.requester, "requester"),
        (permit.responsible_supervisor, "responsible_supervisor"),
    ):
        if not user:
            continue
        employee = (
            Employee.objects.filter(
                organization_id=permit.organization_id, user=user
            )
            .select_related("user")
            .first()
        )
        if employee and employee.pk not in people:
            people[employee.pk] = {"employee": employee, "source": source}
    return list(people.values())


def validate_permit_competencies(permit):
    """Return the server-side competency assessment used by PTW approval/activation.

    Expiry is evaluated lazily against the current date. A free-text crew list is
    never accepted as proof of competency; when no structured employee is linked,
    the result is explicitly unknown and blocks approval/activation.
    """
    requirements = list(
        PermitTypeCompetencyRequirement.objects.filter(
            organization_id=permit.organization_id,
            permit_type=permit.permit_type,
        )
        .select_related("competency")
        .order_by("competency__name")
    )
    people = _permit_people(permit)
    unstructured_workers = bool((permit.assigned_workers or "").strip())
    structured_assignments = permit.assigned_employees.count()
    requirement_payload = [
        {
            "id": requirement.pk,
            "competency_id": requirement.competency_id,
            "competency_code": requirement.competency.code,
            "competency_name": requirement.competency.name,
            "notes": requirement.notes,
        }
        for requirement in requirements
    ]

    if not requirements:
        return {
            "has_requirements": False,
            "is_compliant": True,
            "is_unknown": False,
            "reason": None,
            "unstructured_workers": unstructured_workers,
            "requirements": [],
            "people": [],
            "blocking_reasons": [],
        }

    if not people:
        reason = (
            "برای این نوع مجوز صلاحیت الزامی تعریف شده است، اما هیچ کارمند ساختاریافته‌ای "
            "به مجوز متصل نیست. استفاده از متن آزاد برای اثبات صلاحیت کافی نیست."
        )
        return {
            "has_requirements": True,
            "is_compliant": False,
            "is_unknown": True,
            "reason": reason,
            "unstructured_workers": unstructured_workers,
            "requirements": requirement_payload,
            "people": [],
            "blocking_reasons": [reason],
        }

    if unstructured_workers and structured_assignments == 0:
        reason = (
            "فهرست افراد مجوز فقط به‌صورت متن آزاد ثبت شده و به کارکنان ساختاریافته متصل "
            "نیست؛ صلاحیت تیم اجرایی قابل اعتبارسنجی نیست و وضعیت «نامشخص» است."
        )
        return {
            "has_requirements": True,
            "is_compliant": False,
            "is_unknown": True,
            "reason": reason,
            "unstructured_workers": True,
            "requirements": requirement_payload,
            "people": [
                {
                    "employee_id": item["employee"].pk,
                    "employee_no": item["employee"].employee_no,
                    "full_name": item["employee"].full_name,
                    "is_active": item["employee"].is_active,
                    "source": item["source"],
                    "source_display": SOURCE_LABELS.get(item["source"], item["source"]),
                    "checks": [],
                }
                for item in people
            ],
            "blocking_reasons": [reason],
        }

    people_payload = []
    blocking_reasons = []
    all_valid = True
    for item in people:
        employee = item["employee"]
        checks = []
        for requirement in requirements:
            assessment = employee_competency_status(employee, requirement.competency)
            status = assessment["status"]
            if not employee.is_active:
                status = "inactive_employee"
            valid = status in {"valid", "expiring_soon"} and employee.is_active
            reason = None
            if not valid:
                label = COMPETENCY_STATUS_LABELS.get(status, status)
                reason = (
                    f"{employee.full_name} ({employee.employee_no}) برای صلاحیت "
                    f"«{requirement.competency.name}» وضعیت {label} دارد."
                )
                blocking_reasons.append(reason)
            all_valid = all_valid and valid
            checks.append(
                {
                    **assessment,
                    "competency_id": requirement.competency_id,
                    "competency_code": requirement.competency.code,
                    "competency_name": requirement.competency.name,
                    "is_valid": valid,
                    "blocking_reason": reason,
                }
            )
        people_payload.append(
            {
                "employee_id": employee.pk,
                "employee_no": employee.employee_no,
                "full_name": employee.full_name,
                "is_active": employee.is_active,
                "source": item["source"],
                "source_display": SOURCE_LABELS.get(item["source"], item["source"]),
                "checks": checks,
            }
        )

    return {
        "has_requirements": True,
        "is_compliant": all_valid,
        "is_unknown": False,
        "reason": None if all_valid else blocking_reasons[0],
        "unstructured_workers": unstructured_workers,
        "requirements": requirement_payload,
        "people": people_payload,
        "blocking_reasons": blocking_reasons,
    }


def assert_permit_competencies(permit):
    result = validate_permit_competencies(permit)
    if not result["is_compliant"]:
        raise ValidationError(
            "صلاحیت الزامی مجوز کار تأیید نشد: "
            + (result["reason"] or "دسترسی به صلاحیت معتبر برای همه افراد امکان‌پذیر نیست.")
        )
    return result


# ---------------------------------------------------------------------------
# PPE catalogue, stock and assignment lifecycle
# ---------------------------------------------------------------------------


@transaction.atomic
def create_ppe_item(*, organization, actor, data):
    _ensure_manager(actor, organization.id)
    payload = dict(data)
    payload.pop("organization", None)
    code = (payload.get("code") or "").strip()
    if not code:
        raise ValidationError({"code": "کد قلم PPE الزامی است."})
    payload["code"] = code
    _check_code_available(PPEItem, organization.id, code)
    item = PPEItem(organization=organization, created_by=actor, **payload)
    item.full_clean()
    _save_with_duplicate_guard(item, "کد قلم PPE در این سازمان تکراری است.")
    log_event(
        organization=organization,
        actor=actor,
        action="ppe_item.created",
        entity_type="ppe_item",
        entity_id=item.pk,
        details={"code": item.code, "name": item.name, "category": item.category},
    )
    return item


@transaction.atomic
def update_ppe_item(*, item, actor, data):
    _ensure_manager(actor, item.organization_id)
    payload = dict(data)
    payload.pop("organization", None)
    if "code" in payload and payload["code"] != item.code:
        raise ValidationError({"code": "کد قلم PPE پس از ثبت قابل تغییر نیست."})
    payload.pop("code", None)
    for field, value in payload.items():
        setattr(item, field, value)
    item.full_clean()
    item.save()
    log_event(
        organization=item.organization,
        actor=actor,
        action="ppe_item.updated",
        entity_type="ppe_item",
        entity_id=item.pk,
        details={"code": item.code, "fields": sorted(payload.keys())},
    )
    return item


@transaction.atomic
def create_stock(*, organization, actor, data):
    _ensure_manager(actor, organization.id)
    payload = dict(data)
    payload.pop("organization", None)
    item = payload.get("item")
    if item is None:
        raise ValidationError({"item": "قلم PPE الزامی است."})
    if item.organization_id != organization.id:
        raise ValidationError({"item": "قلم PPE باید متعلق به همان سازمان باشد."})
    _validate_workplace(payload.get("workplace"), organization.id)
    stock = PPEStock(organization=organization, **payload)
    stock.full_clean()
    _save_with_duplicate_guard(stock, "انبار/محل نگهداری برای این قلم قبلاً ثبت شده است.")
    log_event(
        organization=organization,
        actor=actor,
        action="ppe_stock.created",
        entity_type="ppe_stock",
        entity_id=stock.pk,
        details={"item_code": item.code, "location": stock.location_name, "quantity": stock.quantity_on_hand},
    )
    return stock


@transaction.atomic
def update_stock(*, stock, actor, data):
    _ensure_manager(actor, stock.organization_id)
    payload = dict(data)
    payload.pop("organization", None)
    if "item" in payload and payload["item"].pk != stock.item_id:
        raise ValidationError({"item": "قلم PPE انبار پس از ثبت قابل تغییر نیست."})
    payload.pop("item", None)
    previous_quantity = stock.quantity_on_hand
    _validate_workplace(payload.get("workplace", stock.workplace), stock.organization_id)
    for field, value in payload.items():
        setattr(stock, field, value)
    stock.full_clean()
    _save_with_duplicate_guard(stock, "انبار/محل نگهداری برای این قلم قبلاً ثبت شده است.")
    log_event(
        organization=stock.organization,
        actor=actor,
        action="ppe_stock.updated",
        entity_type="ppe_stock",
        entity_id=stock.pk,
        details={
            "item_code": stock.item.code,
            "previous_quantity": previous_quantity,
            "quantity": stock.quantity_on_hand,
        },
    )
    return stock


def _lock_active_stock(stock_id):
    try:
        return PPEStock.objects.select_for_update().select_related("item").get(pk=stock_id)
    except PPEStock.DoesNotExist as exc:
        raise ValidationError("انبار PPE یافت نشد.") from exc


@transaction.atomic
def create_assignment(*, organization, actor, data):
    _ensure_ppe_operator(actor, organization.id)
    payload = dict(data)
    payload.pop("organization", None)
    employee = payload.get("employee")
    item = payload.get("item")
    stock = payload.get("stock")
    quantity = payload.get("quantity")
    if employee is None or item is None or stock is None or not quantity:
        raise ValidationError("کارمند، قلم PPE، انبار و تعداد الزامی هستند.")
    if employee.organization_id != organization.id:
        raise ValidationError({"employee": "کارمند باید متعلق به همان سازمان باشد."})
    if not employee.is_active:
        raise ValidationError({"employee": "به کارمند غیرفعال نباید PPE تحویل شود."})
    if item.organization_id != organization.id or stock.organization_id != organization.id:
        raise ValidationError("قلم PPE و انبار باید متعلق به همان سازمان باشند.")
    if stock.item_id != item.pk:
        raise ValidationError({"stock": "انبار انتخاب‌شده با قلم PPE هم‌خوان نیست."})
    if quantity < 1:
        raise ValidationError({"quantity": "تعداد تحویل باید حداقل ۱ باشد."})
    if item.tracks_serial and quantity != 1:
        raise ValidationError({"quantity": "برای قلم سریال‌دار، هر تحویل باید دقیقاً یک عدد باشد."})
    if item.tracks_serial and not (payload.get("serial_number") or "").strip():
        raise ValidationError({"serial_number": "برای این قلم، شماره سریال الزامی است."})

    locked_stock = _lock_active_stock(stock.pk)
    if not locked_stock.is_active:
        raise ValidationError({"stock": "انبار غیرفعال است."})
    if locked_stock.quantity_on_hand < quantity:
        raise ValidationError(
            {"quantity": f"موجودی کافی نیست؛ موجودی فعلی {locked_stock.quantity_on_hand} عدد است."}
        )

    issued_on = payload.pop("issued_on", None) or timezone.localdate()
    assignment = PPEAssignment(
        organization=organization,
        issued_on=issued_on,
        issued_by=actor,
        status=PPEAssignment.Status.ACTIVE,
        **payload,
    )
    assignment.full_clean()
    locked_stock.quantity_on_hand -= quantity
    locked_stock.save(update_fields=["quantity_on_hand", "updated_at"])
    _save_with_duplicate_guard(
        assignment, "این شماره سریال هم‌اکنون به فرد دیگری تخصیص یافته است."
    )
    PPEAssignmentEvent.objects.create(
        organization=organization,
        assignment=assignment,
        event_type=PPEAssignmentEvent.EventType.ISSUED,
        occurred_on=issued_on,
        quantity=quantity,
        condition=assignment.condition_on_issue,
        notes=assignment.notes,
        actor=actor,
        is_synthetic=assignment.is_synthetic,
    )
    if employee.user_id:
        notify_user(
            user=employee.user,
            organization=organization,
            title="تحویل تجهیزات حفاظت فردی",
            message=f"قلم «{item.name}» با تعداد {quantity} در تاریخ {issued_on} به شما تحویل داده شد.",
        )
    log_event(
        organization=organization,
        actor=actor,
        action="ppe_assignment.issued",
        entity_type="ppe_assignment",
        entity_id=assignment.pk,
        details={
            "employee_no": employee.employee_no,
            "item_code": item.code,
            "quantity": quantity,
            "serial_number": assignment.serial_number,
            "stock_id": locked_stock.pk,
            "remaining_quantity": locked_stock.quantity_on_hand,
        },
    )
    return assignment


@transaction.atomic
def return_assignment(
    *, assignment, actor, condition="", returned_on=None, notes="", restock=True
):
    _ensure_ppe_operator(actor, assignment.organization_id)
    locked = (
        PPEAssignment.objects.select_for_update()
        .select_related("employee", "item", "stock")
        .get(pk=assignment.pk)
    )
    if locked.status != PPEAssignment.Status.ACTIVE:
        raise ValidationError("تنها تحویل فعال قابل برگشت است.")
    stock = _lock_active_stock(locked.stock_id)
    close_date = returned_on or timezone.localdate()
    if close_date < locked.issued_on:
        raise ValidationError({"returned_on": "تاریخ برگشت نمی‌تواند قبل از تاریخ تحویل باشد."})
    locked.status = PPEAssignment.Status.RETURNED
    locked.returned_on = close_date
    locked.return_condition = condition
    if notes:
        locked.notes = f"{locked.notes}\n{notes}".strip()
    locked.full_clean()
    locked.save()
    if restock:
        stock.quantity_on_hand += locked.quantity
        stock.save(update_fields=["quantity_on_hand", "updated_at"])
    PPEAssignmentEvent.objects.create(
        organization=locked.organization,
        assignment=locked,
        event_type=PPEAssignmentEvent.EventType.RETURNED,
        occurred_on=close_date,
        quantity=locked.quantity,
        condition=condition,
        notes=(notes or "").strip() if restock else f"{notes}\nتجهیز به موجودی قابل استفاده بازنگشت.".strip(),
        actor=actor,
    )
    if locked.employee.user_id:
        notify_user(
            user=locked.employee.user,
            organization=locked.organization,
            title="ثبت برگشت تجهیزات حفاظت فردی",
            message=f"برگشت قلم «{locked.item.name}» در تاریخ {close_date} ثبت شد.",
        )
    log_event(
        organization=locked.organization,
        actor=actor,
        action="ppe_assignment.returned",
        entity_type="ppe_assignment",
        entity_id=locked.pk,
        details={
            "employee_no": locked.employee.employee_no,
            "item_code": locked.item.code,
            "quantity": locked.quantity,
            "returned_on": str(close_date),
            "condition": condition,
            "restocked": bool(restock),
            "remaining_quantity": stock.quantity_on_hand,
        },
    )
    return locked


@transaction.atomic
def replace_assignment(*, assignment, actor, data):
    _ensure_ppe_operator(actor, assignment.organization_id)
    locked = (
        PPEAssignment.objects.select_for_update()
        .select_related("employee", "item", "stock")
        .get(pk=assignment.pk)
    )
    if locked.status != PPEAssignment.Status.ACTIVE:
        raise ValidationError("تنها تحویل فعال قابل تعویض است.")
    stock = _lock_active_stock(locked.stock_id)
    replacement_serial = (data.get("serial_number") or "").strip()
    if locked.item.tracks_serial and not replacement_serial:
        raise ValidationError({"serial_number": "برای تعویض قلم سریال‌دار، شماره سریال جدید الزامی است."})
    issued_on = data.get("issued_on") or timezone.localdate()
    if issued_on < locked.issued_on:
        raise ValidationError({"issued_on": "تاریخ تحویل جدید نباید قبل از تحویل قبلی باشد."})
    condition = data.get("condition_on_issue") or "سالم"

    locked.status = PPEAssignment.Status.REPLACED
    locked.returned_on = issued_on
    locked.return_condition = data.get("return_condition") or "تعویض دوره‌ای"
    locked.full_clean()
    locked.save()
    restock_old = bool(data.get("restock_old", False))
    if restock_old:
        stock.quantity_on_hand += locked.quantity
        stock.save(update_fields=["quantity_on_hand", "updated_at"])

    new_assignment = PPEAssignment(
        organization=locked.organization,
        employee=locked.employee,
        item=locked.item,
        stock=stock,
        quantity=locked.quantity,
        serial_number=replacement_serial,
        issued_on=issued_on,
        condition_on_issue=condition,
        replacement_due_on=data.get("replacement_due_on"),
        issued_by=actor,
        status=PPEAssignment.Status.ACTIVE,
        notes=data.get("notes", ""),
    )
    new_assignment.full_clean()
    if stock.quantity_on_hand < new_assignment.quantity:
        raise ValidationError("موجودی برای تعویض کافی نیست.")
    stock.quantity_on_hand -= new_assignment.quantity
    stock.save(update_fields=["quantity_on_hand", "updated_at"])
    _save_with_duplicate_guard(
        new_assignment, "شماره سریال جدید هم‌اکنون به فرد دیگری تخصیص یافته است."
    )
    PPEAssignmentEvent.objects.create(
        organization=locked.organization,
        assignment=locked,
        event_type=PPEAssignmentEvent.EventType.REPLACED,
        occurred_on=issued_on,
        quantity=locked.quantity,
        condition=locked.return_condition,
        notes=data.get("notes", ""),
        actor=actor,
    )
    PPEAssignmentEvent.objects.create(
        organization=locked.organization,
        assignment=new_assignment,
        event_type=PPEAssignmentEvent.EventType.ISSUED,
        occurred_on=issued_on,
        quantity=new_assignment.quantity,
        condition=condition,
        notes=data.get("notes", ""),
        actor=actor,
    )
    if locked.employee.user_id:
        notify_user(
            user=locked.employee.user,
            organization=locked.organization,
            title="تعویض تجهیزات حفاظت فردی",
            message=f"قلم «{locked.item.name}» در تاریخ {issued_on} تعویض شد.",
        )
    log_event(
        organization=locked.organization,
        actor=actor,
        action="ppe_assignment.replaced",
        entity_type="ppe_assignment",
        entity_id=locked.pk,
        details={
            "employee_no": locked.employee.employee_no,
            "item_code": locked.item.code,
            "old_serial_number": locked.serial_number,
            "new_assignment_id": new_assignment.pk,
            "new_serial_number": new_assignment.serial_number,
            "quantity": locked.quantity,
            "restocked_old": restock_old,
        },
    )
    return new_assignment


@transaction.atomic
def dispose_assignment(*, assignment, actor, condition="", notes=""):
    _ensure_ppe_operator(actor, assignment.organization_id)
    locked = PPEAssignment.objects.select_for_update().select_related("employee", "item").get(pk=assignment.pk)
    if locked.status != PPEAssignment.Status.ACTIVE:
        raise ValidationError("تنها تحویل فعال قابل خروج از سرویس است.")
    close_date = timezone.localdate()
    locked.status = PPEAssignment.Status.DISPOSED
    locked.returned_on = close_date
    locked.return_condition = condition
    if notes:
        locked.notes = f"{locked.notes}\n{notes}".strip()
    locked.full_clean()
    locked.save()
    PPEAssignmentEvent.objects.create(
        organization=locked.organization,
        assignment=locked,
        event_type=PPEAssignmentEvent.EventType.DISPOSED,
        occurred_on=close_date,
        quantity=locked.quantity,
        condition=condition,
        notes=notes,
        actor=actor,
    )
    log_event(
        organization=locked.organization,
        actor=actor,
        action="ppe_assignment.disposed",
        entity_type="ppe_assignment",
        entity_id=locked.pk,
        details={
            "employee_no": locked.employee.employee_no,
            "item_code": locked.item.code,
            "quantity": locked.quantity,
            "condition": condition,
        },
    )
    return locked


def workforce_stats(organization_ids):
    organization_ids = list(organization_ids)
    employees = Employee.objects.filter(organization_id__in=organization_ids)
    courses = TrainingCourse.objects.filter(organization_id__in=organization_ids)
    sessions = TrainingSession.objects.filter(organization_id__in=organization_ids)
    attendance = TrainingAttendance.objects.filter(organization_id__in=organization_ids)
    competency_records = EmployeeCompetency.objects.filter(
        organization_id__in=organization_ids
    ).select_related("competency", "employee")
    items = PPEItem.objects.filter(organization_id__in=organization_ids)
    stocks = PPEStock.objects.filter(organization_id__in=organization_ids)
    assignments = PPEAssignment.objects.filter(organization_id__in=organization_ids)

    latest_records = {}
    for record in competency_records.order_by("employee_id", "competency_id", "-achieved_on", "-id"):
        latest_records[(record.employee_id, record.competency_id)] = record

    valid = expiring = expired = suspended = revoked = 0
    for record in latest_records.values():
        status = record.effective_status
        if status in {"valid", "expiring_soon"}:
            valid += 1
            if status == "expiring_soon":
                expiring += 1
        elif status == "expired":
            expired += 1
        elif status == "suspended":
            suspended += 1
        elif status == "revoked":
            revoked += 1

    today = timezone.localdate()
    active_assignments = assignments.filter(status=PPEAssignment.Status.ACTIVE)
    due_limit = today + timedelta(days=PPE_REPLACEMENT_DUE_SOON_DAYS)
    return {
        "employees_total": employees.count(),
        "employees_active": employees.filter(is_active=True).count(),
        "employees_without_account": employees.filter(user__isnull=True).count(),
        "courses_active": courses.filter(is_active=True).count(),
        "sessions_upcoming": sessions.filter(
            scheduled_on__gte=today,
            status__in=[TrainingSession.Status.SCHEDULED, TrainingSession.Status.IN_PROGRESS],
        ).count(),
        "sessions_completed": sessions.filter(status=TrainingSession.Status.COMPLETED).count(),
        "attendance_passed": attendance.filter(
            assessment_result=TrainingAttendance.AssessmentResult.PASSED
        ).count(),
        "attendance_failed": attendance.filter(
            assessment_result=TrainingAttendance.AssessmentResult.FAILED
        ).count(),
        "attendance_absent": attendance.filter(
            attendance_status=TrainingAttendance.AttendanceStatus.ABSENT
        ).count(),
        "attendance_pending": attendance.filter(
            assessment_result=TrainingAttendance.AssessmentResult.PENDING
        ).count(),
        "competency_records_total": competency_records.count(),
        "competency_valid": valid,
        "competency_expiring_soon": expiring,
        "competency_expired": expired,
        "competency_suspended": suspended,
        "competency_revoked": revoked,
        "competency_due_soon_days": COMPETENCY_DUE_SOON_DAYS,
        "ppe_items": items.count(),
        "ppe_items_active": items.filter(is_active=True).count(),
        "ppe_stock_below_minimum": sum(1 for stock in stocks if stock.is_below_minimum),
        "ppe_active_assignments": active_assignments.count(),
        "ppe_assignments_due_soon": active_assignments.filter(
            replacement_due_on__gte=today, replacement_due_on__lte=due_limit
        ).count(),
        "ppe_assignments_overdue": active_assignments.filter(
            replacement_due_on__lt=today
        ).count(),
        "ppe_replacement_due_soon_days": PPE_REPLACEMENT_DUE_SOON_DAYS,
    }
