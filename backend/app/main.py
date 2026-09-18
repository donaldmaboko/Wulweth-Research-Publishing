"""Wulweth Research & Publishing — FastAPI application entry point."""
from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.db import engine
from app.routers import (
    admin, analytics, auth, deliverables, documents, feed, invoices, messages,
    moderation, notifications, opportunities, organizations, payments, payouts,
    professionals, projects, quotes, research_requests, reviews, search, taxonomy,
    users,
)

API = settings.api_prefix


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Light startup check — the schema itself is created by scripts/init_db.py
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print(f"[wulweth-api] ready in {settings.environment} mode")
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Professional research services, expertise and publishing platform.",
    docs_url="/api/docs", openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, settings.public_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    elapsed = time.perf_counter() - started
    response.headers["Server-Timing"] = f"app;dur={elapsed * 1000:.1f}"
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    print(f"[wulweth-api] unhandled error on {request.method} {request.url.path}: {exc!r}")
    return JSONResponse(status_code=500, content={"detail": "An unexpected error occurred. The team has been notified."})


for module in (auth, taxonomy, professionals, organizations, users, research_requests,
               projects, documents, deliverables, quotes, invoices, payments, payouts,
               messages, notifications, feed, opportunities, moderation, search,
               analytics, admin, reviews):
    app.include_router(module.router, prefix=API)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "wulweth-api", "time": time.time()}
