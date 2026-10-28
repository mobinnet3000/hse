from rest_framework import serializers
from .models import CalculationRecord


class CalculationRecordSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)

    class Meta:
        model = CalculationRecord
        fields = [
            "id",
            "organization",
            "user",
            "user_name",
            "calculator_type",
            "title",
            "input_params",
            "results",
            "notes",
            "is_synthetic",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class UnitConversionInputSerializer(serializers.Serializer):
    category = serializers.CharField(max_length=40)
    value = serializers.FloatField()
    from_unit = serializers.CharField(max_length=20)
    to_unit = serializers.CharField(max_length=20)


class HSERatesInputSerializer(serializers.Serializer):
    exposure_hours = serializers.FloatField(min_value=0)
    lost_time_injuries = serializers.IntegerField(min_value=0, default=0)
    total_recordable_incidents = serializers.IntegerField(min_value=0, default=0)
    lost_days = serializers.IntegerField(min_value=0, default=0)
    multiplier = serializers.FloatField(default=1000000.0)


class NoiseInputSerializer(serializers.Serializer):
    sound_levels = serializers.ListField(child=serializers.FloatField(), required=False)
    exposures = serializers.ListField(child=serializers.DictField(), required=False)
    criterion_level = serializers.FloatField(default=85.0)
    exchange_rate = serializers.FloatField(default=3.0)


class RiggingInputSerializer(serializers.Serializer):
    calculation_sub_type = serializers.ChoiceField(
        choices=["sling_tension", "geometry_weight", "crane_capacity"]
    )
    # Fields for sling tension
    load_weight_kg = serializers.FloatField(required=False, default=0.0)
    rigging_hardware_weight_kg = serializers.FloatField(required=False, default=0.0)
    hook_block_weight_kg = serializers.FloatField(required=False, default=0.0)
    num_sling_legs = serializers.IntegerField(required=False, default=2)
    sling_angle_to_horizontal_deg = serializers.FloatField(required=False, default=60.0)
    shackle_wll_kg = serializers.FloatField(required=False, allow_null=True)

    # Fields for geometry weight
    shape = serializers.CharField(required=False, default="rectangular_prism")
    dimensions = serializers.DictField(required=False, default=dict)
    material = serializers.CharField(required=False, default="steel")
    custom_density_kg_m3 = serializers.FloatField(required=False, allow_null=True)

    # Fields for crane capacity & outrigger
    crane_rated_capacity_kg = serializers.FloatField(required=False, default=1.0)
    crane_total_weight_kg = serializers.FloatField(required=False, default=0.0)
    outrigger_pad_area_sqm = serializers.FloatField(required=False, default=1.0)
    allowable_ground_pressure_kpa = serializers.FloatField(required=False, default=200.0)


class EnergyFleetInputSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["electricity", "fleet"])
    # electricity
    consumption_kwh = serializers.FloatField(required=False, default=0.0)
    tariff_irr_per_kwh = serializers.FloatField(required=False, default=0.0)
    # fleet
    fuel_liters = serializers.FloatField(required=False, default=0.0)
    distance_km = serializers.FloatField(required=False, default=0.0)
    operating_hours = serializers.FloatField(required=False, allow_null=True)
    fuel_cost_per_liter_irr = serializers.FloatField(required=False, allow_null=True)


class ExcavationInputSerializer(serializers.Serializer):
    depth_m = serializers.FloatField(min_value=0.1)
    length_m = serializers.FloatField(min_value=0.1)
    bottom_width_m = serializers.FloatField(min_value=0.1)
    soil_type = serializers.ChoiceField(choices=["rock", "type_a", "type_b", "type_c"], default="type_b")
