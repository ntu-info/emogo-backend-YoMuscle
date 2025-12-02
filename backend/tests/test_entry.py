"""
Entry API 測試

測試涵蓋：
- 建立 Entry (POST /api/v1/entries)
- 取得 Entry 列表 (GET /api/v1/entries)
- 取得單一 Entry (GET /api/v1/entries/{entry_id})
- 更新 Entry (PUT /api/v1/entries/{entry_id})
- 刪除 Entry (DELETE /api/v1/entries/{entry_id})
"""
import pytest
from httpx import AsyncClient


class TestCreateEntry:
    """測試建立 Entry"""
    
    @pytest.mark.asyncio
    async def test_create_entry_with_all_fields(self, client: AsyncClient, sample_entry_data):
        """測試建立完整的 Entry（包含所有欄位）"""
        response = await client.post("/api/v1/entries", json=sample_entry_data)
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["user_id"] == sample_entry_data["user_id"]
        assert data["client_id"] == sample_entry_data["client_id"]
        assert data["memo"] == sample_entry_data["memo"]
        assert data["mood"]["level"] == sample_entry_data["mood"]["level"]
        assert data["location"]["latitude"] == sample_entry_data["location"]["latitude"]
        assert data["is_synced"] is True
        assert "_id" in data
    
    @pytest.mark.asyncio
    async def test_create_entry_minimal(self, client: AsyncClient, sample_entry_minimal):
        """測試建立最小化的 Entry（只有必填欄位）"""
        response = await client.post("/api/v1/entries", json=sample_entry_minimal)
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["user_id"] == sample_entry_minimal["user_id"]
        assert data["client_id"] == sample_entry_minimal["client_id"]
        assert data["memo"] is None
        assert data["mood"] is None
        assert data["location"] is None
    
    @pytest.mark.asyncio
    async def test_create_entry_duplicate_client_id(self, client: AsyncClient, sample_entry_data):
        """測試重複的 client_id 應該回傳 409 錯誤"""
        # 第一次建立
        response1 = await client.post("/api/v1/entries", json=sample_entry_data)
        assert response1.status_code == 201
        
        # 重複建立
        response2 = await client.post("/api/v1/entries", json=sample_entry_data)
        assert response2.status_code == 409
    
    @pytest.mark.asyncio
    async def test_create_entry_invalid_mood_level(self, client: AsyncClient):
        """測試無效的心情等級（超出 1-5 範圍）"""
        invalid_data = {
            "user_id": "test_user",
            "client_id": "client_invalid",
            "mood": {
                "level": 10  # 無效，應該在 1-5 之間
            }
        }
        
        response = await client.post("/api/v1/entries", json=invalid_data)
        assert response.status_code == 422  # Validation Error
    
    @pytest.mark.asyncio
    async def test_create_entry_invalid_location(self, client: AsyncClient):
        """測試無效的 GPS 座標"""
        invalid_data = {
            "user_id": "test_user",
            "client_id": "client_invalid_loc",
            "location": {
                "latitude": 200,  # 無效，應該在 -90 到 90 之間
                "longitude": 121.5654
            }
        }
        
        response = await client.post("/api/v1/entries", json=invalid_data)
        assert response.status_code == 422


