"""Telegram Bot API. credentials: bot_token, [discussion_chat_id]. external_id = kanal @username yoki -100... ID."""
import json
from datetime import datetime, timezone as dt_tz

import requests

from .base import BaseAdapter, PlatformError, check


class TelegramAdapter(BaseAdapter):
    platform = "telegram"

    @property
    def api(self):
        tok = self.cred.get("bot_token")
        if not tok:
            raise PlatformError("Bot token kiritilmagan")
        return f"https://api.telegram.org/bot{tok}"

    def _call(self, method, **kw):
        r = requests.post(f"{self.api}/{method}", timeout=60, **kw)
        data = check(r, method)
        if not data.get("ok"):
            raise PlatformError(f"{method}: {data}")
        return data["result"]

    def _url(self, msg_id):
        ext = self.channel.external_id
        if ext.startswith("@"):
            return f"https://t.me/{ext[1:]}/{msg_id}"
        if ext.startswith("-100"):
            return f"https://t.me/c/{ext[4:]}/{msg_id}"
        return ""

    def publish(self, variant):
        chat = self.channel.external_id
        text = variant.full_text()
        files = self.media_files(variant.post)
        if not files:
            res = self._call("sendMessage", data={"chat_id": chat, "text": text[:4096]})
            return {"external_id": str(res["message_id"]), "url": self._url(res["message_id"])}

        def send_caption_separately(first):
            return len(text) > 1024

        caption = "" if len(text) > 1024 else text
        if len(files) == 1:
            path, kind = files[0]
            method, field = ("sendVideo", "video") if kind == "video" else ("sendPhoto", "photo")
            with open(path, "rb") as f:
                res = self._call(method, data={"chat_id": chat, "caption": caption}, files={field: f})
            mid = res["message_id"]
        else:
            media, handles = [], {}
            for i, (path, kind) in enumerate(files[:10]):
                handles[f"f{i}"] = open(path, "rb")
                item = {"type": "video" if kind == "video" else "photo", "media": f"attach://f{i}"}
                if i == 0 and caption:
                    item["caption"] = caption
                media.append(item)
            try:
                res = self._call("sendMediaGroup", data={"chat_id": chat, "media": json.dumps(media)}, files=handles)
            finally:
                for h in handles.values():
                    h.close()
            mid = res[0]["message_id"]
        if len(text) > 1024:
            self._call("sendMessage", data={"chat_id": chat, "text": text[:4096], "reply_to_message_id": mid})
        return {"external_id": str(mid), "url": self._url(mid)}

    def fetch_metrics(self):
        n = self._call("getChatMemberCount", data={"chat_id": self.channel.external_id})
        return {"followers": int(n)}

    def fetch_comments(self):
        """Muhokama guruhiga qo'shilgan bot orqali kanal postlari ostidagi javoblarni oladi."""
        offset = self.cred.get("update_offset", 0)
        try:
            updates = self._call("getUpdates", data={"offset": offset, "timeout": 0, "allowed_updates": json.dumps(["message"])})
        except PlatformError as e:
            raise PlatformError(f"getUpdates (webhook yoqilmagan bo'lsin): {e}")
        out, last = [], offset
        want_chat = str(self.cred.get("discussion_chat_id", ""))
        for u in updates:
            last = max(last, u["update_id"] + 1)
            m = u.get("message") or {}
            chat = m.get("chat", {})
            if chat.get("type") not in ("group", "supergroup"):
                continue
            if want_chat and str(chat.get("id")) != want_chat:
                continue
            rep = m.get("reply_to_message")
            if not rep or not m.get("text"):
                continue
            origin = rep.get("forward_origin") or {}
            post_msg_id = origin.get("message_id") or rep.get("forward_from_message_id")
            u_from = m.get("from", {})
            out.append({
                "external_id": f"{chat['id']}:{m['message_id']}",
                "parent_ref": f"{chat['id']}:{m['message_id']}",
                "author": u_from.get("username") or u_from.get("first_name", ""),
                "text": m["text"],
                "posted_at": datetime.fromtimestamp(m["date"], tz=dt_tz.utc),
                "post_external_id": str(post_msg_id or ""),
            })
        if last != offset:
            self.channel.update_credentials(update_offset=last)
        return out

    def reply(self, comment, text):
        chat_id, msg_id = comment.parent_ref.split(":")
        self._call("sendMessage", data={"chat_id": chat_id, "text": text, "reply_to_message_id": msg_id})
