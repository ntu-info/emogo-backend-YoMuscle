"""
影片上傳整合測試
測試完整的影片上傳流程：上傳影片 -> 建立 Entry -> 驗證資料庫 -> 檢查 Dashboard

測試涵蓋：
- 使用真實影片檔案上傳
- 建立包含影片的 Entry
- 驗證影片資料正確儲存到資料庫
- 驗證 Dashboard 可以顯示和播放影片
"""
import os
import pytest
from httpx import AsyncClient
from pathlib import Path


# 取得測試影片檔案路徑
# 支援大小寫不同的副檔名
TEST_VIDEO_PATH = Path(__file__).parent.parent.parent / "data" / "video_01.MP4"
if not TEST_VIDEO_PATH.exists():
    TEST_VIDEO_PATH = Path(__file__).parent.parent.parent / "data" / "video_01.mp4"


class TestVideoUploadIntegration:
    """測試影片上傳整合流程"""
    
    @pytest.mark.asyncio
    async def test_upload_real_video_file(self, client: AsyncClient):
        """測試上傳真實影片檔案"""
        # 檢查測試影片是否存在
        if not TEST_VIDEO_PATH.exists():
            pytest.skip(f"測試影片檔案不存在: {TEST_VIDEO_PATH}")
        
        user_id = "test_video_user_001"
        
        # 讀取真實影片檔案
        with open(TEST_VIDEO_PATH, "rb") as f:
            video_content = f.read()
        
        # 準備上傳資料
        files = {
            "file": (TEST_VIDEO_PATH.name, video_content, "video/mp4")
        }
        data = {"user_id": user_id}
        
        # 上傳影片
        response = await client.post("/api/v1/upload/video", files=files, data=data)
        
        assert response.status_code == 200, f"上傳失敗: {response.text}"
        result = response.json()
        
        # 驗證上傳結果
        assert result["success"] is True
        assert result["url"].startswith("/uploads/videos/")
        assert result["url"].endswith((".mp4", ".MP4"))
        assert result["file_size"] > 0
        assert result["file_size"] == len(video_content)
        assert "original_filename" in result
        
        # 驗證檔案確實存在於伺服器
        video_url = result["url"]
        video_response = await client.get(video_url)
        assert video_response.status_code == 200
        assert len(video_response.content) == result["file_size"]
    
    @pytest.mark.asyncio
    async def test_create_entry_with_video(self, client: AsyncClient):
        """測試建立包含影片的 Entry"""
        user_id = "test_entry_video_user"
        
        # 先上傳影片
        if not TEST_VIDEO_PATH.exists():
            pytest.skip(f"測試影片檔案不存在: {TEST_VIDEO_PATH}")
        
        with open(TEST_VIDEO_PATH, "rb") as f:
            video_content = f.read()
        
        files = {
            "file": (TEST_VIDEO_PATH.name, video_content, "video/mp4")
        }
        upload_data = {"user_id": user_id}
        
        upload_response = await client.post("/api/v1/upload/video", files=files, data=upload_data)
        assert upload_response.status_code == 200
        upload_result = upload_response.json()
        video_url = upload_result["url"]
        
        # 建立包含影片的 Entry
        entry_data = {
            "user_id": user_id,
            "client_id": f"client_with_video_{pytest.current_time if hasattr(pytest, 'current_time') else 'test'}",
            "memo": "這是一筆包含影片的測試記錄",
            "mood": {
                "level": 5,
                "emoji": "😄",
                "label": "happy"
            },
            "video": {
                "url": video_url,
                "file_size": upload_result["file_size"],
                "duration": None,
                "thumbnail_url": None
            },
            "location": {
                "latitude": 25.0330,
                "longitude": 121.5654,
                "accuracy": 10.5
            }
        }
        
        # 建立 Entry
        entry_response = await client.post("/api/v1/entries", json=entry_data)
        assert entry_response.status_code == 201, f"建立 Entry 失敗: {entry_response.text}"
        
        entry_result = entry_response.json()
        
        # 驗證 Entry 資料
        assert entry_result["user_id"] == user_id
        assert entry_result["memo"] == entry_data["memo"]
        assert entry_result["video"] is not None
        assert entry_result["video"]["url"] == video_url
        assert entry_result["video"]["file_size"] == upload_result["file_size"]
        assert entry_result["mood"]["level"] == 5
        assert entry_result["location"]["latitude"] == 25.0330
        assert "_id" in entry_result
        
        # 驗證可以透過 API 取得 Entry
        entry_id = entry_result["_id"]
        get_response = await client.get(f"/api/v1/entries/{entry_id}")
        assert get_response.status_code == 200
        
        retrieved_entry = get_response.json()
        assert retrieved_entry["video"] is not None
        assert retrieved_entry["video"]["url"] == video_url
    
    @pytest.mark.asyncio
    async def test_entry_list_includes_video(self, client: AsyncClient):
        """測試 Entry 列表包含影片資訊"""
        user_id = "test_list_video_user"
        
        # 上傳影片並建立 Entry
        if not TEST_VIDEO_PATH.exists():
            pytest.skip(f"測試影片檔案不存在: {TEST_VIDEO_PATH}")
        
        with open(TEST_VIDEO_PATH, "rb") as f:
            video_content = f.read()
        
        files = {
            "file": (TEST_VIDEO_PATH.name, video_content, "video/mp4")
        }
        upload_response = await client.post(
            "/api/v1/upload/video",
            files=files,
            data={"user_id": user_id}
        )
        assert upload_response.status_code == 200
        upload_result = upload_response.json()
        
        # 建立 Entry
        entry_data = {
            "user_id": user_id,
            "client_id": f"list_test_{pytest.current_time if hasattr(pytest, 'current_time') else 'test'}",
            "memo": "列表測試記錄",
            "video": {
                "url": upload_result["url"],
                "file_size": upload_result["file_size"]
            }
        }
        
        create_response = await client.post("/api/v1/entries", json=entry_data)
        assert create_response.status_code == 201
        
        # 取得 Entry 列表
        list_response = await client.get(
            "/api/v1/entries",
            params={"user_id": user_id, "page": 1, "page_size": 10}
        )
        assert list_response.status_code == 200
        
        list_result = list_response.json()
        assert list_result["total"] > 0
        assert len(list_result["entries"]) > 0
        
        # 找到剛建立的 Entry
        found_entry = None
        for entry in list_result["entries"]:
            if entry.get("client_id") == entry_data["client_id"]:
                found_entry = entry
                break
        
        assert found_entry is not None, "找不到剛建立的 Entry"
        assert found_entry["video"] is not None, "Entry 中沒有影片資料"
        assert found_entry["video"]["url"] == upload_result["url"]
    
    @pytest.mark.asyncio
    async def test_dashboard_displays_video(self, client: AsyncClient):
        """測試 Dashboard 可以顯示影片"""
        user_id = "test_dashboard_video_user"
        
        # 上傳影片並建立 Entry
        if not TEST_VIDEO_PATH.exists():
            pytest.skip(f"測試影片檔案不存在: {TEST_VIDEO_PATH}")
        
        with open(TEST_VIDEO_PATH, "rb") as f:
            video_content = f.read()
        
        files = {
            "file": (TEST_VIDEO_PATH.name, video_content, "video/mp4")
        }
        upload_response = await client.post(
            "/api/v1/upload/video",
            files=files,
            data={"user_id": user_id}
        )
        assert upload_response.status_code == 200
        upload_result = upload_response.json()
        
        # 建立 Entry
        entry_data = {
            "user_id": user_id,
            "client_id": f"dashboard_test_{pytest.current_time if hasattr(pytest, 'current_time') else 'test'}",
            "memo": "Dashboard 測試記錄",
            "video": {
                "url": upload_result["url"],
                "file_size": upload_result["file_size"]
            }
        }
        
        create_response = await client.post("/api/v1/entries", json=entry_data)
        assert create_response.status_code == 201
        
        # 取得 Dashboard 頁面
        dashboard_response = await client.get("/dashboard", params={"user_id": user_id})
        assert dashboard_response.status_code == 200
        
        dashboard_html = dashboard_response.text
        
        # 驗證 Dashboard HTML 包含影片相關內容
        assert "video" in dashboard_html.lower() or "影片" in dashboard_html
        assert upload_result["url"] in dashboard_html or "video-player" in dashboard_html.lower()
        
        # 驗證影片 URL 可以在 Dashboard 中存取
        video_url = upload_result["url"]
        video_check = await client.get(video_url)
        assert video_check.status_code == 200, f"無法存取影片: {video_url}"


