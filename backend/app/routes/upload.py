from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from app.services.storage_service import StorageService

router = APIRouter(prefix="/upload", tags=["Upload"])


class VideoUploadResponse(BaseModel):
    """影片上傳回應"""
    success: bool
    url: str
    file_size: int
    original_filename: str
    message: str


@router.post("/video", response_model=VideoUploadResponse)
async def upload_video(
    file: UploadFile = File(..., description="影片檔案"),
    user_id: str = Form(..., description="使用者 ID")
):
    """
    上傳影片檔案
    
    - 支援的格式: mp4, mov, avi
    - 檔案大小限制: 100MB（可在設定中調整）
    
    **Form Data:**
    - **file**: 影片檔案
    - **user_id**: 使用者識別碼
    
    **Response:**
    - **url**: 影片的存取 URL（用於建立 Entry 時的 video.url）
    - **file_size**: 檔案大小（bytes）
    """
    try:
        result = await StorageService.save_video(file, user_id)
        
        return VideoUploadResponse(
            success=True,
            url=result["url"],
            file_size=result["file_size"],
            original_filename=result["original_filename"],
            message="影片上傳成功"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上傳失敗: {str(e)}")


@router.delete("/video")
async def delete_video(video_url: str):
    """
    刪除影片檔案
    
    **Query Parameters:**
    - **video_url**: 影片的 URL 路徑
    """
    deleted = await StorageService.delete_video(video_url)
    
    if not deleted:
        raise HTTPException(status_code=404, detail="影片不存在或刪除失敗")
    
    return {"success": True, "message": "影片已刪除"}
