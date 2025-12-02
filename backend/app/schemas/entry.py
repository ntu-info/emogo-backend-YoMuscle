from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class LocationCreate(BaseModel):
    """GPS 位置建立 Schema"""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    altitude: Optional[float] = None
    accuracy: Optional[float] = None
    address: Optional[str] = None


class MoodCreate(BaseModel):
    """心情建立 Schema"""
    level: int = Field(..., ge=1, le=5)
    emoji: Optional[str] = None
    label: Optional[str] = None


class VideoCreate(BaseModel):
    """影片建立 Schema"""
    url: str
    duration: Optional[float] = None
    thumbnail_url: Optional[str] = None
    file_size: Optional[int] = None


class EntryCreate(BaseModel):
    """建立 Entry 的請求 Schema"""
    user_id: str = Field(..., min_length=1)
    client_id: str = Field(..., min_length=1, description="前端產生的唯一 ID")
    
    # 核心內容 - 全部 Optional
    memo: Optional[str] = None
    mood: Optional[MoodCreate] = None
    video: Optional[VideoCreate] = None
    location: Optional[LocationCreate] = None
    
    # 可選欄位
    tags: Optional[List[str]] = None
    created_at: Optional[datetime] = None  # 允許前端傳入離線時的建立時間

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user123",
                "client_id": "client-uuid-123",
                "memo": "今天心情不錯",
                "mood": {
                    "level": 4,
                    "emoji": "😊",
                    "label": "happy"
                },
                "location": {
                    "latitude": 25.0330,
                    "longitude": 121.5654
                },
                "tags": ["日常"]
            }
        }
    )


class EntryUpdate(BaseModel):
    """更新 Entry 的請求 Schema"""
    memo: Optional[str] = None
    mood: Optional[MoodCreate] = None
    video: Optional[VideoCreate] = None
    location: Optional[LocationCreate] = None
    tags: Optional[List[str]] = None


class LocationResponse(BaseModel):
    """GPS 位置回應 Schema"""
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    accuracy: Optional[float] = None
    address: Optional[str] = None


class MoodResponse(BaseModel):
    """心情回應 Schema"""
    level: int
    emoji: Optional[str] = None
    label: Optional[str] = None


class VideoResponse(BaseModel):
    """影片回應 Schema"""
    url: str
    duration: Optional[float] = None
    thumbnail_url: Optional[str] = None
    file_size: Optional[int] = None


class EntryResponse(BaseModel):
    """Entry 回應 Schema"""
    id: str = Field(..., alias="_id", serialization_alias="_id")
    user_id: str
    client_id: str
    
    memo: Optional[str] = None
    mood: Optional[MoodResponse] = None
    video: Optional[VideoResponse] = None
    location: Optional[LocationResponse] = None
    
    tags: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    is_synced: bool

    model_config = ConfigDict(populate_by_name=True, by_alias=True)


class EntryListResponse(BaseModel):
    """Entry 列表回應 Schema"""
    entries: List[EntryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
