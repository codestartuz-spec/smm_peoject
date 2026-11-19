""".env faylini veb-sahifadan o'qish/tahrirlash va sozlamalarni qayta ishga tushirmasdan yangilash."""
import re
import shutil
from pathlib import Path

from django.conf import settings
from dotenv import dotenv_values

ENV_PATH = Path(settings.BASE_DIR) / ".env"
EXAMPLE_PATH = Path(settings.BASE_DIR) / ".env.example"

DEFAULT_AI = ["gemini", "groq", "openrouter"]  # faqat bepullari standart yoqilgan

# Har bir AI provayder — alohida karta (kalit, model, yo'riqnoma)
AI_META = [
    {"id": "gemini", "label": "Google Gemini", "free": True, "key": "GEMINI_API_KEY", "model": "GEMINI_MODEL",
     "models": ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"],
     "url": "https://aistudio.google.com/apikey", "url_label": "Google AI Studio",
     "price": "Bepul (kunlik/daqiqalik limit bor). Karta shart emas.",
     "steps": ["aistudio.google.com/apikey sahifasiga Google akkauntingiz bilan kiring.",
               "«Create API key» tugmasini bosing (yangi yoki mavjud Google Cloud loyihasini tanlang).",
               "Hosil bo'lgan kalit (AIza... bilan boshlanadi) ni nusxalab, quyidagi maydonga joylang.",
               "«Saqlash va tekshirish» ni bosing."]},
    {"id": "groq", "label": "Groq", "free": True, "key": "GROQ_API_KEY", "model": "GROQ_MODEL",
     "models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
     "url": "https://console.groq.com/keys", "url_label": "Groq Console",
     "price": "Bepul tarif (so'rov limiti bor). Karta shart emas.",
     "steps": ["console.groq.com ga Google yoki email bilan ro'yxatdan o'ting.",
               "«API Keys» bo'limida «Create API Key» ni bosing va nom bering.",
               "Kalit (gsk_... bilan boshlanadi) faqat bir marta ko'rsatiladi — nusxalab joylang.",
               "«Saqlash va tekshirish» ni bosing."]},
    {"id": "openrouter", "label": "OpenRouter", "free": True, "key": "OPENROUTER_API_KEY", "model": "OPENROUTER_MODEL",
     "models": ["meta-llama/llama-3.3-70b-instruct:free", "google/gemini-2.0-flash-exp:free"],
     "url": "https://openrouter.ai/keys", "url_label": "OpenRouter Keys",
     "price": "Faqat nomi «:free» bilan tugaydigan modellar bepul (kunlik limit bilan). Boshqa modellar pullik.",
     "steps": ["openrouter.ai ga ro'yxatdan o'ting.",
               "Keys bo'limida «Create Key» ni bosing (sk-or-... ko'rinishida).",
               "Model nomi oxirida «:free» bo'lishiga ishonch hosil qiling, aks holda hisobingizdan pul yechiladi.",
               "Kalitni joylab, «Saqlash va tekshirish» ni bosing."]},
    {"id": "anthropic", "label": "Claude (Anthropic)", "free": False, "key": "ANTHROPIC_API_KEY", "model": "ANTHROPIC_MODEL",
     "models": ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
     "url": "https://console.anthropic.com/settings/keys", "url_label": "Anthropic Console",
     "price": "PULLIK: oldindan kredit sotib olinadi (bepul tarif yo'q). Eng arzoni — Haiku, eng sifatlisi — Opus. Claude.ai obunasi (Pro/Max) API uchun yaramaydi, u alohida.",
     "steps": ["console.anthropic.com ga kiring va ro'yxatdan o'ting (API akkaunti claude.ai dan alohida).",
               "Settings → Billing bo'limida kredit qo'shing (oldindan to'lov, kichik summadan boshlash mumkin). Limits bo'limida oylik xarajat limitini qo'ying.",
               "Settings → API keys → «Create Key» ni bosing va nom bering.",
               "Kalit (sk-ant-... bilan boshlanadi) faqat bir marta ko'rsatiladi — nusxalab joylang.",
               "Matn uchun arzon va tez «claude-haiku-5-5» dan boshlang, «Saqlash va tekshirish» ni bosing."]},
    {"id": "openai", "label": "OpenAI (ChatGPT API)", "free": False, "key": "OPENAI_API_KEY", "model": "OPENAI_MODEL",
     "models": ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"],
     "url": "https://platform.openai.com/api-keys", "url_label": "OpenAI Platform",
     "price": "PULLIK: oldindan kredit kerak. ChatGPT Plus obunasi API uchun yaramaydi, u alohida. «mini» modellar eng arzon.",
     "steps": ["platform.openai.com ga kiring va ro'yxatdan o'ting.",
               "Settings → Billing bo'limida to'lov usulini ulab, kredit qo'shing; Limits bo'limida oylik limit qo'ying.",
               "API keys bo'limida «Create new secret key» ni bosing.",
               "Kalit (sk-... bilan boshlanadi) faqat bir marta ko'rsatiladi — nusxalab joylang.",
               "Model sifatida arzon «gpt-4o-mini» dan boshlang, «Saqlash va tekshirish» ni bosing."]},
]
AI_PROVIDER_ORDER = [m["id"] for m in AI_META]
AI_LABELS = {m["id"]: m["label"] for m in AI_META}
AI_FIELDS = [{"key": m[k], "kind": "secret" if k == "key" else "text"} for m in AI_META for k in ("key", "model")]

