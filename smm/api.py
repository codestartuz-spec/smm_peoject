"""React ilova uchun JSON API. Barcha endpointlar sessiya (login) talab qiladi."""
import functools
import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta

import requests
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.db.models import Count
from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import ensure_csrf_cookie

from . import envconf, notify, storage, tasks
from .ai import agents
from .ai import providers as ai_providers
from .ai.providers import AIError
from .models import (PLATFORMS, POST_KINDS, POST_STATUSES, Business, Channel, Comment, CommentDigest, MediaAsset,
                     Pillar, Post, PostVariant, Series)
from .platforms import PlatformError, get_adapter
from .platforms.instagram import discover

logger = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(self, msg, status=400):
        super().__init__(msg)
        self.status = status


def api(methods=("GET",), auth=True):
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(request, *a, **kw):
            if request.method not in methods:
                return JsonResponse({"error": "Method not allowed"}, status=405)
            if auth and not request.user.is_authenticated:
                return JsonResponse({"error": "Kirish talab qilinadi"}, status=401)
            request.data = {}
            if (request.content_type or "").startswith("application/json") and request.body:
                try:
                    request.data = json.loads(request.body)
                except ValueError:
                    return JsonResponse({"error": "JSON formati noto'g'ri"}, status=400)
            try:
                return fn(request, *a, **kw)
            except ApiError as e:
                return JsonResponse({"error": str(e)}, status=e.status)
            except (AIError, PlatformError, requests.RequestException) as e:
                return JsonResponse({"error": str(e)}, status=400)
            except Http404:
                raise
            except Exception as e:  # noqa: BLE001 — kutilmagan xato: logga yozib, aniq xabar qaytaramiz
                logger.exception("API xatosi: %s %s", request.method, request.path)
                return JsonResponse({"error": f"Server xatosi: {type(e).__name__}: {e}"[:400]}, status=500)
        return wrapper
    return deco


def ok(**kw):
    return JsonResponse({"ok": True, **kw})


def iso(dt):
    return timezone.localtime(dt).isoformat() if dt else None


def biz_or_404(slug):
    return get_object_or_404(Business, slug=slug)


# ------------------------------------------------------------------ serializerlar
def channel_dict(c):
    return {"id": c.id, "platform": c.platform, "name": c.name, "external_id": c.external_id, "followers": c.followers,
            "status": c.status, "last_error": c.last_error, "has_credentials": bool(c.credentials)}


def media_dict(m):
    return {"id": m.id, "name": m.name, "url": m.url, "kind": m.kind, "size": m.size, "created_at": iso(m.created_at)}


def post_dict(p, detail=False):
    d = {"id": p.id, "title": p.title, "kind": p.kind, "status": p.status, "scheduled_at": iso(p.scheduled_at),
         "series_id": p.series_id, "series_name": p.series.name if p.series_id else "", "part_no": p.part_no,
         "pillar_id": p.pillar_id, "ai_generated": p.ai_generated,
         "platforms": sorted({v.channel.platform for v in p.variants.all()})}
    if detail:
        d.update({
            "brief": p.brief, "script": p.script or {},
            "media": [media_dict(m) for m in p.media.all()],
            "variants": [{"channel_id": v.channel_id, "platform": v.channel.platform, "channel_name": v.channel.name,
                          "caption": v.caption, "hashtags": v.hashtags, "status": v.status, "url": v.external_url,
                          "error": v.error} for v in p.variants.select_related("channel")],
        })
    return d


def biz_dict(b, detail=False):
    chans = list(b.channels.all())
    d = {"id": b.id, "name": b.name, "slug": b.slug, "industry": b.industry, "is_active": b.is_active,
         "followers": sum(c.followers for c in chans), "platforms": [c.platform for c in chans]}
    if detail:
        d.update({k: getattr(b, k) for k in ("description", "audience", "tone", "usp", "hashtags", "forbidden_words",
                                              "goals", "report_chat_id")})
        d["pillars"] = [{"id": p.id, "name": p.name, "share": p.share} for p in b.pillars.all()]
    return d


def comment_dict(c):
    return {"id": c.id, "platform": c.channel.platform, "author": c.author, "text": c.text, "posted_at": iso(c.posted_at),
            "sentiment": c.sentiment, "topic": c.topic, "is_question": c.is_question, "is_lead": c.is_lead,
            "analyzed": c.analyzed, "suggested_reply": c.suggested_reply, "reply_status": c.reply_status,
            "reply_text": c.reply_text, "post_title": c.variant.post.title if c.variant_id else ""}


