"""
簡單的測試腳本來驗證影片格式驗證邏輯
"""
import io
from app.services.storage_service import StorageService
from fastapi import UploadFile

async def test_invalid_format():
    """測試無效格式應該被拒絕"""
    # 模擬上傳 .txt 檔案
    file_content = b"this is not a video"
    file = UploadFile(
        filename="test.txt",
        file=io.BytesIO(file_content)
    )
    file.content_type = "text/plain"
    
    try:
        result = await StorageService.save_video(file, "test_user")
        print(f"❌ 測試失敗：應該拒絕 .txt 檔案，但卻接受了")
        print(f"   結果: {result}")
        return False
    except ValueError as e:
        print(f"✅ 測試通過：正確拒絕了 .txt 檔案")
        print(f"   錯誤訊息: {e}")
        return True

async def test_valid_format():
    """測試有效格式應該被接受"""
    # 模擬上傳 .mp4 檔案
    file_content = b"fake mp4 video content" * 100
    file = UploadFile(
        filename="test_video.mp4",
        file=io.BytesIO(file_content)
    )
    file.content_type = "video/mp4"
    
    try:
        result = await StorageService.save_video(file, "test_user")
        print(f"✅ 測試通過：正確接受了 .mp4 檔案")
        print(f"   結果 URL: {result['url']}")
        return True
    except ValueError as e:
        print(f"❌ 測試失敗：應該接受 .mp4 檔案，但卻拒絕了")
        print(f"   錯誤訊息: {e}")
        return False

if __name__ == "__main__":
    import asyncio
    
    print("=" * 60)
    print("測試影片格式驗證邏輯")
    print("=" * 60)
    
    print("\n1. 測試無效格式 (.txt):")
    result1 = asyncio.run(test_invalid_format())
    
    print("\n2. 測試有效格式 (.mp4):")
    result2 = asyncio.run(test_valid_format())
    
    print("\n" + "=" * 60)
    if result1 and result2:
        print("✅ 所有測試通過！")
    else:
        print("❌ 部分測試失敗")
    print("=" * 60)

