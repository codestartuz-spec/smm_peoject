from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from .crypto import decrypt_json, encrypt_json

PLATFORMS = [
    ("telegram", "Telegram"),
    ("instagram", "Instagram"),
    ("youtube", "YouTube"),
    ("facebook", "Facebook Page"),
    ("tiktok", "TikTok"),
    ("linkedin", "LinkedIn"),
]

POST_KINDS = [
    ("post", "Oddiy post (rasm/matn)"),
    ("carousel", "Karusel"),
    ("reel", "Reels / Shorts (qisqa video)"),
    ("video", "Uzun video"),
    ("story", "Story"),
]

POST_STATUSES = [
    ("idea", "G'oya"),
    ("draft", "Qoralama"),
    ("pending", "Tasdiq kutmoqda"),
    ("approved", "Tasdiqlangan"),
    ("published", "E'lon qilindi"),
    ("failed", "Xato"),
    ("rejected", "Rad etildi"),
]


class Business(models.Model):
    name = models.CharField("Nomi", max_length=120)
    slug = models.SlugField(unique=True, blank=True)
    industry = models.CharField("Soha", max_length=120, blank=True)
    description = models.TextField("Biznes haqida", blank=True)
    audience = models.TextField("Maqsadli auditoriya", blank=True)
    tone = models.CharField("Ovoz ohangi", max_length=200, blank=True, default="do'stona, ishonchli, sodda")
    usp = models.TextField("Afzalliklari (USP)", blank=True)
    hashtags = models.CharField("Doimiy hashtaglar", max_length=300, blank=True)
    forbidden_words = models.CharField("Ishlatilmaydigan so'zlar", max_length=300, blank=True)
    goals = models.TextField("Maqsadlar (KPI)", blank=True)
    report_chat_id = models.CharField("Hisobot Telegram chat ID (ixtiyoriy)", max_length=50, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *a, **kw):
        if not self.slug:
            base = slugify(self.name) or "biznes"
            slug, i = base, 2
            while Business.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug, i = f"{base}-{i}", i + 1
            self.slug = slug
        super().save(*a, **kw)


class Pillar(models.Model):
    """Kontent ustuni: masalan 'Foydali maslahat', 'Keys', 'Aksiya'."""
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="pillars")
    name = models.CharField(max_length=100)
    share = models.PositiveIntegerField("Ulushi %", default=25)
    notes = models.CharField(max_length=300, blank=True)

    def __str__(self):
        return f"{self.business.name} / {self.name}"


class Channel(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="channels")
    platform = models.CharField(max_length=20, choices=PLATFORMS)
    name = models.CharField(max_length=150)
    external_id = models.CharField("Kanal/akkaunt ID", max_length=150, blank=True)
    credentials_enc = models.TextField(blank=True)
    status = models.CharField(max_length=20, default="active")
    last_error = models.TextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    followers = models.PositiveBigIntegerField(default=0)

    class Meta:
        ordering = ["business", "platform"]

    def __str__(self):
        return f"{self.name} ({self.get_platform_display()})"

    @property
    def credentials(self) -> dict:
        return decrypt_json(self.credentials_enc)

    @credentials.setter
    def credentials(self, data: dict):
        self.credentials_enc = encrypt_json(data)

    def update_credentials(self, **kw):
        c = self.credentials
        c.update(kw)
        self.credentials = c
        self.save(update_fields=["credentials_enc"])


class Series(models.Model):
    """Ketma-ket davom etadigan kontent seriyasi."""
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="series")
    name = models.CharField(max_length=150)
    concept = models.TextField("Seriya g'oyasi", blank=True)
    total_parts = models.PositiveIntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "series"

    def __str__(self):
        return self.name


class MediaAsset(models.Model):
    """Cloudflare R2 omboridagi fayl. Postlar faqat shu kutubxonadan fayl tanlaydi."""
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="media")
    name = models.CharField("Fayl nomi", max_length=255)
    key = models.CharField("R2 kaliti", max_length=500, unique=True)
    url = models.URLField("Ochiq manzil", max_length=700)
    kind = models.CharField(max_length=10, default="image")  # image | video
    size = models.BigIntegerField(default=0)
    content_type = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.name


class Post(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="posts")
    pillar = models.ForeignKey(Pillar, null=True, blank=True, on_delete=models.SET_NULL)
    series = models.ForeignKey(Series, null=True, blank=True, on_delete=models.SET_NULL, related_name="posts")
    part_no = models.PositiveIntegerField("Seriya qismi", null=True, blank=True)
    title = models.CharField("Sarlavha / g'oya", max_length=250)
    kind = models.CharField(max_length=10, choices=POST_KINDS, default="post")
    status = models.CharField(max_length=10, choices=POST_STATUSES, default="idea")
    brief = models.TextField("Qisqacha mazmun", blank=True)
    script = models.JSONField("Ssenariy / dizayn rejasi", default=dict, blank=True)
    scheduled_at = models.DateTimeField("Chiqish vaqti", null=True, blank=True)
    media = models.ManyToManyField(MediaAsset, blank=True)
    ai_generated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_at", "-created_at"]

    def __str__(self):
        return self.title


class PostVariant(models.Model):
    """Postning bitta kanal uchun moslashtirilgan ko'rinishi."""
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="variants")
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="variants")
    caption = models.TextField(blank=True)
    hashtags = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=10, default="pending")  # pending|published|failed
    external_id = models.CharField(max_length=200, blank=True)
    external_url = models.CharField(max_length=300, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True)

    class Meta:
        unique_together = ("post", "channel")

    def full_text(self):
        return (self.caption + ("\n\n" + self.hashtags if self.hashtags else "")).strip()


class MetricSnapshot(models.Model):
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="snapshots")
    date = models.DateField()
    metrics = models.JSONField(default=dict)

    class Meta:
        unique_together = ("channel", "date")
        ordering = ["date"]


class PostMetric(models.Model):
    variant = models.ForeignKey(PostVariant, on_delete=models.CASCADE, related_name="metrics")
    captured_at = models.DateTimeField(default=timezone.now)
    metrics = models.JSONField(default=dict)


class Comment(models.Model):
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="comments")
    variant = models.ForeignKey(PostVariant, null=True, blank=True, on_delete=models.SET_NULL)
    external_id = models.CharField(max_length=200)
    parent_ref = models.CharField(max_length=200, blank=True)  # javob berish uchun (message/comment id)
    author = models.CharField(max_length=150, blank=True)
    text = models.TextField()
    posted_at = models.DateTimeField(default=timezone.now)
    sentiment = models.CharField(max_length=10, blank=True)  # positive|neutral|negative
    topic = models.CharField(max_length=120, blank=True)
    is_question = models.BooleanField(default=False)
    is_lead = models.BooleanField(default=False)
    analyzed = models.BooleanField(default=False)
    suggested_reply = models.TextField(blank=True)
    reply_status = models.CharField(max_length=10, default="none")  # none|suggested|sent|skipped
    reply_text = models.TextField(blank=True)

    class Meta:
        unique_together = ("channel", "external_id")
        ordering = ["-posted_at"]


class CommentDigest(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="digests")
    created_at = models.DateTimeField(auto_now_add=True)
    text = models.TextField()

    class Meta:
        ordering = ["-created_at"]


class AIRun(models.Model):
    business = models.ForeignKey(Business, null=True, blank=True, on_delete=models.SET_NULL)
    kind = models.CharField(max_length=40)
    provider = models.CharField(max_length=30, blank=True)
    result = models.TextField(blank=True)
    ok = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
