import math
from typing import Any, Dict, List, Optional


class UnitConversionError(ValueError):
    pass


# Unit Conversion Factors to Base SI Units
# Base units: length->meter, mass->kg, force->N, pressure->Pa, area->sqm, volume->cum, energy->J, power->W
UNIT_FACTORS: Dict[str, Dict[str, float]] = {
    "length": {
        "m": 1.0,
        "cm": 0.01,
        "mm": 0.001,
        "km": 1000.0,
        "in": 0.0254,
        "ft": 0.3048,
        "yd": 0.9144,
        "mile": 1609.344,
    },
    "mass": {
        "kg": 1.0,
        "g": 0.001,
        "mg": 0.000001,
        "tonne": 1000.0,
        "lb": 0.45359237,
        "oz": 0.028349523,
    },
    "force": {
        "N": 1.0,
        "kN": 1000.0,
        "kgf": 9.80665,
        "lbf": 4.448222,
    },
    "pressure": {
        "Pa": 1.0,
        "kPa": 1000.0,
        "MPa": 1000000.0,
        "bar": 100000.0,
        "mbar": 100.0,
        "psi": 6894.757,
        "atm": 101325.0,
        "mmHg": 133.322,
    },
    "area": {
        "sqm": 1.0,
        "sqcm": 0.0001,
        "sqmm": 0.000001,
        "ha": 10000.0,
        "sqkm": 1000000.0,
        "sqft": 0.092903,
        "sqin": 0.00064516,
        "acre": 4046.86,
    },
    "volume": {
        "cum": 1.0,
        "L": 0.001,
        "mL": 0.000001,
        "gal_us": 0.00378541,
        "cuft": 0.0283168,
    },
    "energy": {
        "J": 1.0,
        "kJ": 1000.0,
        "MJ": 1000000.0,
        "kWh": 3600000.0,
        "cal": 4.184,
        "kcal": 4184.0,
        "BTU": 1055.06,
    },
    "power": {
        "W": 1.0,
        "kW": 1000.0,
        "MW": 1000000.0,
        "hp_metric": 735.49875,
        "hp_mech": 745.69987,
    },
}


def convert_units(category: str, value: float, from_unit: str, to_unit: str) -> float:
    """Converts a numerical value between units in a specified physical category."""
    if category == "temperature":
        # Handle non-linear temperature conversions
        from_u = from_unit.upper()
        to_u = to_unit.upper()
        if from_u == to_u:
            return float(value)
        # Convert to Kelvin first
        if from_u == "C":
            kelvin = value + 273.15
        elif from_u == "F":
            kelvin = (value - 32.0) * (5.0 / 9.0) + 273.15
        elif from_u == "K":
            kelvin = value
        else:
            raise UnitConversionError(f"واحد دمای نامعتبر: {from_unit}")

        # Convert from Kelvin to target
        if to_u == "C":
            return round(kelvin - 273.15, 4)
        elif to_u == "F":
            return round((kelvin - 273.15) * (9.0 / 5.0) + 32.0, 4)
        elif to_u == "K":
            return round(kelvin, 4)
        else:
            raise UnitConversionError(f"واحد دمای نامعتبر: {to_unit}")

    if category not in UNIT_FACTORS:
        raise UnitConversionError(f"دسته‌بندی نامعتبر واحد: {category}")

    factors = UNIT_FACTORS[category]
    if from_unit not in factors:
        raise UnitConversionError(f"واحد مبدأ نامعتبر است: {from_unit}")
    if to_unit not in factors:
        raise UnitConversionError(f"واحد مقصد نامعتبر است: {to_unit}")

    # Convert to base SI then to target
    base_val = value * factors[from_unit]
    converted = base_val / factors[to_unit]
    return round(converted, 6)


