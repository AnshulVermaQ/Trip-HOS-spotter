from django.conf import settings
from django.http import HttpResponse
from urllib.parse import urlparse


class DevelopmentCorsMiddleware:
    """Small dependency-free CORS layer for the separate Vite development server."""

    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def is_allowed_origin(origin: str | None) -> bool:
        if not origin:
            return False
        if origin in settings.CORS_ALLOWED_ORIGINS:
            return True
        # Vite and preview tools can choose an available local port. Keep this
        # permissive behavior strictly to Django's DEBUG mode.
        parsed = urlparse(origin)
        return bool(settings.DEBUG and parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"})

    def __call__(self, request):
        origin = request.headers.get("Origin")
        allowed_origin = self.is_allowed_origin(origin)
        if request.method == "OPTIONS" and allowed_origin:
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)
        if allowed_origin:
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
            response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type"
        return response
