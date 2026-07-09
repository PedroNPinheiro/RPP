import time

from authlib.integrations.starlette_client import OAuthError
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse

from ..auth import oauth
from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login")
async def login(request: Request):
    redirect_uri = f"{settings.app_base_url}/auth/callback"
    return await oauth.entra.authorize_redirect(request, redirect_uri)


@router.get("/callback")
async def callback(request: Request):
    try:
        token = await oauth.entra.authorize_access_token(request)
    except OAuthError:
        return RedirectResponse(url="/?auth_error=1")
    claims = token.get("userinfo") or {}
    email = (
        claims.get("email")
        or claims.get("preferred_username")
        or claims.get("upn")
        or ""
    )
    request.session["user"] = {
        "email": email,
        "name": claims.get("name") or email,
        "exp": int(time.time()) + settings.session_ttl,
    }
    return RedirectResponse(url="/")


@router.get("/me")
async def me(request: Request):
    if not settings.auth_enabled:
        return {"authenticated": True, "email": "dev@local", "name": "Dev User"}
    user = request.session.get("user")
    if not user or user.get("exp", 0) < time.time():
        return JSONResponse({"authenticated": False}, status_code=401)
    return {"authenticated": True, "email": user["email"], "name": user["name"]}


@router.get("/logout")
async def logout(request: Request):
    request.session.clear()
    if not settings.auth_enabled:
        return RedirectResponse(url="/")
    url = (
        f"https://login.microsoftonline.com/{settings.entra_tenant_id}"
        f"/oauth2/v2.0/logout?post_logout_redirect_uri={settings.app_base_url}"
    )
    return RedirectResponse(url=url)
