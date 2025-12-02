"""
Sync API 測試

測試涵蓋：
- 批次同步 (POST /api/v1/sync/batch)
- 檢查同步狀態 (GET /api/v1/sync/status)
"""
import pytest
from httpx import AsyncClient


class TestBatchSync:
    """測試批次同步功能"""
    
    @pytest.mark.asyncio
    async def test_batch_sync_success(self, client: AsyncClient, sample_sync_request):
        """測試成功的批次同步"""
        response = await client.post("/api/v1/sync/batch", json=sample_sync_request)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["result"]["total_received"] == 3
        assert data["result"]["total_synced"] == 3
        assert data["result"]["total_failed"] == 0
        assert data["result"]["total_duplicates"] == 0
        
        # 檢查每筆記錄的狀態
        assert len(data["statuses"]) == 3
        for status in data["statuses"]:
            assert status["success"] is True
            assert status["server_id"] is not None
    
    @pytest.mark.asyncio
    async def test_batch_sync_with_duplicates(self, client: AsyncClient, sample_sync_request):
        """測試同步時遇到重複記錄"""
        # 第一次同步
        await client.post("/api/v1/sync/batch", json=sample_sync_request)
        
        # 第二次同步（相同資料）
        response = await client.post("/api/v1/sync/batch", json=sample_sync_request)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["result"]["total_synced"] == 0
        assert data["result"]["total_duplicates"] == 3
    
    @pytest.mark.asyncio
    async def test_batch_sync_partial(self, client: AsyncClient, sample_sync_request):
        """測試部分記錄已存在的情況"""
        # 先建立一筆記錄
        first_entry = {
            "user_id": sample_sync_request["user_id"],
            "client_id": sample_sync_request["entries"][0]["client_id"],
            "memo": "已存在的記錄"
        }
        await client.post("/api/v1/entries", json=first_entry)
        
        # 同步（其中一筆已存在）
        response = await client.post("/api/v1/sync/batch", json=sample_sync_request)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["result"]["total_received"] == 3
        assert data["result"]["total_synced"] == 2
        assert data["result"]["total_duplicates"] == 1
    
    @pytest.mark.asyncio
    async def test_batch_sync_empty(self, client: AsyncClient):
        """測試空的同步請求"""
        empty_request = {
            "user_id": "test_user",
            "entries": []
        }
        
        response = await client.post("/api/v1/sync/batch", json=empty_request)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert data["result"]["total_received"] == 0
        assert data["result"]["total_synced"] == 0
    
    @pytest.mark.asyncio
    async def test_batch_sync_preserves_created_at(self, client: AsyncClient):
        """測試同步時保留前端的建立時間"""
        sync_request = {
            "user_id": "test_user",
            "entries": [
                {
                    "user_id": "test_user",
                    "client_id": "offline_entry_1",
                    "memo": "離線建立的記錄",
                    "created_at": "2024-01-01T10:00:00"
                }
            ]
        }
        
        response = await client.post("/api/v1/sync/batch", json=sync_request)
        
        assert response.status_code == 200
        data = response.json()
        
        # 取得建立的記錄
        server_id = data["statuses"][0]["server_id"]
        entry_response = await client.get(f"/api/v1/entries/{server_id}")
        entry_data = entry_response.json()
        
        # 確認 created_at 被保留
        assert entry_data["created_at"].startswith("2024-01-01")


class TestSyncStatus:
    """測試同步狀態檢查"""
    
    @pytest.mark.asyncio
    async def test_check_sync_status_all_synced(self, client: AsyncClient, sample_entry_data):
        """測試檢查已同步的記錄"""
        # 先建立幾筆記錄
        client_ids = []
        for i in range(3):
            entry = sample_entry_data.copy()
            entry["client_id"] = f"status_check_{i}"
            client_ids.append(entry["client_id"])
            await client.post("/api/v1/entries", json=entry)
        
        # 檢查狀態
        response = await client.get(
            "/api/v1/sync/status",
            params={
                "user_id": sample_entry_data["user_id"],
                "client_ids": client_ids
            }
        )
        
        assert response.status_code == 200
        statuses = response.json()
        
        assert len(statuses) == 3
        for status in statuses:
            assert status["success"] is True
            assert status["server_id"] is not None
    
    @pytest.mark.asyncio
    async def test_check_sync_status_not_synced(self, client: AsyncClient):
        """測試檢查未同步的記錄"""
        response = await client.get(
            "/api/v1/sync/status",
            params={
                "user_id": "test_user",
                "client_ids": ["not_exists_1", "not_exists_2"]
            }
        )
        
        assert response.status_code == 200
        statuses = response.json()
        
        assert len(statuses) == 2
        for status in statuses:
            assert status["success"] is False
            assert "Not found" in status["error"]
    
    @pytest.mark.asyncio
    async def test_check_sync_status_mixed(self, client: AsyncClient, sample_entry_data):
        """測試混合狀態（部分已同步、部分未同步）"""
        # 只建立一筆
        entry = sample_entry_data.copy()
        entry["client_id"] = "mixed_status_1"
        await client.post("/api/v1/entries", json=entry)
        
        # 檢查狀態（一筆存在、一筆不存在）
        response = await client.get(
            "/api/v1/sync/status",
            params={
                "user_id": sample_entry_data["user_id"],
                "client_ids": ["mixed_status_1", "mixed_status_not_exist"]
            }
        )
        
        assert response.status_code == 200
        statuses = response.json()
        
        synced = [s for s in statuses if s["success"]]
        not_synced = [s for s in statuses if not s["success"]]
        
        assert len(synced) == 1
        assert len(not_synced) == 1
