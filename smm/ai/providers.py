"""AI provayderlar: Gemini, Groq, OpenRouter (bepul), Claude va OpenAI (pullik). Birinchisi xato bersa keyingisiga o'tadi."""
import json
import re

import requests
from django.conf import settings


class AIError(Exception):
    pass


def _gemini(system, prompt, as_json):
    key = settings.GEMINI_API_KEY
    if not key:
        raise AIError("GEMINI_API_KEY yo'q")
    body = {"systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.8}}
    if as_json:
        body["generationConfig"]["responseMimeType"] = "application/json"
    r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent",
                      params={"key": key}, json=body, timeout=120)
    if r.status_code >= 400:
        raise AIError(f"Gemini {r.status_code}: {r.text[:200]}")
    try:
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise AIError(f"Gemini bo'sh javob: {r.text[:200]}")


def _openai_compat(url, key, model, system, prompt, as_json, extra_headers=None):
    if not key:
        raise AIError("API kalit yo'q")
    body = {"model": model, "temperature": 0.8,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}]}
    if as_json:
        body["response_format"] = {"type": "json_object"}
    h = {"Authorization": f"Bearer {key}", **(extra_headers or {})}
    r = requests.post(url, json=body, headers=h, timeout=120)
    if r.status_code >= 400:
        raise AIError(f"{url.split('/')[2]} {r.status_code}: {r.text[:200]}")
    return r.json()["choices"][0]["message"]["content"]


def _groq(system, prompt, as_json):
    return _openai_compat("https://api.groq.com/openai/v1/chat/completions", settings.GROQ_API_KEY,
                          settings.GROQ_MODEL, system, prompt, as_json)


def _openrouter(system, prompt, as_json):
    # :free modellarda json_mode ba'zan yo'q, shuning uchun prompt orqali so'raymiz
    return _openai_compat("https://openrouter.ai/api/v1/chat/completions", settings.OPENROUTER_API_KEY,
                          settings.OPENROUTER_MODEL, system, prompt, False, {"X-Title": "SMM Agent"})


def _anthropic(system, prompt, as_json):
    key = settings.ANTHROPIC_API_KEY
    if not key:
        raise AIError("ANTHROPIC_API_KEY yo'q")
    if as_json:
        system += "\n\nJavobni faqat yaroqli JSON ko'rinishida ber, boshqa matn yozma."
    r = requests.post("https://api.anthropic.com/v1/messages", timeout=180,
                      headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                      json={"model": settings.ANTHROPIC_MODEL, "max_tokens": 8192, "temperature": 0.8, "system": system,
                            "messages": [{"role": "user", "content": prompt}]})
    if r.status_code >= 400:
        raise AIError(f"Claude {r.status_code}: {r.text[:200]}")
    try:
        return "".join(b.get("text", "") for b in r.json()["content"] if b.get("type") == "text")
    except (KeyError, TypeError):
        raise AIError(f"Claude bo'sh javob: {r.text[:200]}")


def _openai(system, prompt, as_json):
    if as_json:
        system += "\n\nRespond with valid JSON only."
    return _openai_compat("https://api.openai.com/v1/chat/completions", settings.OPENAI_API_KEY,
                          settings.OPENAI_MODEL, system, prompt, as_json)


PROVIDERS = {"gemini": _gemini, "groq": _groq, "openrouter": _openrouter,
             "anthropic": _anthropic, "openai": _openai}


def generate(system: str, prompt: str, as_json=False):
    """-> (matn, provayder_nomi)"""
    errors = []
    for name in settings.AI_PROVIDERS:
        fn = PROVIDERS.get(name)
        if not fn:
            continue
        try:
            return fn(system, prompt, as_json), name
        except (AIError, requests.RequestException) as e:
            errors.append(f"{name}: {e}")
    raise AIError("Hech bir AI ishlamadi. Sozlamalar sahifasida kalitlarni tekshiring.\n" + "\n".join(errors))


def parse_json(text: str):
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    try:
        return json.loads(text)
    except ValueError:
        m = re.search(r"(\{.*\}|\[.*\])", text, re.S)
        if m:
            try:
                return json.loads(m.group(1))
            except ValueError:
                pass
    raise AIError("AI javobi JSON emas: " + text[:200])
