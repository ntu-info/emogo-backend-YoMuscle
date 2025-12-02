from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class Location(BaseModel):
    """GPS 位置資訊"""
    latitude: float = Field(..., ge=-90, le=90, description="緯度")
    longitude: float = Field(..., ge=-180, le=180, description="經度")
    altitude: Optional[float] = Field(default=None, description="海拔高度")
    accuracy: Optional[float] = Field(default=None, description="精確度（公尺）")
    address: Optional[str] = Field(default=None, description="反向地理編碼的地址")


class Mood(BaseModel):
    """心情記錄"""
    level: int = Field(..., ge=1, le=5, description="心情等級 1-5")
    emoji: Optional[str] = Field(default=None, description="對應的 emoji")
    label: Optional[str] = Field(default=None, description="心情標籤 (e.g., happy, sad)")


class Video(BaseModel):
    """影片資訊"""
    url: str = Field(..., description="影片儲存路徑或 URL")
    duration: Optional[float] = Field(default=None, description="影片長度（秒）")
    thumbnail_url: Optional[str] = Field(default=None, description="縮圖 URL")
    file_size: Optional[int] = Field(default=None, description="檔案大小（bytes）")


class Entry(BaseModel):
    """使用者單次記錄 - 整合所有欄位"""
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str = Field(..., description="使用者識別碼")
    
    # 核心內容 - 全部為 Optional
    memo: Optional[str] = Field(default=None, description="文字備忘錄")
    mood: Optional[Mood] = Field(default=None, description="心情")
    video: Optional[Video] = Field(default=None, description="影片")
    location: Optional[Location] = Field(default=None, description="GPS 位置")
    
    # 中繼資料
    client_id: str = Field(..., description="前端產生的唯一 ID（用於離線同步）")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    synced_at: Optional[datetime] = Field(default=None, description="同步時間")
    is_synced: bool = Field(default=False, description="同步狀態標記")
    
    # 額外標籤
    tags: Optional[List[str]] = Field(default=None, description="標籤列表")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "user_id": "user123",
                "memo": "今天心情不錯",
                "mood": {
                    "level": 4,
                    "emoji": "😊",
                    "label": "happy"
                },
                "location": {
                    "latitude": 25.0330,
                    "longitude": 121.5654,
                    "address": "台北市"
                },
                "client_id": "client-uuid-123",
                "tags": ["日常", "開心"]
            }
        }
