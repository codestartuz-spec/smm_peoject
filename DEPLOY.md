# Serverga joylash (GitHub → SSH → Docker → Cloudflare Tunnel)

Natija: loyiha local serverda Docker ichida ishlaydi va **https://smm.elshod.date** orqali global tarmoqqa chiqadi.
Serverda port ochish, router sozlash yoki SSL sertifikat kerak emas — hammasini Cloudflare Tunnel hal qiladi.

Konteynerlar: `db` (MySQL 8.4) · `web` (gunicorn + React) · `scheduler` (rejalashtirilgan postlar, izohlar, hisobotlar) · `cloudflared` (tunnel).

## 0. Oldindan kerak
- `elshod.date` domeni Cloudflare akkauntingizda (DNS Cloudflare'da boshqarilsin).
- Serverda Docker va Docker Compose v2 (`docker compose version`). O'rnatish: https://docs.docker.com/engine/install/ubuntu/
- Serverga SSH orqali kirish.

## 1. GitHub'ga yuklash (kompyuteringizda)
GitHub'da **Private** repozitoriya yarating (masalan `smm-agent`), keyin `C:\PythonLoyhalar\SMM` papkasida:

```powershell
git init
git add .
git commit -m "SMM Agent"
git branch -M main
git remote add origin https://github.com/<login>/smm-agent.git
git push -u origin main
```
`.gitignore` tufayli `.env`, `venv`, `node_modules` GitHub'ga **chiqmaydi**. Repozitoriyani private qoldiring.
(Ikkita GitHub akkauntingiz bo'lsa, kerakli akkaunt bilan kirganingizni tekshiring.)

## 2. Cloudflare Tunnel yaratish (token olish)
1. https://one.dash.cloudflare.com → **Zero Trust** (birinchi marta bo'lsa, bepul rejani tanlang).
2. **Networks → Tunnels → Create a tunnel → Cloudflared** → nom: `smm-server` → Save.
3. «Install and run a connector» sahifasida Docker buyrug'i chiqadi: `docker run cloudflare/cloudflared ... --token eyJh...`.
   Faqat **`eyJh...` bilan boshlanadigan uzun tokenni** nusxalang (buyruqni ishga tushirmang).
4. **Next → Public Hostname** qo'shing:
   - Subdomain: `smm` · Domain: `elshod.date`
   - Service Type: **HTTP** · URL: **`web:8000`**
5. Save. (DNS yozuvi avtomatik yaratiladi.)

## 3. Serverga o'rnatish (SSH)
```bash
ssh <user>@<server-ip>
git clone https://github.com/<login>/smm-agent.git
cd smm-agent
./deploy.sh
```
`deploy.sh` birinchi marta admin login/parolini, tunnel tokenini va domenni so'raydi, `SECRET_KEY` va baza parolini o'zi yaratadi,
so'ng `docker compose up -d --build` qiladi. Birinchi yig'ish bir necha daqiqa oladi.

Tekshirish: `docker compose ps` (hammasi `running/healthy`), so'ng brauzerda **https://smm.elshod.date**.

> Repozitoriyani private qilgan bo'lsangiz, `git clone` uchun GitHub **Personal Access Token** yoki SSH deploy key kerak bo'ladi.

## 4. Veb sahifada sozlash
Kirgach **Sozlamalar** bo'limida har bir karta ichida yo'riqnoma bor:
1. **Sayt manzili** — `https://smm.elshod.date` (deploy.sh o'zi qo'yadi).
2. **Cloudflare R2** — media ombori. Bucket uchun custom domain: R2 → bucket → Settings → Custom Domains → `media.elshod.date`
   (shu domen ham Cloudflare'da bo'lishi kerak). Shu manzilni «Ochiq manzil» ga yozing.
3. **AI provayderlar**, **Telegram bot**, **Google (YouTube)** va **Meta** kalitlari.
   Google redirect URI: `https://smm.elshod.date/oauth/google/callback/`.

## 5. Yangilash
Kompyuterda o'zgartirish → `git push`. Serverda:
```bash
cd smm-agent && git pull && ./deploy.sh
```
(`.env` mavjud bo'lgani uchun deploy.sh faqat qayta yig'adi; ma'lumotlar bazasi `db_data` volume'ida saqlanadi.)

## 6. Zaxira nusxa (muhim)
```bash
# baza
docker compose exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" smm_db' > smm_backup_$(date +%F).sql
# tiklash
docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" smm_db' < smm_backup_2026-11-19.sql
```
`.env` faylini (ayniqsa `SECRET_KEY`) ham xavfsiz joyga nusxalang: kanal tokenlari shu kalit bilan shifrlangan.
Media fayllar Cloudflare R2 da turadi, serverda emas.

## 7. Qo'shimcha xavfsizlik (tavsiya)
Admin panel internetda ochiq bo'lgani uchun Cloudflare Zero Trust → **Access → Applications → Self-hosted** orqali
`smm.elshod.date` ni faqat o'z emailingiz (bir martalik kod) bilan ochiladigan qiling. Bepul tarifga kiradi.

## Foydali buyruqlar
| Maqsad | Buyruq |
|---|---|
| Loglar | `docker compose logs -f web` · `docker compose logs -f scheduler` |
| Qayta ishga tushirish | `docker compose restart web scheduler` |
| To'xtatish | `docker compose down` (baza saqlanadi) |
| Admin parolini unutsangiz | `docker compose exec web python manage.py changepassword <login>` |
| Testlar | `docker compose exec web env DB_ENGINE=sqlite python manage.py test` |

## Muammolar
- **400 Bad Request** — `.env` dagi `ALLOWED_HOSTS` ga domen kiritilmagan. Tuzatib: `docker compose restart web scheduler`.
- **403 CSRF** — `PUBLIC_BASE_URL`/`ALLOWED_HOSTS` domeniga mos emas yoki `BEHIND_PROXY=1` yo'q.
- **Cloudflare 502** — Public Hostname URL i `web:8000` ekanini va `web` konteyneri healthy ekanini tekshiring.
- **Fayl yuklanmaydi (413)** — Cloudflare bepul tarifida bitta so'rov 100 MB gacha; katta videoni siqing.
- **Baza ulanmaydi** — `.env` dagi `DB_PASSWORD` bazaning birinchi yaratilgan paroli bilan bir xil bo'lishi kerak (volume'ni o'chirmaguncha o'zgarmaydi).
