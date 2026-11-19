"""Fon ishchi: python manage.py run_scheduler  (Windows'da Celery/Redis kerak emas)"""
import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from django.core.management.base import BaseCommand
from django.db import close_old_connections

from smm import envconf, tasks


def _safe(fn):
    def run():
        close_old_connections()
        try:
            envconf.refresh_settings()
            fn()
        except Exception:  # noqa: BLE001
            logging.getLogger("smm").exception("vazifa xatosi: %s", fn.__name__)
        finally:
            close_old_connections()
    run.__name__ = fn.__name__
    return run


class Command(BaseCommand):
    help = "Rejalashtirilgan postlar, statistika, izohlar va hisobotlar uchun fon ishchi"

    def handle(self, *args, **opts):
        logging.basicConfig(level=logging.INFO)
        s = BlockingScheduler(timezone="Asia/Tashkent")
        s.add_job(_safe(tasks.publish_due), "interval", minutes=1, id="publish", max_instances=1, coalesce=True)
        s.add_job(_safe(tasks.sync_comments), "interval", minutes=30, id="comments", max_instances=1)
        s.add_job(_safe(tasks.collect_stats), "interval", hours=3, id="stats", max_instances=1)
        s.add_job(_safe(tasks.morning_reminder), "cron", hour=9, minute=0, id="morning")
        s.add_job(_safe(tasks.daily_comment_digest), "cron", hour=20, minute=0, id="digest")
        s.add_job(_safe(tasks.cleanup_media), "cron", hour=3, minute=30, id="cleanup")
        s.add_job(_safe(tasks.weekly_report), "cron", day_of_week="sun", hour=19, minute=0, id="weekly")
        self.stdout.write(self.style.SUCCESS("Scheduler ishga tushdi (Ctrl+C - to'xtatish)"))
        try:
            s.start()
        except (KeyboardInterrupt, SystemExit):
            pass
