from django.contrib import admin
from .models import EnergyConsumptionLog, ExcavationOperation, FleetFuelLog, FleetVehicle


@admin.register(FleetVehicle)
class FleetVehicleAdmin(admin.ModelAdmin):
    list_display = ["vehicle_code", "plate_number", "model_name", "vehicle_type", "fuel_type", "is_active"]
    list_filter = ["vehicle_type", "fuel_type", "organization", "is_active"]
    search_fields = ["vehicle_code", "plate_number", "model_name"]


@admin.register(FleetFuelLog)
class FleetFuelLogAdmin(admin.ModelAdmin):
    list_display = ["vehicle", "log_date", "odometer_km", "fuel_liters", "consumption_rate_l_per_100km"]
    list_filter = ["log_date", "organization"]


@admin.register(EnergyConsumptionLog)
class EnergyConsumptionLogAdmin(admin.ModelAdmin):
    list_display = ["workplace", "utility_type", "period_start", "period_end", "consumption_value", "unit", "carbon_emissions_kg_co2"]
    list_filter = ["utility_type", "organization"]


@admin.register(ExcavationOperation)
class ExcavationOperationAdmin(admin.ModelAdmin):
    list_display = ["reference_code", "project_name", "workplace", "soil_type", "depth_m", "protective_system", "status"]
    list_filter = ["status", "soil_type", "protective_system", "organization"]
    search_fields = ["reference_code", "project_name"]