class TestGetEntries:
    """測試取得 Entry 列表"""
    
    @pytest.mark.asyncio
    async def test_get_entries_empty(self, client: AsyncClient):
        """測試空列表"""
        response = await client.get("/api/v1/entries", params={"user_id": "test_user"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["entries"] == []
        assert data["total"] == 0
        assert data["page"] == 1
    
    @pytest.mark.asyncio
    async def test_get_entries_with_data(self, client: AsyncClient, sample_entry_data):
        """測試有資料的列表"""
        # 先建立幾筆資料
        for i in range(3):
            entry = sample_entry_data.copy()
            entry["client_id"] = f"client_{i}"
            await client.post("/api/v1/entries", json=entry)
        
        response = await client.get(
            "/api/v1/entries",
            params={"user_id": sample_entry_data["user_id"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["entries"]) == 3
        assert data["total"] == 3
    
    @pytest.mark.asyncio
    async def test_get_entries_pagination(self, client: AsyncClient, sample_entry_data):
        """測試分頁功能"""
        # 建立 5 筆資料
        for i in range(5):
            entry = sample_entry_data.copy()
            entry["client_id"] = f"page_client_{i}"
            await client.post("/api/v1/entries", json=entry)
        
        # 第一頁，每頁 2 筆
        response = await client.get(
            "/api/v1/entries",
            params={"user_id": sample_entry_data["user_id"], "page": 1, "page_size": 2}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["entries"]) == 2
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert data["total_pages"] == 3
    
    @pytest.mark.asyncio
    async def test_get_entries_filter_by_mood(self, client: AsyncClient):
        """測試根據心情等級篩選"""
        user_id = "filter_test_user"
        
        # 建立不同心情等級的記錄
        for i, level in enumerate([1, 3, 5, 3, 2]):
            entry = {
                "user_id": user_id,
                "client_id": f"mood_filter_{i}",
                "mood": {"level": level}
            }
            await client.post("/api/v1/entries", json=entry)
        
        # 篩選心情等級為 3 的記錄
        response = await client.get(
            "/api/v1/entries",
            params={"user_id": user_id, "mood_level": 3}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["entries"]) == 2
        for entry in data["entries"]:
            assert entry["mood"]["level"] == 3


class TestGetEntry:
    """測試取得單一 Entry"""
    
    @pytest.mark.asyncio
    async def test_get_entry_success(self, client: AsyncClient, sample_entry_data):
        """測試成功取得單一 Entry"""
        # 先建立
        create_response = await client.post("/api/v1/entries", json=sample_entry_data)
        entry_id = create_response.json()["_id"]
        
        # 取得
        response = await client.get(f"/api/v1/entries/{entry_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["_id"] == entry_id
        assert data["memo"] == sample_entry_data["memo"]
    
    @pytest.mark.asyncio
    async def test_get_entry_not_found(self, client: AsyncClient):
        """測試 Entry 不存在"""
        response = await client.get("/api/v1/entries/507f1f77bcf86cd799439011")
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_get_entry_invalid_id(self, client: AsyncClient):
        """測試無效的 Entry ID"""
        response = await client.get("/api/v1/entries/invalid_id")
        assert response.status_code == 404


class TestUpdateEntry:
    """測試更新 Entry"""
    
    @pytest.mark.asyncio
    async def test_update_entry_memo(self, client: AsyncClient, sample_entry_data):
        """測試更新備忘錄"""
        # 先建立
        create_response = await client.post("/api/v1/entries", json=sample_entry_data)
        entry_id = create_response.json()["_id"]
        
        # 更新
        update_data = {"memo": "更新後的備忘錄"}
        response = await client.put(f"/api/v1/entries/{entry_id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["memo"] == "更新後的備忘錄"
        # 其他欄位不變
        assert data["mood"]["level"] == sample_entry_data["mood"]["level"]
    
    @pytest.mark.asyncio
    async def test_update_entry_mood(self, client: AsyncClient, sample_entry_data):
        """測試更新心情"""
        # 先建立
        create_response = await client.post("/api/v1/entries", json=sample_entry_data)
        entry_id = create_response.json()["_id"]
        
        # 更新
        update_data = {"mood": {"level": 1, "emoji": "😢", "label": "sad"}}
        response = await client.put(f"/api/v1/entries/{entry_id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["mood"]["level"] == 1
        assert data["mood"]["emoji"] == "😢"
    
    @pytest.mark.asyncio
    async def test_update_entry_not_found(self, client: AsyncClient):
        """測試更新不存在的 Entry"""
        update_data = {"memo": "test"}
        response = await client.put(
            "/api/v1/entries/507f1f77bcf86cd799439011",
            json=update_data
        )
        assert response.status_code == 404


class TestDeleteEntry:
    """測試刪除 Entry"""
    
    @pytest.mark.asyncio
    async def test_delete_entry_success(self, client: AsyncClient, sample_entry_data):
        """測試成功刪除 Entry"""
        # 先建立
        create_response = await client.post("/api/v1/entries", json=sample_entry_data)
        entry_id = create_response.json()["_id"]
        
        # 刪除
        response = await client.delete(f"/api/v1/entries/{entry_id}")
        assert response.status_code == 204
        
        # 確認已刪除
        get_response = await client.get(f"/api/v1/entries/{entry_id}")
        assert get_response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_delete_entry_not_found(self, client: AsyncClient):
        """測試刪除不存在的 Entry"""
        response = await client.delete("/api/v1/entries/507f1f77bcf86cd799439011")
        assert response.status_code == 404
