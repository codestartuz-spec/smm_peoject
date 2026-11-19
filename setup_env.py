"""setup.bat chaqiradi: .env yo'q bo'lsa avtomatik yaratadi."""
import secrets
import sys
from pathlib import Path

base = Path(__file__).resolve().parent
env = base / ".env"
if env.exists():
    print(".env mavjud - o'zgartirilmaydi.")
    sys.exit(0)
pw = input("MySQL root paroli [Enter = 12345]: ").strip() or "12345"
out = []
for line in (base / ".env.example").read_text(encoding="utf-8").splitlines():
    if line.startswith("SECRET_KEY="):
        line = "SECRET_KEY=" + secrets.token_urlsafe(50)
    elif line.startswith("DB_PASSWORD="):
        line = "DB_PASSWORD=" + pw
    out.append(line)
env.write_text("\n".join(out) + "\n", encoding="utf-8")
print(".env yaratildi.")
