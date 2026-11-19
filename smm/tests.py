"""Tezkor tekshiruv: python manage.py test  (tashqi API'lar soxtalashtirilgan)"""
import json
from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from smm import tasks
from smm.models import Business, Channel, Comment, Post, PostVariant


def fake_generate(system, prompt, as_json=False):
    if "SERIYA" in prompt:
        d = {"name": "Bot seriyasi", "concept": "x", "parts": [
            {"no": i, "kind": "reel", "title": f"Qism {i}", "brief": "b", "hook": "h", "teaser": "t"} for i in (1, 2, 3)]}
    elif "oylik" in prompt.lower() or "Boshlanish" in prompt:
        d = {"items": [{"date": "2026-12-01", "time": "12:00", "pillar": "Maslahat", "kind": "carousel", "title": "G'oya 1", "brief": "m"}]}
    elif "izohlarni tahlil" in prompt:
        ids = json.loads(prompt.split("Izohlar: ")[1].split("\nFAQAT")[0])
        d = {"results": [{"id": i["id"], "sentiment": "positive", "topic": "narx", "is_question": True, "is_lead": True, "reply": "Rahmat!"} for i in ids]}
    elif "So'nggi izohlar" in prompt:
        d = {"summary": "Hammasi yaxshi"}
    else:
        d = {"captions": {"telegram": "TG matn", "instagram": "IG matn"}, "hashtags": ["#a"],
             "script": {"hook": "H", "scenes": [{"time": "0-3s", "visual": "v", "voiceover": "o", "on_screen_text": "t"}], "cta": "c"}}
    return json.dumps(d), "fake"


import tempfile
from pathlib import Path

from django.test import Client


