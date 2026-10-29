import datetime
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.organizations.models import Membership, Organization
from apps.workplaces.models import Workplace
from .models import EnergyConsumptionLog, ExcavationOperation, FleetFuelLog, FleetVehicle

User = get_user_model()


class FleetEnergyTestCase(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="شرکت عملیات صنعتی", is_active=True)
        self.workplace = Workplace.objects.create(name="سایت ۲", organization=self.org)
        self.user = User.objects.create_user(username="fleet_mgr", password="pwd")
        Membership.objects.create(user=self.user, organization=self.org, role=Membership.Roles.ACTION_OWNER)

    def test_vehicle_fuel_log_and_odometer_update(self):
        vehicle = FleetVehicle.objects.create(
            organization=self.org,
            vehicle_code="VH-01",
            plate_number="12الف345-67",
            model_name="Toyota Hilux",
            current_odometer_km=10000.0,
        )

        # Log 1: at 10,500 km, 50 liters
        log1 = FleetFuelLog.objects.create(
            organization=self.org,
            vehicle=vehicle,
            log_date=datetime.date.today() - datetime.timedelta(days=7),
            odometer_km=10500.0,
            fuel_liters=50.0,
        )
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.current_odometer_km, 10500.0)

        # Log 2: at 11,000 km, 50 liters -> distance = 500 km -> 50 / 500 * 100 = 10 L/100km
        log2 = FleetFuelLog.objects.create(
            organization=self.org,
            vehicle=vehicle,
            log_date=datetime.date.today(),
            odometer_km=11000.0,
            fuel_liters=50.0,
        )
        self.assertEqual(log2.distance_traveled_km, 500.0)
        self.assertEqual(log2.consumption_rate_l_per_100km, 10.0)
        vehicle.refresh_from_db()
        self.assertEqual(vehicle.current_odometer_km, 11000.0)

    def test_energy_log_carbon_emissions(self):
        log = EnergyConsumptionLog.objects.create(
            organization=self.org,
            workplace=self.workplace,
            utility_type=EnergyConsumptionLog.UtilityType.ELECTRICITY,
            meter_identifier="MTR-E-101",
            period_start=datetime.date(2026, 1, 1),
            period_end=datetime.date(2026, 1, 31),
            consumption_value=10000.0,  # 10,000 kWh * 0.55 = 5,500 kg CO2
            tariff_rate_irr=1500.0,
        )
        self.assertEqual(log.carbon_emissions_kg_co2, 5500.0)
        self.assertEqual(log.total_cost_irr, 15000000.0)

    def test_excavation_operation_geometry_calculation(self):
        exc = ExcavationOperation.objects.create(
            organization=self.org,
            workplace=self.workplace,
            project_name="کانال تأسیسات برق",
            reference_code="EXC-2026-001",
            soil_type=ExcavationOperation.SoilType.TYPE_B,
            depth_m=2.0,
            length_m=50.0,
            bottom_width_m=1.0,
        )
        # Type B soil slope ratio is 1:1 -> Top width = 1 + 2*(2.0) = 5.0m
        # Volume = ((5+1)/2)*2 * 50 = 6 * 50 = 300 m3
        self.assertEqual(exc.top_width_m, 5.0)
        self.assertEqual(exc.volume_m3, 300.0)