# ------------------------------------------------------------------ sessiya
@ensure_csrf_cookie
@api(("GET",), auth=False)
def session(request):
    u = request.user
    return JsonResponse({"authenticated": u.is_authenticated, "user": u.username if u.is_authenticated else None,
                         "name": (u.get_full_name() or u.username) if u.is_authenticated else None,
                         "meta": {"platforms": PLATFORMS, "kinds": POST_KINDS, "statuses": POST_STATUSES}})


@api(("POST",), auth=False)
def login_view(request):
    u = authenticate(request, username=request.data.get("username", ""), password=request.data.get("password", ""))
    if not u:
        raise ApiError("Login yoki parol noto'g'ri", 400)
    login(request, u)
    return ok(user=u.username)


@api(("POST",))
def logout_view(request):
    logout(request)
    return ok()


# ------------------------------------------------------------------ dashboard / bizneslar
@api(("GET", "POST"))
def businesses(request):
    if request.method == "POST":
        name = (request.data.get("name") or "").strip()
        if not name:
            raise ApiError("Biznes nomini kiriting")
        b = Business.objects.create(name=name, industry=request.data.get("industry", ""))
        return ok(business=biz_dict(b, True))
    today = timezone.localdate()
    rows, tot = [], {"followers": 0, "pending": 0, "today": 0, "replies": 0}
    for b in Business.objects.filter(is_active=True):
        d = biz_dict(b)
        d.update({"pending": b.posts.filter(status="pending").count(), "ideas": b.posts.filter(status="idea").count(),
                  "today": b.posts.filter(scheduled_at__date=today).count(),
                  "published": b.posts.filter(status="published").count(),
                  "replies": Comment.objects.filter(channel__business=b, reply_status="suggested").count()})
        for k in tot:
            tot[k] += d.get(k, 0)
        rows.append(d)
    upcoming = Post.objects.filter(status__in=["approved", "pending"], scheduled_at__gte=timezone.now()) \
        .select_related("business").order_by("scheduled_at")[:8]
    return JsonResponse({"businesses": rows, "totals": tot,
                         "upcoming": [{**post_dict(p), "business": p.business.name, "slug": p.business.slug} for p in upcoming]})


@api(("GET", "PUT"))
def business_detail(request, slug):
    b = biz_or_404(slug)
    if request.method == "PUT":
        d = request.data
        for k in ("name", "industry", "description", "audience", "tone", "usp", "hashtags", "forbidden_words", "goals",
                  "report_chat_id"):
            if k in d:
                setattr(b, k, str(d[k])[:2000])
        if "is_active" in d:
            b.is_active = bool(d["is_active"])
        if not b.name.strip():
            raise ApiError("Nom bo'sh bo'lmasin")
        b.save()
        if "pillars" in d:
            keep = []
            for p in d["pillars"]:
                nm = str(p.get("name", "")).strip()
                if not nm:
                    continue
                obj = b.pillars.filter(pk=p.get("id") or 0).first() or Pillar(business=b)
                obj.name, obj.share = nm[:100], int(p.get("share") or 0)
                obj.save()
                keep.append(obj.id)
            b.pillars.exclude(pk__in=keep).delete()
    return JsonResponse({"business": biz_dict(b, True)})


@api(("GET",))
def overview(request, slug):
    b = biz_or_404(slug)
    now = timezone.now()
    since = timezone.localdate() - timedelta(days=7)
    delta = 0
    for ch in b.channels.all():
        sn = list(ch.snapshots.filter(date__gte=since).order_by("date"))
        if len(sn) > 1:
            delta += sn[-1].metrics.get("followers", 0) - sn[0].metrics.get("followers", 0)
    digest = b.digests.first()
    return JsonResponse({
        "business": biz_dict(b, True),
        "pending": [post_dict(p) for p in b.posts.filter(status="pending")],
        "upcoming": [post_dict(p) for p in b.posts.filter(status__in=["approved", "draft", "idea"], scheduled_at__gte=now).order_by("scheduled_at")[:8]],
        "failed": [post_dict(p) for p in b.posts.filter(status="failed")[:5]],
        "channels": [channel_dict(c) for c in b.channels.all()],
        "digest": {"text": digest.text, "created_at": iso(digest.created_at)} if digest else None,
        "replies": Comment.objects.filter(channel__business=b, reply_status="suggested").count(),
        "counts": dict(b.posts.values_list("status").annotate(n=Count("id"))),
        "followers_delta_7d": delta,
    })


