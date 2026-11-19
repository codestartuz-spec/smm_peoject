"""AI agent: kontent reja, seriya, post/ssenariy yozish, izoh tahlili, javoblar. Hammasi o'zbek tilida,
AI hech narsani o'zi e'lon qilmaydi - faqat taklif (qoralama) yaratadi."""
import json
from datetime import datetime, timedelta

from django.utils import timezone

from ..models import AIRun, Channel, Comment, Pillar, Post, PostVariant, Series
from .providers import AIError, generate, parse_json

SYSTEM = (
    "Sen tajribali SMM mutaxassisi va kontent yozuvchisan. Barcha matnlarni FAQAT o'zbek tilida (lotin yozuvi) yoz. "
    "Tabiiy, jonli, tushunarli o'zbekcha: tarjima hidi bo'lmasin. Aniq, foydali, takrorlanmaydigan g'oyalar ber. "
    "Qo'pol so'z, bo'rttirma va yolg'on va'dalar yo'q."
)

KIND_HELP = {
    "post": "rasmli post: 1 ta rasm uchun vizual tavsif (image_prompt) va matn",
    "carousel": "karusel: 5-9 ta slayd, har slaydda sarlavha, qisqa matn va vizual tavsif; 1-slayd ilmoq (hook), oxirgi slayd CTA",
    "reel": "30-45 soniyalik vertikal video: sahnalar (vaqt, kadr/vizual, ovoz matni, ekrandagi yozuv), 3 soniyalik hook, oxirida CTA",
    "video": "uzun video: reja (bo'limlar, vaqt), kirish hook, asosiy qismlar, sahnalar, thumbnail g'oyasi, sarlavha variantlari",
    "story": "story: 3-6 kadr, har kadrda vizual, matn, stiker/so'rovnoma g'oyasi, oxirida harakatga chaqiriq",
}


def brand_context(b):
    pillars = ", ".join(f"{p.name} ({p.share}%)" for p in b.pillars.all()) or "belgilanmagan"
    return (
        f"BIZNES: {b.name}\nSoha: {b.industry}\nHaqida: {b.description}\nAuditoriya: {b.audience}\n"
        f"Ohang: {b.tone}\nAfzalliklari: {b.usp}\nKontent ustunlari: {pillars}\nMaqsadlar: {b.goals}\n"
        f"Ishlatilmaydigan so'zlar: {b.forbidden_words or 'yo`q'}\nDoimiy hashtaglar: {b.hashtags}"
    )


def _log(business, kind, provider, result, ok=True):
    AIRun.objects.create(business=business, kind=kind, provider=provider, result=str(result)[:20000], ok=ok)


def _run_json(business, kind, prompt):
    text, prov = generate(SYSTEM, prompt, as_json=True)
    data = parse_json(text)
    _log(business, kind, prov, text)
    return data


def _channels_desc(business):
    return ", ".join(sorted({c.platform for c in business.channels.all()})) or "telegram, instagram, youtube"


# ---------------------------------------------------------------- oylik reja
def generate_month_plan(business, start, days=30, per_week=4):
    """G'oyalar ro'yxatini yaratadi -> Post(status='idea'). Tasdiq/rad qilish foydalanuvchida."""
    recent = list(business.posts.order_by("-created_at").values_list("title", flat=True)[:25])
    prompt = f"""{brand_context(business)}

Platformalar: {_channels_desc(business)}
Boshlanish sanasi: {start:%Y-%m-%d}, davr: {days} kun, haftasiga ~{per_week} ta kontent.
Oxirgi mavzular (takrorlama): {recent}

Kontent ustunlari ulushiga rioya qilib, formatlarni (post, carousel, reel, story, video) aralashtirib reja tuz.
Mavzular bir-biriga bog'lanib borsin, haftada kamida bitta reel/video bo'lsin.
FAQAT JSON qaytar: {{"items":[{{"date":"YYYY-MM-DD","time":"HH:MM","pillar":"ustun nomi","kind":"post|carousel|reel|video|story","title":"g'oya sarlavhasi","brief":"2-3 jumla mazmun"}}]}}"""
    data = _run_json(business, "month_plan", prompt)
    pillars = {p.name.lower(): p for p in business.pillars.all()}
    made = []
    tz = timezone.get_current_timezone()
    for it in data.get("items", []):
        try:
            when = datetime.strptime(f"{it['date']} {it.get('time', '12:00')}", "%Y-%m-%d %H:%M")
            when = timezone.make_aware(when, tz)
        except (ValueError, KeyError):
            when = None
        kind = it.get("kind") if it.get("kind") in KIND_HELP else "post"
        made.append(Post.objects.create(
            business=business, pillar=pillars.get(str(it.get("pillar", "")).lower()), title=str(it.get("title", ""))[:250],
            kind=kind, brief=it.get("brief", ""), scheduled_at=when, status="idea", ai_generated=True))
    return made


