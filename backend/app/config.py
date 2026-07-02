from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8-sig", extra="ignore"
    )

    # Postgres — the app connects locally as the least-privilege rpp_app role.
    database_url: str = "host=localhost dbname=rpp user=rpp_app password=CHANGE_ME"

    # Comma-separated allowed origins for the browser frontend.
    cors_origins: str = "*"

    # Entra ID SSO — filled in when auth is wired up. While False, a dev user
    # is assumed (do NOT deploy to prod with auth disabled).
    auth_enabled: bool = False
    entra_tenant_id: str = ""
    entra_client_id: str = ""

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