# ------------------------------------------------------------------ postlar
@api(("GET", "POST"))
def posts(request, slug):
    b = biz_or_404(slug)
    if request.method == "POST":
        p = Post.objects.create(business=b, title=(request.data.get("title") or "Yangi post")[:250],
                                kind=request.data.get("kind", "post"), status="draft",
                                scheduled_at=_dt(request.data.get("scheduled_at")))
        return ok(post=post_dict(p, True))
    qs = b.posts.select_related("series").prefetch_related("variants__channel")
    if request.GET.get("status"):
        qs = qs.filter(status=request.GET["status"])
    if request.GET.get("kind"):
        qs = qs.filter(kind=request.GET["kind"])
    if request.GET.get("q"):
        qs = qs.filter(title__icontains=request.GET["q"])
    return JsonResponse({"posts": [post_dict(p) for p in qs[:400]],
                         "counts": dict(b.posts.values_list("status").annotate(n=Count("id")))})


def _dt(v):
    if not v:
        return None
    d = parse_datetime(v)
    if d is None:
        raise ApiError("Sana formati noto'g'ri")
    return timezone.make_aware(d, timezone.get_current_timezone()) if timezone.is_naive(d) else d


@api(("GET", "PUT", "PATCH", "DELETE"))
def post_detail(request, pk):
    p = get_object_or_404(Post.objects.select_related("business", "series"), pk=pk)
    b = p.business
    if request.method == "DELETE":
        p.delete()
        return ok()
    if request.method in ("PUT", "PATCH"):
        d = request.data
        if p.status == "published":
            raise ApiError("E'lon qilingan postni o'zgartirib bo'lmaydi")
        if "title" in d:
            p.title = str(d["title"])[:250]
        if "kind" in d and d["kind"] in dict(POST_KINDS):
            p.kind = d["kind"]
        if "brief" in d:
            p.brief = d["brief"]
        if "scheduled_at" in d:
            p.scheduled_at = _dt(d["scheduled_at"])
        if "pillar_id" in d:
            p.pillar = b.pillars.filter(pk=d["pillar_id"] or 0).first()
        if "series_id" in d:
            p.series = b.series.filter(pk=d["series_id"] or 0).first()
        if "script" in d and isinstance(d["script"], dict):
            p.script = d["script"]
        p.save()
        if "variants" in d:
            chosen = set()
            for v in d["variants"]:
                ch = b.channels.filter(pk=v.get("channel_id")).first()
                if not ch:
                    continue
                chosen.add(ch.id)
                obj, _ = PostVariant.objects.get_or_create(post=p, channel=ch)
                if obj.status != "published":
                    obj.caption, obj.hashtags = v.get("caption", ""), v.get("hashtags", "")
                    obj.save()
            p.variants.exclude(channel_id__in=chosen).exclude(status="published").delete()
        p.refresh_from_db()
    return JsonResponse({"post": post_dict(p, True)})


@api(("POST",))
def post_media(request, pk):
    """Postga fayl biriktirish: faqat shu biznesning R2 kutubxonasidagi fayllar (asset_ids)."""
    p = get_object_or_404(Post, pk=pk)
    ids = [int(i) for i in (request.data.get("asset_ids") or []) if str(i).isdigit()]
    found = MediaAsset.objects.filter(business=p.business, id__in=ids)
    if len(found) != len(set(ids)):
        raise ApiError("Faqat Media kutubxonasidagi fayllarni tanlash mumkin", 400)
    p.media.add(*found)
    return JsonResponse({"post": post_dict(p, True)})


@api(("DELETE",))
def post_media_delete(request, pk, mid):
    p = get_object_or_404(Post, pk=pk)
    p.media.remove(mid)
    return JsonResponse({"post": post_dict(p, True)})