# -------------------------------------------------------------------------
# HSE Incident & Performance Rates
# -------------------------------------------------------------------------
def calculate_hse_rates(
    exposure_hours: float,
    lost_time_injuries: int,
    total_recordable_incidents: int,
    lost_days: int,
    multiplier: float = 1_000_000.0,
) -> Dict[str, Any]:
    """Calculates LTIFR, TRIR, Severity Rate, and Frequency-Severity Index (FSI).

    Safe against zero exposure hours.
    """
    if exposure_hours <= 0:
        return {
            "ltifr": 0.0,
            "trir": 0.0,
            "severity_rate": 0.0,
            "fsi": 0.0,
            "warning": "ساعات کارکرد صفر یا نامعتبر است؛ شاخص‌ها قابل محاسبه نیستند.",
            "is_valid": False,
        }

    if lost_time_injuries < 0 or total_recordable_incidents < 0 or lost_days < 0:
        return {
            "exposure_hours": exposure_hours,
            "multiplier": multiplier,
            "lost_time_injuries": lost_time_injuries,
            "total_recordable_incidents": total_recordable_incidents,
            "lost_days": lost_days,
            "ltifr": 0.0,
            "trir": 0.0,
            "severity_rate": 0.0,
            "fsi": 0.0,
            "warning": "تعداد حوادث یا روزهای از دست رفته نمی‌تواند منفی باشد.",
            "is_valid": False,
        }

    ltifr = (lost_time_injuries * multiplier) / exposure_hours
    trir = (total_recordable_incidents * multiplier) / exposure_hours
    severity_rate = (lost_days * multiplier) / exposure_hours

    # FSI = sqrt((LTIFR * SR) / 1000)
    fsi = math.sqrt((ltifr * severity_rate) / 1000.0) if (ltifr * severity_rate) >= 0 else 0.0

    return {
        "exposure_hours": exposure_hours,
        "multiplier": multiplier,
        "lost_time_injuries": lost_time_injuries,
        "total_recordable_incidents": total_recordable_incidents,
        "lost_days": lost_days,
        "ltifr": round(ltifr, 2),
        "trir": round(trir, 2),
        "severity_rate": round(severity_rate, 2),
        "fsi": round(fsi, 3),
        "is_valid": True,
    }


# -------------------------------------------------------------------------
# Occupational Noise: Logarithmic Summation & Dose/TWA
# -------------------------------------------------------------------------
def combine_noise_levels(sound_levels_dba: List[float]) -> Dict[str, Any]:
    """Combines multiple sound pressure levels using logarithmic summation:

    L_sum = 10 * log10(sum(10^(L_i / 10)))
    """
    if not sound_levels_dba:
        return {"combined_spl_dba": 0.0, "count": 0, "levels": []}

    total_power = sum(10.0 ** (level / 10.0) for level in sound_levels_dba)
    combined = 10.0 * math.log10(total_power)
    return {
        "combined_spl_dba": round(combined, 2),
        "count": len(sound_levels_dba),
        "levels": sound_levels_dba,
    }


def calculate_noise_dose_and_twa(
    exposures: List[Dict[str, float]],
    criterion_level: float = 85.0,
    exchange_rate: float = 3.0,
) -> Dict[str, Any]:
    """Calculates Noise Dose (%) and 8-Hour Time-Weighted Average (TWA dBA).

    exposures: list of {"duration_hours": float, "sound_level_dba": float}
    Exchange rate: 3 dB (ISO/OSHA NIOSH recommended) or 5 dB (OSHA PEL).
    """
    if exchange_rate <= 0:
        raise ValueError("نرخ تبادل تراز صوتی (Exchange Rate) باید بزرگ‌تر از صفر باشد.")
    if criterion_level <= 0:
        raise ValueError("تراز مبنای دوز صدا (Criterion Level) باید بزرگ‌تر از صفر باشد.")

    total_dose_pct = 0.0
    for exp in exposures:
        duration = exp.get("duration_hours", 0.0)
        level = exp.get("sound_level_dba", 0.0)
        if duration > 0 and level > 0:
            # Allowable time T = 8 / 2^((L - Criterion) / ExchangeRate)
            allowable_hours = 8.0 / (2.0 ** ((level - criterion_level) / exchange_rate))
            if allowable_hours > 0:
                total_dose_pct += (duration / allowable_hours) * 100.0

    # TWA = Criterion + (ExchangeRate / log10(2)) * log10(Dose / 100)
    if total_dose_pct > 0:
        log_factor = exchange_rate / math.log10(2.0)
        twa = criterion_level + log_factor * math.log10(total_dose_pct / 100.0)
    else:
        twa = 0.0

    action_level_exceeded = twa >= 82.0
    pel_exceeded = twa >= 85.0

    return {
        "total_dose_percent": round(total_dose_pct, 2),
        "twa_dba": round(twa, 2),
        "criterion_level": criterion_level,
        "exchange_rate": exchange_rate,
        "action_level_exceeded": action_level_exceeded,
        "pel_exceeded": pel_exceeded,
        "hearing_protection_required": pel_exceeded,
    }


