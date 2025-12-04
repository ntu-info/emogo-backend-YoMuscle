import os
import uuid
import mimetypes
import aiofiles
from datetime import datetime
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
        if not ext:
            ext = ".mp4"
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_id = uuid.uuid4().hex[:8]
        return f"{timestamp}_{unique_id}{ext}"
    
    @classmethod
    def _is_allowed_video_type(cls, name_or_extension: str) -> bool:
        """檢查是否為允許的影片類型"""
        ext = os.path.splitext(name_or_extension)[1].lower()
        if ext:
            ext = ext.lstrip('.')
        else:
            ext = name_or_extension.lower().lstrip('.')
        allowed_types = [
            file_type.strip().lower()
            for file_type in settings.ALLOWED_VIDEO_TYPES.split(',')
            if file_type.strip()
        ]
        return ext in allowed_types
    
    @classmethod
    async def save_video(cls, file: UploadFile, user_id: str) -> dict:
        """儲存影片檔案（本地儲存）"""
        allowed_extensions = [
            file_type.strip().lower()
            for file_type in settings.ALLOWED_VIDEO_TYPES.split(',')
            if file_type.strip()
        ]
        
        original_filename = file.filename or ""
        content_type = (file.content_type or "").lower()
        
        # 先從檔名取得副檔名
        ext = os.path.splitext(original_filename)[1].lower()
        ext_without_dot = ext.lstrip('.')
        
        # 如果檔名有副檔名，檢查是否為允許的格式
        if ext_without_dot:
            if ext_without_dot not in allowed_extensions:
                # 副檔名不符合，檢查 content_type 是否為影片格式
                if not content_type.startswith('video/'):
                    # 既不是允許的副檔名，也不是影片的 content_type，拒絕
                    raise ValueError(f"不支援的影片格式。允許的格式: {settings.ALLOWED_VIDEO_TYPES}")
                # 是影片格式但副檔名不對，從 content_type 推斷正確的副檔名
                content_type_map = {
                    "video/quicktime": "mov",
                    "video/mp4": "mp4",
                    "video/mpeg4": "mp4",
                    "video/x-msvideo": "avi",
                    "video/avi": "avi",
                }
                if content_type in content_type_map:
                    ext = f".{content_type_map[content_type]}"
                    ext_without_dot = content_type_map[content_type]
                else:
                    # 無法推斷，拒絕
                    raise ValueError(f"無法從 content_type 推斷影片格式。允許的格式: {settings.ALLOWED_VIDEO_TYPES}")
        else:
            # 沒有副檔名，從 content_type 推斷
            if not content_type.startswith('video/'):
                # 沒有副檔名且不是影片格式，拒絕
                raise ValueError(f"檔案缺少副檔名且 content_type 不是影片格式。允許的格式: {settings.ALLOWED_VIDEO_TYPES}")
            
            content_type_map = {
                "video/quicktime": "mov",
                "video/mp4": "mp4",
                "video/mpeg4": "mp4",
                "video/x-msvideo": "avi",
                "video/avi": "avi",
            }
            if content_type in content_type_map:
                ext = f".{content_type_map[content_type]}"
                ext_without_dot = content_type_map[content_type]
            else:
                guessed_ext = mimetypes.guess_extension(content_type)
                if guessed_ext:
                    guessed_ext_clean = guessed_ext.lstrip('.').lower()
                    if guessed_ext_clean in allowed_extensions:
                        ext = guessed_ext.lower()
                        ext_without_dot = guessed_ext_clean
                    else:
                        raise ValueError(f"無法推斷支援的影片格式。允許的格式: {settings.ALLOWED_VIDEO_TYPES}")
                else:
                    raise ValueError(f"無法從 content_type 推斷影片格式。允許的格式: {settings.ALLOWED_VIDEO_TYPES}")
        
        # 確保最終的副檔名是允許的
        if ext_without_dot not in allowed_extensions:
            raise ValueError(f"不支援的影片格式。允許的格式: {settings.ALLOWED_VIDEO_TYPES}")
        
        # 更新檔名
        if not original_filename:
            original_filename = f"uploaded_video{ext}"
        else:
            original_filename = original_filename.split('/')[-1]
            if not original_filename.lower().endswith(ext):
                original_filename = f"{original_filename}{ext}"
        
        # 建立使用者專屬目錄
        user_dir = os.path.join(cls._get_upload_dir(), "videos", user_id)
        os.makedirs(user_dir, exist_ok=True)
        
        # 產生唯一檔名
        new_filename = cls._generate_filename(original_filename)
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
            "original_filename": original_filename,
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
