from django.db.models import Q

from apps.organizations.models import Membership


def active_membership(user, organization_id):
    if not user or not user.is_authenticated:
        return None
    return (
        user.memberships.select_related("organization")
        .filter(
            organization_id=organization_id,
            is_active=True,
            organization__is_active=True,
        )
        .first()
    )


def accessible_organizations(user):
    from apps.organizations.models import Organization

    if not user or not user.is_authenticated:
        return Organization.objects.none()
    if user.is_platform_admin:
        return Organization.objects.all()
    return Organization.objects.filter(
        memberships__user=user,
        memberships__is_active=True,
        is_active=True,
    ).distinct()


def accessible_organization_ids(user):
    return accessible_organizations(user).values_list("id", flat=True)


def can_manage_organization(user, organization_id):
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    membership = active_membership(user, organization_id)
    return bool(membership and membership.role == Membership.Roles.ORG_ADMIN)


def can_view_organization(user, organization_id):
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return active_membership(user, organization_id) is not None


RISK_EDITOR_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
    Membership.Roles.HSE_INSPECTOR,
    Membership.Roles.WORKSHOP_SUPERVISOR,
}

RISK_APPROVER_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
}


def membership_role(user, organization_id):
    membership = active_membership(user, organization_id)
    return membership.role if membership else None


def can_edit_risks(user, organization_id):
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in RISK_EDITOR_ROLES


def can_approve_risks(user, organization_id):
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in RISK_APPROVER_ROLES

CHECKLIST_EDITOR_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
}

INSPECTION_EDITOR_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
    Membership.Roles.HSE_INSPECTOR,
}

REVIEWER_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
}


def can_manage_checklists(user, organization_id):
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in CHECKLIST_EDITOR_ROLES


def can_conduct_inspections(user, organization_id):
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in INSPECTION_EDITOR_ROLES


def can_review(user, organization_id):
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in REVIEWER_ROLES


def is_active_member(user, organization_id):
    return active_membership(user, organization_id) is not None


INCIDENT_MANAGER_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
}


def can_manage_incidents(user, organization_id):
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in INCIDENT_MANAGER_ROLES


def can_investigate_incident(user, incident):
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    if can_manage_incidents(user, incident.organization_id):
        return True
    return incident.assigned_investigator_id == user.id


PERMIT_APPROVER_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
}

PERMIT_CONTROLLER_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
    Membership.Roles.HSE_INSPECTOR,
    Membership.Roles.WORKSHOP_SUPERVISOR,
}

SHIFT_HANDOVER_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
    Membership.Roles.WORKSHOP_SUPERVISOR,
    Membership.Roles.HSE_INSPECTOR,
}


def can_approve_permits(user, organization_id):
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in PERMIT_APPROVER_ROLES


def can_control_permits(user, organization_id):
    """Can activate, verify controls, suspend, resume, or close permits."""
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in PERMIT_CONTROLLER_ROLES


def can_conduct_shift_handover(user, organization_id):
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in SHIFT_HANDOVER_ROLES



EQUIPMENT_MANAGER_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
}

ASSET_OPERATOR_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
    Membership.Roles.HSE_INSPECTOR,
    Membership.Roles.WORKSHOP_SUPERVISOR,
}

CALIBRATION_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
    Membership.Roles.HSE_INSPECTOR,
}


def can_manage_equipment(user, organization_id):
    """Create/edit equipment and maintenance plans, change equipment status."""
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in EQUIPMENT_MANAGER_ROLES


def can_conduct_asset_work(user, organization_id):
    """Create and execute maintenance work orders."""
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in ASSET_OPERATOR_ROLES


def can_calibrate_equipment(user, organization_id):
    """Record calibration results and view calibration history."""
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in CALIBRATION_ROLES


WORKFORCE_MANAGER_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
}

TRAINING_OPERATOR_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
    Membership.Roles.HSE_INSPECTOR,
}

COMPETENCY_ISSUER_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
    Membership.Roles.HSE_INSPECTOR,
}

PPE_OPERATOR_ROLES = {
    Membership.Roles.ORG_ADMIN,
    Membership.Roles.HSE_MANAGER,
    Membership.Roles.HSE_INSPECTOR,
    Membership.Roles.WORKSHOP_SUPERVISOR,
}


def can_manage_workforce(user, organization_id):
    """Manage personnel, course catalogue, competency definitions and PPE catalogue/stock."""
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in WORKFORCE_MANAGER_ROLES


def can_conduct_training(user, organization_id):
    """Create delivery sessions and record attendance/assessment results."""
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in TRAINING_OPERATOR_ROLES


def can_issue_competency(user, organization_id):
    """Issue, suspend or revoke employee competency records."""
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in COMPETENCY_ISSUER_ROLES


def can_operate_ppe(user, organization_id):
    """Issue, return or replace PPE assignments."""
    if not user or not user.is_authenticated:
        return False
    if user.is_platform_admin:
        return True
    return membership_role(user, organization_id) in PPE_OPERATOR_ROLES
