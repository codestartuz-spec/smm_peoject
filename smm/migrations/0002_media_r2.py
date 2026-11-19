from django.db import migrations, models


def clear_media(apps, schema_editor):
    apps.get_model("smm", "MediaAsset").objects.all().delete()  # eski mahalliy fayllar R2 ga ko'chirilmaydi


class Migration(migrations.Migration):
    dependencies = [("smm", "0001_initial")]

    operations = [
        migrations.RunPython(clear_media, migrations.RunPython.noop),
        migrations.AlterModelOptions(name="mediaasset", options={"ordering": ["-created_at", "-id"]}),
        migrations.RemoveField(model_name="mediaasset", name="file"),
        migrations.AddField(model_name="mediaasset", name="name", field=models.CharField(default="", max_length=255, verbose_name="Fayl nomi"), preserve_default=False),
        migrations.AddField(model_name="mediaasset", name="key", field=models.CharField(default="", max_length=500, unique=True, verbose_name="R2 kaliti"), preserve_default=False),
        migrations.AddField(model_name="mediaasset", name="url", field=models.URLField(default="", max_length=700, verbose_name="Ochiq manzil"), preserve_default=False),
        migrations.AddField(model_name="mediaasset", name="size", field=models.BigIntegerField(default=0)),
        migrations.AddField(model_name="mediaasset", name="content_type", field=models.CharField(blank=True, max_length=100)),
    ]
