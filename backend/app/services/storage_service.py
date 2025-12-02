import os
import uuid
import aiofiles
from datetime import datetime
from typing import Optional
from fastapi import UploadFile

from app.config import settings


class StorageService:
    """檔案儲存服務"""
    
    @classmethod
    def _get_upload_dir(cls) -> str:
        """取得上傳目錄路徑"""
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), settings.UPLOAD_DIR)
        os.makedirs(upload_dir, exist_ok=True)
        return upload_dir
    
    @classmethod
    def _generate_filename(cls, original_filename: str) -> str:
        """產生唯一的檔案名稱"""
        ext = os.path.splitext(original_filename)[1].lower()
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_id = uuid.uuid4().hex[:8]
        return f"{timestamp}_{unique_id}{ext}"
    
    @classmethod
    def _is_allowed_video_type(cls, filename: str) -> bool:
        """檢查是否為允許的影片類型"""
        ext = os.path.splitext(filename)[1].lower().lstrip('.')
        allowed_types = settings.ALLOWED_VIDEO_TYPES.split(',')
        return ext in allowed_types
    
    @classmethod
    async def save_video(cls, file: UploadFile, user_id: str) -> dict:
        """儲存影片檔案（本地儲存）"""
        if not cls._is_allowed_video_type(file.filename):
            raise ValueError(f"不支援的影片格式。允許的格式: {settings.ALLOWED_VIDEO_TYPES}")
        
        # 建立使用者專屬目錄
        user_dir = os.path.join(cls._get_upload_dir(), "videos", user_id)
        os.makedirs(user_dir, exist_ok=True)
        
        # 產生唯一檔名
        new_filename = cls._generate_filename(file.filename)
        file_path = os.path.join(user_dir, new_filename)
        
        # 讀取並寫入檔案
        file_size = 0
        async with aiofiles.open(file_path, 'wb') as out_file:
            while content := await file.read(1024 * 1024):  # 1MB chunks
                file_size += len(content)
                
                # 檢查檔案大小限制
                if file_size > settings.MAX_VIDEO_SIZE_MB * 1024 * 1024:
                    # 刪除已寫入的部分
                    await out_file.close()
                    os.remove(file_path)
                    raise ValueError(f"檔案大小超過限制 ({settings.MAX_VIDEO_SIZE_MB}MB)")
                
                await out_file.write(content)
        
        # 產生相對 URL
        relative_url = f"/uploads/videos/{user_id}/{new_filename}"
        
        return {
            "url": relative_url,
            "file_size": file_size,
            "original_filename": file.filename,
            "saved_filename": new_filename
        }
    
    @classmethod
    async def delete_video(cls, video_url: str) -> bool:
        """刪除影片檔案"""
        try:
            # 從 URL 解析檔案路徑
            relative_path = video_url.lstrip('/')
            file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), relative_path)
            
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
            return False
        except Exception:
            return False
    
    @classmethod
    async def save_video_to_s3(cls, file: UploadFile, user_id: str) -> dict:
        """儲存影片到 AWS S3（未來擴充）"""
        # TODO: 實作 S3 上傳
        raise NotImplementedError("S3 storage not implemented yet")
