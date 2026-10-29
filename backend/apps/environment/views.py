from decimal import Decimal
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import accessible_organization_ids, can_view_organization
from apps.core.views_utils import resolve_organization
from apps.organizations.models import Organization

from .models import (
    EnvironmentalAspect,
    EnvironmentalThreshold,
    OccupationalHygieneRecord,
    WasteRecord,
    WastewaterEmissionRecord,
)
from .serializers import (
    EnvironmentalAspectSerializer,
    EnvironmentalThresholdSerializer,
    OccupationalHygieneRecordSerializer,
    WasteRecordSerializer,
    WastewaterEmissionRecordSerializer,
)
from .services import (
    evaluate_and_record_hygiene_survey,
    evaluate_and_record_wastewater_emission,
    generate_waste_manifest_csv,
    get_environmental_summary,
    update_waste_status,
)


class EnvironmentBaseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org_ids = accessible_organization_ids(user)
        qs = super().get_queryset().filter(organization_id__in=org_ids)
        org_param = self.request.query_params.get("organization")
        if org_param and org_param.isdigit():
            if int(org_param) in org_ids:
                qs = qs.filter(organization_id=int(org_param))
            else:
                return qs.none()
        return qs

    def _resolve_org(self):
        org_param = self.request.data.get("organization") or self.request.query_params.get("organization")
        user = self.request.user
        org_ids = accessible_organization_ids(user)
        if org_param:
            try:
                org_id = int(org_param)
            except (ValueError, TypeError):
                raise ValidationError({"organization": "شناسه سازمان نامعتبر است."})
            if org_id not in org_ids:
                raise PermissionDenied("دسترسی به این سازمان مجاز نیست.")
        elif len(org_ids) >= 1:
            org_id = list(org_ids)[0]
        else:
            raise ValidationError({"organization": "شناسه سازمان لازم است."})
        return Organization.objects.get(pk=org_id)


class EnvironmentalThresholdViewSet(EnvironmentBaseViewSet):
    queryset = EnvironmentalThreshold.objects.all()
    serializer_class = EnvironmentalThresholdSerializer

    def perform_create(self, serializer):
        org = self._resolve_org()
        serializer.save(organization=org)


class EnvironmentalAspectViewSet(EnvironmentBaseViewSet):
    queryset = EnvironmentalAspect.objects.select_related("workplace")
    serializer_class = EnvironmentalAspectSerializer

    def perform_create(self, serializer):
        org = self._resolve_org()
        serializer.save(organization=org)


class WasteRecordViewSet(EnvironmentBaseViewSet):
    queryset = WasteRecord.objects.select_related("workplace", "contractor")
    serializer_class = WasteRecordSerializer

    def perform_create(self, serializer):
        org = self._resolve_org()
        serializer.save(organization=org)

    @action(detail=True, methods=["post"], url_path="update-status")
    def update_status(self, request, pk=None):
        waste = self.get_object()
        new_status = request.data.get("status")
        if not new_status:
            return Response({"status": ["انتخاب وضعیت جدید الزامی است."]}, status=status.HTTP_400_BAD_REQUEST)

        consignment_number = request.data.get("consignment_number", "")
        contractor_id = request.data.get("contractor")
        contractor = None
        if contractor_id:
            from apps.workforce.models import ContractorCompany
            contractor = get_object_or_404(ContractorCompany, pk=contractor_id, organization=waste.organization)

        disposal_facility = request.data.get("disposal_facility", "")
        disposal_method = request.data.get("disposal_method", "")
        disposal_date = request.data.get("disposal_date")

        try:
            updated = update_waste_status(
                waste_record=waste,
                new_status=new_status,
                consignment_number=consignment_number,
                contractor=contractor,
                disposal_facility=disposal_facility,
                disposal_method=disposal_method,
                disposal_date=disposal_date,
                actor=request.user,
            )
            return Response(WasteRecordSerializer(updated).data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class WastewaterEmissionRecordViewSet(EnvironmentBaseViewSet):
    queryset = WastewaterEmissionRecord.objects.select_related("workplace", "threshold", "non_conformity")
    serializer_class = WastewaterEmissionRecordSerializer

    def perform_create(self, serializer):
        org = self._resolve_org()
        data = serializer.validated_data
        record = evaluate_and_record_wastewater_emission(
            organization=org,
            workplace=data["workplace"],
            sampling_point=data["sampling_point"],
            category=data["category"],
            sample_date=data["sample_date"],
            parameter=data["parameter"],
            measured_value=data["measured_value"],
            unit=data["unit"],
            threshold=data.get("threshold"),
            laboratory_name=data.get("laboratory_name", ""),
            test_report_number=data.get("test_report_number", ""),
            notes=data.get("notes", ""),
            actor=self.request.user,
        )
        serializer.instance = record


class OccupationalHygieneRecordViewSet(EnvironmentBaseViewSet):
    queryset = OccupationalHygieneRecord.objects.select_related("workplace", "threshold", "non_conformity")
    serializer_class = OccupationalHygieneRecordSerializer

    def perform_create(self, serializer):
        org = self._resolve_org()
        data = serializer.validated_data
        record = evaluate_and_record_hygiene_survey(
            organization=org,
            workplace=data["workplace"],
            category=data["category"],
            location_details=data["location_details"],
            survey_date=data["survey_date"],
            surveyor_name=data["surveyor_name"],
            measured_value=data["measured_value"],
            unit=data["unit"],
            threshold=data.get("threshold"),
            control_recommendation=data.get("control_recommendation", ""),
            actor=self.request.user,
        )
        serializer.instance = record


class EnvironmentalSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        org_ids = accessible_organization_ids(user)
        org_param = request.query_params.get("organization")
        if org_param and org_param.isdigit():
            org_id = int(org_param)
            if org_id not in org_ids:
                return Response(
                    {"error": {"code": "forbidden", "message": "دسترسی به این سازمان مجاز نیست."}},
                    status=status.HTTP_403_FORBIDDEN,
                )
            orgs = Organization.objects.filter(pk=org_id)
        else:
            orgs = Organization.objects.filter(id__in=org_ids)

        if not orgs.exists():
            return Response({
                "aspects_total": 0,
                "aspects_significant": 0,
                "waste_records_count": 0,
                "hazardous_waste_kg": 0.0,
                "non_hazardous_waste_kg": 0.0,
                "active_stored_waste_count": 0,
                "emission_records_count": 0,
                "emission_exceedances_count": 0,
                "hygiene_surveys_count": 0,
                "hygiene_exceedances_count": 0,
            })

        summary = get_environmental_summary(orgs)
        return Response(summary)


class WasteExportCSVView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        org_ids = accessible_organization_ids(user)
        org_param = request.query_params.get("organization")
        if org_param and org_param.isdigit():
            org_id = int(org_param)
            if org_id not in org_ids:
                return Response(
                    {"error": {"code": "forbidden", "message": "دسترسی به این سازمان مجاز نیست."}},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif len(org_ids) >= 1:
            org_id = list(org_ids)[0]
        else:
            return Response(
                {"error": {"code": "organization_required", "message": "شناسه سازمان لازم است."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        org = Organization.objects.get(pk=org_id)
        csv_data = generate_waste_manifest_csv(org)
        response = HttpResponse(csv_data, content_type="text/csv; charset=utf-8-sig")
        response["Content-Disposition"] = f'attachment; filename="waste_manifest_{org.code}.csv"'
        return response
