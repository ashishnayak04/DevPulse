"""HTTP client for the Node DevPulse internal API (agent tool execution)."""

from __future__ import annotations

import httpx

from . import config

_client: httpx.AsyncClient | None = None


class ToolError(Exception):
    """Raised when the Node API can't resolve a tool call."""

    def __init__(self, message: str, code: str = "TOOL_ERROR"):
        super().__init__(message)
        self.code = code


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=config.NODE_API_URL,
            timeout=httpx.Timeout(20.0),
        )
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def call_tool(tool: str, arguments: dict | None = None) -> dict:
    """Call a single internal context tool on the Node API."""
    headers = {"X-DevPulse-Token": config.AI_SERVICE_TOKEN}
    payload = {"tool": tool, "arguments": arguments or {}}
    try:
        resp = await get_client().post("/api/internal/ai-context", json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise ToolError(f"Node API connection error: {exc}", "NODE_CONNECTION_ERROR") from exc

    if resp.status_code == 200:
        body = resp.json()
        if body.get("success"):
            return body.get("data", {})
        err = body.get("error", {}) if isinstance(body, dict) else {}
        raise ToolError(err.get("message", "Unknown Node API error"), err.get("code", "NODE_ERROR"))

    if resp.status_code == 401:
        raise ToolError("Node API rejected the service token", "NODE_UNAUTHORIZED")
    if resp.status_code == 503:
        raise ToolError("AI context not configured on Node API", "NODE_CONTEXT_NOT_CONFIGURED")

    try:
        body = resp.json()
        err = body.get("error", {}) if isinstance(body, dict) else {}
        code = err.get("code")
        message = err.get("message")
    except Exception:  # noqa: BLE001
        code, message = None, None

    raise ToolError(message or f"Node API error {resp.status_code}", code or "NODE_ERROR")


async def health() -> dict:
    """Lightweight reachability probe (token-guarded)."""
    headers = {"X-DevPulse-Token": config.AI_SERVICE_TOKEN}
    try:
        resp = await get_client().get("/api/health", headers=headers, timeout=httpx.Timeout(5.0))
        return {"ok": resp.status_code == 200, "status": resp.status_code}
    except httpx.HTTPError as exc:
        return {"ok": False, "status": None, "error": str(exc)}