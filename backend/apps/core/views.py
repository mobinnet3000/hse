from django.db import connection
from django.http import JsonResponse
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response


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
