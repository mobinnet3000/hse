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
