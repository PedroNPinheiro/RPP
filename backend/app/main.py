from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from .config import settings
from .db import pool
from .routers import analytics, attachments, audit, auth, health, parts


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast with the REAL error (e.g. "password authentication failed")
    # instead of a 30s PoolTimeout on the first request if creds/DB are wrong.
    psycopg.connect(settings.database_url, connect_timeout=5).close()
    pool.open()
    try:
        yield
    finally:
        pool.close()


app = FastAPI(title="Replacement Parts API", version="0.1.0", lifespan=lifespan)

# HttpOnly, signed session cookie (SameSite=Lax so the OAuth callback works).
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    https_only=True,
    same_site="lax",
    max_age=settings.session_ttl,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(health.router)
app.include_router(parts.router)
app.include_router(audit.router)
app.include_router(attachments.router)
app.include_router(analytics.router)
