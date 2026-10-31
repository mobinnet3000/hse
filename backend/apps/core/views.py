import os
import uuid

from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .integrations import get_all_integrations_status, test_integration


@api_view(["GET"])
def health(request):
    """Liveness probe: verifies that the web application process is responsive."""
    return Response({"status": "ok", "service": "hse-guard"})


@api_view(["GET"])
def readiness(request):
    """
    Readiness probe: verifies critical dependencies before routing traffic:
    1. Database connectivity
    2. Media storage filesystem writability
    """
    db_ok = True
    storage_ok = True
    errors = {}

    # 1. Database connectivity probe
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception as e:
        db_ok = False
        errors["database"] = str(e)

    # 2. Media storage writability probe
    try:
        media_path = settings.MEDIA_ROOT
        os.makedirs(media_path, exist_ok=True)
        probe_file = os.path.join(media_path, f".readiness_probe_{uuid.uuid4().hex}")
        with open(probe_file, "w") as f:
            f.write("probe")
        if os.path.exists(probe_file):
            os.remove(probe_file)
    except Exception as e:
        storage_ok = False
        errors["storage"] = str(e)

    if not db_ok or not storage_ok:
        return Response(
            {
                "status": "not_ready",
                "database": "connected" if db_ok else "disconnected",
                "storage": "writable" if storage_ok else "unwritable",
                "errors": errors,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({
        "status": "ready",
        "database": "connected",
        "storage": "writable",
    })


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
