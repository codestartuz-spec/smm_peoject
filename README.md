# SMM Agent

Shaxsiy SMM platforma (Django + MySQL). Bizneslar: Elshod | Tech, Nova CRM va boshqalar.
Telegram, Instagram, YouTube (+ Facebook Page) integratsiyasi, kalendar, tasdiqlash tizimi, bepul AI, statistika, izoh tahlili.

## Ishga tushirish (Windows)
1. MySQL ishlab turishi kerak (login: root, parol `.env` da).
2. `setup.bat` — (.env yo`q bo`lsa .env.example dan nusxa oladi; MySQL paroli 12345) venv, kutubxonalar, baza (`smm_db`), migratsiya, admin yaratish.
3. Kirgach **Sozlamalar** sahifasidan kamida bitta AI kalit kiriting (Gemini — bepul). MySQL sozlamalari faqat `.env` faylida (bir marta).
4. `start.bat` — veb (http://127.0.0.1:8000) + fon ishchi (scheduler) ochiladi.

## Asosiy oqim
Kanal ulash → AI studiyada oylik reja/seriya → postni «AI yozsin» (matn + ssenariy) → tahrir →
**Tasdiqlash** → belgilangan vaqtda avtomatik e'lon. Tasdiqlanmagan post hech qachon chiqmaydi.

## Media (Cloudflare R2)
Post rasm/videolari **faqat** Cloudflare R2 omboriga yuklanadi va faqat shu kutubxonadan tanlanadi (biznesning «Media» bo'limi: yuklash,
ko'rish, o'chirish). Instagram/Facebook fayllarni R2 ning ochiq manzilidan oladi, shuning uchun tunnel kerak emas.
Sozlash: Sozlamalar → «Cloudflare R2» kartasi (bosqichma-bosqich yo'riqnoma bor).

## Kanallar
- Telegram: bot token + kanal (@username yoki -100...), bot kanalga admin. Izohlar uchun botni muhokama guruhiga qo'shing va guruh ID kiriting.
- Instagram: Business/Creator + Facebook Page, uzoq muddatli access token (yo'riqnoma Sozlamalar → Meta kartasida).
- YouTube: Google OAuth (yo'riqnoma Sozlamalar → Google kartasida).
- TikTok, LinkedIn: keyingi bosqich (adapter qoliplari tayyor).

## Server (Docker)
Docker, Cloudflare Tunnel va GitHub bo'yicha to'liq yo'riqnoma: **DEPLOY.md**.

## Fon vazifalari (run_scheduler)
Har daqiqa: tasdiqlangan postlarni e'lon · 30 daq: izohlar · 3 soat: statistika · 09:00 ertalabki eslatma ·
20:00 har biznes uchun izohlar xulosasi Telegramga · yakshanba 19:00 haftalik hisobot.

## Test
`set DB_ENGINE=sqlite && python manage.py test`
