import hmac

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field

from . import agent, config, node_client
from .schemas import InvestigationResult

app = FastAPI(title="DevPulse AI Service", version="0.2.0")


def require_service_token(x_dev_pulse_token: str | None = Header(default=None, alias="X-DevPulse-Token")) -> None:
    if not config.AI_SERVICE_TOKEN:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="AI service token not configured on the server")
    if not x_dev_pulse_token or not hmac.compare_digest(x_dev_pulse_token, config.AI_SERVICE_TOKEN):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service token")


class InvestigateRequest(BaseModel):
    incidentId: str = Field(min_length=1, max_length=64)
    endpointId: str | None = None


@app.get("/health")
async def health(_: None = Depends(require_service_token)):
    node = await node_client.health()
    return {
        "status": "ok",
        "service": "ai-service",
        "version": app.version,
        "provider": config.AI_PROVIDER,
        "model": config.AI_MODEL,
        "mode": "llm" if (config.AI_API_KEY and config.AI_BASE_URL) else "mock",
        "llmConfigured": bool(config.AI_API_KEY and config.AI_BASE_URL),
        "nodeApi": node,
    }


@app.post("/investigate")
async def investigate(
    request: InvestigateRequest,
    _: None = Depends(require_service_token),
) -> dict:
    try:
        result: InvestigationResult = await agent.run_investigation(
            request.incidentId, request.endpointId
        )
    except agent.InvestigationBudgetError as exc:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Investigation budget exceeded: {exc}",
        ) from exc
    except node_client.ToolError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Node API tool failed ({exc.code}): {exc}",
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Investigation failed: {exc}",
        ) from exc

    return {"success": True, "data": result.model_dump(mode="json")}


@app.on_event("shutdown")
async def shutdown() -> None:
    await node_client.close_client()


@app.get("/")
async def root():
    return {"service": "DevPulse AI Service", "docs": "/docs", "health": "/health"}