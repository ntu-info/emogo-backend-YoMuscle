from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

from app.schemas.entry import EntryCreate, EntryResponse


class SyncStatus(BaseModel):
    """單一記錄同步狀態"""
    client_id: str
    success: bool
    error: Optional[str] = None
    server_id: Optional[str] = None  # 同步成功後的伺服器端 ID


class SyncRequest(BaseModel):
    """批次同步請求 Schema"""
    user_id: str = Field(..., min_length=1)
    entries: List[EntryCreate] = Field(..., description="待同步的記錄列表")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user123",
                "entries": [
                    {
                        "user_id": "user123",
                        "client_id": "client-uuid-1",
                        "memo": "第一筆離線記錄",
                        "mood": {"level": 3},
                        "created_at": "2024-01-01T10:00:00Z"
                    },
                    {
                        "user_id": "user123", 
                        "client_id": "client-uuid-2",
                        "memo": "第二筆離線記錄",
                        "location": {
                            "latitude": 25.0330,
                            "longitude": 121.5654
                        },
                        "created_at": "2024-01-01T11:00:00Z"
                    }
                ]
            }
        }
    )


class SyncResult(BaseModel):
    """同步結果詳情"""
    total_received: int = Field(..., description="收到的記錄數量")
    total_synced: int = Field(..., description="成功同步的記錄數量")
    total_failed: int = Field(..., description="同步失敗的記錄數量")
    total_duplicates: int = Field(default=0, description="重複的記錄數量（已存在）")


class SyncResponse(BaseModel):
    """批次同步回應 Schema"""
    success: bool
    message: str
    result: SyncResult
    statuses: List[SyncStatus] = Field(..., description="每筆記錄的同步狀態")
    synced_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "同步完成",
                "result": {
                    "total_received": 2,
                    "total_synced": 2,
                    "total_failed": 0,
                    "total_duplicates": 0
                },
                "statuses": [
                    {
                        "client_id": "client-uuid-1",
                        "success": True,
                        "server_id": "server-id-1"
                    },
                    {
                        "client_id": "client-uuid-2",
                        "success": True,
                        "server_id": "server-id-2"
                    }
                ],
                "synced_at": "2024-01-01T12:00:00Z"
            }
        }
    )
