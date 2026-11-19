"""Instagram Graph API (Business/Creator). credentials: access_token. external_id = Instagram user ID.
Eslatma: Instagram media'ni ochiq URL orqali oladi -> fayllar Cloudflare R2 ning ochiq manzilidan olinadi (tunnel kerak emas)."""
import time
from datetime import datetime

import requests
from django.utils.dateparse import parse_datetime

from .base import BaseAdapter, PlatformError, check

GRAPH = "https://graph.facebook.com/v21.0"


def discover(access_token):
    """Token bilan bog'langan Facebook sahifalar va Instagram akkauntlarni topadi."""
    r = requests.get(f"{GRAPH}/me/accounts", params={
        "fields": "name,instagram_business_account{id,username}", "access_token": access_token}, timeout=30)
    out = []
    for p in check(r, "me/accounts").get("data", []):
        ig = p.get("instagram_business_account")
        if ig:
            out.append({"page": p["name"], "ig_id": ig["id"], "username": ig.get("username", "")})
    return out


class InstagramAdapter(BaseAdapter):
    platform = "instagram"

    @property
    def token(self):
        t = self.cred.get("access_token")
        if not t:
            raise PlatformError("Instagram access token kiritilmagan")
        return t

    def _get(self, path, **params):
        params["access_token"] = self.token
        return check(requests.get(f"{GRAPH}/{path}", params=params, timeout=60), path)

    def _post(self, path, **params):
        params["access_token"] = self.token
        return check(requests.post(f"{GRAPH}/{path}", data=params, timeout=120), path)

    def _wait(self, container_id, tries=40):
        for _ in range(tries):
            st = self._get(container_id, fields="status_code").get("status_code")
            if st == "FINISHED":
                return
            if st in ("ERROR", "EXPIRED"):
                raise PlatformError(f"Instagram media qayta ishlashda xato: {st}")
            time.sleep(6)
        raise PlatformError("Instagram media tayyor bo'lmadi (timeout)")

    def publish(self, variant):
        ig = self.channel.external_id
        post, text = variant.post, variant.full_text()
        urls = self.media_urls(post)
        if not urls:
            raise PlatformError("Instagram uchun rasm yoki video biriktiring")
        if post.kind == "story":
            u, kind = urls[0]
            key = "video_url" if kind == "video" else "image_url"
            cid = self._post(f"{ig}/media", media_type="STORIES", **{key: u})["id"]
        elif post.kind == "reel":
            cid = self._post(f"{ig}/media", media_type="REELS", video_url=urls[0][0], caption=text)["id"]
        elif len(urls) > 1:
            kids = []
            for u, kind in urls[:10]:
                key = "video_url" if kind == "video" else "image_url"
                extra = {"media_type": "VIDEO"} if kind == "video" else {}
                kid = self._post(f"{ig}/media", is_carousel_item="true", **{key: u}, **extra)["id"]
                if kind == "video":
                    self._wait(kid)
                kids.append(kid)
            cid = self._post(f"{ig}/media", media_type="CAROUSEL", children=",".join(kids), caption=text)["id"]
        else:
            u, kind = urls[0]
            if kind == "video":
                cid = self._post(f"{ig}/media", media_type="REELS", video_url=u, caption=text)["id"]
            else:
                cid = self._post(f"{ig}/media", image_url=u, caption=text)["id"]
        self._wait(cid)
        mid = self._post(f"{ig}/media_publish", creation_id=cid)["id"]
        link = ""
        try:
            link = self._get(mid, fields="permalink").get("permalink", "")
        except PlatformError:
            pass
        return {"external_id": mid, "url": link}

    def fetch_metrics(self):
        ig = self.channel.external_id
        data = self._get(ig, fields="followers_count,follows_count,media_count")
        res = {"followers": data.get("followers_count", 0), "following": data.get("follows_count", 0),
               "media_count": data.get("media_count", 0)}
        try:  # kunlik insights (metrikalar Meta tomonidan o'zgarib turadi, shuning uchun try)
            ins = self._get(f"{ig}/insights", metric="reach,profile_views,website_clicks", period="day")
            for m in ins.get("data", []):
                vals = m.get("values") or []
                if vals:
                    res[m["name"]] = vals[-1].get("value", 0)
        except PlatformError:
            pass
        return res

    def fetch_post_metrics(self, variant):
        mid = variant.external_id
        data = self._get(mid, fields="like_count,comments_count")
        res = {"likes": data.get("like_count", 0), "comments": data.get("comments_count", 0)}
        try:
            ins = self._get(f"{mid}/insights", metric="reach,saved,shares")
            for m in ins.get("data", []):
                vals = m.get("values") or []
                if vals:
                    res[m["name"]] = vals[0].get("value", 0)
        except PlatformError:
            pass
        return res

    def fetch_comments(self):
        from ..models import PostVariant
        out = []
        qs = PostVariant.objects.filter(channel=self.channel, status="published").exclude(external_id="").order_by("-published_at")[:15]
        for v in qs:
            try:
                data = self._get(f"{v.external_id}/comments", fields="id,text,username,timestamp", limit=50)
            except PlatformError:
                continue
            for c in data.get("data", []):
                out.append({"external_id": c["id"], "parent_ref": c["id"], "author": c.get("username", ""),
                            "text": c.get("text", ""), "posted_at": parse_datetime(c["timestamp"].replace("+0000", "+00:00")),
                            "post_external_id": v.external_id})
        return out

    def reply(self, comment, text):
        self._post(f"{comment.parent_ref}/replies", message=text)
