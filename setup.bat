@echo off
chcp 65001 >nul
cd /d %~dp0
echo ===== SMM Agent: to'liq o'rnatish =====
python --version >nul 2>&1
if errorlevel 1 (
  echo [XATO] Python topilmadi. python.org dan o'rnating va "Add to PATH" ni belgilang.
  pause & exit /b 1
)
if not exist venv (
  echo [1/6] Virtual muhit yaratilmoqda...
  python -m venv venv
)
call venv\Scripts\activate
echo [2/6] Kutubxonalar o'rnatilmoqda...
python -m pip install -q -r requirements.txt
if errorlevel 1 ( echo [XATO] Kutubxonalar o'rnatilmadi & pause & exit /b 1 )
echo [3/6] Sozlamalar (.env)...
python setup_env.py
if errorlevel 1 ( pause & exit /b 1 )
echo [4/6] MySQL bazasi yaratilmoqda...
python manage.py init_db
if errorlevel 1 (
  echo.
  echo [XATO] MySQL bilan muammo. MySQL yoqilganini va parolni tekshiring.
  echo Parol noto'g'ri bo'lsa: .env faylini o'chiring va setup.bat ni qayta ishga tushiring.
  pause & exit /b 1
)
echo [5/6] Jadvallar yaratilmoqda...
python manage.py migrate
if errorlevel 1 ( pause & exit /b 1 )
echo [6/6] Admin foydalanuvchi...
set /p ADMIN_PASS=Panel paroli [Enter = admin12345]: 
if "%ADMIN_PASS%"=="" set ADMIN_PASS=admin12345
set DJANGO_SUPERUSER_USERNAME=admin
set DJANGO_SUPERUSER_PASSWORD=%ADMIN_PASS%
set DJANGO_SUPERUSER_EMAIL=admin@example.com
python manage.py createsuperuser --noinput || echo (admin allaqachon mavjud)
echo.
echo ===== TAYYOR =====
echo Panelga kirish: login = admin, parol = siz kiritgan.
echo Ishga tushirish uchun start.bat ni bosing.
echo .env faylida bepul AI kalitini (GEMINI_API_KEY) yozishni unutmang.
set /p GO=Hozir ishga tushiraymi? [Y/N]: 
if /i "%GO%"=="Y" call start.bat
pause
