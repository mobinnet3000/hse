LIKELIHOOD_MIN = 1
LIKELIHOOD_MAX = 5
SEVERITY_MIN = 1
SEVERITY_MAX = 5

RISK_LEVEL_THRESHOLDS = (
    (4, "low", "کم"),
    (9, "medium", "متوسط"),
    (14, "high", "زیاد"),
    (25, "critical", "بحرانی"),
)


def calculate_risk_score(likelihood, severity):
    if not isinstance(likelihood, int) or not isinstance(severity, int):
        raise ValueError("likelihood and severity must be integers")
    if not LIKELIHOOD_MIN <= likelihood <= LIKELIHOOD_MAX:
        raise ValueError("likelihood out of range")
    if not SEVERITY_MIN <= severity <= SEVERITY_MAX:
        raise ValueError("severity out of range")
    return likelihood * severity


def risk_level_for_score(score):
    if not isinstance(score, int) or score < 1:
        raise ValueError("score out of range")
    for threshold, code, label in RISK_LEVEL_THRESHOLDS:
        if score <= threshold:
            return code, label
    raise ValueError("score out of range")


def evaluate_risk(likelihood, severity):
    score = calculate_risk_score(likelihood, severity)
    code, label = risk_level_for_score(score)
    return score, code, label


def calculate_hcms_residual(likelihood, severity):
    score = calculate_risk_score(likelihood, severity)
    code, label = risk_level_for_score(score)
    return {
        "residual_score": score,
        "residual_level": code,
        "residual_level_label": label,
    }


BARRIER_EFFECTIVENESS_FACTORS = {
    "effective": 0.3,          # 70% risk reduction
    "partially_effective": 0.6,# 40% risk reduction
    "not_tested": 0.8,         # 20% estimated reduction
    "ineffective": 1.0,        # No reduction (failed barrier)
}


def evaluate_barrier_residual(initial_score, effectiveness):
    factor = BARRIER_EFFECTIVENESS_FACTORS.get(effectiveness, 1.0)
    residual_score = max(1, min(25, int(round(initial_score * factor))))
    code, label = risk_level_for_score(residual_score)
    return residual_score, code, label

