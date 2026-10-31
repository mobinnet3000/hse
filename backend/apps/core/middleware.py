import uuid


class RequestCorrelationMiddleware:
    """
    Middleware that ensures every request has an X-Request-ID for distributed tracing,
    debugging, and audit correlation across staging and production environments.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Extract existing X-Request-ID header or generate a new UUID4
        request_id = request.META.get("HTTP_X_REQUEST_ID")
        if not request_id or not request_id.strip():
            request_id = str(uuid.uuid4())
        else:
            request_id = request_id.strip()[:64]  # Limit length for safety

        request.correlation_id = request_id

        response = self.get_response(request)
        response["X-Request-ID"] = request_id
        return response