# kind: text | secret | select.  Har bir guruh — sozlamalar sahifasida alohida karta.
# MySQL (DB_*), SECRET_KEY, DEBUG, ALLOWED_HOSTS bu yerda YO'Q: ular faqat .env faylida (bir marta o'rnatiladi).
GROUPS = [
    {"id": "notify", "title": "Telegram hisobot boti", "icon": "send", "badge": "Bepul", "required": ["NOTIFY_BOT_TOKEN", "NOTIFY_CHAT_ID"],
     "test": [("test_notify", "Saqlash va test xabar yuborish")],
     "intro": "Izohlar xulosasi, ertalabki eslatma, haftalik hisobot va xato xabarlari shu bot orqali sizga keladi. Bu bot post chiqaradigan kanal botidan alohida bo'lishi mumkin.",
     "steps": ["Telegramda @BotFather ni oching va /newbot yuboring. Bot uchun nom va @username bering.",
               "BotFather yuborgan tokenni (123456:ABC... ko'rinishida) «Bot token» maydoniga joylang.",
               "O'zingizning chat ID raqamingizni bilish uchun @userinfobot ga /start yozing — u «Id» raqamingizni yuboradi.",
               "Yangi botingizni toping va unga /start yozing (bo'lmasa bot sizga xabar yubora olmaydi).",
               "Guruhga yuborish kerak bo'lsa: botni guruhga qo'shing; guruh ID si manfiy (-100... bilan) bo'ladi.",
               "«Saqlash va test xabar yuborish» ni bosing — Telegramda xabar kelishi kerak."],
     "links": [{"label": "@BotFather", "url": "https://t.me/BotFather"}, {"label": "@userinfobot", "url": "https://t.me/userinfobot"}],
     "fields": [
         {"key": "NOTIFY_BOT_TOKEN", "label": "Bot token", "kind": "secret", "help": "@BotFather bergan token"},
         {"key": "NOTIFY_CHAT_ID", "label": "Sizning chat ID", "kind": "text", "help": "Raqam, masalan 123456789 (guruh bo'lsa -100...)"},
     ]},
    {"id": "r2", "title": "Cloudflare R2 — media ombori", "icon": "cloud", "badge": "Bepul 10 GB", "required": ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"],
     "test": [("test_r2", "Saqlash va ulanishni tekshirish")],
     "intro": "Postlardagi rasm va videolar faqat shu omborga yuklanadi va faqat shu yerdan olinadi (kompyuter papkasidan to'g'ridan-to'g'ri tanlab bo'lmaydi). Instagram va Facebook ham fayllarni shu ochiq manzildan oladi, shuning uchun alohida tunnel kerak emas. Cloudflare R2 ning bepul tarifida 10 GB joy bor, fayllarni yuklab olish uchun to'lov olinmaydi (aniq limitlarni Cloudflare panelida ko'ring).",
     "steps": ["dash.cloudflare.com ga kiring (akkaunt yo'q bo'lsa bepul oching). R2 bo'limi birinchi marta yoqilganda to'lov kartasini so'rashi mumkin, lekin bepul limit doirasida pul yechilmaydi.",
               "Chap menyuda «R2 Object Storage» → «Create bucket» ni bosing. Nom bering (masalan smm-media), joylashuvni «Automatic» qoldiring. Bu nomni «Bucket nomi» maydoniga yozasiz.",
               "Account ID: R2 sahifasining o'ng tomonidagi «Account ID» (32 belgili) ni nusxalab, quyidagi maydonga joylang.",
               "Ochiq manzil: bucket → Settings → «Public access» bo'limida «R2.dev subdomain» ni Enable qiling (https://pub-xxxx.r2.dev beriladi) YOKI «Custom domain» orqali o'z domeningizni ulang (masalan media.elshod.date — bu tavsiya etiladi). Shu manzilni «Ochiq manzil» maydoniga yozing.",
               "Kalitlar: R2 asosiy sahifasida «Manage API tokens» → «Create API token». Ruxsat: «Object Read & Write», faqat shu bucket uchun. Yaratgach «Access Key ID» va «Secret Access Key» ko'rsatiladi (secret faqat bir marta!) — ikkalasini joylang.",
               "«Saqlash va ulanishni tekshirish» ni bosing. Muvaffaqiyatli bo'lsa, biznesning «Media» bo'limidan fayl yuklashingiz mumkin."],
     "links": [{"label": "Cloudflare dashboard", "url": "https://dash.cloudflare.com/?to=/:account/r2/overview"}],
     "fields": [
         {"key": "R2_ACCOUNT_ID", "label": "Account ID", "kind": "text", "placeholder": "32 belgili ID"},
         {"key": "R2_BUCKET", "label": "Bucket nomi", "kind": "text", "placeholder": "smm-media"},
         {"key": "R2_ACCESS_KEY_ID", "label": "Access Key ID", "kind": "secret"},
         {"key": "R2_SECRET_ACCESS_KEY", "label": "Secret Access Key", "kind": "secret"},
         {"key": "R2_PUBLIC_URL", "label": "Ochiq manzil", "kind": "text", "placeholder": "https://media.elshod.date", "help": "Bucketning ommaga ochiq manzili (r2.dev yoki o'z domeningiz), oxirida / siz"},
         {"key": "R2_CLEANUP_DAYS", "label": "Avtomatik tozalash (kun)", "kind": "text", "placeholder": "0", "help": "Faqat nashr qilingan postlarning fayllari shuncha kundan keyin R2 dan o'chiriladi. 0 = o'chirilmaydi."},
     ]},
    {"id": "public", "title": "Sayt manzili", "icon": "globe", "badge": "Majburiy", "required": ["PUBLIC_BASE_URL"],
     "test": [("test_url", "Saqlash va manzilni tekshirish")],
     "intro": "Dasturning o'zi ochiladigan manzil. Telegram xabarlaridagi havolalar va Google ulanishining qaytish manzili shundan olinadi. Instagram/Facebook rasmlari endi Cloudflare R2 dan olinadi, shuning uchun bu yerga tunnel manzili kerak emas.",
     "steps": ["Faqat o'z kompyuteringizda ishlatsangiz: http://127.0.0.1:8000 qoldiring.",
               "Serverga joylagach: https://smm.elshod.date kabi to'liq manzilni yozing (Cloudflare Tunnel orqali ulanadi, batafsil DEPLOY.md da).",
               "Manzil oxirida / bo'lmasin. Domen avtomatik ruxsat etilgan hostlarga qo'shiladi.",
               "«Saqlash va manzilni tekshirish» ni bosing."],
     "links": [],
     "fields": [{"key": "PUBLIC_BASE_URL", "label": "Sayt manzili", "kind": "text", "placeholder": "https://smm.elshod.date"}]},
    {"id": "google", "title": "YouTube / Google OAuth", "icon": "youtube", "badge": "Bepul", "required": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], "test": [],
     "intro": "YouTube'ga video yuklash va statistika olish uchun Google OAuth kerak. Bir marta sozlanadi, so'ng «Kanallar» bo'limida «Google bilan ulash» tugmasi ishlaydi.",
     "redirect": "/oauth/google/callback/",
     "steps": ["console.cloud.google.com da yangi loyiha yarating (masalan «SMM Agent»).",
               "«APIs & Services» → «Library» da «YouTube Data API v3» va «YouTube Analytics API» ni qidirib, ikkalasini Enable qiling.",
               "«OAuth consent screen» (Google Auth Platform) ni to'ldiring: User type — External, ilova nomi va email. «Test users» ga o'z Gmail'ingizni qo'shing.",
               "Muhim: ilova «Testing» holatida qolsa, ulanish tokeni 7 kundan keyin yaroqsiz bo'ladi. Doimiy ishlashi uchun «Publish app» (In production) ni bosing; faqat o'zingiz ishlatganingiz uchun tekshiruvsiz ham ishlayveradi («unverified app» ogohlantirishi chiqadi, «Advanced → Continue» bosing).",
               "«Credentials» → «Create credentials» → «OAuth client ID» → Application type: «Web application».",
               "«Authorized redirect URIs» ga yuqoridagi «Redirect URI» ni aynan nusxalab qo'shing (domen o'zgarsa, uni ham yangilang).",
               "Client ID va Client secret ni shu yerga joylab saqlang. Keyin «Kanallar» → YouTube kanal qo'shing → «Google bilan ulash»."],
     "links": [{"label": "Google Cloud Console", "url": "https://console.cloud.google.com/apis/credentials"}],
     "fields": [
         {"key": "GOOGLE_CLIENT_ID", "label": "Client ID", "kind": "text"},
         {"key": "GOOGLE_CLIENT_SECRET", "label": "Client secret", "kind": "secret"},
     ]},
    {"id": "meta", "title": "Meta (Instagram / Facebook)", "icon": "instagram", "badge": "Bepul", "required": ["META_APP_ID", "META_APP_SECRET"], "test": [],
     "intro": "Instagram (Business/Creator) va Facebook sahifasi Meta Graph API orqali boshqariladi. Har bir kanal uchun access token «Kanallar» bo'limida kiritiladi; bu yerdagi App ID/Secret token yangilash va uzoq muddatli token olish uchun.",
     "steps": ["Instagram akkauntingiz Business yoki Creator turida va Facebook sahifasiga ulangan bo'lishi kerak (Instagram → Sozlamalar → Akkaunt turi / Ulangan sahifa).",
               "developers.facebook.com ga kiring → «My Apps» → «Create App». Maqsad sifatida Business turini tanlang.",
               "Ilovaga «Instagram» (Graph API) va «Facebook Login for Business» mahsulotlarini qo'shing. Settings → Basic dan App ID va App Secret ni shu yerga joylang.",
               "Graph API Explorer da o'z ilovangizni tanlab, ruxsatlarni belgilang: instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_insights, pages_show_list, pages_read_engagement, pages_manage_posts (Facebook uchun). «Generate Access Token» ni bosing.",
               "Token qisqa muddatli. Uni uzoq muddatli (60 kun) tokenga almashtiring: GET /oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=QISQA_TOKEN. Facebook sahifa tokenini /me/accounts orqali olsangiz, u muddatsiz bo'ladi.",
               "Instagram user ID: /me/accounts?fields=instagram_business_account so'rovida chiqadi. Shu ID va tokenni «Kanallar» → Instagram qo'shish formasiga kiriting.",
               "Eslatma: ilova «Development» rejimida bo'lsa, faqat o'zingiz (ilova admini) uchun ishlaydi — shaxsiy brend uchun yetarli. Meta interfeysi tez-tez o'zgaradi, nomlar biroz farq qilishi mumkin."],
     "links": [{"label": "Meta for Developers", "url": "https://developers.facebook.com/apps/"}, {"label": "Graph API Explorer", "url": "https://developers.facebook.com/tools/explorer/"}],
     "fields": [
         {"key": "META_APP_ID", "label": "App ID", "kind": "text"},
         {"key": "META_APP_SECRET", "label": "App secret", "kind": "secret"},
     ]},
]

