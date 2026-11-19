@echo off
chcp 65001 >nul
cd /d %~dp0
call venv\Scripts\activate
start "SMM scheduler" cmd /k "venv\Scripts\python manage.py run_scheduler"
start "" http://127.0.0.1:8000
python manage.py runserver 127.0.0.1:8000
