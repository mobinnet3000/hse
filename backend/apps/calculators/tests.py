import math
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.organizations.models import Membership, Organization
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

User = get_user_model()


class CalculatorFormulasTestCase(TestCase):
    def test_unit_conversions(self):
        # Length
        self.assertAlmostEqual(convert_units("length", 10.0, "m", "ft"), 32.8084, places=2)
        self.assertAlmostEqual(convert_units("length", 1.0, "in", "mm"), 25.4, places=1)
        # Mass
        self.assertAlmostEqual(convert_units("mass", 1.0, "tonne", "kg"), 1000.0, places=1)
        self.assertAlmostEqual(convert_units("mass", 100.0, "lb", "kg"), 45.3592, places=2)
        # Pressure
        self.assertAlmostEqual(convert_units("pressure", 1.0, "bar", "kPa"), 100.0, places=1)
        self.assertAlmostEqual(convert_units("pressure", 1.0, "atm", "Pa"), 101325.0, places=0)
        # Temperature
        self.assertEqual(convert_units("temperature", 100.0, "C", "F"), 212.0)
        self.assertEqual(convert_units("temperature", 32.0, "F", "C"), 0.0)
        self.assertAlmostEqual(convert_units("temperature", 0.0, "C", "K"), 273.15, places=2)

    def test_hse_rates_calculation(self):
        # Exposure: 200,000 hrs, 2 LTIs, 4 TRIR cases, 30 lost days
        res = calculate_hse_rates(
            exposure_hours=200000,
            lost_time_injuries=2,
            total_recordable_incidents=4,
            lost_days=30,
            multiplier=1000000,
        )
        self.assertTrue(res["is_valid"])
        self.assertEqual(res["ltifr"], 10.0)
        self.assertEqual(res["trir"], 20.0)
        self.assertEqual(res["severity_rate"], 150.0)
        # FSI = sqrt((10 * 150) / 1000) = sqrt(1.5) = 1.225
        self.assertAlmostEqual(res["fsi"], 1.225, places=2)

        # Zero exposure hours handling
        res_zero = calculate_hse_rates(0, 1, 1, 5)
        self.assertFalse(res_zero["is_valid"])
        self.assertEqual(res_zero["ltifr"], 0.0)

    def test_noise_combination_and_dose(self):
        # Two identical 85 dBA sound sources combine to 88.01 dBA (+3 dB rule)
        combined = combine_noise_levels([85.0, 85.0])
        self.assertAlmostEqual(combined["combined_spl_dba"], 88.01, places=1)

        # 8 hours at 85 dBA should be exactly 100% dose with 85 dBA criterion
        dose_res = calculate_noise_dose_and_twa(
            exposures=[{"duration_hours": 8.0, "sound_level_dba": 85.0}],
            criterion_level=85.0,
            exchange_rate=3.0,
        )
        self.assertAlmostEqual(dose_res["total_dose_percent"], 100.0, places=1)
        self.assertAlmostEqual(dose_res["twa_dba"], 85.0, places=1)

    def test_crane_and_sling_tension(self):
        # 10,000 kg load, 2 legs, 60 deg angle:
        # T = 10,000 / (2 * sin(60)) = 10,000 / (2 * 0.8660) = 5773.5 kg
        rigging_res = calculate_sling_tension_and_rigging(
            load_weight_kg=10000.0,
            rigging_hardware_weight_kg=0.0,
            hook_block_weight_kg=0.0,
            num_sling_legs=2,
            sling_angle_to_horizontal_deg=60.0,
            shackle_wll_kg=6500.0,
        )
        self.assertAlmostEqual(rigging_res["tension_per_leg_kg"], 5773.5, delta=1.0)
        self.assertTrue(rigging_res["shackle_is_adequate"])
        self.assertFalse(rigging_res["is_angle_critical_warning"])

        # Shallow 30 degree angle -> Critical Warning
        rigging_shallow = calculate_sling_tension_and_rigging(
            load_weight_kg=10000.0,
            num_sling_legs=2,
            sling_angle_to_horizontal_deg=30.0,
        )
        self.assertTrue(rigging_shallow["is_angle_critical_warning"])
        # At 30 deg, sin(30) = 0.5, so T = 10,000 / (2 * 0.5) = 10,000 kg per leg
        self.assertAlmostEqual(rigging_shallow["tension_per_leg_kg"], 10000.0, places=0)

    def test_crane_utilization_and_outrigger_pressure(self):
        res = calculate_crane_lift_parameters(
            total_gross_load_kg=8500.0,
            crane_rated_capacity_kg=10000.0,
            crane_total_weight_kg=20000.0,
            outrigger_pad_area_sqm=1.0,
            allowable_ground_pressure_kpa=250.0,
        )
        self.assertEqual(res["utilization_percent"], 85.0)
        self.assertTrue(res["is_critical_lift"])
        self.assertFalse(res["is_capacity_exceeded"])
        self.assertTrue(res["ground_pressure_is_safe"])

    def test_geometry_weight_steel_plate(self):
        # 2m x 1m x 0.05m = 0.1 m3. Steel density = 7850 kg/m3 -> 785 kg
        res = calculate_load_weight_from_geometry(
            shape="rectangular_prism",
            dimensions={"length_m": 2.0, "width_m": 1.0, "height_m": 0.05},
            material="steel",
        )
        self.assertAlmostEqual(res["weight_kg"], 785.0, places=1)

    def test_excavation_geometry(self):
        # Type B soil (1:1 slope). Depth = 2m, Length = 10m, Bottom Width = 1m.
        # Top width = 1 + 2*(2 * 1.0) = 5m.
        # Cross section = ((5 + 1)/2) * 2 = 6 m2. Volume = 6 * 10 = 60 m3.
        exc = calculate_excavation_geometry(
            depth_m=2.0,
            length_m=10.0,
            bottom_width_m=1.0,
            soil_type="type_b",
        )
        self.assertEqual(exc["top_width_m"], 5.0)
        self.assertEqual(exc["volume_m3"], 60.0)
        self.assertTrue(exc["protection_mandatory"])


class CalculatorAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="تست ماشین حساب", is_active=True)
        self.user = User.objects.create_user(
            username="calc_engineer",
            password="testpassword123",
            first_name="مهندس",
            last_name="محاسبات",
        )
        Membership.objects.create(
            user=self.user,
            organization=self.org,
            role=Membership.Roles.ACTION_OWNER,
            is_active=True,
        )
        self.client.force_authenticate(user=self.user)

    def test_unit_conversion_api(self):
        response = self.client.post(
            "/api/v1/calculators/unit-convert/",
            {
                "category": "length",
                "value": 100,
                "from_unit": "cm",
                "to_unit": "m",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["result"], 1.0)

    def test_hse_rates_api_with_save(self):
        response = self.client.post(
            "/api/v1/calculators/hse-rates/",
            {
                "exposure_hours": 1000000,
                "lost_time_injuries": 1,
                "total_recordable_incidents": 2,
                "lost_days": 10,
                "save_record": True,
                "title": "محاسبه سه ماهه اول",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["ltifr"], 1.0)
        self.assertEqual(response.data["trir"], 2.0)

        # Verify saved record in database
        saved = CalculationRecord.objects.filter(organization=self.org, calculator_type="hse_rates").first()
        self.assertIsNotNone(saved)
        self.assertEqual(saved.title, "محاسبه سه ماهه اول")
