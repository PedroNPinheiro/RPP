from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import pool
from .routers import attachments, audit, health, parts


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(parts.router)
app.include_router(audit.router)
app.include_router(attachments.router)
