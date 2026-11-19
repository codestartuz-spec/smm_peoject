from django.contrib import admin

from . import models

for m in (models.Business, models.Pillar, models.Channel, models.Series, models.Post,
          models.PostVariant, models.MediaAsset, models.MetricSnapshot, models.Comment,
          models.CommentDigest, models.AIRun):
    admin.site.register(m)
