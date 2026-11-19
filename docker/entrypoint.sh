#!/bin/sh
# Konteyner ishga tushganda: baza kutish -> migratsiya -> statik fayllar -> admin (bir marta) -> asosiy buyruq
set -e

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "[smm] MySQL kutilmoqda..."
  python - <<'PY'
import os, sys, time
import pymysql
for _ in range(60):
    try:
        pymysql.connect(host=os.getenv("DB_HOST", "db"), port=int(os.getenv("DB_PORT", "3306")),
                        user=os.getenv("DB_USER", "root"), password=os.getenv("DB_PASSWORD", "")).close()
        sys.exit(0)
    except Exception:
        time.sleep(2)
sys.exit("MySQL'ga ulanib bo'lmadi (DB_HOST/DB_PASSWORD ni .env da tekshiring)")
PY
  python manage.py init_db
  python manage.py migrate --noinput
  python manage.py collectstatic --noinput -v 0
  python manage.py shell -c "
import os
from django.contrib.auth import get_user_model
U = get_user_model()
u, p = os.getenv('DJANGO_SUPERUSER_USERNAME'), os.getenv('DJANGO_SUPERUSER_PASSWORD')
if u and p and not U.objects.exists():
    U.objects.create_superuser(u, os.getenv('DJANGO_SUPERUSER_EMAIL', ''), p)
    print('[smm] admin yaratildi:', u)
"
fi
exec "$@"
