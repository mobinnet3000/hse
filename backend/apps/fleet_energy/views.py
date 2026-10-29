from django.db.models import Sum
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import TenantRequiredPermission
from apps.organizations.models import Membership
from .models import EnergyConsumptionLog, ExcavationOperation, FleetFuelLog, FleetVehicle
from .serializers import (
    EnergyConsumptionLogSerializer,
    ExcavationOperationSerializer,
    FleetFuelLogSerializer,
    FleetVehicleSerializer,
)


def _get_user_organization(user):
    membership = Membership.objects.filter(user=user, is_active=True).first()
    return membership.organization if membership else None


class FleetVehicleViewSet(viewsets.ModelViewSet):
    serializer_class = FleetVehicleSerializer
    permission_classes = [IsAuthenticated, TenantRequiredPermission]

    def get_queryset(self):
        user = self.request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        return FleetVehicle.objects.filter(organization_id__in=org_ids).select_related("assigned_driver")

    def perform_create(self, serializer):
        org = _get_user_organization(self.request.user)
        serializer.save(organization=org)


class FleetFuelLogViewSet(viewsets.ModelViewSet):
    serializer_class = FleetFuelLogSerializer
    permission_classes = [IsAuthenticated, TenantRequiredPermission]

    def get_queryset(self):
        user = self.request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        queryset = FleetFuelLog.objects.filter(organization_id__in=org_ids).select_related("vehicle")
        vehicle_id = self.request.query_params.get("vehicle")
        if vehicle_id:
            queryset = queryset.filter(vehicle_id=vehicle_id)
        return queryset

    def perform_create(self, serializer):
        org = _get_user_organization(self.request.user)
        serializer.save(organization=org)


class EnergyConsumptionLogViewSet(viewsets.ModelViewSet):
    serializer_class = EnergyConsumptionLogSerializer
    permission_classes = [IsAuthenticated, TenantRequiredPermission]

    def get_queryset(self):
        user = self.request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        queryset = EnergyConsumptionLog.objects.filter(organization_id__in=org_ids).select_related("workplace")
        utility = self.request.query_params.get("utility_type")
        if utility:
            queryset = queryset.filter(utility_type=utility)
        return queryset

    def perform_create(self, serializer):
        org = _get_user_organization(self.request.user)
        serializer.save(organization=org)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.get_queryset()
        total_kwh = qs.filter(utility_type=EnergyConsumptionLog.UtilityType.ELECTRICITY).aggregate(
            s=Sum("consumption_value")
        )["s"] or 0.0
        total_carbon = qs.aggregate(c=Sum("carbon_emissions_kg_co2"))["c"] or 0.0
        total_cost = qs.aggregate(t=Sum("total_cost_irr"))["t"] or 0.0

        return Response({
            "total_electricity_kwh": round(total_kwh, 2),
            "total_carbon_kg_co2": round(total_carbon, 2),
            "total_energy_cost_irr": round(total_cost, 2),
        })


class ExcavationOperationViewSet(viewsets.ModelViewSet):
    serializer_class = ExcavationOperationSerializer
    permission_classes = [IsAuthenticated, TenantRequiredPermission]

    def get_queryset(self):
        user = self.request.user
        org_ids = Membership.objects.filter(user=user, is_active=True).values_list("organization_id", flat=True)
        queryset = ExcavationOperation.objects.filter(organization_id__in=org_ids).select_related(
            "workplace", "competent_person"
        )
        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    def perform_create(self, serializer):
        org = _get_user_organization(self.request.user)
        serializer.save(organization=org)
