"""Keyingi bosqich platformalari. Interfeys tayyor, API ulanishi keyin yoziladi."""
from .base import BaseAdapter, PlatformError


class _Stub(BaseAdapter):
    def _nope(self):
        raise PlatformError(f"{self.platform}: integratsiya keyingi bosqichda qo'shiladi")

    def publish(self, variant):
        self._nope()

    def fetch_metrics(self):
        self._nope()


class TikTokAdapter(_Stub):
    platform = "tiktok"  # TikTok Content Posting API (audit talab qilinadi)


class LinkedInAdapter(_Stub):
    platform = "linkedin"  # LinkedIn Posts API (w_member_social)
