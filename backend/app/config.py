from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """應用程式設定"""
    
    # MongoDB Atlas
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "emogo_db"
    
    # App Settings
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "your-secret-key-change-in-production"
    
    # File Storage
    STORAGE_TYPE: str = "local"  # local or s3
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_BUCKET_NAME: Optional[str] = None
    AWS_REGION: Optional[str] = None
    
    # Upload Settings
    MAX_VIDEO_SIZE_MB: int = 100
    ALLOWED_VIDEO_TYPES: str = "mp4,mov,avi"
    UPLOAD_DIR: str = "uploads"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True
    )


settings = Settings()
