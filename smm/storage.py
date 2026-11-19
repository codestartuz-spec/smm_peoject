"""Cloudflare R2 (S3 mos) media ombori. Post fayllari faqat shu yerdan olinadi."""
import mimetypes
import re
import secrets
import tempfile
import time
from pathlib import Path

import requests
from django.conf import settings

IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp", ".gif")
VIDEO_EXT = (".mp4", ".mov", ".webm", ".mkv")
ALLOWED_EXT = IMAGE_EXT + VIDEO_EXT
MAX_UPLOAD_MB = 100  # Cloudflare Tunnel/proxy bepul tarifida bitta so'rov 100 MB gacha


class StorageError(Exception):
    pass


def configured() -> bool:
    return all(getattr(settings, k, "") for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"))


def _client():
    if not configured():
        raise StorageError("Cloudflare R2 sozlanmagan. Sozlamalar → Cloudflare R2 kartasini to'ldiring.")
    import boto3
    from botocore.config import Config
    return boto3.client(
        "s3", endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID, aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto", config=Config(signature_version="s3v4", retries={"max_attempts": 3}))


def public_url(key: str) -> str:
    return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"


def kind_of(name: str) -> str:
    return "video" if name.lower().endswith(VIDEO_EXT) else "image"


def make_key(business_slug: str, filename: str) -> str:
    stem = re.sub(r"[^a-z0-9]+", "-", Path(filename).stem.lower()).strip("-")[:40] or "fayl"
    ext = Path(filename).suffix.lower()
    return f"{business_slug}/{time.strftime('%Y/%m')}/{secrets.token_hex(4)}-{stem}{ext}"


def upload(fileobj, key: str, content_type: str = ""):
    ct = content_type or mimetypes.guess_type(key)[0] or "application/octet-stream"
    try:
        _client().upload_fileobj(fileobj, settings.R2_BUCKET, key, ExtraArgs={"ContentType": ct, "CacheControl": "public, max-age=31536000"})
    except StorageError:
        raise
    except Exception as e:  # noqa: BLE001 — botocore xatolari turlicha
        raise StorageError(f"R2 ga yuklanmadi: {e}")


def delete(key: str):
    try:
        _client().delete_object(Bucket=settings.R2_BUCKET, Key=key)
    except StorageError:
        raise
    except Exception as e:  # noqa: BLE001
        raise StorageError(f"R2 dan o'chirilmadi: {e}")


def check() -> str:
    """Ulanish, bucket va ochiq manzilni tekshiradi; xabar qaytaradi yoki StorageError."""
    c = _client()
    key = f"_test/{secrets.token_hex(4)}.txt"
    try:
        c.put_object(Bucket=settings.R2_BUCKET, Key=key, Body=b"ok", ContentType="text/plain")
    except Exception as e:  # noqa: BLE001
        raise StorageError(f"Bucketga yozib bo'lmadi (kalit/ruxsat/bucket nomini tekshiring): {e}")
    try:
        try:
            r = requests.get(public_url(key), timeout=15)
            if r.status_code != 200:
                raise StorageError(f"Yozish ishladi, lekin ochiq manzil HTTP {r.status_code} qaytardi. Bucketda Public access (r2.dev yoki custom domain) yoqilganini tekshiring.")
        except requests.RequestException as e:
            raise StorageError(f"Yozish ishladi, lekin ochiq manzilga ulanib bo'lmadi: {e}")
    finally:
        try:
            c.delete_object(Bucket=settings.R2_BUCKET, Key=key)
        except Exception:  # noqa: BLE001
            pass
    return "R2 ishlayapti: yozish, o'chirish va ochiq manzil ✓"


def local_copy(asset) -> str:
    """Telegram/YouTube fayl baytlarini talab qiladi: R2 dan vaqtinchalik nusxa yuklab oladi."""
    cache = Path(tempfile.gettempdir()) / "smm_media"
    cache.mkdir(exist_ok=True)
    path = cache / f"{asset.pk}-{Path(asset.key).name}"
    if path.exists() and path.stat().st_size:
        return str(path)
    try:
        with requests.get(asset.url, stream=True, timeout=120) as r:
            if r.status_code != 200:
                raise StorageError(f"Faylni R2 dan olib bo'lmadi (HTTP {r.status_code}): {asset.name}")
            tmp = path.with_suffix(path.suffix + ".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(1024 * 1024):
                    f.write(chunk)
            tmp.replace(path)
    except requests.RequestException as e:
        raise StorageError(f"Faylni R2 dan olib bo'lmadi: {e}")
    return str(path)
