from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class User(BaseModel):
    """用戶模型"""
    user_id: str = Field(..., description="用戶唯一識別碼")
    username: str = Field(..., description="用戶名稱（用於顯示）")
    email: Optional[str] = Field(None, description="電子郵件（可選）")
    device_id: Optional[str] = Field(None, description="裝置識別碼")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_john_doe_123",
                "username": "John Doe",
                "email": "john@example.com",
                "device_id": "device_abc123"
            }
        }