# ------------------------------------------------------------------ media kutubxona (Cloudflare R2)
@api(("GET", "POST"))
def library(request, slug):
    b = biz_or_404(slug)
    if request.method == "POST":
        files = request.FILES.getlist("files")
        if not files:
            raise ApiError("Fayl tanlanmagan")
        if not storage.configured():
            raise ApiError("Cloudflare R2 sozlanmagan: Sozlamalar → «Cloudflare R2» kartasini to'ldiring", 400)
        done, errors = [], []
        for f in files:
            if not f.name.lower().endswith(storage.ALLOWED_EXT):
                errors.append(f"{f.name}: format qo'llanmaydi (JPG, PNG, WEBP, GIF, MP4, MOV, WEBM)")
                continue
            if f.size > storage.MAX_UPLOAD_MB * 1024 * 1024:
                errors.append(f"{f.name}: {storage.MAX_UPLOAD_MB} MB dan katta")
                continue
            key = storage.make_key(b.slug, f.name)
            try:
                storage.upload(f, key, f.content_type or "")
            except storage.StorageError as e:
                errors.append(f"{f.name}: {e}")
                continue
            done.append(MediaAsset.objects.create(business=b, name=f.name[:255], key=key, url=storage.public_url(key),
                                                  kind=storage.kind_of(f.name), size=f.size, content_type=f.content_type or ""))
        return JsonResponse({"assets": [media_dict(m) for m in done], "errors": errors,
                             "message": f"{len(done)} ta fayl yuklandi" + (f", {len(errors)} ta xato" if errors else "")})
    qs = b.media.annotate(used=Count("post"))
    kind = request.GET.get("kind")
    if kind in ("image", "video"):
        qs = qs.filter(kind=kind)
    q = (request.GET.get("q") or "").strip()
    if q:
        qs = qs.filter(name__icontains=q)
    items = [{**media_dict(m), "used": m.used} for m in qs]
    total = sum(m["size"] for m in items)
    return JsonResponse({"assets": items, "configured": storage.configured(), "total_size": total, "max_upload_mb": storage.MAX_UPLOAD_MB})


@api(("DELETE",))
def library_item(request, pk):
    m = get_object_or_404(MediaAsset, pk=pk)
    busy = m.post_set.filter(status__in=("pending", "approved"))
    if busy.exists():
        raise ApiError(f"Fayl rejalashtirilgan postda ishlatilmoqda: «{busy.first().title[:50]}». Avval postdan olib tashlang.", 409)
    try:
        storage.delete(m.key)
    except storage.StorageError as e:
        raise ApiError(str(e), 502)
    m.delete()
    return ok(message="Fayl o'chirildi")


# ------------------------------------------------------------------ profil
def user_dict(u):
    return {"username": u.username, "first_name": u.first_name, "last_name": u.last_name, "email": u.email,
            "date_joined": iso(u.date_joined), "last_login": iso(u.last_login)}


@api(("GET", "PUT"))
def profile(request):
    u = request.user
    if request.method == "PUT":
        d = request.data
        username = (d.get("username") or "").strip()
        if not username or len(username) > 150:
            raise ApiError("Login bo'sh bo'lmasligi kerak")
        from django.contrib.auth import get_user_model
        if get_user_model().objects.filter(username__iexact=username).exclude(pk=u.pk).exists():
            raise ApiError("Bu login band")
        email = (d.get("email") or "").strip()
        if email and "@" not in email:
            raise ApiError("Email noto'g'ri")
        u.username, u.email = username, email
        u.first_name, u.last_name = (d.get("first_name") or "").strip()[:150], (d.get("last_name") or "").strip()[:150]
        u.save()
    return JsonResponse({"profile": user_dict(u)})


@api(("POST",))
def profile_password(request):
    from django.contrib.auth import update_session_auth_hash
    u, d = request.user, request.data
    if not u.check_password(d.get("current_password") or ""):
        raise ApiError("Joriy parol noto'g'ri")
    new = d.get("new_password") or ""
    if len(new) < 8:
        raise ApiError("Yangi parol kamida 8 belgi bo'lishi kerak")
    if new != d.get("confirm_password"):
        raise ApiError("Yangi parol va tasdiqlash mos kelmadi")
    if new == d.get("current_password"):
        raise ApiError("Yangi parol joriy paroldan farq qilishi kerak")
    u.set_password(new)
    u.save()
    update_session_auth_hash(request, u)  # tizimdan chiqib ketmaslik uchun
    return ok(message="Parol o'zgartirildi")


