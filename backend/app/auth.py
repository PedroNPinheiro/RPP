import time

from authlib.integrations.starlette_client import OAuth
from fastapi import HTTPException, Request

from .config import settings

# Confidential OIDC client for the Backend-For-Frontend login flow. The tokens
# from Entra never leave the server; the browser only ever holds the signed,
# HttpOnly session cookie set after callback.
oauth = OAuth()
if settings.entra_tenant_id and settings.entra_client_id:
    oauth.register(
        name="entra",
        client_id=settings.entra_client_id,
        client_secret=settings.entra_client_secret,
        server_metadata_url=(
            f"https://login.microsoftonline.com/{settings.entra_tenant_id}"
            "/v2.0/.well-known/openid-configuration"
        ),
        client_kwargs={"scope": "openid profile email"},
    )


def get_current_user(request: Request) -> dict:
    """Identity from the session cookie. When auth is disabled (dev/local),
    a fixed user is returned so the app is usable without Entra configured."""
    if not settings.auth_enabled:
        return {"email": "dev@local", "name": "Dev User"}
    user = request.session.get("user")
    if not user or user.get("exp", 0) < time.time():
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
