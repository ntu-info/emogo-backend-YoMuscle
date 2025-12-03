from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class UserRegisterRequest(BaseModel):
    """用戶註冊請求"""
    username: str = Field(..., min_length=1, max_length=50, description="用戶名稱")
    email: Optional[str] = Field(None, description="電子郵件（可選）")
    device_id: Optional[str] = Field(None, description="裝置識別碼")
    
    class Config:
        json_schema_extra = {
            "example": {
                "username": "小明",
                "email": "ming@example.com"
            }
        }


class UserLoginRequest(BaseModel):
    """用戶登入請求（簡單版，用 username 登入）"""
    username: str = Field(..., description="用戶名稱")
    device_id: Optional[str] = Field(None, description="裝置識別碼")


class UserResponse(BaseModel):
    """用戶回應"""
    user_id: str
    username: str
    email: Optional[str] = None
    created_at: datetime
    last_login: datetime
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_xiaoming_1701234567890",
                "username": "小明",
                "email": "ming@example.com",
                "created_at": "2025-12-03T01:00:00",
                "last_login": "2025-12-03T01:00:00"
            }
        }


class UserListResponse(BaseModel):
    """用戶列表回應"""
    users: list[UserResponse]
    total: int
