import csv
from decimal import Decimal
import io
from typing import Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.auditlog.services import log_event
from apps.findings.models import NonConformity

from .models import (
    EnvironmentalAspect,
    EnvironmentalThreshold,
    OccupationalHygieneRecord,
    WasteRecord,
    WastewaterEmissionRecord,
)


def evaluate_and_record_wastewater_emission(
    organization,
    workplace,
    sampling_point: str,
    category: str,
    sample_date,
    parameter: str,
    measured_value: Decimal,
    unit: str,
    threshold: Optional[EnvironmentalThreshold] = None,
    laboratory_name: str = "",
    test_report_number: str = "",
    notes: str = "",
    actor=None,
    auto_create_nonconformity: bool = True,
    is_synthetic: bool = False,
) -> WastewaterEmissionRecord:
    """Record wastewater/emission test result, evaluate threshold, and flag exceedances."""
    val = Decimal(str(measured_value))

    # Match threshold if not provided
    if not threshold:
        threshold = (
            EnvironmentalThreshold.objects.filter(
                organization=organization,
                parameter__iexact=parameter,
                is_active=True,
            )
            .order_by("-created_at")
            .first()
        )

    is_exceedance = False
    standard_limit = None
    if threshold:
        standard_limit = threshold.limit_value
        is_exceedance, _ = threshold.evaluate_value(val)

    with transaction.atomic():
        nc = None
        if is_exceedance and auto_create_nonconformity:
            nc_title = f"تخطی از حد مجاز زیست‌محیطی در {sampling_point} ({parameter}: {val} {unit})"
            nc = NonConformity.objects.create(
                organization=organization,
                workplace=workplace,
                severity=NonConformity.Severity.HIGH,
                source=NonConformity.Source.OTHER,
                status=NonConformity.Status.OPEN,
                description=(
                    f"تخطی آزمایشگاهی از حد استاندارد مجاز در نقطه «{sampling_point}». "
                    f"پارامتر {parameter} برابر با {val} {unit} اندازه‌گیری شد (حد مجاز: {standard_limit} {unit}). "
                    f"آزمایشگاه: {laboratory_name or 'معتمد'}، شماره گزارش: {test_report_number or 'ثبت دستی'}."
                ),
            )

        record = WastewaterEmissionRecord.objects.create(
            organization=organization,
            workplace=workplace,
            sampling_point=sampling_point,
            category=category,
            sample_date=sample_date,
            parameter=parameter,
            measured_value=val,
            unit=unit,
            threshold=threshold,
            standard_limit=standard_limit,
            is_exceedance=is_exceedance,
            laboratory_name=laboratory_name,
            test_report_number=test_report_number,
            non_conformity=nc,
            notes=notes,
            is_synthetic=is_synthetic,
        )

        if actor:
            log_event(
                organization=organization,
                actor=actor,
                action="environment.sample_recorded",
                entity_type="WastewaterEmissionRecord",
                entity_id=record.id,
                details={
                    "sampling_point": sampling_point,
                    "parameter": parameter,
                    "measured_value": str(val),
                    "is_exceedance": is_exceedance,
                    "non_conformity_id": nc.id if nc else None,
                },
            )

    return record


def evaluate_and_record_hygiene_survey(
    organization,
    workplace,
    category: str,
    location_details: str,
    survey_date,
    surveyor_name: str,
    measured_value: Decimal,
    unit: str,
    threshold: Optional[EnvironmentalThreshold] = None,
    control_recommendation: str = "",
    actor=None,
    auto_create_nonconformity: bool = True,
    is_synthetic: bool = False,
) -> OccupationalHygieneRecord:
    """Record occupational hygiene survey and evaluate worker exposure vs TLV/OEL."""
    val = Decimal(str(measured_value))

    if not threshold:
        threshold = (
            EnvironmentalThreshold.objects.filter(
                organization=organization,
                category=category,
                is_active=True,
            )
            .order_by("-created_at")
            .first()
        )

    is_exceedance = False
    standard_limit = None
    result = OccupationalHygieneRecord.AssessmentResult.ACCEPTABLE

    if threshold:
        standard_limit = threshold.limit_value
        is_exceedance, _ = threshold.evaluate_value(val)
        limit_dec = Decimal(str(threshold.limit_value))
        if is_exceedance:
            result = OccupationalHygieneRecord.AssessmentResult.UNACCEPTABLE
        elif val >= (limit_dec * Decimal("0.80")):
            result = OccupationalHygieneRecord.AssessmentResult.WARNING
        else:
            result = OccupationalHygieneRecord.AssessmentResult.ACCEPTABLE

    with transaction.atomic():
        nc = None
        if is_exceedance and auto_create_nonconformity:
            nc = NonConformity.objects.create(
                organization=organization,
                workplace=workplace,
                severity=NonConformity.Severity.HIGH,
                source=NonConformity.Source.OTHER,
                status=NonConformity.Status.OPEN,
                description=(
                    f"مخاطره بهداشت حرفه‌ای در ایستگاه «{location_details}». "
                    f"عامل زیان‌آور {category} با مقدار {val} {unit} سنجش شد که بالاتر از حد مجاز مواجهه شغلی ({standard_limit} {unit}) است. "
                    f"اقدام پیشنهادی: {control_recommendation or 'توقف فعالیت یا تجهیز به PPE موثر'}."
                ),
            )

        record = OccupationalHygieneRecord.objects.create(
            organization=organization,
            workplace=workplace,
            category=category,
            location_details=location_details,
            survey_date=survey_date,
            surveyor_name=surveyor_name,
            measured_value=val,
            unit=unit,
            threshold=threshold,
            standard_limit=standard_limit,
            is_exceedance=is_exceedance,
            assessment_result=result,
            control_recommendation=control_recommendation,
            non_conformity=nc,
            is_synthetic=is_synthetic,
        )

        if actor:
            log_event(
                organization=organization,
                actor=actor,
                action="hygiene.survey_recorded",
                entity_type="OccupationalHygieneRecord",
                entity_id=record.id,
                details={
                    "category": category,
                    "location": location_details,
                    "measured_value": str(val),
                    "assessment_result": result,
                    "is_exceedance": is_exceedance,
                    "non_conformity_id": nc.id if nc else None,
                },
            )

    return record


