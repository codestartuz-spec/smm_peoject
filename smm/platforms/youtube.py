"""YouTube Data API v3 + Analytics API. credentials: refresh_token, [client_id, client_secret]."""
import os
from datetime import date, datetime, timedelta, timezone as dt_tz

import requests
from django.conf import settings
from django.utils.dateparse import parse_datetime

from .base import BaseAdapter, PlatformError, check

API = "https://www.googleapis.com/youtube/v3"


class YouTubeAdapter(BaseAdapter):
    platform = "youtube"

    def _token(self):
        c = self.cred
        cid = c.get("client_id") or settings.GOOGLE_CLIENT_ID
        sec = c.get("client_secret") or settings.GOOGLE_CLIENT_SECRET
        if not (cid and sec and c.get("refresh_token")):
            raise PlatformError("YouTube: Google OAuth ulanmagan (kanal sahifasida 'Google bilan ulash' ni bosing)")
        r = requests.post("https://oauth2.googleapis.com/token", data={
            "client_id": cid, "client_secret": sec, "refresh_token": c["refresh_token"], "grant_type": "refresh_token"}, timeout=30)
        return check(r, "oauth")["access_token"]

    def _h(self):
        return {"Authorization": f"Bearer {self._token()}"}

    def publish(self, variant):
        post = variant.post
        vids = [p for p, k in self.media_files(post) if k == "video"]
        if not vids:
            raise PlatformError("YouTube uchun video fayl biriktiring")
        path = vids[0]
        title = post.title[:95]
        desc = variant.full_text()
        if post.kind == "reel" and "#shorts" not in desc.lower():
            desc += "\n\n#Shorts"
        meta = {"snippet": {"title": title, "description": desc, "categoryId": "28"},
                "status": {"privacyStatus": "public", "selfDeclaredMadeForKids": False}}
        h = self._h()
        size = os.path.getsize(path)
        init = requests.post("https://www.googleapis.com/upload/youtube/v3/videos",
                             params={"uploadType": "resumable", "part": "snippet,status"},
                             headers={**h, "X-Upload-Content-Type": "video/*", "X-Upload-Content-Length": str(size)},
                             json=meta, timeout=60)
        if init.status_code >= 400:
            raise PlatformError(f"YouTube upload init: {init.text[:300]}")
        with open(path, "rb") as f:
            up = requests.put(init.headers["Location"], data=f, headers={"Content-Length": str(size)}, timeout=3600)
        data = check(up, "upload")
        return {"external_id": data["id"], "url": f"https://youtu.be/{data['id']}"}

    def fetch_metrics(self):
        r = requests.get(f"{API}/channels", params={"part": "statistics", "mine": "true"}, headers=self._h(), timeout=30)
        items = check(r, "channels").get("items", [])
        if not items:
            raise PlatformError("YouTube kanal topilmadi")
        st = items[0]["statistics"]
        res = {"followers": int(st.get("subscriberCount", 0)), "views_total": int(st.get("viewCount", 0)),
               "videos": int(st.get("videoCount", 0))}
        try:
            end, start = date.today(), date.today() - timedelta(days=7)
            ar = requests.get("https://youtubeanalytics.googleapis.com/v2/reports", headers=self._h(), timeout=30, params={
                "ids": "channel==MINE", "startDate": start.isoformat(), "endDate": end.isoformat(),
                "metrics": "views,estimatedMinutesWatched,averageViewDuration,subscribersGained"})
            d = check(ar, "analytics")
            if d.get("rows"):
                for name, val in zip([c["name"] for c in d["columnHeaders"]], d["rows"][0]):
                    res[f"week_{name}"] = val
        except PlatformError:
            pass
        return res

    def fetch_post_metrics(self, variant):
        r = requests.get(f"{API}/videos", params={"part": "statistics", "id": variant.external_id}, headers=self._h(), timeout=30)
        items = check(r, "videos").get("items", [])
        if not items:
            return {}
        s = items[0]["statistics"]
        return {"views": int(s.get("viewCount", 0)), "likes": int(s.get("likeCount", 0)), "comments": int(s.get("commentCount", 0))}

    def fetch_comments(self):
        from ..models import PostVariant
        out, h = [], self._h()
        qs = PostVariant.objects.filter(channel=self.channel, status="published").exclude(external_id="").order_by("-published_at")[:10]
        for v in qs:
            r = requests.get(f"{API}/commentThreads", headers=h, timeout=30, params={
                "part": "snippet", "videoId": v.external_id, "maxResults": 50, "order": "time", "textFormat": "plainText"})
            if r.status_code >= 400:
                continue
            for it in r.json().get("items", []):
                top = it["snippet"]["topLevelComment"]
                sn = top["snippet"]
                out.append({"external_id": top["id"], "parent_ref": top["id"], "author": sn.get("authorDisplayName", ""),
                            "text": sn.get("textDisplay", ""), "posted_at": parse_datetime(sn["publishedAt"]),
                            "post_external_id": v.external_id})
        return out

    def reply(self, comment, text):
        r = requests.post(f"{API}/comments", params={"part": "snippet"}, headers=self._h(), timeout=30,
                          json={"snippet": {"parentId": comment.parent_ref, "textOriginal": text}})
        check(r, "comment reply")
