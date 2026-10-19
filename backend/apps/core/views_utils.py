from rest_framework import status
from rest_framework.response import Response

from apps.core.access import accessible_organization_ids


def resolve_organization(request, check):
    organization_id = request.query_params.get("organization")
    if organization_id is None:
        organization_id = request.data.get("organization")
    if organization_id is None:
        ids = list(accessible_organization_ids(request.user))
        if len(ids) != 1:
            return None, Response(
                {
                    "error": {
                        "code": "organization_required",
                        "message": "شناسه سازمان لازم است.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        organization_id = ids[0]
    try:
        organization_id = int(organization_id)
    except (TypeError, ValueError):
        return None, Response(
            {
                "error": {
                    "code": "invalid_parameter",
                    "message": "شناسه سازمان نامعتبر است.",
                }
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not check(request.user, organization_id):
        return None, Response(
            {"error": {"code": "not_found", "message": "موردی یافت نشد."}},
            status=status.HTTP_404_NOT_FOUND,
        )
    return organization_id, None
