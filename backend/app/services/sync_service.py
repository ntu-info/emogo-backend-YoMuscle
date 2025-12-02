from datetime import datetime
from typing import List

from app.schemas.entry import EntryCreate
from app.schemas.sync import SyncRequest, SyncResponse, SyncResult, SyncStatus
from app.services.entry_service import EntryService


class SyncService:
    """離線同步業務邏輯服務"""
    
    @classmethod
    async def batch_sync(cls, sync_request: SyncRequest) -> SyncResponse:
        """批次同步離線記錄"""
        statuses: List[SyncStatus] = []
        total_synced = 0
        total_failed = 0
        total_duplicates = 0
        
        for entry_data in sync_request.entries:
            try:
                # 檢查是否已存在（根據 client_id）
                existing = await EntryService.get_by_client_id(
                    client_id=entry_data.client_id,
                    user_id=entry_data.user_id
                )
                
                if existing:
                    # 已存在，標記為重複
                    total_duplicates += 1
                    statuses.append(SyncStatus(
                        client_id=entry_data.client_id,
                        success=True,
                        server_id=existing["_id"],
                        error="Duplicate entry, already synced"
                    ))
                    continue
                
                # 建立新記錄
                created_entry = await EntryService.create(entry_data)
                total_synced += 1
                
                statuses.append(SyncStatus(
                    client_id=entry_data.client_id,
                    success=True,
                    server_id=created_entry["_id"]
                ))
                
            except Exception as e:
                total_failed += 1
                statuses.append(SyncStatus(
                    client_id=entry_data.client_id,
                    success=False,
                    error=str(e)
                ))
        
        # 決定整體成功狀態
        all_success = total_failed == 0
        
        return SyncResponse(
            success=all_success,
            message=cls._generate_message(total_synced, total_failed, total_duplicates),
            result=SyncResult(
                total_received=len(sync_request.entries),
                total_synced=total_synced,
                total_failed=total_failed,
                total_duplicates=total_duplicates
            ),
            statuses=statuses,
            synced_at=datetime.utcnow()
        )
    
    @classmethod
    def _generate_message(cls, synced: int, failed: int, duplicates: int) -> str:
        """產生同步結果訊息"""
        if failed == 0 and duplicates == 0:
            return f"同步完成，成功同步 {synced} 筆記錄"
        elif failed == 0:
            return f"同步完成，成功同步 {synced} 筆記錄，{duplicates} 筆為重複記錄"
        else:
            return f"同步部分完成，成功 {synced} 筆，失敗 {failed} 筆，重複 {duplicates} 筆"
    
    @classmethod
    async def check_sync_status(cls, user_id: str, client_ids: List[str]) -> List[SyncStatus]:
        """檢查多個 client_id 的同步狀態"""
        statuses: List[SyncStatus] = []
        
        for client_id in client_ids:
            existing = await EntryService.get_by_client_id(
                client_id=client_id,
                user_id=user_id
            )
            
            if existing:
                statuses.append(SyncStatus(
                    client_id=client_id,
                    success=True,
                    server_id=existing["_id"]
                ))
            else:
                statuses.append(SyncStatus(
                    client_id=client_id,
                    success=False,
                    error="Not found on server"
                ))
        
        return statuses