# -------------------------------------------------------------------------
# Lifting, Crane & Rigging Engineering
# -------------------------------------------------------------------------
STANDARD_DENSITIES_KG_M3 = {
    "steel": 7850.0,
    "structural_steel": 7850.0,
    "concrete": 2400.0,
    "reinforced_concrete": 2500.0,
    "aluminum": 2700.0,
    "water": 1000.0,
    "wood_hardwood": 750.0,
    "wood_softwood": 500.0,
    "soil_dry": 1600.0,
    "soil_wet": 2000.0,
    "sand": 1600.0,
    "gravel": 1800.0,
}


def calculate_load_weight_from_geometry(
    shape: str,
    dimensions: Dict[str, float],
    material: str = "steel",
    custom_density_kg_m3: Optional[float] = None,
) -> Dict[str, Any]:
    """Calculates load weight based on 3D geometry and material density."""
    density = custom_density_kg_m3 or STANDARD_DENSITIES_KG_M3.get(material.lower(), 7850.0)
    volume_cum = 0.0

    shape_lower = shape.lower()
    if shape_lower in ["rectangular_prism", "box", "plate"]:
        length = dimensions.get("length_m", 0.0)
        width = dimensions.get("width_m", 0.0)
        height = dimensions.get("height_m", 0.0)
        volume_cum = length * width * height
    elif shape_lower in ["cylinder", "solid_round"]:
        diameter = dimensions.get("diameter_m", 0.0)
        length = dimensions.get("length_m", 0.0)
        radius = diameter / 2.0
        volume_cum = math.pi * (radius ** 2) * length
    elif shape_lower in ["hollow_pipe", "tube"]:
        outer_diameter = dimensions.get("outer_diameter_m", 0.0)
        wall_thickness = dimensions.get("wall_thickness_m", 0.0)
        length = dimensions.get("length_m", 0.0)
        r_outer = outer_diameter / 2.0
        r_inner = max(0.0, r_outer - wall_thickness)
        volume_cum = math.pi * ((r_outer ** 2) - (r_inner ** 2)) * length
    else:
        raise ValueError(f"شکل هندسی ناشناخته: {shape}")

    total_weight_kg = volume_cum * density
    return {
        "shape": shape,
        "volume_m3": round(volume_cum, 4),
        "density_kg_m3": density,
        "weight_kg": round(total_weight_kg, 2),
        "weight_tonnes": round(total_weight_kg / 1000.0, 3),
    }


def calculate_sling_tension_and_rigging(
    load_weight_kg: float,
    rigging_hardware_weight_kg: float = 0.0,
    hook_block_weight_kg: float = 0.0,
    num_sling_legs: int = 2,
    sling_angle_to_horizontal_deg: float = 60.0,
    shackle_wll_kg: Optional[float] = None,
) -> Dict[str, Any]:
    """Calculates tension in each sling leg:

    T = Gross Weight / (n * sin(theta))
    Also checks load factors and shackle capacities.
    """
    gross_load_kg = load_weight_kg + rigging_hardware_weight_kg + hook_block_weight_kg
    if load_weight_kg <= 0 or gross_load_kg <= 0:
        raise ValueError("وزن خالص و ناخالص بار باید بزرگ‌تر از صفر باشد.")
    if num_sling_legs <= 0:
        raise ValueError("تعداد شاخه‌های اسلینگ باید حداقل ۱ باشد.")
    if sling_angle_to_horizontal_deg <= 0 or sling_angle_to_horizontal_deg > 90:
        raise ValueError("زاویه اسلینگ نسبت به افق باید بین ۱ تا ۹۰ درجه باشد.")

    angle_rad = math.radians(sling_angle_to_horizontal_deg)
    sin_angle = math.sin(angle_rad)

    # In 4-leg slings, standard rigging practice assumes only 2 legs carry load on rigid loads
    effective_legs = 2 if num_sling_legs == 4 else num_sling_legs

    tension_per_leg_kg = gross_load_kg / (effective_legs * sin_angle)
    load_angle_factor = 1.0 / sin_angle

    is_angle_unsafe = sling_angle_to_horizontal_deg < 45.0
    shackle_safe = True
    shackle_safety_margin = None

    if shackle_wll_kg and shackle_wll_kg > 0:
        shackle_safe = tension_per_leg_kg <= shackle_wll_kg
        shackle_safety_margin = round(shackle_wll_kg - tension_per_leg_kg, 2)

    return {
        "gross_load_kg": round(gross_load_kg, 2),
        "effective_legs": effective_legs,
        "sling_angle_deg": sling_angle_to_horizontal_deg,
        "load_angle_factor": round(load_angle_factor, 3),
        "tension_per_leg_kg": round(tension_per_leg_kg, 2),
        "tension_per_leg_tonnes": round(tension_per_leg_kg / 1000.0, 3),
        "is_angle_critical_warning": is_angle_unsafe,
        "shackle_wll_kg": shackle_wll_kg,
        "shackle_is_adequate": shackle_safe,
        "shackle_safety_margin_kg": shackle_safety_margin,
    }


