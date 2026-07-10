import time

from authlib.integrations.starlette_client import OAuth
from fastapi import Depends, HTTPException, Request

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


def role_from_claims(claims: dict) -> str:
    """Map Entra App Roles to our two levels. If no app role is assigned yet
    (roles claim absent), default to 'editor' so behaviour is unchanged until
    roles are set up — flip to 'viewer' here for a lock-down-by-default policy."""
    roles = claims.get("roles") or []
    if "Editor" in roles:
        return "editor"
    if "Viewer" in roles:
        return "viewer"
    return "editor"


def get_current_user(request: Request) -> dict:
    """Identity + role from the session cookie. When auth is disabled (dev),
    a full-access dev user is returned so the app is usable without Entra."""
    if not settings.auth_enabled:
        return {"email": "dev@local", "name": "Dev User", "role": "editor"}
    user = request.session.get("user")
    if not user or user.get("exp", 0) < time.time():
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def require_editor(user: dict = Depends(get_current_user)) -> dict:
    """Guard for write endpoints — only an explicit 'viewer' is blocked.
    A missing role (e.g. a session created before roles existed) is treated
    as editor so nobody is locked out mid-rollout."""
    if user.get("role", "editor") != "editor":
        raise HTTPException(status_code=403, detail="Your account has read-only access.")
    return user
