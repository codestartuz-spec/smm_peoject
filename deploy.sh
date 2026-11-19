#!/usr/bin/env bash
# Serverda ishga tushirish / yangilash:  ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

command -v docker >/dev/null || { echo "Docker o'rnatilmagan: https://docs.docker.com/engine/install/"; exit 1; }

if [ ! -f .env ]; then
  echo "== Birinchi o'rnatish: .env yaratilmoqda =="
  read -rp "Admin login [admin]: " ADMIN_USER; ADMIN_USER=${ADMIN_USER:-admin}
  read -rsp "Admin parol (kamida 8 belgi): " ADMIN_PASS; echo
  read -rp "Cloudflare Tunnel tokeni (DEPLOY.md 3-qadam): " TUNNEL
  read -rp "Sayt domeni [smm.elshod.date]: " DOMAIN; DOMAIN=${DOMAIN:-smm.elshod.date}
  cp docker.env.example .env
  ADMIN_USER="$ADMIN_USER" ADMIN_PASS="$ADMIN_PASS" TUNNEL="$TUNNEL" DOMAIN="$DOMAIN" python3 - <<'PY'
import os, re, secrets
t = open(".env", encoding="utf-8").read()
vals = {"SECRET_KEY": secrets.token_urlsafe(50), "DB_PASSWORD": secrets.token_hex(12),
        "DJANGO_SUPERUSER_USERNAME": os.environ["ADMIN_USER"], "DJANGO_SUPERUSER_PASSWORD": os.environ["ADMIN_PASS"],
        "TUNNEL_TOKEN": os.environ["TUNNEL"], "PUBLIC_BASE_URL": "https://" + os.environ["DOMAIN"],
        "ALLOWED_HOSTS": os.environ["DOMAIN"] + ",127.0.0.1,localhost"}
for k, v in vals.items():
    t = re.sub(rf"^{k}=.*$", lambda m: f"{k}={v}", t, flags=re.M)
open(".env", "w", encoding="utf-8").write(t)
PY
  chmod 600 .env
  echo ".env tayyor. SECRET_KEY ni xavfsiz joyda saqlab qo'ying (kanal tokenlari shu bilan shifrlanadi)."
fi

docker compose up -d --build
docker compose ps
echo
echo "Tayyor. Loglar: docker compose logs -f web"
