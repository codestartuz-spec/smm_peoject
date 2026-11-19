"""Facebook Page (Graph API). credentials: page_token. external_id = Page ID."""
import requests
from django.utils.dateparse import parse_datetime

from .base import BaseAdapter, PlatformError, check
from .instagram import GRAPH


class FacebookAdapter(BaseAdapter):
    platform = "facebook"

    def _t(self):
        t = self.cred.get("page_token")
        if not t:
            raise PlatformError("Facebook page token kiritilmagan")
        return t

    def publish(self, variant):
        pid, text, t = self.channel.external_id, variant.full_text(), self._t()
        urls = self.media_urls(variant.post)
        if not urls:
            r = requests.post(f"{GRAPH}/{pid}/feed", data={"message": text, "access_token": t}, timeout=60)
        elif urls[0][1] == "video":
            r = requests.post(f"{GRAPH}/{pid}/videos", data={"file_url": urls[0][0], "description": text, "access_token": t}, timeout=300)
        else:
            r = requests.post(f"{GRAPH}/{pid}/photos", data={"url": urls[0][0], "caption": text, "access_token": t}, timeout=120)
        d = check(r, "facebook publish")
        ext = d.get("post_id") or d.get("id")
        return {"external_id": ext, "url": f"https://facebook.com/{ext}"}

    def fetch_metrics(self):
        r = requests.get(f"{GRAPH}/{self.channel.external_id}", params={"fields": "fan_count,followers_count", "access_token": self._t()}, timeout=30)
        d = check(r, "fb page")
        return {"followers": d.get("followers_count") or d.get("fan_count", 0)}

    def fetch_comments(self):
        from ..models import PostVariant
        out = []
        for v in PostVariant.objects.filter(channel=self.channel, status="published").exclude(external_id="").order_by("-published_at")[:10]:
            r = requests.get(f"{GRAPH}/{v.external_id}/comments", params={"fields": "id,message,from,created_time", "access_token": self._t()}, timeout=30)
            if r.status_code >= 400:
                continue
            for c in r.json().get("data", []):
                out.append({"external_id": c["id"], "parent_ref": c["id"], "author": (c.get("from") or {}).get("name", ""),
                            "text": c.get("message", ""), "posted_at": parse_datetime(c["created_time"].replace("+0000", "+00:00")),
                            "post_external_id": v.external_id})
        return out

    def reply(self, comment, text):
        r = requests.post(f"{GRAPH}/{comment.parent_ref}/comments", data={"message": text, "access_token": self._t()}, timeout=30)
        check(r, "fb reply")
