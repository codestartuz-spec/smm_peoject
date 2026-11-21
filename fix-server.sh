#!/usr/bin/env bash
# Serverda:  cd ~/progects/smm && bash fix-server.sh
set -e
cd "$(dirname "$0")"
git pull || true
[ -f .env ] || cp docker.env.example .env
rnd() { openssl rand -hex "$1"; }
grep -q '^SECRET_KEY=CHANGE_ME' .env && sed -i "s|^SECRET_KEY=.*|SECRET_KEY=$(rnd 32)|" .env
# DB parol: faqat harf/raqam. Baza yangidan yaratiladi.
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$(rnd 10)|" .env
grep -q '^WEB_PORT=' .env || echo 'WEB_PORT=7020' >> .env
sed -i 's|^DB_HOST=.*|DB_HOST=db|' .env
echo "== .env tayyor (parollar yangilandi) =="
docker compose --profile tunnel down -v 2>/dev/null || docker compose down -v
docker compose up -d --build
echo "== Kutilyapti (1-3 daqiqa) =="
for i in $(seq 1 40); do
  if curl -fs http://127.0.0.1:7020/api/session/ >/dev/null; then echo "TAYYOR: http://$(hostname -I | awk '{print $1}'):7020"; docker compose ps; exit 0; fi
  sleep 5
done
echo "Ishga tushmadi. Loglar:"; docker compose logs --tail 40 web