# ---------------------------------------------------------------- seriya
def generate_series(business, topic, parts=5, start=None, every_days=2):
    """Ketma-ket davom etuvchi seriya: har qism oldingisiga bog'lanadi."""
    prompt = f"""{brand_context(business)}

Mavzu: {topic}
{parts} qismli SERIYA yarat. Qismlar ketma-ket o'qilganda/ko'rilganda yaxlit hikoya bo'lsin:
har qism oldingisiga ishora qilsin ("o'tgan qismda..."), oxirida keyingisiga qiziqish uyg'otsin (cliffhanger), oxirgi qismda xulosa va CTA bo'lsin.
Formatlarni aralashtir (reel, carousel, post, story).
FAQAT JSON: {{"name":"seriya nomi","concept":"umumiy g'oya","parts":[{{"no":1,"kind":"reel|carousel|post|story|video","title":"...","brief":"mazmun","hook":"ilmoq","teaser":"keyingi qismga ishora"}}]}}"""
    data = _run_json(business, "series", prompt)
    s = Series.objects.create(business=business, name=data.get("name", topic)[:150], concept=data.get("concept", ""),
                              total_parts=len(data.get("parts", [])))
    start = start or (timezone.now() + timedelta(days=1)).replace(hour=12, minute=0, second=0, microsecond=0)
    posts = []
    for i, p in enumerate(data.get("parts", [])):
        kind = p.get("kind") if p.get("kind") in KIND_HELP else "post"
        posts.append(Post.objects.create(
            business=business, series=s, part_no=p.get("no", i + 1), kind=kind, status="idea", ai_generated=True,
            title=f"{s.name} — {p.get('no', i + 1)}-qism: {p.get('title', '')}"[:250],
            brief=p.get("brief", ""), script={"hook": p.get("hook", ""), "teaser": p.get("teaser", "")},
            scheduled_at=start + timedelta(days=every_days * i)))
    return s, posts


# ---------------------------------------------------------------- to'liq post + ssenariy
def write_post(post):
    """Post uchun: har kanalga caption+hashtag va format bo'yicha batafsil ssenariy/dizayn rejasi."""
    b = post.business
    channels = list(b.channels.filter(status="active"))
    series_ctx = ""
    if post.series:
        prev = list(post.series.posts.exclude(pk=post.pk).order_by("part_no").values("part_no", "title", "brief"))
        series_ctx = f"\nBu seriyaning bir qismi. Seriya: {post.series.name}. G'oya: {post.series.concept}. Boshqa qismlar: {prev}. Ketma-ketlikka rioya qil."
    prompt = f"""{brand_context(b)}

KONTENT: {post.title}
Format: {post.get_kind_display()}  -> {KIND_HELP.get(post.kind, '')}
Qisqacha: {post.brief}{series_ctx}
Kanallar: {[c.platform for c in channels]}

Har kanal uchun platformaga mos caption yoz (Telegram: batafsilroq; Instagram: qisqa, ilmoq bilan, hashtaglar alohida; YouTube: tavsif; Facebook: o'rtacha).
Pastdagi 'script' ichida format uchun TO'LIQ ishlab chiqarish rejasini ber (xarajat kam bo'lishi uchun oddiy telefon bilan suratga olish va bepul Canva/CapCut'da yig'ish mumkin bo'lsin).
FAQAT JSON:
{{"captions":{{"telegram":"...","instagram":"...","youtube":"...","facebook":"..."}},
 "hashtags":["#..."],
 "script":{{"hook":"...","image_prompt":"post uchun vizual tavsif","scenes":[{{"time":"0-3s","visual":"...","voiceover":"...","on_screen_text":"..."}}],
 "slides":[{{"title":"...","text":"...","visual":"..."}}],"frames":[{{"visual":"...","text":"...","sticker":"..."}}],
 "cta":"...","music":"...","thumbnail":"...","shooting_tips":"..."}}}}
Faqat tanlangan formatga tegishli bo'limlarni to'ldir, qolganlarini bo'sh qoldir."""
    data = _run_json(b, "write_post", prompt)
    post.script = {**(post.script or {}), **data.get("script", {})}
    if post.status == "idea":
        post.status = "draft"
    post.ai_generated = True
    post.save()
    tags = " ".join(data.get("hashtags", [])) or b.hashtags
    if b.hashtags and b.hashtags not in tags:
        tags = (tags + " " + b.hashtags).strip()
    caps = data.get("captions", {})
    for c in channels:
        v, _ = PostVariant.objects.get_or_create(post=post, channel=c)
        if v.status != "published":
            v.caption = caps.get(c.platform) or caps.get("instagram") or post.title
            v.hashtags = tags if c.platform in ("instagram", "facebook", "youtube", "tiktok") else ""
            v.save()
    return post


