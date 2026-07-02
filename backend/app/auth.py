from fastapi import Header, HTTPException

from .config import settings

# Placeholder auth seam. When auth_enabled is False (dev), a fixed user is
# returned so the API is usable while we build the frontend. Step 3 replaces
# the TODO with real Entra ID validation: verify the Bearer JWT against the
# tenant's JWKS, check audience = client_id, and enforce group membership.


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    if not settings.auth_enabled:
        return {"email": "dev@local", "name": "Dev User"}

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    # TODO(step 3): validate token with Entra (tenant_id / client_id / JWKS),
    # extract email + groups, authorize.
    raise HTTPException(status_code=501, detail="Entra auth not yet configured")
