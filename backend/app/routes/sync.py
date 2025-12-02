from typing import List
from fastapi import APIRouter, Query

from app.schemas.sync import SyncRequest, SyncResponse, SyncStatus
from app.services.sync_service import SyncService

router = APIRouter(prefix="/sync", tags=["Sync"])


@router.post("/batch", response_model=SyncResponse)
async def batch_sync(sync_request: SyncRequest):
    """
    批次同步離線記錄
    
    當使用者按下 Sync 按鈕時，前端會將所有尚未同步的記錄一次傳送到這個 API。
    
    - 會檢查每筆記錄的 client_id 是否已存在
    - 已存在的記錄會被標記為重複（不會重複建立）
    - 回傳每筆記錄的同步結果
    
    **Request Body:**
    - **user_id**: 使用者識別碼
    - **entries**: 待同步的記錄列表
    
    **Response:**
    - **success**: 是否全部同步成功
    - **message**: 同步結果訊息
    - **result**: 同步統計資訊
    - **statuses**: 每筆記錄的同步狀態
    """
    response = await SyncService.batch_sync(sync_request)
    return response


@router.get("/status", response_model=List[SyncStatus])
async def check_sync_status(
    user_id: str = Query(..., description="使用者 ID"),
    client_ids: List[str] = Query(..., description="要檢查的 client_id 列表")
):
    """
    檢查記錄的同步狀態
    
    前端可以用這個 API 來檢查本地記錄是否已經同步到伺服器。
    
    **Query Parameters:**
    - **user_id**: 使用者識別碼
    - **client_ids**: 要檢查的 client_id 列表
    
    **Response:**
    - 每個 client_id 的同步狀態列表
    """
    statuses = await SyncService.check_sync_status(user_id, client_ids)
    return statuses
