from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
import math

from app.schemas.entry import (
    EntryCreate,
    EntryUpdate,
    EntryResponse,
    EntryListResponse
)
from app.services.entry_service import EntryService

router = APIRouter(prefix="/entries", tags=["Entries"])


@router.post("", response_model=EntryResponse, status_code=201, response_model_by_alias=True)
async def create_entry(entry: EntryCreate):
    """
    建立新的記錄
    
    - **user_id**: 使用者識別碼（必填）
    - **client_id**: 前端產生的唯一 ID（必填，用於離線同步）
    - **memo**: 文字備忘錄（選填）
    - **mood**: 心情記錄（選填）
    - **video**: 影片資訊（選填）
    - **location**: GPS 位置（選填）
    - **tags**: 標籤列表（選填）
    """
    # 檢查 client_id 是否已存在
    existing = await EntryService.get_by_client_id(entry.client_id, entry.user_id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Entry with client_id '{entry.client_id}' already exists"
        )
    
    created_entry = await EntryService.create(entry)
    return created_entry


@router.get("", response_model=EntryListResponse, response_model_by_alias=True)
async def get_entries(
    user_id: str = Query(..., description="使用者 ID"),
    page: int = Query(1, ge=1, description="頁碼"),
    page_size: int = Query(20, ge=1, le=100, description="每頁數量"),
    start_date: Optional[datetime] = Query(None, description="開始日期"),
    end_date: Optional[datetime] = Query(None, description="結束日期"),
    mood_level: Optional[int] = Query(None, ge=1, le=5, description="心情等級篩選"),
    tags: Optional[List[str]] = Query(None, description="標籤篩選")
):
    """
    取得記錄列表
    
    支援分頁與多種篩選條件
    """
    entries, total = await EntryService.get_list(
        user_id=user_id,
        page=page,
        page_size=page_size,
        start_date=start_date,
        end_date=end_date,
        mood_level=mood_level,
        tags=tags
    )
    
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    
    return EntryListResponse(
        entries=entries,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/{entry_id}", response_model=EntryResponse, response_model_by_alias=True)
async def get_entry(entry_id: str):
    """
    取得單一記錄
    """
    entry = await EntryService.get_by_id(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.put("/{entry_id}", response_model=EntryResponse, response_model_by_alias=True)
async def update_entry(entry_id: str, entry: EntryUpdate):
    """
    更新記錄
    
    只更新有提供的欄位
    """
    # 檢查記錄是否存在
    existing = await EntryService.get_by_id(entry_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    updated_entry = await EntryService.update(entry_id, entry)
    return updated_entry


@router.delete("/{entry_id}", status_code=204)
async def delete_entry(entry_id: str):
    """
    刪除記錄
    """
    # 檢查記錄是否存在
    existing = await EntryService.get_by_id(entry_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    deleted = await EntryService.delete(entry_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete entry")
    
    return None
