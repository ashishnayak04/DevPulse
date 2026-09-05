import hmac

from fastapi import Depends, FastAPI, Header, HTTPException, status

from . import config

app = FastAPI(title="DevPulse AI Service", version="0.1.0")


def require_service_token(x_dev_pulse_token: str | None = Header(default=None, alias="X-DevPulse-Token")) -> None:
    if not config.AI_SERVICE_TOKEN:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="AI service token not configured on the server")
    if not x_dev_pulse_token or not hmac.compare_digest(x_dev_pulse_token, config.AI_SERVICE_TOKEN):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service token")


@app.get("/health")
async def health(_: None = Depends(require_service_token)):
    return {
        "status": "ok",
        "service": "ai-service",
        "version": app.version,
        "provider": config.AI_PROVIDER,
        "model": config.AI_MODEL,
    }


@app.get("/")
async def root():
    return {"service": "DevPulse AI Service", "docs": "/docs", "health": "/health"}