class TestVideoSyncFlow:
    """測試影片同步流程（模擬前端同步行為）"""
    
    @pytest.mark.asyncio
    async def test_sync_entry_with_video(self, client: AsyncClient):
        """測試同步包含影片的 Entry"""
        user_id = "test_sync_video_user"
        
        if not TEST_VIDEO_PATH.exists():
            pytest.skip(f"測試影片檔案不存在: {TEST_VIDEO_PATH}")
        
        # 模擬前端同步流程：先上傳影片，再同步 Entry
        with open(TEST_VIDEO_PATH, "rb") as f:
            video_content = f.read()
        
        # 1. 上傳影片
        files = {
            "file": (TEST_VIDEO_PATH.name, video_content, "video/mp4")
        }
        upload_response = await client.post(
            "/api/v1/upload/video",
            files=files,
            data={"user_id": user_id}
        )
        assert upload_response.status_code == 200
        upload_result = upload_response.json()
        
        # 2. 使用 sync/batch API 同步 Entry（模擬前端批次同步）
        sync_data = {
            "user_id": user_id,
            "entries": [
                {
                    "user_id": user_id,
                    "client_id": f"sync_video_{pytest.current_time if hasattr(pytest, 'current_time') else 'test'}",
                    "memo": "同步測試記錄（含影片）",
                    "mood": {
                        "level": 4,
                        "emoji": "😊",
                        "label": "calm"
                    },
                    "video": {
                        "url": upload_result["url"],
                        "file_size": upload_result["file_size"]
                    },
                    "location": {
                        "latitude": 25.0330,
                        "longitude": 121.5654
                    }
                }
            ]
        }
        
        sync_response = await client.post("/api/v1/sync/batch", json=sync_data)
        assert sync_response.status_code == 200
        
        sync_result = sync_response.json()
        assert sync_result["success"] is True
        assert sync_result["result"]["total_synced"] == 1
        
        # 驗證同步後的 Entry 包含影片
        statuses = sync_result["statuses"]
        assert len(statuses) == 1
        assert statuses[0]["success"] is True
        assert statuses[0]["server_id"] is not None
        
        # 取得同步後的 Entry
        server_id = statuses[0]["server_id"]
        entry_response = await client.get(f"/api/v1/entries/{server_id}")
        assert entry_response.status_code == 200
        
        entry = entry_response.json()
        assert entry["video"] is not None
        assert entry["video"]["url"] == upload_result["url"]
        assert entry["memo"] == "同步測試記錄（含影片）"

