from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import TenantRequiredPermission
from apps.organizations.models import Membership
from .formulas import (
    calculate_crane_lift_parameters,
    calculate_electricity_and_emissions,
    calculate_excavation_geometry,
    calculate_fleet_fuel_efficiency,
    calculate_hse_rates,
    calculate_load_weight_from_geometry,
    calculate_noise_dose_and_twa,
    calculate_sling_tension_and_rigging,
    combine_noise_levels,
    convert_units,
)
from .models import CalculationRecord
from .serializers import (
    CalculationRecordSerializer,
    EnergyFleetInputSerializer,
    ExcavationInputSerializer,
    HSERatesInputSerializer,
    NoiseInputSerializer,
    RiggingInputSerializer,
    UnitConversionInputSerializer,
)


def _get_user_organization(user):
    membership = Membership.objects.filter(user=user, is_active=True).first()
    return membership.organization if membership else None


class CalculationRecordViewSet(viewsets.ModelViewSet):
    serializer_class = CalculationRecordSerializer
    permission_classes = [IsAuthenticated, TenantRequiredPermission]

    def get_queryset(self):
        user = self.request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        queryset = CalculationRecord.objects.filter(organization_id__in=org_ids)
        calc_type = self.request.query_params.get("calculator_type")
        if calc_type:
            queryset = queryset.filter(calculator_type=calc_type)
        return queryset

    def perform_create(self, serializer):
        org = _get_user_organization(self.request.user)
        serializer.save(organization=org, user=self.request.user)


class UnitConvertAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UnitConversionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            result = convert_units(
                category=data["category"],
                value=data["value"],
                from_unit=data["from_unit"],
                to_unit=data["to_unit"],
            )
            return Response({
                "category": data["category"],
                "input_value": data["value"],
                "from_unit": data["from_unit"],
                "to_unit": data["to_unit"],
                "result": result,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class HSERatesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = HSERatesInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = calculate_hse_rates(
            exposure_hours=data["exposure_hours"],
            lost_time_injuries=data["lost_time_injuries"],
            total_recordable_incidents=data["total_recordable_incidents"],
            lost_days=data["lost_days"],
            multiplier=data["multiplier"],
        )
        if request.data.get("save_record"):
            org = _get_user_organization(request.user)
            if org:
                CalculationRecord.objects.create(
                    organization=org,
                    user=request.user,
                    calculator_type=CalculationRecord.CalculatorType.HSE_RATES,
                    title=request.data.get("title", "محاسبه شاخص‌های حوادث HSE"),
                    input_params=data,
                    results=result,
                )
        return Response(result)


class NoiseCalculatorAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = NoiseInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        out = {}
        if data.get("sound_levels"):
            out["logarithmic_sum"] = combine_noise_levels(data["sound_levels"])
        if data.get("exposures"):
            out["dose_and_twa"] = calculate_noise_dose_and_twa(
                exposures=data["exposures"],
                criterion_level=data.get("criterion_level", 85.0),
                exchange_rate=data.get("exchange_rate", 3.0),
            )
        if request.data.get("save_record"):
            org = _get_user_organization(request.user)
            if org:
                CalculationRecord.objects.create(
                    organization=org,
                    user=request.user,
                    calculator_type=CalculationRecord.CalculatorType.NOISE,
                    title=request.data.get("title", "محاسبه صدای محیط کار"),
                    input_params=data,
                    results=out,
                )
        return Response(out)


class RiggingCalculatorAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = RiggingInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        sub_type = data["calculation_sub_type"]

        if sub_type == "sling_tension":
            res = calculate_sling_tension_and_rigging(
                load_weight_kg=data.get("load_weight_kg", 0.0),
                rigging_hardware_weight_kg=data.get("rigging_hardware_weight_kg", 0.0),
                hook_block_weight_kg=data.get("hook_block_weight_kg", 0.0),
                num_sling_legs=data.get("num_sling_legs", 2),
                sling_angle_to_horizontal_deg=data.get("sling_angle_to_horizontal_deg", 60.0),
                shackle_wll_kg=data.get("shackle_wll_kg"),
            )
        elif sub_type == "geometry_weight":
            res = calculate_load_weight_from_geometry(
                shape=data.get("shape", "rectangular_prism"),
                dimensions=data.get("dimensions", {}),
                material=data.get("material", "steel"),
                custom_density_kg_m3=data.get("custom_density_kg_m3"),
            )
        elif sub_type == "crane_capacity":
            total_load = data.get("load_weight_kg", 0.0) + data.get("rigging_hardware_weight_kg", 0.0)
            res = calculate_crane_lift_parameters(
                total_gross_load_kg=total_load,
                crane_rated_capacity_kg=data.get("crane_rated_capacity_kg", 1.0),
                crane_total_weight_kg=data.get("crane_total_weight_kg", 0.0),
                outrigger_pad_area_sqm=data.get("outrigger_pad_area_sqm", 1.0),
                allowable_ground_pressure_kpa=data.get("allowable_ground_pressure_kpa", 200.0),
            )
        else:
            return Response({"error": "نوع محاسبه باربرداری نامعتبر است."}, status=status.HTTP_400_BAD_REQUEST)

        if request.data.get("save_record"):
            org = _get_user_organization(request.user)
            if org:
                CalculationRecord.objects.create(
                    organization=org,
                    user=request.user,
                    calculator_type=CalculationRecord.CalculatorType.RIGGING_CRANE,
                    title=request.data.get("title", f"محاسبه باربرداری - {sub_type}"),
                    input_params=data,
                    results=res,
                )
        return Response(res)


class EnergyFleetCalculatorAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = EnergyFleetInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        mode = data["mode"]

        if mode == "electricity":
            res = calculate_electricity_and_emissions(
                consumption_kwh=data.get("consumption_kwh", 0.0),
                tariff_irr_per_kwh=data.get("tariff_irr_per_kwh", 0.0),
            )
        else:
            res = calculate_fleet_fuel_efficiency(
                fuel_liters=data.get("fuel_liters", 0.0),
                distance_km=data.get("distance_km", 0.0),
                operating_hours=data.get("operating_hours"),
                fuel_cost_per_liter_irr=data.get("fuel_cost_per_liter_irr"),
            )

        if request.data.get("save_record"):
            org = _get_user_organization(request.user)
            if org:
                CalculationRecord.objects.create(
                    organization=org,
                    user=request.user,
                    calculator_type=CalculationRecord.CalculatorType.ENERGY_FLEET,
                    title=request.data.get("title", f"محاسبه انرژی/سوخت - {mode}"),
                    input_params=data,
                    results=res,
                )
        return Response(res)


class ExcavationCalculatorAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ExcavationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        res = calculate_excavation_geometry(
            depth_m=data["depth_m"],
            length_m=data["length_m"],
            bottom_width_m=data["bottom_width_m"],
            soil_type=data["soil_type"],
        )
        if request.data.get("save_record"):
            org = _get_user_organization(request.user)
            if org:
                CalculationRecord.objects.create(
                    organization=org,
                    user=request.user,
                    calculator_type=CalculationRecord.CalculatorType.EXCAVATION,
                    title=request.data.get("title", f"محاسبه شیب گودبرداری ({data['soil_type']})"),
                    input_params=data,
                    results=res,
                )
        return Response(res)
