from .models import AuditEvent

SENSITIVE_PATTERNS = {"password", "secret", "token", "api_key", "key", "credential", "auth"}


def sanitize_details(details):
    if not isinstance(details, dict):
        return details or {}
    clean = {}
    for k, v in details.items():
        if any(pat in k.lower() for pat in SENSITIVE_PATTERNS):
            clean[k] = "******"
        elif isinstance(v, dict):
            clean[k] = sanitize_details(v)
        else:
            clean[k] = v
    return clean


def log_event(*, organization, actor, action, entity_type, entity_id=None, details=None):
    safe_details = sanitize_details(details)
    return AuditEvent.objects.create(
        organization=organization,
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=safe_details,
    )