LIVE_KEYS = ["PUBLIC_BASE_URL", "GEMINI_API_KEY", "GEMINI_MODEL", "GROQ_API_KEY", "GROQ_MODEL", "OPENROUTER_API_KEY",
             "OPENROUTER_MODEL", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "OPENAI_API_KEY", "OPENAI_MODEL", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET",
             "R2_PUBLIC_URL", "R2_CLEANUP_DAYS", "NOTIFY_BOT_TOKEN", "NOTIFY_CHAT_ID", "GOOGLE_CLIENT_ID",
             "GOOGLE_CLIENT_SECRET", "META_APP_ID", "META_APP_SECRET"]

_last_mtime = None


def all_fields():
    yield from AI_FIELDS
    for g in GROUPS:
        for f in g["fields"]:
            yield f


def read_env() -> dict:
    """.env qiymatlari (yo'q kalitlar .env.example dan)."""
    data = dict(dotenv_values(EXAMPLE_PATH)) if EXAMPLE_PATH.exists() else {}
    if ENV_PATH.exists():
        data.update({k: v for k, v in dotenv_values(ENV_PATH).items() if v is not None})
    return {k: (v or "") for k, v in data.items()}


def _quote(v: str) -> str:
    if v == "" or not re.search(r'[\s#"\'\\]', v):
        return v
    return '"' + v.replace("\\", "\\\\").replace('"', '\\"') + '"'