@api(("POST",))
def post_action(request, pk, action):
    p = get_object_or_404(Post.objects.select_related("business"), pk=pk)
    msg = ""
    if action == "ai":
        if not p.business.channels.exists():
            raise ApiError("Avval kanal ulang")
        agents.write_post(p)
        msg = "AI matn va ssenariyni tayyorladi. Ko'rib chiqing va tasdiqlang."
    elif action == "submit":
        p.status, msg = "pending", "Tasdiqlashga yuborildi"
        p.save(update_fields=["status"])
    elif action == "approve":
        if not p.variants.exists():
            raise ApiError("Kamida bitta kanal tanlang va matn yozing")
        p.status = "approved"
        p.scheduled_at = p.scheduled_at or timezone.now()
        p.save(update_fields=["status", "scheduled_at"])
        msg = f"Tasdiqlandi. Chiqish vaqti: {timezone.localtime(p.scheduled_at):%d.%m.%Y %H:%M}"
    elif action in ("reject", "reopen"):
        p.status = "rejected" if action == "reject" else "draft"
        p.save(update_fields=["status"])
    elif action == "publish_now":
        if p.status != "approved":
            raise ApiError("Faqat tasdiqlangan post e'lon qilinadi")
        done = tasks.publish_post(p)
        p.refresh_from_db()
        if not done:
            return JsonResponse({"error": "E'lon qilishda xato: kanal xatolarini ko'ring", "post": post_dict(p, True)}, status=400)
        msg = "E'lon qilindi 🚀"
    else:
        raise ApiError("Noma'lum amal", 404)
    p.refresh_from_db()
    return ok(message=msg, post=post_dict(p, True))


# ------------------------------------------------------------------ AI
@api(("POST",))
def ai_plan(request, slug):
    b = biz_or_404(slug)
    d = request.data
    start = datetime.strptime(d.get("start") or timezone.localdate().isoformat(), "%Y-%m-%d").date()
    made = agents.generate_month_plan(b, start, int(d.get("days") or 30), int(d.get("per_week") or 4))
    return ok(count=len(made), message=f"{len(made)} ta g'oya yaratildi")


@api(("POST",))
def ai_series(request, slug):
    b = biz_or_404(slug)
    d = request.data
    if not (d.get("topic") or "").strip():
        raise ApiError("Seriya mavzusini kiriting")
    s, made = agents.generate_series(b, d["topic"], int(d.get("parts") or 5), every_days=int(d.get("every") or 2))
    return ok(count=len(made), message=f"«{s.name}»: {len(made)} qism yaratildi")


@api(("POST",))
def ai_insights(request, slug):
    b = biz_or_404(slug)
    since = timezone.localdate() - timedelta(days=7)
    lines = []
    for ch in b.channels.all():
        sn = list(ch.snapshots.filter(date__gte=since).order_by("date"))
        if sn:
            lines.append(f"{ch.platform}: obunachi {sn[0].metrics.get('followers', 0)} -> {sn[-1].metrics.get('followers', 0)}")
    for v in PostVariant.objects.filter(post__business=b, status="published", published_at__date__gte=since):
        pm = v.metrics.order_by("-captured_at").first()
        if pm:
            lines.append(f"{v.post.title[:60]} [{v.channel.platform}] {pm.metrics}")
    return ok(text=agents.weekly_insights(b, "\n".join(lines) or "Ma'lumot hali yo'q"))


@api(("GET",))
def series_list(request, slug):
    b = biz_or_404(slug)
    return JsonResponse({"series": [{"id": s.id, "name": s.name, "concept": s.concept, "total_parts": s.total_parts,
                                     "posts": [{"id": p.id, "part_no": p.part_no, "title": p.title, "status": p.status,
                                                "kind": p.kind} for p in s.posts.order_by("part_no")]}
                                    for s in b.series.all()]})