class ApiTest(TestCase):
    def setUp(self):
        User.objects.create_superuser("admin", password="pw")
        self.c = Client(enforce_csrf_checks=False)
        self.c.login(username="admin", password="pw")
        self.b = Business.objects.create(name="Elshod | Tech", industry="IT")
        self.b.pillars.create(name="Maslahat", share=50)
        self.ch = Channel.objects.create(business=self.b, platform="telegram", name="TG", external_id="@x")
        self.ch.credentials = {"bot_token": "123:abc"}
        self.ch.save()
        self.base = f"/api/businesses/{self.b.slug}"

    def j(self, method, url, data=None):
        return getattr(self.c, method)(url, json.dumps(data or {}), content_type="application/json")

    def test_auth_required_and_session(self):
        anon = Client()
        self.assertEqual(anon.get("/api/businesses/").status_code, 401)
        self.assertFalse(anon.get("/api/session/").json()["authenticated"])
        r = anon.post("/api/login/", json.dumps({"username": "admin", "password": "pw"}), content_type="application/json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(anon.get("/api/session/").json()["authenticated"])
        bad = Client().post("/api/login/", json.dumps({"username": "admin", "password": "x"}), content_type="application/json")
        self.assertEqual(bad.status_code, 400)

    def test_read_endpoints(self):
        for u in ("/api/businesses/", f"{self.base}/", f"{self.base}/overview/", f"{self.base}/posts/", f"{self.base}/series/",
                  f"{self.base}/stats/", f"{self.base}/channels/", f"{self.base}/comments/", "/api/settings/"):
            self.assertEqual(self.c.get(u).status_code, 200, u)
        self.assertEqual(self.c.get("/some/spa/route").status_code in (200, 503), True)

    def test_business_crud(self):
        r = self.j("post", "/api/businesses/", {"name": "Nova CRM"})
        self.assertEqual(r.json()["business"]["slug"], "nova-crm")
        r = self.j("put", "/api/businesses/nova-crm/", {"tone": "rasmiy", "pillars": [{"name": "Keys", "share": 30}]})
        self.assertEqual(r.json()["business"]["pillars"][0]["name"], "Keys")

    @mock.patch("smm.ai.agents.generate", side_effect=fake_generate)
    def test_ai_flow_and_approval(self, _):
        self.assertEqual(self.j("post", f"{self.base}/ai/series/", {"topic": "Bot", "parts": 3}).status_code, 200)
        self.assertEqual(Post.objects.filter(series__isnull=False).count(), 3)
        self.j("post", f"{self.base}/ai/plan/", {"start": "2026-12-01"})
        p = Post.objects.get(title="G'oya 1")
        r = self.j("post", f"/api/posts/{p.id}/ai/")
        self.assertEqual(r.json()["post"]["variants"][0]["caption"], "TG matn")
        # tahrir
        r = self.j("put", f"/api/posts/{p.id}/", {"title": "Yangi sarlavha", "scheduled_at": "2026-12-01T12:00",
                                                  "variants": [{"channel_id": self.ch.id, "caption": "Matn", "hashtags": "#a"}]})
        self.assertEqual(r.json()["post"]["title"], "Yangi sarlavha")
        p.refresh_from_db()
        p.scheduled_at = timezone.now()
        p.save()
        with mock.patch("smm.tasks.get_adapter") as ga:
            ga.return_value.publish.return_value = {"external_id": "7", "url": "https://t.me/x/7"}
            tasks.publish_due()
            ga.return_value.publish.assert_not_called()            # tasdiqlanmagan chiqmaydi
            self.assertEqual(self.j("post", f"/api/posts/{p.id}/approve/").status_code, 200)
            tasks.publish_due()
            ga.return_value.publish.assert_called_once()
        p.refresh_from_db()
        self.assertEqual(p.status, "published")
        self.assertEqual(self.j("put", f"/api/posts/{p.id}/", {"title": "x"}).status_code, 400)  # e'lon qilingan o'zgarmaydi

    @mock.patch("smm.ai.agents.generate", side_effect=fake_generate)
    def test_comments(self, _):
        c = Comment.objects.create(channel=self.ch, external_id="1", text="Narxi qancha?", author="ali")
        self.j("post", f"{self.base}/comments/action/", {"action": "analyze"})
        c.refresh_from_db()
        self.assertTrue(c.analyzed and c.is_lead)
        self.assertEqual(self.c.get(f"{self.base}/comments/?f=leads").json()["comments"][0]["reply_status"], "suggested")
        with mock.patch("smm.api.get_adapter") as ga:
            self.j("post", f"{self.base}/comments/action/", {"action": "send", "id": c.id, "reply": "Salom"})
            ga.return_value.reply.assert_called_once()
        c.refresh_from_db()
        self.assertEqual(c.reply_status, "sent")


class EnvSettingsTest(TestCase):
    def setUp(self):
        from smm import envconf
        self.tmp = Path(tempfile.mkdtemp())
        self.patches = [mock.patch.object(envconf, "ENV_PATH", self.tmp / ".env"),
                        mock.patch.object(envconf, "EXAMPLE_PATH", self.tmp / ".env.example")]
        for p in self.patches:
            p.start()
        (self.tmp / ".env.example").write_text("# izoh\nGEMINI_API_KEY=\nGEMINI_MODEL=gemini-2.0-flash\nDB_PASSWORD=12345\n")
        User.objects.create_superuser("admin", password="pw")
        self.c = Client()
        self.c.login(username="admin", password="pw")

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def post(self, data):
        return self.c.post("/api/settings/", json.dumps(data), content_type="application/json")

    def test_save_mask_and_clear(self):
        r = self.post({"values": {"GEMINI_API_KEY": "AIza-secret-1234", "GEMINI_MODEL": "gemini-2.5-flash",
                                  "PUBLIC_BASE_URL": "https://x.example.com/"}, "prios": {"groq": "1", "gemini": "2"}})
        self.assertEqual(r.status_code, 200)
        txt = (self.tmp / ".env").read_text()
        self.assertIn("# izoh", txt)
        self.assertIn("AI_PROVIDERS=groq,gemini", txt)
        from django.conf import settings
        self.assertEqual(settings.GEMINI_MODEL, "gemini-2.5-flash")
        self.assertEqual(settings.PUBLIC_BASE_URL, "https://x.example.com")
        self.assertIn("x.example.com", settings.ALLOWED_HOSTS)
        self.assertNotIn("AIza-secret-1234", self.c.get("/api/settings/").content.decode())   # ochiq qaytmaydi
        self.post({"values": {"GEMINI_API_KEY": ""}})
        self.assertIn("GEMINI_API_KEY=AIza-secret-1234", (self.tmp / ".env").read_text())
        self.post({"clear": ["GEMINI_API_KEY"]})
        self.assertIn("GEMINI_API_KEY=\n", (self.tmp / ".env").read_text())

    def test_groups_have_guides_and_no_db_fields(self):
        data = self.c.get("/api/settings/").json()
        ids = [g["id"] for g in data["groups"]]
        self.assertEqual(ids, ["notify", "r2", "public", "google", "meta"])
        keys = {f["key"] for g in data["groups"] for f in g["fields"]}
        self.assertFalse(any(k.startswith("DB_") for k in keys))      # MySQL web'dan o'zgartirilmaydi
        self.assertTrue(all(len(g["steps"]) >= 3 for g in data["groups"]))
        self.post({"values": {"DB_PASSWORD": "hack", "R2_BUCKET": "smm-media", "R2_PUBLIC_URL": "https://cdn.example.com/"}})
        txt = (self.tmp / ".env").read_text()
        self.assertNotIn("hack", txt)
        self.assertIn("R2_PUBLIC_URL=https://cdn.example.com\n", txt)
        self.assertEqual(self.post({"values": {"R2_CLEANUP_DAYS": "abc"}}).status_code, 400)

    def test_r2_check_action(self):
        with mock.patch("smm.api.storage.check", return_value="R2 ishlayapti"):
            self.assertEqual(self.post({"action": "test_r2"}).json()["level"], "success")
        from smm import storage
        with mock.patch("smm.api.storage.check", side_effect=storage.StorageError("yo'q")):
            self.assertEqual(self.post({"action": "test_r2"}).json()["level"], "error")

    def test_validation_and_tests(self):
        self.assertEqual(self.post({"values": {"PUBLIC_BASE_URL": "notaurl"}}).status_code, 400)
        self.assertFalse((self.tmp / ".env").exists())
        with mock.patch("smm.api.notify.send_verbose", return_value=(True, "Yuborildi")):
            self.assertEqual(self.post({"action": "test_notify"}).json()["level"], "success")
        with mock.patch.dict("smm.ai.providers.PROVIDERS", {"gemini": lambda s, p, j: "ok"}):
            self.assertIn("ishlayapti", self.post({"action": "test_ai_gemini"}).json()["message"])


    def test_ai_cards_and_paid_providers(self):
        self.post({"prios": {"gemini": "1"}})
        # alohida karta saqlash: prios yuborilmasa tartib o'zgarmaydi
        self.post({"values": {"ANTHROPIC_API_KEY": "sk-ant-zzz-9999", "ANTHROPIC_MODEL": "claude-sonnet-5-5"}})
        txt = (self.tmp / ".env").read_text()
        self.assertIn("AI_PROVIDERS=gemini\n", txt)
        self.assertIn("ANTHROPIC_MODEL=claude-sonnet-5-5", txt)
        data = self.c.get("/api/settings/").json()
        cards = {c["id"]: c for c in data["ai_cards"]}
        self.assertEqual(list(cards), ["gemini", "groq", "openrouter", "anthropic", "openai"])
        self.assertTrue(cards["anthropic"]["is_set"] and not cards["anthropic"]["free"] and len(cards["anthropic"]["steps"]) >= 4)
        self.assertEqual(cards["gemini"]["prio"], 1)
        self.assertNotIn("sk-ant-zzz-9999", json.dumps(data))
        self.post({"prios": {"gemini": "1", "anthropic": "2", "openai": "3"}})
        self.assertIn("AI_PROVIDERS=gemini,anthropic,openai", (self.tmp / ".env").read_text())

    def test_anthropic_and_openai_calls(self):
        from smm.ai import providers
        from django.test import override_settings

        class R:
            status_code = 200
            def __init__(self, j): self._j = j
            def json(self): return self._j
        with override_settings(ANTHROPIC_API_KEY="k", ANTHROPIC_MODEL="claude-haiku-5-5", OPENAI_API_KEY="k2", OPENAI_MODEL="gpt-4o-mini"):
            with mock.patch("smm.ai.providers.requests.post", return_value=R({"content": [{"type": "text", "text": "salom"}]})) as m:
                self.assertEqual(providers._anthropic("sys", "p", True), "salom")
                kw = m.call_args.kwargs
                self.assertEqual(kw["headers"]["x-api-key"], "k")
                self.assertEqual(kw["json"]["model"], "claude-haiku-5-5")
                self.assertIn("JSON", kw["json"]["system"])
            with mock.patch("smm.ai.providers.requests.post", return_value=R({"choices": [{"message": {"content": "hi"}}]})) as m:
                self.assertEqual(providers._openai("sys", "p", False), "hi")
                self.assertEqual(m.call_args.kwargs["headers"]["Authorization"], "Bearer k2")


class MediaProfileTest(TestCase):
    def setUp(self):
        User.objects.create_superuser("admin", password="pw12345678")
        self.c = Client()
        self.c.login(username="admin", password="pw12345678")
        self.b = Business.objects.create(name="Elshod | Tech")
        self.store = {}

    def _patches(self):
        from smm import storage
        return [mock.patch.object(storage, "configured", return_value=True),
                mock.patch.object(storage, "upload", side_effect=lambda f, k, ct="": self.store.__setitem__(k, f.read())),
                mock.patch.object(storage, "delete", side_effect=lambda k: self.store.pop(k, None))]

    def test_library_upload_attach_delete(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.test import override_settings
        ps = self._patches()
        for p in ps:
            p.start()
        self.addCleanup(lambda: [p.stop() for p in ps])
        with override_settings(R2_PUBLIC_URL="https://cdn.example.com"):
            r = self.c.post(f"/api/businesses/{self.b.slug}/library/", {"files": [
                SimpleUploadedFile("Rasm 1.JPG", b"img", "image/jpeg"), SimpleUploadedFile("hujjat.exe", b"x"),
                SimpleUploadedFile("video.mp4", b"vid", "video/mp4")]})
            j = r.json()
            self.assertEqual(len(j["assets"]), 2)
            self.assertEqual(len(j["errors"]), 1)
            self.assertTrue(j["assets"][0]["url"].startswith("https://cdn.example.com/elshod-tech/"))
            self.assertEqual({a["kind"] for a in j["assets"]}, {"image", "video"})
            self.assertEqual(len(self.store), 2)
            ids = [a["id"] for a in j["assets"]]
            post = Post.objects.create(business=self.b, title="P", status="approved")
            # begona biznes fayli yoki mavjud bo'lmagan id biriktirilmaydi
            other = Business.objects.create(name="Nova CRM")
            from smm.models import MediaAsset
            foreign = MediaAsset.objects.create(business=other, name="x.png", key="k/x.png", url="https://cdn.example.com/k/x.png")
            bad = self.c.post(f"/api/posts/{post.id}/media/", json.dumps({"asset_ids": [foreign.id]}), content_type="application/json")
            self.assertEqual(bad.status_code, 400)
            good = self.c.post(f"/api/posts/{post.id}/media/", json.dumps({"asset_ids": ids}), content_type="application/json")
            self.assertEqual(len(good.json()["post"]["media"]), 2)
            # rejalashtirilgan postda ishlatilayotgan fayl o'chirilmaydi
            self.assertEqual(self.c.delete(f"/api/media/{ids[0]}/").status_code, 409)
            post.status = "published"
            post.save()
            self.assertEqual(self.c.delete(f"/api/media/{ids[0]}/").status_code, 200)
            self.assertEqual(len(self.store), 1)
            lst = self.c.get(f"/api/businesses/{self.b.slug}/library/").json()
            self.assertEqual(len(lst["assets"]), 1)

    def test_upload_requires_r2_config(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        r = self.c.post(f"/api/businesses/{self.b.slug}/library/", {"files": SimpleUploadedFile("a.png", b"x")})
        self.assertEqual(r.status_code, 400)
        self.assertIn("R2", r.json()["error"])

    def test_cleanup_media(self):
        from datetime import timedelta
        from django.test import override_settings
        from smm.models import MediaAsset
        ps = self._patches()
        for p in ps:
            p.start()
        self.addCleanup(lambda: [p.stop() for p in ps])
        old = MediaAsset.objects.create(business=self.b, name="a.png", key="a", url="https://x/a")
        free = MediaAsset.objects.create(business=self.b, name="b.png", key="b", url="https://x/b")
        post = Post.objects.create(business=self.b, title="P", status="published")
        post.media.add(old)
        ch = Channel.objects.create(business=self.b, platform="telegram", name="t")
        PostVariant.objects.create(post=post, channel=ch, status="published", published_at=timezone.now() - timedelta(days=40))
        with override_settings(R2_CLEANUP_DAYS="0"):
            self.assertEqual(tasks.cleanup_media(), 0)
        with override_settings(R2_CLEANUP_DAYS="30"):
            self.assertEqual(tasks.cleanup_media(), 1)
        self.assertFalse(MediaAsset.objects.filter(pk=old.pk).exists())
        self.assertTrue(MediaAsset.objects.filter(pk=free.pk).exists())  # postga biriktirilmagan fayl tegilmaydi

    def test_profile(self):
        self.assertEqual(self.c.get("/api/profile/").json()["profile"]["username"], "admin")
        r = self.c.put("/api/profile/", json.dumps({"username": "elshod", "first_name": "Elshod", "email": "e@x.uz"}), content_type="application/json")
        self.assertEqual(r.json()["profile"]["username"], "elshod")
        User.objects.create_user("band", password="x")
        self.assertEqual(self.c.put("/api/profile/", json.dumps({"username": "band"}), content_type="application/json").status_code, 400)
        pw = lambda d: self.c.post("/api/profile/password/", json.dumps(d), content_type="application/json")
        self.assertEqual(pw({"current_password": "xato", "new_password": "yangiparol1", "confirm_password": "yangiparol1"}).status_code, 400)
        self.assertEqual(pw({"current_password": "pw12345678", "new_password": "qisqa", "confirm_password": "qisqa"}).status_code, 400)
        self.assertEqual(pw({"current_password": "pw12345678", "new_password": "yangiparol1", "confirm_password": "boshqa"}).status_code, 400)
        self.assertEqual(pw({"current_password": "pw12345678", "new_password": "yangiparol1", "confirm_password": "yangiparol1"}).status_code, 200)
        self.assertEqual(self.c.get("/api/profile/").status_code, 200)  # sessiya saqlanib qoldi
        self.assertTrue(User.objects.get(username="elshod").check_password("yangiparol1"))
