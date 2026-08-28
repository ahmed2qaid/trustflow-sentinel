from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import demo, requests, vendors

settings = get_settings()
app = FastAPI(
    title="TrustFlow Sentinel API",
    version="0.1.0",
    description="Evidence-gated B2B payment change verification for the DevNetwork API + Cloud + AI Hackathon 2026.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vendors.router, prefix=settings.api_prefix)
app.include_router(requests.router, prefix=settings.api_prefix)
app.include_router(demo.router, prefix=settings.api_prefix)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.app_env,
        "integrations": {
            "nutrient": "mock" if settings.use_mock_nutrient else "live",
            "serpapi": "mock" if settings.use_mock_serpapi else "live",
            "llm": "mock" if settings.use_mock_llm else "ollama",
        },
    }
