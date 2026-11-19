from .base import PlatformError  # noqa: F401
from .facebook import FacebookAdapter
from .instagram import InstagramAdapter
from .stubs import LinkedInAdapter, TikTokAdapter
from .telegram import TelegramAdapter
from .youtube import YouTubeAdapter

ADAPTERS = {
    "telegram": TelegramAdapter,
    "instagram": InstagramAdapter,
    "youtube": YouTubeAdapter,
    "facebook": FacebookAdapter,
    "tiktok": TikTokAdapter,
    "linkedin": LinkedInAdapter,
}


def get_adapter(channel):
    return ADAPTERS[channel.platform](channel)