# ------------------------------------------------------------------ statistika
@api(("GET",))
def stats(request, slug):
    b = biz_or_404(slug)
    days = int(request.GET.get("days", 30))
    since = timezone.localdate() - timedelta(days=days)
    summary, per_channel, totals = [], [], defaultdict(int)
    for ch in b.channels.all():
        sn = list(ch.snapshots.filter(date__gte=since).order_by("date"))
        first = sn[0].metrics.get("followers", 0) if sn else 0
        last = sn[-1].metrics if sn else {}
        summary.append({**channel_dict(ch), "delta": (last.get("followers", 0) - first) if sn else 0,
                        "extra": {k: v for k, v in last.items() if k != "followers"}})
        per_channel.append({"channel_id": ch.id, "platform": ch.platform, "name": ch.name,
                            "points": [{"date": s.date.isoformat(), "followers": s.metrics.get("followers", 0)} for s in sn]})
        for s in sn:
            totals[s.date.isoformat()] += s.metrics.get("followers", 0)
    perf = []
    for v in PostVariant.objects.filter(post__business=b, status="published").select_related("post", "channel").order_by("-published_at")[:40]:
        pm = v.metrics.order_by("-captured_at").first()
        perf.append({"title": v.post.title, "platform": v.channel.platform, "kind": v.post.kind, "url": v.external_url,
                     "published_at": iso(v.published_at), "metrics": pm.metrics if pm else {}})
    kinds = list(b.posts.filter(status="published").values("kind").annotate(n=Count("id")))
    sentiment = {s: Comment.objects.filter(channel__business=b, sentiment=s).count() for s in ("positive", "neutral", "negative")}
    return JsonResponse({"days": days, "summary": summary, "channels": per_channel,
                         "total_series": [{"date": d, "followers": n} for d, n in sorted(totals.items())],
                         "perf": perf, "kinds": kinds, "sentiment": sentiment,
                         "published_total": b.posts.filter(status="published").count()})


@api(("POST",))
def stats_refresh(request, slug):
    biz_or_404(slug)
    tasks.collect_stats()
    return ok(message="Statistika yangilandi")


# ------------------------------------------------------------------ kanallar
CRED_KEYS = {"telegram": "bot_token", "instagram": "access_token", "facebook": "page_token",
             "youtube": "refresh_token", "tiktok": "access_token", "linkedin": "access_token"}


@api(("GET", "POST"))
def channels(request, slug):
    b = biz_or_404(slug)
    if request.method == "POST":
        d = request.data
        plat = d.get("platform")
        if plat not in CRED_KEYS:
            raise ApiError("Platforma noto'g'ri")
        token = (d.get("token") or "").strip()
        cred = {CRED_KEYS[plat]: token} if token else {}
        if plat == "telegram" and d.get("discussion"):
            cred["discussion_chat_id"] = str(d["discussion"]).strip()
        ext, info = (d.get("external_id") or "").strip(), ""
        if plat == "instagram" and token and not ext:
            found = discover(token)
            if found:
                ext, info = found[0]["ig_id"], f"Instagram topildi: @{found[0]['username']}"
        ch = Channel(business=b, platform=plat, name=d.get("name") or plat, external_id=ext)
        ch.credentials = cred
        ch.save()
        return ok(channel=channel_dict(ch), message=info or "Kanal qo'shildi")
    return JsonResponse({"channels": [channel_dict(c) for c in b.channels.all()]})


@api(("POST", "DELETE"))
def channel_action(request, pk, action=None):
    ch = get_object_or_404(Channel, pk=pk)
    if request.method == "DELETE" or action == "delete":
        ch.delete()
        return ok()
    if action == "test":
        try:
            m = get_adapter(ch).fetch_metrics()
        except Exception as e:  # noqa: BLE001
            ch.last_error = str(e)[:500]
            ch.save(update_fields=["last_error"])
            raise ApiError(str(e))
        ch.last_error, ch.followers = "", m.get("followers", ch.followers)
        ch.save(update_fields=["last_error", "followers"])
        return ok(message=f"Ulanish ishlayapti ✓ ({m.get('followers', 0)} obunachi)", channel=channel_dict(ch))
    raise ApiError("Noma'lum amal", 404)


def google_start(request, pk):
    if not request.user.is_authenticated:
        return redirect("/login")
    ch = get_object_or_404(Channel, pk=pk)
    cid = ch.credentials.get("client_id") or settings.GOOGLE_CLIENT_ID
    if not cid:
        return redirect(f"/b/{ch.business.slug}/channels?google=nokey")
    from urllib.parse import urlencode
    scopes = " ".join(["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.force-ssl",
                       "https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/yt-analytics.readonly"])
    q = urlencode({"client_id": cid, "redirect_uri": request.build_absolute_uri(reverse("google_callback")),
                   "response_type": "code", "scope": scopes, "access_type": "offline", "prompt": "consent", "state": str(ch.id)})
    return redirect(f"https://accounts.google.com/o/oauth2/v2/auth?{q}")


