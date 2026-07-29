from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Absolute path to backend/.env so config loads no matter the working directory
# (uvicorn/systemd may launch from anywhere).
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE, env_file_encoding="utf-8-sig", extra="ignore"
    )

    # Postgres — the app connects locally as the least-privilege rpp_app role.
    database_url: str = "host=localhost dbname=rpp user=rpp_app password=CHANGE_ME"

    # Where uploaded attachment files are stored (outside the repo).
    upload_dir: str = "/var/lib/rpp/uploads"

    # Public URL of the app (used for OAuth redirect + logout).
    app_base_url: str = "https://rpp.cascointernal.com"

    # Entra ID SSO (Backend-For-Frontend / confidential client). While
    # auth_enabled is False a dev user is assumed — do NOT ship prod that way.
    auth_enabled: bool = False
    entra_tenant_id: str = ""
    entra_client_id: str = ""
    entra_client_secret: str = ""

    # Signs the HttpOnly session cookie. Set a long random value in prod.
    session_secret: str = "dev-insecure-change-me"
    session_ttl: int = 60 * 60 * 8  # 8h

    # Email notifications (Office 365 SMTP). Notifications are disabled
    # until smtp_user, smtp_password and notify_drawings_to are all set.
    smtp_host: str = "smtp.office365.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    # Comma-separated recipient list for the "drawings required" alert.
    notify_drawings_to: str = ""
    # Optional comma-separated BCC list (envelope-only; header never sent).
    notify_drawings_bcc: str = ""
    # Same, for the "drawing concluded" alert.
    notify_drawings_done_to: str = ""
    notify_drawings_done_bcc: str = ""

    @property
    def cors_list(self) -> list[str]:
        return [self.app_base_url]


settings = Settings()
