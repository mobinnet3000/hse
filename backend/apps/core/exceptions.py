import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API error", exc_info=exc)
        return Response(
            {"error": {"code": "server_error", "message": "خطای داخلی سرور رخ داد."}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = response.data
    message = detail.get("detail") if isinstance(detail, dict) else None
    if not message:
        message = "درخواست نامعتبر است."
    response.data = {
        "error": {
            "code": getattr(exc, "default_code", "invalid_request"),
            "message": str(message),
            "details": detail,
        }
    }
    return response