def calculate_crane_lift_parameters(
    total_gross_load_kg: float,
    crane_rated_capacity_kg: float,
    crane_total_weight_kg: float = 0.0,
    outrigger_pad_area_sqm: float = 1.0,
    allowable_ground_pressure_kpa: float = 200.0,
    eccentricity_factor: float = 1.5,
) -> Dict[str, Any]:
    """Calculates Crane Utilization (%) and Outrigger Ground Bearing Pressure (kPa)."""
    if crane_rated_capacity_kg <= 0:
        raise ValueError("ظرفیت نامی جرثقیل باید بزرگ‌تر از صفر باشد.")

    utilization_pct = (total_gross_load_kg / crane_rated_capacity_kg) * 100.0
    is_capacity_exceeded = utilization_pct > 100.0
    is_critical_lift = utilization_pct >= 85.0

    # Max outrigger load estimation:
    # R_max ~ (Crane Weight + Gross Load) * (eccentricity / 4)
    total_system_weight_kg = crane_total_weight_kg + total_gross_load_kg
    max_outrigger_reaction_kg = (total_system_weight_kg / 4.0) * eccentricity_factor
    max_outrigger_force_kn = (max_outrigger_reaction_kg * 9.80665) / 1000.0

    ground_pressure_kpa = 0.0
    if outrigger_pad_area_sqm > 0:
        ground_pressure_kpa = max_outrigger_force_kn / outrigger_pad_area_sqm

    ground_pressure_safe = ground_pressure_kpa <= allowable_ground_pressure_kpa

    return {
        "gross_load_kg": round(total_gross_load_kg, 2),
        "rated_capacity_kg": round(crane_rated_capacity_kg, 2),
        "utilization_percent": round(utilization_pct, 2),
        "is_capacity_exceeded": is_capacity_exceeded,
        "is_critical_lift": is_critical_lift,
        "max_outrigger_reaction_tonnes": round(max_outrigger_reaction_kg / 1000.0, 3),
        "ground_bearing_pressure_kpa": round(ground_pressure_kpa, 2),
        "allowable_ground_pressure_kpa": allowable_ground_pressure_kpa,
        "ground_pressure_is_safe": ground_pressure_safe,
    }


# -------------------------------------------------------------------------
# Energy, Fleet Fuel & Emissions
# -------------------------------------------------------------------------
def calculate_electricity_and_emissions(
    consumption_kwh: float,
    tariff_irr_per_kwh: float,
    grid_emission_factor_kg_co2_per_kwh: float = 0.55,
) -> Dict[str, Any]:
    """Calculates electricity cost and carbon footprint."""
    cost = consumption_kwh * tariff_irr_per_kwh
    co2_kg = consumption_kwh * grid_emission_factor_kg_co2_per_kwh
    return {
        "consumption_kwh": consumption_kwh,
        "tariff_irr_per_kwh": tariff_irr_per_kwh,
        "total_cost_irr": round(cost, 2),
        "carbon_emissions_kg_co2": round(co2_kg, 2),
        "carbon_emissions_tonnes_co2": round(co2_kg / 1000.0, 4),
    }


