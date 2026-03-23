from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    

    #cloudflare r2 settings
    r2_endpoint: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_bucket_name: str
    r2_account_id: str



    # App settings
    app_name: str = "NotePeel"
    debug: bool = True
    
    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/notepeel"
    
    # JWT Auth
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    
    # File upload settings
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    allowed_extensions: set = {"png", "jpg", "jpeg", "gif", "bmp", "tiff"}
    
    # Google Cloud - supports both API key and service account (optional now)
    google_cloud_api_key: str = ""
    google_application_credentials: str = ""
    
    # Google OAuth
    google_client_id: str = ""

    # Gemini AI
    gemini_api_key: str = ""

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
