"""Barcha platforma adapterlari uchun umumiy interfeys."""


class PlatformError(Exception):
    pass


def check(resp, what=""):
    """requests javobini tekshiradi, xato bo'lsa PlatformError ko'taradi."""
    try:
        data = resp.json()
    except ValueError:
        data = {"raw": resp.text[:300]}
    if resp.status_code >= 400:
        raise PlatformError(f"{what} HTTP {resp.status_code}: {str(data)[:400]}")
    return data


class BaseAdapter:
    platform = ""

    def __init__(self, channel):
        self.channel = channel
        self.cred = channel.credentials

    # --- media yordamchilari (fayllar faqat Cloudflare R2 dan) ---
    @staticmethod
    def media_files(post):
        from smm import storage
        return [(storage.local_copy(m), m.kind) for m in post.media.all().order_by("id")]

    @staticmethod
    def media_urls(post):
        return [(m.url, m.kind) for m in post.media.all().order_by("id")]

    # --- interfeys ---
    def publish(self, variant) -> dict:
        """-> {'external_id': str, 'url': str}"""
        raise NotImplementedError

    def fetch_metrics(self) -> dict:
        """Kanal darajasidagi ko'rsatkichlar (followers va h.k.)."""
        raise NotImplementedError

    def fetch_post_metrics(self, variant) -> dict:
        return {}

    def fetch_comments(self) -> list:
        """-> [{external_id, parent_ref, author, text, posted_at(datetime), post_external_id}]"""
        return []

    def reply(self, comment, text) -> None:
        raise PlatformError("Bu platformada javob berish hali qo'llab-quvvatlanmaydi")
