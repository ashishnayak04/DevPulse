"""OpenAI-compatible chat completion client with tool calling.

The provider is pluggable via AI_PROVIDER / AI_BASE_URL / AI_MODEL.
When no AI_API_KEY is configured the caller should use the deterministic
mock agent in ``agent.py`` instead of calling this module.
"""

from __future__ import annotations

import time

import httpx

from . import config

SYSTEM_FINGERPRINT = "devpulse-ai"


class LlmError(Exception):
    def __init__(self, message: str, code: str = "LLM_ERROR"):
        super().__init__(message)
        self.code = code


def ai_configured() -> bool:
    return bool(config.AI_API_KEY and config.AI_BASE_URL)


def _chat_completion_url() -> str:
    base = config.AI_BASE_URL.rstrip("/")
    if base.endswith("/v1"):
        return f"{base}/chat/completions"
    return f"{base}/v1/chat/completions"


def estimate_tokens(text: str) -> int:
    """Rough token estimate used only for the cost guardrail."""
    return max(1, int(len(text or "") / 4))


class TokenBudget:
    """Tracks an approximate token spend across tool calls."""

    def __init__(self, limit: int, reserve: int = 0):
        self.limit = limit
        self.reserve = reserve
        self.spent = 0

    def add(self, tokens: int) -> int:
        self.spent += tokens
        return self.spent

    def exhausted(self) -> bool:
        return self.spent + self.reserve >= self.limit


async def chat_completion(
    messages: list[dict],
    tools: list[dict] | None = None,
    *,
    model: str | None = None,
    temperature: float | None = None,
) -> dict:
    """One round trip. Returns the assistant message dict plus usage info."""
    url = _chat_completion_url()
    payload: dict = {
        "model": model or config.AI_MODEL,
        "messages": messages,
        "temperature": config.AI_TEMPERATURE if temperature is None else temperature,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    headers = {
        "Authorization": f"Bearer {config.AI_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=config.AI_TIMEOUT_MS / 1000) as client:
            resp = await client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise LlmError(f"LLM request failed: {exc}", "LLM_CONNECTION_ERROR") from exc

    if resp.status_code >= 400:
        detail = _extract_error_detail(resp)
        raise LlmError(detail, f"LLM_HTTP_{resp.status_code}")

    body = resp.json()
    choice = (body.get("choices") or [{}])[0]
    message = choice.get("message", {})
    usage = body.get("usage") or {}

    prompt_tokens = usage.get("prompt_tokens") or estimate_tokens(
        " ".join(str(m.get("content", "")) for m in messages)
    )
    completion_tokens = usage.get("completion_tokens") or 0

    return {
        "message": message,
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
        "latency_ms": int(resp.elapsed.total_seconds() * 1000),
    }


def _extract_error_detail(resp: httpx.Response) -> str:
    try:
        body = resp.json()
    except Exception:  # noqa: BLE001
        return f"LLM provider error {resp.status_code}"
    if isinstance(body, dict):
        err = body.get("error")
        if isinstance(err, dict) and err.get("message"):
            return f"LLM error {resp.status_code}: {err['message']}"
        if isinstance(err, str):
            return f"LLM error {resp.status_code}: {err}"
    return f"LLM provider error {resp.status_code}"