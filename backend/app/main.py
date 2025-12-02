from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import settings
from app.database import database
from app.routes import entry_router, sync_router, upload_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期管理"""
    # 啟動時連接資料庫
    await database.connect()
    yield
    # 關閉時斷開連接
    await database.disconnect()


# 建立 FastAPI 應用程式
app = FastAPI(
    title="Emogo Backend API",
    description="""
    Emogo 後端 API 服務
    
    ## 功能
    
    * **Entries** - 記錄管理（包含 memo、mood、video、location）
    * **Sync** - 離線同步功能
    * **Upload** - 影片上傳服務
    
    ## 離線同步流程
    
    1. 前端在本地建立記錄時，產生一個唯一的 `client_id`
    2. 網路連通時，前端呼叫 `/api/v1/entries` 即時上傳
    3. 網路斷線時，記錄暫存在本地
    4. 恢復連線後，使用者按下 Sync 按鈕
    5. 前端呼叫 `/api/v1/sync/batch` 批次上傳
    6. 後端回傳每筆記錄的同步結果
    """,
    version="1.0.0",
    lifespan=lifespan
)

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生產環境應該限制來源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 確保 uploads 目錄存在
uploads_dir = os.path.join(os.path.dirname(__file__), "..", settings.UPLOAD_DIR)
os.makedirs(uploads_dir, exist_ok=True)

# 掛載靜態檔案（用於影片存取）
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# 註冊路由
app.include_router(entry_router, prefix="/api/v1")
app.include_router(sync_router, prefix="/api/v1")
app.include_router(upload_router, prefix="/api/v1")


@app.get("/")
async def root():
    """API 根路徑"""
    return {
        "message": "Welcome to Emogo Backend API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
async def health_check():
    """健康檢查端點"""
    return {
        "status": "healthy",
        "database": "connected" if database.client else "disconnected"
    }
