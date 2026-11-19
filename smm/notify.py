"""Sizga (egasiga) Telegram bot orqali xabar yuborish."""
import requests
from django.conf import settings


def send_verbose(text, chat_id=None):
    """-> (ok: bool, tafsilot: str)"""
    token, chat = settings.NOTIFY_BOT_TOKEN, chat_id or settings.NOTIFY_CHAT_ID
    if not token:
        return False, "Bot token kiritilmagan"
    if not chat:
        return False, "Chat ID kiritilmagan"
    try:
        r = requests.post(f"https://api.telegram.org/bot{token}/sendMessage",
                          data={"chat_id": chat, "text": text[:4000], "disable_web_page_preview": "true"}, timeout=20)
    except requests.RequestException as e:
        return False, f"Tarmoq xatosi: {e}"
    if r.status_code == 200:
        return True, "Yuborildi"
    try:
        desc = r.json().get("description", r.text[:200])
    except ValueError:
        desc = r.text[:200]
    return False, f"Telegram: {desc}"


def send(text, chat_id=None):
    return send_verbose(text, chat_id)[0]
