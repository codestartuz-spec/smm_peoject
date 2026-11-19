"""MySQL bazasini (agar yo'q bo'lsa) utf8mb4 bilan yaratadi: python manage.py init_db"""
import pymysql
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "MySQL bazasini yaratadi"

    def handle(self, *args, **opts):
        db = settings.DATABASES["default"]
        if "mysql" not in db["ENGINE"]:
            raise CommandError("DB_ENGINE=mysql emas")
        try:
            con = pymysql.connect(host=db["HOST"], port=int(db["PORT"]), user=db["USER"], password=db["PASSWORD"])
        except pymysql.MySQLError as e:
            hint = ""
            if e.args and e.args[0] == 1045:
                hint = " -> Parol noto'g'ri. SMM papkasidagi .env faylida DB_PASSWORD ni tuzating (yoki .env ni o'chirib setup.bat ni qayta ishga tushiring)."
            elif e.args and e.args[0] == 2003:
                hint = " -> MySQL server ishlamayapti. XAMPP/MySQL xizmatini yoqing."
            raise CommandError(f"MySQL'ga ulanib bo'lmadi: {e}{hint}")
        with con.cursor() as cur:
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{db['NAME']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        con.close()
        self.stdout.write(self.style.SUCCESS(f"Baza tayyor: {db['NAME']}"))
