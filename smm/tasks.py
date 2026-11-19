"""Fon vazifalari (scheduler chaqiradi, shuningdek veb-tugmalardan ham ishlatiladi)."""
import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from . import notify
from .ai import agents
from .ai.providers import AIError
from .models import Business, Channel, Comment, CommentDigest, MediaAsset, MetricSnapshot, Post, PostMetric, PostVariant
from .platforms import PlatformError, get_adapter

log = logging.getLogger("smm")


def publish_variant(variant):
    ch = variant.channel
    try:
        res = get_adapter(ch).publish(variant)
        variant.status, variant.error = "published", ""
        variant.external_id, variant.external_url = res.get("external_id", ""), res.get("url", "")
        variant.published_at = timezone.now()
    except Exception as e:  # noqa: BLE001 - xatoni foydalanuvchiga ko'rsatamiz
        variant.status, variant.error = "failed", str(e)[:1500]
        ch.last_error = str(e)[:500]
        ch.save(update_fields=["last_error"])
    variant.save()
    return variant


def publish_post(post):
    """Tasdiqlangan postni barcha kanallariga yuboradi."""
    variants = post.variants.exclude(status="published").select_related("channel")
    for v in variants:
        publish_variant(v)
    all_v = list(post.variants.all())
    ok = all_v and all(v.status == "published" for v in all_v)
    post.status = "published" if ok else "failed"
    post.save(update_fields=["status"])
    icon = "✅" if ok else "⚠️"
    lines = [f"{icon} {post.business.name}: «{post.title}»"]
    for v in all_v:
        lines.append(f"• {v.channel.get_platform_display()}: " + (v.external_url or "yuborildi") if v.status == "published" else f"• {v.channel.get_platform_display()}: XATO — {v.error[:150]}")
    notify.send("\n".join(lines), post.business.report_chat_id or None)
    return ok


def publish_due():
    """Faqat TASDIQLANGAN (approved) va vaqti kelgan postlar e'lon qilinadi."""
    now = timezone.now()
    for p in Post.objects.filter(status="approved", scheduled_at__lte=now):
        publish_post(p)


def collect_stats():
    today = timezone.localdate()
    for ch in Channel.objects.filter(status="active", business__is_active=True):
        try:
            m = get_adapter(ch).fetch_metrics()
        except Exception as e:  # noqa: BLE001
            ch.last_error = str(e)[:500]
            ch.save(update_fields=["last_error"])
            continue
        MetricSnapshot.objects.update_or_create(channel=ch, date=today, defaults={"metrics": m})
        ch.followers = m.get("followers", ch.followers)
        ch.last_error = ""
        ch.save(update_fields=["followers", "last_error"])
    since = timezone.now() - timedelta(days=30)
    for v in PostVariant.objects.filter(status="published", published_at__gte=since).select_related("channel"):
        try:
            m = get_adapter(v.channel).fetch_post_metrics(v)
        except Exception:  # noqa: BLE001
            continue
        if m:
            PostMetric.objects.create(variant=v, metrics=m)


def sync_comments(channel=None):
    qs = [channel] if channel else Channel.objects.filter(status="active", business__is_active=True)
    new = 0
    for ch in qs:
        try:
            items = get_adapter(ch).fetch_comments()
        except Exception as e:  # noqa: BLE001
            ch.last_error = str(e)[:500]
            ch.save(update_fields=["last_error"])
            continue
        for it in items:
            variant = PostVariant.objects.filter(channel=ch, external_id=it.get("post_external_id", "")).first() if it.get("post_external_id") else None
            _, created = Comment.objects.get_or_create(
                channel=ch, external_id=it["external_id"],
                defaults={"variant": variant, "parent_ref": it.get("parent_ref", ""), "author": it.get("author", ""),
                          "text": it["text"], "posted_at": it.get("posted_at") or timezone.now()})
            new += created
    return new


