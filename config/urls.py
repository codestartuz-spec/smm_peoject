from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from smm.api import spa

DIST = settings.BASE_DIR / "frontend" / "dist"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("smm.urls")),
    re_path(r"^assets/(?P<path>.*)$", serve, {"document_root": DIST / "assets"}),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) + [
    re_path(r"^(?!api/|admin/|media/|oauth/|assets/).*$", spa),
]
