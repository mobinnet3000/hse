import csv
from datetime import timedelta

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assets.models import Equipment, MaintenanceWorkOrder
from apps.capa.models import CorrectiveAction
from apps.core.access import accessible_organization_ids, can_view_organization
from apps.findings.models import NonConformity
from apps.incidents.models import Incident
from apps.inspections.models import Inspection
from apps.permits.models import Permit
from apps.risks.models import RiskAssessment
from apps.workforce.models import (
    EmployeeCompetency,
    PPEAssignment,
    TrainingAttendance,
)


CALIBRATION_STATUS_LABELS = {
    "not_required": "کالیبراسیون لازم نیست",
    "missing": "ثبت‌نشده",
    "valid": "معتبر",
    "due_soon": "نزدیک سررسید",
    "expired": "منقضی",
    "failed": "ناموفق",
}


def export_csv(filename, headers, row_generator):
    response = HttpResponse(content_type="text/csv; charset=utf-8-sig")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    writer.writerow(headers)
    for row in row_generator:
        writer.writerow(row)
    return response


class ReportExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, report_type):
        org_ids = list(accessible_organization_ids(request.user))
        organization_id = request.query_params.get("organization")
        if organization_id:
            try:
                organization_id = int(organization_id)
                if not can_view_organization(request.user, organization_id):
                    return Response(
                        {"error": {"code": "not_found", "message": "سازمان یافت نشد."}},
                        status=404,
                    )
                target_orgs = [organization_id]
            except ValueError:
                return Response(
                    {"error": {"code": "invalid_parameter", "message": "شناسه سازمان نامعتبر است."}},
                    status=400,
                )
        else:
            target_orgs = org_ids if not request.user.is_platform_admin else None

        workplace_id = request.query_params.get("workplace")
        if workplace_id:
            try:
                workplace_id = int(workplace_id)
            except ValueError:
                return Response(
                    {"error": {"code": "invalid_parameter", "message": "شناسه محل کار نامعتبر است."}},
                    status=400,
                )

        status_filter = request.query_params.get("status")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if report_type == "inspections":
            qs = Inspection.objects.select_related("checklist", "workplace", "organization").all()
            if target_orgs is not None:
                qs = qs.filter(organization_id__in=target_orgs)
            if workplace_id:
                qs = qs.filter(workplace_id=workplace_id)
            if status_filter:
                qs = qs.filter(status=status_filter)
            if date_from:
                qs = qs.filter(scheduled_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(scheduled_at__date__lte=date_to)

            headers = [
                "شناسه",
                "سازمان",
                "محل کار",
                "عنوان بازرسی",
                "چک‌لیست",
                "وضعیت",
                "تاریخ زمان‌بندی",
                "تاریخ انجام",
                "تاریخ تکمیل",
            ]

            def row_gen():
                for i in qs.iterator(chunk_size=200):
                    yield [
                        i.pk,
                        i.organization.name if i.organization else "",
                        i.workplace.name if i.workplace else "—",
                        i.title,
                        i.checklist.title if i.checklist else "",
                        i.get_status_display(),
                        i.scheduled_at.strftime("%Y-%m-%d %H:%M") if i.scheduled_at else "",
                        i.performed_at.strftime("%Y-%m-%d %H:%M") if i.performed_at else "",
                        i.completed_at.strftime("%Y-%m-%d %H:%M") if i.completed_at else "",
                    ]

            return export_csv("inspections_report.csv", headers, row_gen())

        elif report_type == "risks":
            qs = RiskAssessment.objects.select_related("hazard", "hazard__workplace", "organization").all()
            if target_orgs is not None:
                qs = qs.filter(organization_id__in=target_orgs)
            if workplace_id:
                qs = qs.filter(hazard__workplace_id=workplace_id)
            level_filter = request.query_params.get("level")
            if level_filter:
                qs = qs.filter(level=level_filter)
            if status_filter:
                qs = qs.filter(status=status_filter)
            if date_from:
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(created_at__date__lte=date_to)

            headers = [
                "شناسه",
                "سازمان",
                "محل کار",
                "عنوان خطر",
                "احتمال",
                "شدت",
                "امتیاز",
                "سطح ریسک",
                "وضعیت",
                "اقدامات کنترلی پیشنهادی",
            ]

            def row_gen():
                for r in qs.iterator(chunk_size=200):
                    yield [
                        r.pk,
                        r.organization.name if r.organization else "",
                        r.hazard.workplace.name if r.hazard and r.hazard.workplace else "—",
                        r.hazard.title if r.hazard else "",
                        r.likelihood,
                        r.severity,
                        r.score,
                        r.get_level_display(),
                        r.get_status_display(),
                        r.proposed_controls or "",
                    ]

            return export_csv("risks_report.csv", headers, row_gen())

        elif report_type == "non-conformities":
            qs = NonConformity.objects.select_related("organization", "workplace").all()
            if target_orgs is not None:
                qs = qs.filter(organization_id__in=target_orgs)
            if workplace_id:
                qs = qs.filter(workplace_id=workplace_id)
            severity_filter = request.query_params.get("severity")
            if severity_filter:
                qs = qs.filter(severity=severity_filter)
            if status_filter:
                qs = qs.filter(status=status_filter)
            if date_from:
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(created_at__date__lte=date_to)

            headers = [
                "شناسه",
                "سازمان",
                "محل کار",
                "شرح عدم‌انطباق",
                "شدت",
                "وضعیت",
                "منبع",
                "تاریخ ثبت",
            ]

            def row_gen():
                for n in qs.iterator(chunk_size=200):
                    yield [
                        n.pk,
                        n.organization.name if n.organization else "",
                        n.workplace.name if n.workplace else "—",
                        n.description,
                        n.get_severity_display(),
                        n.get_status_display(),
                        n.get_source_display(),
                        n.created_at.strftime("%Y-%m-%d %H:%M") if n.created_at else "",
                    ]

            return export_csv("non_conformities_report.csv", headers, row_gen())

        elif report_type == "assets":
            qs = Equipment.objects.select_related(
                "organization", "workplace"
            ).prefetch_related("calibrations", "maintenance_plans", "work_orders").all()
            if target_orgs is not None:
                qs = qs.filter(organization_id__in=target_orgs)
            if workplace_id:
                qs = qs.filter(workplace_id=workplace_id)
            category_filter = request.query_params.get("category")
            if category_filter:
                qs = qs.filter(category=category_filter)
            if status_filter:
                qs = qs.filter(status=status_filter)
            calibration_filter = request.query_params.get("calibration_status")
            if calibration_filter:
                qs = qs.filter(
                    pk__in=[item.pk for item in qs if item.calibration_status == calibration_filter]
                )
            if date_from:
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(created_at__date__lte=date_to)

            headers = [
                "شناسه",
                "سازمان",
                "محل استقرار",
                "کد تجهیز",
                "نام تجهیز",
                "دسته",
                "وضعیت",
                "وضعیت کالیبراسیون",
                "سررسید کالیبراسیون",
                "موعد بعدی نگهداری",
                "دستورکار باز",
                "داده سنتتیک",
            ]

            def row_gen():
                for e in qs.iterator(chunk_size=200):
                    next_plan = (
                        e.maintenance_plans.filter(is_active=True)
                        .order_by("next_due_date")
                        .values_list("next_due_date", flat=True)
                        .first()
                    )
                    yield [
                        e.pk,
                        e.organization.name if e.organization else "",
                        e.workplace.name if e.workplace else "—",
                        e.code,
                        e.name,
                        e.get_category_display(),
                        e.get_status_display(),
                        CALIBRATION_STATUS_LABELS.get(e.calibration_status, e.calibration_status),
                        e.calibration_due_on.strftime("%Y-%m-%d") if e.calibration_due_on else "",
                        next_plan.strftime("%Y-%m-%d") if next_plan else "",
                        e.work_orders.filter(
                            status__in=[
                                MaintenanceWorkOrder.Status.PLANNED,
                                MaintenanceWorkOrder.Status.IN_PROGRESS,
                            ]
                        ).count(),
                        "بله" if e.is_synthetic else "خیر",
                    ]

            return export_csv("assets_report.csv", headers, row_gen())

        elif report_type == "training":
            qs = TrainingAttendance.objects.select_related(
                "organization",
                "employee",
                "employee__workplace",
                "session",
                "session__course",
                "session__workplace",
            ).all()
            if target_orgs is not None:
                qs = qs.filter(organization_id__in=target_orgs)
            if workplace_id:
                qs = qs.filter(session__workplace_id=workplace_id)
            if status_filter:
                qs = qs.filter(attendance_status=status_filter)
            result_filter = request.query_params.get("result")
            if result_filter:
                qs = qs.filter(assessment_result=result_filter)
            course_filter = request.query_params.get("course")
            if course_filter and str(course_filter).isdigit():
                qs = qs.filter(session__course_id=int(course_filter))
            if date_from:
                qs = qs.filter(session__scheduled_on__gte=date_from)
            if date_to:
                qs = qs.filter(session__scheduled_on__lte=date_to)

            headers = [
                "شناسه",
                "سازمان",
                "شماره پرسنلی",
                "نام کارمند",
                "محل کار",
                "دوره",
                "کد دوره",
                "تاریخ برگزاری",
                "وضعیت حضور",
                "نتیجه ارزیابی",
                "امتیاز",
                "تاریخ تکمیل",
                "داده سنتتیک",
            ]

            def row_gen():
                for item in qs.iterator(chunk_size=200):
                    yield [
                        item.pk,
                        item.organization.name if item.organization else "",
                        item.employee.employee_no,
                        item.employee.full_name,
                        item.employee.workplace.name if item.employee.workplace else "—",
                        item.session.course.title,
                        item.session.course.code,
                        item.session.scheduled_on.strftime("%Y-%m-%d") if item.session.scheduled_on else "",
                        item.get_attendance_status_display(),
                        item.get_assessment_result_display(),
                        item.score if item.score is not None else "",
                        item.completed_on.strftime("%Y-%m-%d") if item.completed_on else "",
                        "بله" if item.is_synthetic else "خیر",
                    ]

            return export_csv("training_report.csv", headers, row_gen())

        elif report_type == "competencies":
            qs = EmployeeCompetency.objects.select_related(
                "organization",
                "employee",
                "employee__workplace",
                "competency",
                "source_course",
            ).all()
            if target_orgs is not None:
                qs = qs.filter(organization_id__in=target_orgs)
            if workplace_id:
                qs = qs.filter(employee__workplace_id=workplace_id)
            if status_filter:
                qs = qs.filter(status=status_filter)
            expiry_filter = request.query_params.get("expiry")
            if expiry_filter == "expired":
                qs = qs.filter(status=EmployeeCompetency.Status.ACTIVE, expires_on__lt=timezone.localdate())
            elif expiry_filter == "expiring":
                today = timezone.localdate()
                qs = qs.filter(
                    status=EmployeeCompetency.Status.ACTIVE,
                    expires_on__gte=today,
                    expires_on__lte=today + timedelta(days=30),
                )
            if date_from:
                qs = qs.filter(achieved_on__gte=date_from)
            if date_to:
                qs = qs.filter(achieved_on__lte=date_to)

            headers = [
                "شناسه",
                "سازمان",
                "شماره پرسنلی",
                "نام کارمند",
                "محل کار",
                "کد صلاحیت",
                "نام صلاحیت",
                "تاریخ احراز",
                "تاریخ انقضا",
                "وضعیت موثر",
                "شماره گواهی",
                "دوره منبع",
                "داده سنتتیک",
            ]

            def row_gen():
                for item in qs.iterator(chunk_size=200):
                    yield [
                        item.pk,
                        item.organization.name if item.organization else "",
                        item.employee.employee_no,
                        item.employee.full_name,
                        item.employee.workplace.name if item.employee.workplace else "—",
                        item.competency.code,
                        item.competency.name,
                        item.achieved_on.strftime("%Y-%m-%d") if item.achieved_on else "",
                        item.expires_on.strftime("%Y-%m-%d") if item.expires_on else "",
                        item.effective_status,
                        item.certificate_number,
                        item.source_course.title if item.source_course else "",
                        "بله" if item.is_synthetic else "خیر",
                    ]

            return export_csv("competencies_report.csv", headers, row_gen())

        elif report_type == "ppe":
            qs = PPEAssignment.objects.select_related(
                "organization",
                "employee",
                "employee__workplace",
                "item",
                "stock",
                "issued_by",
            ).prefetch_related("events").all()
            if target_orgs is not None:
                qs = qs.filter(organization_id__in=target_orgs)
            if workplace_id:
                qs = qs.filter(employee__workplace_id=workplace_id)
            if status_filter:
                qs = qs.filter(status=status_filter)
            item_filter = request.query_params.get("item")
            if item_filter and str(item_filter).isdigit():
                qs = qs.filter(item_id=int(item_filter))
            due_filter = request.query_params.get("due")
            today = timezone.localdate()
            if due_filter == "overdue":
                qs = qs.filter(status=PPEAssignment.Status.ACTIVE, replacement_due_on__lt=today)
            elif due_filter == "due_soon":
                qs = qs.filter(
                    status=PPEAssignment.Status.ACTIVE,
                    replacement_due_on__gte=today,
                    replacement_due_on__lte=today + timedelta(days=30),
                )
            if date_from:
                qs = qs.filter(issued_on__gte=date_from)
            if date_to:
                qs = qs.filter(issued_on__lte=date_to)

            headers = [
                "شناسه",
                "سازمان",
                "شماره پرسنلی",
                "نام کارمند",
                "محل کار",
                "کد قلم PPE",
                "نام قلم PPE",
                "تعداد",
                "شماره سریال",
                "تاریخ تحویل",
                "موعد تعویض",
                "وضعیت",
                "وضعیت استفاده",
                "شماره سریال فعال",
                "تعداد رویداد",
                "داده سنتتیک",
            ]

            def row_gen():
                for item in qs.iterator(chunk_size=200):
                    yield [
                        item.pk,
                        item.organization.name if item.organization else "",
                        item.employee.employee_no,
                        item.employee.full_name,
                        item.employee.workplace.name if item.employee.workplace else "—",
                        item.item.code,
                        item.item.name,
                        item.quantity,
                        item.serial_number,
                        item.issued_on.strftime("%Y-%m-%d") if item.issued_on else "",
                        item.replacement_due_on.strftime("%Y-%m-%d") if item.replacement_due_on else "",
                        item.get_status_display(),
                        item.usage_status,
                        "بله" if item.serial_number and item.status == PPEAssignment.Status.ACTIVE else "خیر",
                        item.events.count(),
                        "بله" if item.is_synthetic else "خیر",
                    ]

            return export_csv("ppe_report.csv", headers, row_gen())

        elif report_type == "corrective-actions":
            qs = CorrectiveAction.objects.select_related(
                "organization", "non_conformity", "non_conformity__workplace", "responsible"
            ).all()
            if target_orgs is not None:
                qs = qs.filter(organization_id__in=target_orgs)
            if workplace_id:
                qs = qs.filter(non_conformity__workplace_id=workplace_id)
            if status_filter:
                qs = qs.filter(status=status_filter)
            due_from = request.query_params.get("due_from") or date_from
            due_to = request.query_params.get("due_to") or date_to
            if due_from:
                qs = qs.filter(due_date__gte=due_from)
            if due_to:
                qs = qs.filter(due_date__lte=due_to)

            headers = [
                "شناسه",
                "سازمان",
                "محل کار",
                "شرح اقدام",
                "مسئول",
                "مهلت اقدام",
                "وضعیت",
                "نتیجه اجرا",
                "تأیید اثربخشی",
            ]

            def row_gen():
                for a in qs.iterator(chunk_size=200):
                    yield [
                        a.pk,
                        a.organization.name if a.organization else "",
                        a.non_conformity.workplace.name if a.non_conformity and a.non_conformity.workplace else "—",
                        a.description,
                        a.responsible.get_full_name() or a.responsible.username if a.responsible else "—",
                        a.due_date.strftime("%Y-%m-%d") if a.due_date else "",
                        a.get_status_display(),
                        a.result_text or "",
                        "بله" if a.effectiveness_verified else "خیر",
                    ]

            return export_csv("corrective_actions_report.csv", headers, row_gen())

        elif report_type == "permits":
            qs = Permit.objects.select_related("organization", "workplace", "requester", "responsible_supervisor").prefetch_related("assigned_employees").all()
            if target_orgs is not None:
                qs = qs.filter(organization_id__in=target_orgs)
            if workplace_id:
                qs = qs.filter(workplace_id=workplace_id)
            if status_filter:
                qs = qs.filter(status=status_filter)
            if date_from:
                qs = qs.filter(valid_from__date__gte=date_from)
            if date_to:
                qs = qs.filter(valid_until__date__lte=date_to)

            headers = [
                "شناسه",
                "کد مرجع",
                "سازمان",
                "محل کار",
                "نوع مجوز",
                "عنوان مجوز",
                "درخواست‌کننده",
                "سرپرست مسئول",
                "وضعیت",
                "شروع اعتبار",
                "پایان اعتبار",
                "تعداد نفرات تیم",
            ]

            def row_gen():
                for p in qs.iterator(chunk_size=200):
                    yield [
                        p.pk,
                        p.reference_code,
                        p.organization.name if p.organization else "",
                        p.workplace.name if p.workplace else "—",
                        p.get_permit_type_display(),
                        p.title,
                        p.requester.get_full_name() or p.requester.username if p.requester else "—",
                        p.responsible_supervisor.get_full_name() or p.responsible_supervisor.username if p.responsible_supervisor else "—",
                        p.get_status_display(),
                        p.valid_from.strftime("%Y-%m-%d %H:%M") if p.valid_from else "",
                        p.valid_until.strftime("%Y-%m-%d %H:%M") if p.valid_until else "",
                        p.assigned_employees.count(),
                    ]

            return export_csv("permits_report.csv", headers, row_gen())

        elif report_type == "incidents":
            qs = Incident.objects.select_related("organization", "workplace", "reported_by").all()
            if target_orgs is not None:
                qs = qs.filter(organization_id__in=target_orgs)
            if workplace_id:
                qs = qs.filter(workplace_id=workplace_id)
            if status_filter:
                qs = qs.filter(status=status_filter)
            if date_from:
                qs = qs.filter(occurred_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(occurred_at__date__lte=date_to)

            headers = [
                "شناسه",
                "سازمان",
                "محل کار",
                "نوع رخداد",
                "عنوان حادثه",
                "شدت",
                "وضعیت رسیدگی",
                "تاریخ و زمان وقوع",
                "ثبت‌کننده",
                "تلفات روز کاری (LTD)",
                "تعداد مصدومان",
            ]

            def row_gen():
                for inc in qs.iterator(chunk_size=200):
                    yield [
                        inc.pk,
                        inc.organization.name if inc.organization else "",
                        inc.workplace.name if inc.workplace else "—",
                        inc.get_incident_type_display(),
                        inc.title,
                        inc.get_severity_display(),
                        inc.get_status_display(),
                        inc.occurred_at.strftime("%Y-%m-%d %H:%M") if inc.occurred_at else "",
                        inc.reported_by.get_full_name() or inc.reported_by.username if inc.reported_by else "—",
                        inc.lost_time_days,
                        inc.injury_count,
                    ]

            return export_csv("incidents_report.csv", headers, row_gen())

        return Response({"error": {"code": "invalid_report_type", "message": "نوع گزارش نامعتبر است."}}, status=400)
