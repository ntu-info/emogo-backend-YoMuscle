from app.routes.entry import router as entry_router
from app.routes.sync import router as sync_router
from app.routes.upload import router as upload_router
from app.routes.dashboard import router as dashboard_router

__all__ = ["entry_router", "sync_router", "upload_router", "dashboard_router"]