def analyze_new_comments(business):
    qs = Comment.objects.filter(channel__business=business, analyzed=False)[:40]
    try:
        return agents.analyze_comments(business, qs)
    except AIError as e:
        log.warning("comment analysis: %s", e)
        return 0


def daily_comment_digest():
    """Har biznes uchun alohida izohlar xulosasini Telegram botga yuboradi."""
    for b in Business.objects.filter(is_active=True):
        analyze_new_comments(b)
        since = timezone.now() - timedelta(days=1)
        cs = Comment.objects.filter(channel__business=b, posted_at__gte=since).select_related("channel")
        if not cs.exists():
            continue
        try:
            text = agents.comment_digest(b, cs)
        except AIError as e:
            log.warning("digest: %s", e)
            continue
        if text:
            CommentDigest.objects.create(business=b, text=text)
            pending = Comment.objects.filter(channel__business=b, reply_status="suggested").count()
            notify.send(f"💬 {b.name} — izohlar xulosasi ({cs.count()} ta yangi)\n\n{text}\n\nJavob kutayotgan qoralamalar: {pending} ta\n{settings.PUBLIC_BASE_URL}/b/{b.slug}/comments/",
                        b.report_chat_id or None)


def morning_reminder():
    today = timezone.localdate()
    for b in Business.objects.filter(is_active=True):
        pending = b.posts.filter(status="pending").count()
        today_posts = b.posts.filter(scheduled_at__date=today).exclude(status="published").count()
        if pending or today_posts:
            notify.send(f"🌅 {b.name}: bugun {today_posts} ta post rejada, tasdiq kutayotgan: {pending} ta.\n{settings.PUBLIC_BASE_URL}/b/{b.slug}/",
                        b.report_chat_id or None)


def weekly_report():
    since = timezone.localdate() - timedelta(days=7)
    for b in Business.objects.filter(is_active=True):
        lines = []
        for ch in b.channels.all():
            snaps = list(ch.snapshots.filter(date__gte=since).order_by("date"))
            if snaps:
                f0, f1 = snaps[0].metrics.get("followers", 0), snaps[-1].metrics.get("followers", 0)
                lines.append(f"{ch.get_platform_display()}: obunachi {f0} -> {f1} ({f1 - f0:+d})")
        posts = b.posts.filter(status="published", variants__published_at__date__gte=since).distinct()
        lines.append(f"E'lon qilingan postlar: {posts.count()}")
        for v in PostVariant.objects.filter(post__business=b, status="published", published_at__date__gte=since):
            pm = v.metrics.order_by("-captured_at").first()
            if pm:
                lines.append(f"- {v.post.title[:50]} [{v.channel.platform}] {pm.metrics}")
        try:
            txt = agents.weekly_insights(b, "\n".join(lines))
        except AIError:
            txt = "\n".join(lines)
        notify.send(f"📊 {b.name} — haftalik hisobot\n\n{txt}", b.report_chat_id or None)


def cleanup_media():
    """R2_CLEANUP_DAYS > 0 bo'lsa: faqat nashr qilingan postlarda ishlatilgan eski fayllarni R2 dan o'chiradi."""
    from . import storage
    days = int(settings.R2_CLEANUP_DAYS) if str(settings.R2_CLEANUP_DAYS).isdigit() else 0
    if not days or not storage.configured():
        return 0
    limit, n = timezone.now() - timedelta(days=days), 0
    for m in MediaAsset.objects.filter(post__isnull=False).distinct():
        posts = list(m.post_set.all())
        if any(p.status != "published" for p in posts):
            continue
        last = PostVariant.objects.filter(post__in=posts, status="published").order_by("-published_at").values_list("published_at", flat=True).first()
        if last and last < limit:
            try:
                storage.delete(m.key)
                m.delete()
                n += 1
            except storage.StorageError:
                logging.getLogger("smm").warning("R2 tozalash xatosi: %s", m.key)
    return n