def calculate_fleet_fuel_efficiency(
    fuel_liters: float,
    distance_km: float,
    operating_hours: Optional[float] = None,
    fuel_cost_per_liter_irr: Optional[float] = None,
) -> Dict[str, Any]:
    """Calculates fleet fuel economy indicators."""
    if distance_km <= 0 and (not operating_hours or operating_hours <= 0):
        return {"error": "مسافت یا ساعات کارکرد باید مثبت باشد.", "is_valid": False}

    liters_per_100km = (fuel_liters / distance_km * 100.0) if distance_km > 0 else 0.0
    km_per_liter = (distance_km / fuel_liters) if fuel_liters > 0 and distance_km > 0 else 0.0
    liters_per_hour = (fuel_liters / operating_hours) if operating_hours and operating_hours > 0 else 0.0

    total_cost = (fuel_liters * fuel_cost_per_liter_irr) if fuel_cost_per_liter_irr else 0.0
    cost_per_km = (total_cost / distance_km) if distance_km > 0 and total_cost > 0 else 0.0

    # Diesel/Gasoline average ~ 2.68 kg CO2 per liter
    co2_kg = fuel_liters * 2.68

    return {
        "fuel_liters": fuel_liters,
        "distance_km": distance_km,
        "operating_hours": operating_hours,
        "liters_per_100km": round(liters_per_100km, 2),
        "km_per_liter": round(km_per_liter, 2),
        "liters_per_hour": round(liters_per_hour, 2),
        "total_cost_irr": round(total_cost, 2),
        "cost_per_km_irr": round(cost_per_km, 2),
        "carbon_emissions_kg_co2": round(co2_kg, 2),
        "is_valid": True,
    }


# -------------------------------------------------------------------------
# Excavation Geometry & Trenching Calculations
# -------------------------------------------------------------------------
OSHA_SOIL_SLOPES = {
    "rock": {"h_ratio": 0.0, "angle_deg": 90.0, "desc": "سنگ پایدار (عمودی ۹۰ درجه)"},
    "type_a": {"h_ratio": 0.75, "angle_deg": 53.0, "desc": "خاک تیپ A - چسبنده سخت (شیب ۳/۴ به ۱، ۵۳ درجه)"},
    "type_b": {"h_ratio": 1.0, "angle_deg": 45.0, "desc": "خاک تیپ B - با چسبندگی متوسط (شیب ۱ به ۱، ۴۵ درجه)"},
    "type_c": {"h_ratio": 1.5, "angle_deg": 34.0, "desc": "خاک تیپ C - شنی و ماسه‌ای سست (شیب ۱.۵ به ۱، ۳۴ درجه)"},
}


def calculate_excavation_geometry(
    depth_m: float,
    length_m: float,
    bottom_width_m: float,
    soil_type: str = "type_b",
) -> Dict[str, Any]:
    """Calculates excavation slope, top width, and volume based on OSHA 1926 Subpart P standards."""
    if depth_m <= 0 or length_m <= 0 or bottom_width_m <= 0:
        raise ValueError("عمق، طول و عرض کف گودبرداری باید بزرگ‌تر از صفر باشند.")

    soil_info = OSHA_SOIL_SLOPES.get(soil_type.lower(), OSHA_SOIL_SLOPES["type_b"])
    h_ratio = soil_info["h_ratio"]

    # Horizontal cut per side = Depth * H_ratio
    side_cut_m = depth_m * h_ratio
    top_width_m = bottom_width_m + (2.0 * side_cut_m)

    # Cross sectional area of trapezoid = ((Top Width + Bottom Width) / 2) * Depth
    cross_section_sqm = ((top_width_m + bottom_width_m) / 2.0) * depth_m
    volume_cum = cross_section_sqm * length_m

    # Protection requirement: depths >= 1.5m require shoring/sloping by OSHA
    protection_mandatory = depth_m >= 1.5
    access_ladder_required = depth_m >= 1.22  # 4 feet (1.22m) requires ladder within 7.6m (25ft)

    return {
        "depth_m": depth_m,
        "length_m": length_m,
        "bottom_width_m": bottom_width_m,
        "top_width_m": round(top_width_m, 2),
        "soil_type": soil_type,
        "soil_description": soil_info["desc"],
        "recommended_slope_angle_deg": soil_info["angle_deg"],
        "volume_m3": round(volume_cum, 2),
        "protection_mandatory": protection_mandatory,
        "access_ladder_required": access_ladder_required,
        "safety_disclaimer": "محاسبات صرفاً هندسی بوده و جایگزین تاییدیه فنی مهندس ژئوتکنیک ذی‌صلاح نمی‌باشد.",
    }
