"""
Upload API 測試

測試涵蓋：
- 影片上傳 (POST /api/v1/upload/video)
- 影片刪除 (DELETE /api/v1/upload/video)
"""
import io
import pytest
from httpx import AsyncClient


class TestVideoUpload:
    """測試影片上傳功能"""
    
    @pytest.mark.asyncio
    async def test_upload_video_success(self, client: AsyncClient):
        """測試成功上傳影片"""
        # 建立模擬的影片檔案
        video_content = b"fake video content for testing" * 100
        files = {
            "file": ("test_video.mp4", io.BytesIO(video_content), "video/mp4")
        }
        data = {"user_id": "test_user_123"}
        
        response = await client.post("/api/v1/upload/video", files=files, data=data)
        
        assert response.status_code == 200
        result = response.json()
        
        assert result["success"] is True
        assert result["url"].startswith("/uploads/videos/")
        assert result["url"].endswith(".mp4")
        assert result["file_size"] > 0
        assert result["original_filename"] == "test_video.mp4"
    
    @pytest.mark.asyncio
    async def test_upload_video_invalid_format(self, client: AsyncClient):
        """測試上傳不支援的格式"""
        # 建立模擬的 txt 檔案
        file_content = b"this is not a video"
        files = {
            "file": ("test.txt", io.BytesIO(file_content), "text/plain")
        }
        data = {"user_id": "test_user_123"}
        
        response = await client.post("/api/v1/upload/video", files=files, data=data)
        
        assert response.status_code == 400
        assert "不支援的影片格式" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_upload_video_mov_format(self, client: AsyncClient):
        """測試上傳 MOV 格式"""
        video_content = b"fake mov video content" * 100
        files = {
            "file": ("test_video.mov", io.BytesIO(video_content), "video/quicktime")
        }
        data = {"user_id": "test_user_123"}
        
        response = await client.post("/api/v1/upload/video", files=files, data=data)
        
        assert response.status_code == 200
        result = response.json()
        assert result["url"].endswith(".mov")
    
    @pytest.mark.asyncio
    async def test_upload_video_missing_user_id(self, client: AsyncClient):
        """測試缺少 user_id"""
        video_content = b"fake video content"
        files = {
            "file": ("test_video.mp4", io.BytesIO(video_content), "video/mp4")
        }
        
        response = await client.post("/api/v1/upload/video", files=files)
        
        assert response.status_code == 422  # Validation Error
    
    @pytest.mark.asyncio
    async def test_upload_video_missing_file(self, client: AsyncClient):
        """測試缺少檔案"""
        data = {"user_id": "test_user_123"}
        
        response = await client.post("/api/v1/upload/video", data=data)
        
        assert response.status_code == 422


class TestVideoDelete:
    """測試影片刪除功能"""
    
    @pytest.mark.asyncio
    async def test_delete_video_not_found(self, client: AsyncClient):
        """測試刪除不存在的影片"""
        response = await client.delete(
            "/api/v1/upload/video",
            params={"video_url": "/uploads/videos/not_exists/fake.mp4"}
        )
        
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_delete_video_success(self, client: AsyncClient):
        """測試成功上傳後刪除影片"""
        # 先上傳
        video_content = b"fake video content for delete test" * 100
        files = {
            "file": ("delete_test.mp4", io.BytesIO(video_content), "video/mp4")
        }
        data = {"user_id": "delete_test_user"}
        
        upload_response = await client.post("/api/v1/upload/video", files=files, data=data)
        assert upload_response.status_code == 200
        
        video_url = upload_response.json()["url"]
        
        # 刪除
        delete_response = await client.delete(
            "/api/v1/upload/video",
            params={"video_url": video_url}
        )
        
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] is True