def write_env(updates: dict):
    """Faqat berilgan kalitlarni yangilaydi; izohlar, tartib va boshqa kalitlar saqlanadi."""
    if not ENV_PATH.exists():
        if EXAMPLE_PATH.exists():
            shutil.copyfile(EXAMPLE_PATH, ENV_PATH)
        else:
            ENV_PATH.write_text("", encoding="utf-8")
    lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
    pending = dict(updates)
    out = []
    for line in lines:
        m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
        if m and m.group(1) in pending:
            k = m.group(1)
            out.append(f"{k}={_quote(pending.pop(k))}")
        else:
            out.append(line)
    for k, v in pending.items():
        out.append(f"{k}={_quote(v)}")
    ENV_PATH.write_text("\n".join(out) + "\n", encoding="utf-8")
    refresh_settings(force=True)


def ai_order(values=None) -> list:
    values = values or read_env()
    raw = [p.strip() for p in values.get("AI_PROVIDERS", "").split(",") if p.strip()]
    if "AI_PROVIDERS" not in values:
        return list(DEFAULT_AI)
    return [p for p in raw if p in AI_PROVIDER_ORDER]


def refresh_settings(force=False):
    """.env o'zgargan bo'lsa django.conf.settings ni yangilaydi (qayta ishga tushirish shart emas)."""
    global _last_mtime
    try:
        mtime = ENV_PATH.stat().st_mtime if ENV_PATH.exists() else 0
    except OSError:
        return
    if not force and mtime == _last_mtime:
        return
    _last_mtime = mtime
    v = read_env()
    for k in LIVE_KEYS:
        if k in v:
            val = v[k].rstrip("/") if k == "PUBLIC_BASE_URL" else v[k]
            setattr(settings, k, val)
    setattr(settings, "AI_PROVIDERS", ai_order(v))
    # tunnel (cloudflared/ngrok) hostini ruxsat etish: Instagram media'ni shu host orqali oladi
    from urllib.parse import urlparse
    host = urlparse(settings.PUBLIC_BASE_URL).hostname
    if host and host not in settings.ALLOWED_HOSTS and "*" not in settings.ALLOWED_HOSTS:
        settings.ALLOWED_HOSTS.append(host)


def mask(value: str) -> str:
    return "" if not value else "••••••••" + value[-4:]