def update_waste_status(
    waste_record: WasteRecord,
    new_status: str,
    consignment_number: str = "",
    contractor=None,
    disposal_facility: str = "",
    disposal_method: str = "",
    disposal_date=None,
    actor=None,
) -> WasteRecord:
    """Transition waste record through its lifecycle: stored -> transferred -> disposed."""
    valid_transitions = {
        WasteRecord.Status.STORED: [WasteRecord.Status.TRANSFERRED, WasteRecord.Status.DISPOSED],
        WasteRecord.Status.TRANSFERRED: [WasteRecord.Status.DISPOSED],
        WasteRecord.Status.DISPOSED: [],
    }

    if new_status not in valid_transitions.get(waste_record.status, []):
        raise ValidationError(
            f"تغییر وضعیت از «{waste_record.get_status_display()}» به وضعیت انتخابی مجاز نیست."
        )

    if new_status == WasteRecord.Status.TRANSFERRED:
        if not consignment_number and not waste_record.consignment_number:
            raise ValidationError("برای حمل پسماند درج شماره مانیفست / بارنامه الزامی است.")
        if consignment_number:
            waste_record.consignment_number = consignment_number.strip()
        if contractor:
            waste_record.contractor = contractor

    if new_status == WasteRecord.Status.DISPOSED:
        if not disposal_facility and not waste_record.disposal_facility:
            raise ValidationError("برای وضعیت دفع نهایی درج نام مرکز مجاز امحاء الزامی است.")
        if disposal_facility:
            waste_record.disposal_facility = disposal_facility.strip()
        if disposal_method:
            waste_record.disposal_method = disposal_method.strip()
        waste_record.disposal_date = disposal_date or timezone.now().date()

    waste_record.status = new_status
    waste_record.save()

    if actor:
        log_event(
            organization=waste_record.organization,
            actor=actor,
            action="waste.status_updated",
            entity_type="WasteRecord",
            entity_id=waste_record.id,
            details={
                "new_status": new_status,
                "consignment_number": waste_record.consignment_number,
                "disposal_facility": waste_record.disposal_facility,
            },
        )

    return waste_record


def get_environmental_summary(organization) -> dict:
    """Compute KPI metrics for environmental & occupational hygiene dashboard."""
    aspects = EnvironmentalAspect.objects.filter(organization=organization)
    wastes = WasteRecord.objects.filter(organization=organization)
    emissions = WastewaterEmissionRecord.objects.filter(organization=organization)
    hygienes = OccupationalHygieneRecord.objects.filter(organization=organization)

    hazardous_waste_kg = sum(
        w.quantity for w in wastes.filter(waste_type=WasteRecord.WasteType.HAZARDOUS, unit=WasteRecord.Unit.KG)
    ) + sum(
        w.quantity * 1000 for w in wastes.filter(waste_type=WasteRecord.WasteType.HAZARDOUS, unit=WasteRecord.Unit.TON)
    )

    non_hazardous_waste_kg = sum(
        w.quantity for w in wastes.filter(waste_type=WasteRecord.WasteType.NON_HAZARDOUS, unit=WasteRecord.Unit.KG)
    ) + sum(
        w.quantity * 1000 for w in wastes.filter(waste_type=WasteRecord.WasteType.NON_HAZARDOUS, unit=WasteRecord.Unit.TON)
    )

    return {
        "aspects_total": aspects.count(),
        "aspects_significant": aspects.filter(is_significant=True).count(),
        "waste_records_count": wastes.count(),
        "hazardous_waste_kg": float(hazardous_waste_kg),
        "non_hazardous_waste_kg": float(non_hazardous_waste_kg),
        "active_stored_waste_count": wastes.filter(status=WasteRecord.Status.STORED).count(),
        "emission_records_count": emissions.count(),
        "emission_exceedances_count": emissions.filter(is_exceedance=True).count(),
        "hygiene_surveys_count": hygienes.count(),
        "hygiene_exceedances_count": hygienes.filter(is_exceedance=True).count(),
    }


def generate_waste_manifest_csv(organization) -> str:
    """Generate CSV export of waste records for audit and compliance reporting."""
    wastes = WasteRecord.objects.filter(organization=organization).select_related("workplace", "contractor")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "شناسه پسماند",
        "کارگاه",
        "نام پسماند",
        "نوع پسماند",
        "مقدار",
        "واحد",
        "محل انبارش",
        "تاریخ تولید",
        "وضعیت",
        "شماره بارنامه",
        "پیمانکار حمل",
        "مرکز امحاء",
        "روش دفع",
        "تاریخ دفع",
    ])
    for w in wastes:
        writer.writerow([
            w.id,
            w.workplace.name if w.workplace else "-",
            w.waste_name,
            w.get_waste_type_display(),
            w.quantity,
            w.get_unit_display(),
            w.storage_location,
            str(w.generation_date),
            w.get_status_display(),
            w.consignment_number or "-",
            w.contractor.name if w.contractor else "-",
            w.disposal_facility or "-",
            w.disposal_method or "-",
            str(w.disposal_date) if w.disposal_date else "-",
        ])
    return output.getvalue()
