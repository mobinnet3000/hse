from django.db import connection
from django.http import JsonResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .integrations import get_all_integrations_status, test_integration


@api_view(["GET"])
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        return Response(
            {"status": "error", "database": "unavailable"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response({"status": "ok", "database": "ok"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def integrations_status(request):
    """Returns the list and operational statuses of all provider-neutral integration adapters."""
    items = get_all_integrations_status()
    return Response({
        "count": len(items),
        "results": items,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def test_integration_view(request):
    """Tests connectivity to a specific external adapter."""
    slug = request.data.get("slug")
    if not slug:
        return Response({"error": {"code": "bad_request", "message": "شناسه slug الزامی است."}}, status=400)
    result = test_integration(slug)
    return Response(result)


def not_found(request, exception=None):
    return JsonResponse(
        {"error": {"code": "not_found", "message": "مسیر درخواستی یافت نشد."}},
        status=404,
    )


def server_error(request):
    return JsonResponse(
        {"error": {"code": "server_error", "message": "خطای داخلی سرور رخ داد."}},
        status=500,
    )