def google_callback(request):
    if not request.user.is_authenticated:
        return redirect("/login")
    ch = get_object_or_404(Channel, pk=request.GET.get("state", 0))
    code, slug = request.GET.get("code"), ch.business.slug
    if not code:
        return redirect(f"/b/{slug}/channels?google=denied")
    r = requests.post("https://oauth2.googleapis.com/token", data={
        "code": code, "client_id": ch.credentials.get("client_id") or settings.GOOGLE_CLIENT_ID,
        "client_secret": ch.credentials.get("client_secret") or settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": request.build_absolute_uri(reverse("google_callback")), "grant_type": "authorization_code"}, timeout=30)
    data = r.json()
    if "refresh_token" in data:
        ch.update_credentials(refresh_token=data["refresh_token"])
        return redirect(f"/b/{slug}/channels?google=ok")
    return redirect(f"/b/{slug}/channels?google=error")


# ------------------------------------------------------------------ izohlar
@api(("GET",))
def comments(request, slug):
    b = biz_or_404(slug)
    flt = request.GET.get("f", "suggested")
    qs = Comment.objects.filter(channel__business=b).select_related("channel", "variant__post")
    qs = {"suggested": qs.filter(reply_status="suggested"), "leads": qs.filter(is_lead=True),
          "questions": qs.filter(is_question=True), "negative": qs.filter(sentiment="negative")}.get(flt, qs)
    allc = Comment.objects.filter(channel__business=b)
    return JsonResponse({
        "comments": [comment_dict(c) for c in qs[:150]],
        "counts": {"suggested": allc.filter(reply_status="suggested").count(), "leads": allc.filter(is_lead=True).count(),
                   "questions": allc.filter(is_question=True).count(), "negative": allc.filter(sentiment="negative").count(),
                   "all": allc.count()},
        "sentiment": {s: allc.filter(sentiment=s).count() for s in ("positive", "neutral", "negative")},
        "digests": [{"text": d.text, "created_at": iso(d.created_at)} for d in b.digests.all()[:5]]})


@api(("POST",))
def comments_action(request, slug):
    b = biz_or_404(slug)
    d, act = request.data, request.data.get("action")
    if act == "sync":
        n = sum(tasks.sync_comments(c) for c in b.channels.all())
        return ok(message=f"{n} ta yangi izoh")
    if act == "analyze":
        return ok(message=f"{tasks.analyze_new_comments(b)} ta izoh tahlil qilindi, javob qoralamalari tayyor")
    if act == "digest":
        cs = Comment.objects.filter(channel__business=b).select_related("channel")[:80]
        text = agents.comment_digest(b, cs)
        if not text:
            raise ApiError("Hozircha izoh yo'q")
        CommentDigest.objects.create(business=b, text=text)
        sent, info = notify.send_verbose(f"💬 {b.name} — izohlar xulosasi\n\n{text}", b.report_chat_id or None)
        return ok(message="Xulosa tayyor" + (" va Telegramga yuborildi" if sent else f" (Telegram: {info})"))
    c = get_object_or_404(Comment, pk=d.get("id"), channel__business=b)
    if act == "skip":
        c.reply_status = "skipped"
        c.save(update_fields=["reply_status"])
    elif act == "regen":
        agents.suggest_reply(c)
    elif act == "send":
        text = (d.get("reply") or "").strip()
        if not text:
            raise ApiError("Javob matni bo'sh")
        get_adapter(c.channel).reply(c, text)
        c.reply_text, c.reply_status = text, "sent"
        c.save(update_fields=["reply_text", "reply_status"])
    else:
        raise ApiError("Noma'lum amal", 404)
    return ok(comment=comment_dict(c))


# ------------------------------------------------------------------ umumiy sozlamalar
def _settings_payload(request):
    cur = envconf.read_env()
    order = envconf.ai_order(cur)
    groups = []
    for g in envconf.GROUPS:
        fields = []
        for f in g["fields"]:
            val = cur.get(f["key"], "")
            fields.append({**f, "value": "" if f["kind"] == "secret" else val, "masked": envconf.mask(val), "is_set": bool(val)})
        ready = all(cur.get(k) for k in g.get("required", []))
        groups.append({**g, "fields": fields, "ready": ready, "test": [{"action": a_, "label": l} for a_, l in g["test"]]})
    return {"groups": groups, "env_path": str(envconf.ENV_PATH), "env_exists": envconf.ENV_PATH.exists(),
            "redirect_uri": request.build_absolute_uri("/oauth/google/callback/"),
            "ai_cards": [{**{k: v for k, v in m.items() if k not in ("key", "model")},
                          "key_field": m["key"], "model_field": m["model"],
                          "is_set": bool(cur.get(m["key"])), "masked": envconf.mask(cur.get(m["key"], "")),
                          "model_value": cur.get(m["model"], ""),
                          "prio": (order.index(m["id"]) + 1) if m["id"] in order else ""}
                         for m in envconf.AI_META]}


@api(("GET", "POST"))
def app_settings(request):
    if request.method == "GET":
        return JsonResponse(_settings_payload(request))
    d = request.data
    values, clear = d.get("values", {}), set(d.get("clear", []))
    updates = {}
    for f in envconf.all_fields():
        k = f["key"]
        if f["kind"] == "secret":
            if k in clear:
                updates[k] = ""
            elif str(values.get(k, "")).strip():
                updates[k] = str(values[k]).strip()
        elif k in values:
            updates[k] = str(values[k]).strip()
    if isinstance(d.get("prios"), dict):
        prios = []
        for i, p in enumerate(envconf.AI_PROVIDER_ORDER):
            raw = str(d["prios"].get(p, "")).strip()
            if raw.isdigit() and int(raw) > 0:
                prios.append((int(raw), i, p))
        updates["AI_PROVIDERS"] = ",".join(p for _, _, p in sorted(prios))
    url = updates.get("PUBLIC_BASE_URL", "")
    if url and not url.startswith(("http://", "https://")):
        raise ApiError("Ochiq manzil http:// yoki https:// bilan boshlanishi kerak")
    if updates.get("R2_CLEANUP_DAYS", "0") and not updates.get("R2_CLEANUP_DAYS", "0").isdigit():
        raise ApiError("Avtomatik tozalash kun soni raqam bo'lishi kerak (0 = o'chirilmaydi)")
    if updates.get("R2_PUBLIC_URL") and not updates["R2_PUBLIC_URL"].startswith(("http://", "https://")):
        raise ApiError("R2 ochiq manzili http:// yoki https:// bilan boshlanishi kerak")
    if updates.get("R2_PUBLIC_URL"):
        updates["R2_PUBLIC_URL"] = updates["R2_PUBLIC_URL"].rstrip("/")
    envconf.write_env(updates)

    action, result = d.get("action", "save"), {"level": "success", "message": "Saqlandi. O'zgarishlar darhol kuchga kirdi."}
    if action.startswith("test_ai_"):
        name = action[len("test_ai_"):]
        try:
            out = ai_providers.PROVIDERS[name]("Sen yordamchisan.", "Faqat bitta so'z yoz: ok", False)
            result["message"] = f"{envconf.AI_LABELS.get(name, name)} ishlayapti ✓ (javob: {out.strip()[:40]})"
        except (ai_providers.AIError, requests.RequestException, KeyError) as e:
            result = {"level": "error", "message": f"{envconf.AI_LABELS.get(name, name)}: {e}"}
    elif action == "test_r2":
        try:
            result = {"level": "success", "message": storage.check()}
        except storage.StorageError as e:
            result = {"level": "error", "message": str(e)}
    elif action == "test_notify":
        sent, info = notify.send_verbose("✅ SMM Agent: test xabar. Hisobot boti ishlayapti.")
        result = {"level": "success" if sent else "error", "message": f"Telegram: {info}"}
    elif action == "test_url":
        base = settings.PUBLIC_BASE_URL
        try:
            r = requests.get(base + "/api/session/", timeout=10)
            result = ({"level": "success", "message": f"Manzil ochiq va ishlayapti ✓ ({base})"} if r.status_code < 400
                      else {"level": "error", "message": f"Manzil javob berdi, lekin HTTP {r.status_code}"})
        except requests.RequestException as e:
            result = {"level": "error", "message": f"Manzilga ulanib bo'lmadi: {e}"}
    return JsonResponse({**result, **_settings_payload(request)})


# ------------------------------------------------------------------ React ilovani berish
def spa(request, path=""):
    index = settings.BASE_DIR / "frontend" / "dist" / "index.html"
    if not index.exists():
        return HttpResponse("Frontend yig'ilmagan. `frontend` papkasida: npm install && npm run build",
                            status=503, content_type="text/plain; charset=utf-8")
    return HttpResponse(index.read_text(encoding="utf-8"))
