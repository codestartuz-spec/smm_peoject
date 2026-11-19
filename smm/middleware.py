from .envconf import refresh_settings


class EnvRefreshMiddleware:
    """.env o'zgargan bo'lsa (masalan, boshqa jarayon tomonidan) sozlamalarni qayta yuklaydi."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        refresh_settings()
        return self.get_response(request)
