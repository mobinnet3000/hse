from rest_framework import serializers
from .models import EnergyConsumptionLog, ExcavationOperation, FleetFuelLog, FleetVehicle


def _get_request_org_ids(serializer_instance):
    request = serializer_instance.context.get("request")
    if request and hasattr(request, "user"):
        from apps.organizations.models import Membership
        return set(Membership.objects.filter(
            user=request.user, is_active=True
        ).values_list("organization_id", flat=True))
    return set()


class FleetFuelLogSerializer(serializers.ModelSerializer):
    vehicle_code = serializers.CharField(source="vehicle.vehicle_code", read_only=True)

    class Meta:
        model = FleetFuelLog
        fields = [
            "id",
            "organization",
            "vehicle",
            "vehicle_code",
            "log_date",
            "odometer_km",
            "engine_hours",
            "fuel_liters",
            "total_cost_irr",
            "distance_traveled_km",
            "consumption_rate_l_per_100km",
            "driver_name",
            "receipt_reference",
            "notes",
            "is_synthetic",
            "created_at",
        ]
        read_only_fields = ["id", "organization", "distance_traveled_km", "consumption_rate_l_per_100km", "created_at"]

    def validate_vehicle(self, value):
        org_ids = _get_request_org_ids(self)
        if org_ids and value and value.organization_id not in org_ids:
            raise serializers.ValidationError("خودرو انتخاب‌شده متعلق به سازمان جاری نیست.")
        return value


class FleetVehicleSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source="assigned_driver.get_full_name", read_only=True)
    fuel_logs = FleetFuelLogSerializer(many=True, read_only=True)

    class Meta:
        model = FleetVehicle
        fields = [
            "id",
            "organization",
            "workplace",
            "vehicle_code",
            "plate_number",
            "model_name",
            "vehicle_type",
            "fuel_type",
            "assigned_driver",
            "driver_name",
            "current_odometer_km",
            "current_engine_hours",
            "fuel_logs",
            "is_active",
            "is_synthetic",
            "created_at",
        ]
        read_only_fields = ["id", "organization", "created_at"]

    def validate_workplace(self, value):
        org_ids = _get_request_org_ids(self)
        if org_ids and value and value.organization_id not in org_ids:
            raise serializers.ValidationError("کارگاه انتخاب‌شده متعلق به سازمان جاری نیست.")
        return value


class EnergyConsumptionLogSerializer(serializers.ModelSerializer):
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)

    class Meta:
        model = EnergyConsumptionLog
        fields = [
            "id",
            "organization",
            "workplace",
            "workplace_name",
            "utility_type",
            "meter_identifier",
            "period_start",
            "period_end",
            "consumption_value",
            "unit",
            "tariff_rate_irr",
            "total_cost_irr",
            "carbon_emissions_kg_co2",
            "is_synthetic",
            "created_at",
        ]
        read_only_fields = ["id", "organization", "created_at"]

    def validate_workplace(self, value):
        org_ids = _get_request_org_ids(self)
        if org_ids and value and value.organization_id not in org_ids:
            raise serializers.ValidationError("کارگاه انتخاب‌شده متعلق به سازمان جاری نیست.")
        return value


class ExcavationOperationSerializer(serializers.ModelSerializer):
    workplace_name = serializers.CharField(source="workplace.name", read_only=True)
    competent_person_name = serializers.CharField(source="competent_person.get_full_name", read_only=True)

    class Meta:
        model = ExcavationOperation
        fields = [
            "id",
            "organization",
            "workplace",
            "workplace_name",
            "project_name",
            "reference_code",
            "soil_type",
            "depth_m",
            "length_m",
            "bottom_width_m",
            "top_width_m",
            "volume_m3",
            "protective_system",
            "permit",
            "status",
            "competent_person",
            "competent_person_name",
            "daily_inspection_passed",
            "inspection_notes",
            "is_synthetic",
            "created_at",
        ]
        read_only_fields = ["id", "organization", "top_width_m", "volume_m3", "created_at"]

    def validate_workplace(self, value):
        org_ids = _get_request_org_ids(self)
        if org_ids and value and value.organization_id not in org_ids:
            raise serializers.ValidationError("کارگاه انتخاب‌شده متعلق به سازمان جاری نیست.")
        return value

    def validate_permit(self, value):
        org_ids = _get_request_org_ids(self)
        if org_ids and value and value.organization_id not in org_ids:
            raise serializers.ValidationError("مجوز کار انتخاب‌شده متعلق به سازمان جاری نیست.")
        return value