# ---------------------------------------------------------------- izohlar
def analyze_comments(business, comments):
    """Izohlarni tahlil qiladi (sentiment, mavzu, savol, lead) va javob qoralamasini yozadi."""
    comments = list(comments)[:40]
    if not comments:
        return 0
    items = [{"id": c.id, "author": c.author, "text": c.text[:500]} for c in comments]
    prompt = f"""{brand_context(business)}

Quyidagi izohlarni tahlil qil va har biriga do'stona, qisqa, brend ohangidagi javob qoralamasini yoz (spam/haqorat bo'lsa javob bo'sh).
Izoh narx, buyurtma, hamkorlik haqida so'rasa is_lead=true.
Izohlar: {json.dumps(items, ensure_ascii=False)}
FAQAT JSON: {{"results":[{{"id":1,"sentiment":"positive|neutral|negative","topic":"1-3 so'z","is_question":false,"is_lead":false,"reply":"..."}}]}}"""
    data = _run_json(business, "comments", prompt)
    by_id = {c.id: c for c in comments}
    n = 0
    for r in data.get("results", []):
        c = by_id.get(r.get("id"))
        if not c:
            continue
        c.sentiment = r.get("sentiment", "neutral") if r.get("sentiment") in ("positive", "neutral", "negative") else "neutral"
        c.topic = str(r.get("topic", ""))[:120]
        c.is_question = bool(r.get("is_question"))
        c.is_lead = bool(r.get("is_lead"))
        c.analyzed = True
        if r.get("reply") and c.reply_status == "none":
            c.suggested_reply = r["reply"]
            c.reply_status = "suggested"
        c.save()
        n += 1
    return n


def comment_digest(business, comments):
    """Biznes uchun izohlar bo'yicha qisqa xulosa (Telegramga yuboriladi)."""
    comments = list(comments)[:80]
    if not comments:
        return ""
    rows = [{"platform": c.channel.platform, "sentiment": c.sentiment, "topic": c.topic, "q": c.is_question,
             "lead": c.is_lead, "text": c.text[:200]} for c in comments]
    prompt = f"""{brand_context(business)}

So'nggi izohlar: {json.dumps(rows, ensure_ascii=False)}
Telegram uchun qisqa o'zbekcha xulosa yoz (maks. 900 belgi): umumiy kayfiyat, eng ko'p mavzular, javob kutayotgan savollar, lead bo'lishi mumkin izohlar, 2-3 amaliy tavsiya. Oddiy matn, markdownsiz.
JSON: {{"summary":"..."}}"""
    data = _run_json(business, "digest", prompt)
    return data.get("summary", "")


def suggest_reply(comment):
    b = comment.channel.business
    prompt = f"""{brand_context(b)}
Izoh ({comment.channel.platform}, {comment.author}): {comment.text}
Qisqa, do'stona javob yoz. JSON: {{"reply":"..."}}"""
    data = _run_json(b, "reply", prompt)
    comment.suggested_reply = data.get("reply", "")
    comment.reply_status = "suggested"
    comment.save()
    return comment


# ---------------------------------------------------------------- haftalik tahlil
def weekly_insights(business, stats_text):
    prompt = f"""{brand_context(business)}

Oxirgi hafta statistikasi:
{stats_text}
Nima yaxshi ishladi, nima ishlamadi, keyingi hafta uchun 5 ta aniq tavsiya va 3 ta yangi g'oya ber. Qisqa, o'zbekcha.
JSON: {{"text":"..."}}"""
    return _run_json(business, "insights", prompt).get("text", "")
