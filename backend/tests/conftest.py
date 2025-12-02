"""
測試配置和共用 fixtures
"""
import asyncio
import uuid
from typing import AsyncGenerator, Generator
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient

from app.main import app
from app.database import database
from app.config import settings


# 測試用的 MongoDB URL（使用本地 MongoDB 或測試專用的 Atlas）
TEST_MONGODB_URL = "mongodb://localhost:27017"
TEST_DATABASE_NAME = "emogo_test_db"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """建立事件迴圈"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def test_db():
    """
    測試用資料庫 fixture
    每個測試函數使用唯一的資料庫名稱確保隔離
    """
    # 使用唯一的資料庫名稱
    unique_db_name = f"{TEST_DATABASE_NAME}_{uuid.uuid4().hex[:8]}"
    
    # 連接測試資料庫
    client = AsyncIOMotorClient(TEST_MONGODB_URL)
    test_database = client[unique_db_name]
    
    # 替換全域資料庫實例
    database.client = client
    # 覆蓋 get_database 方法使用測試資料庫
    original_get_database = database.get_database
    database.get_database = lambda: test_database
    database.get_collection = lambda name: test_database[name]
    
    yield test_database
    
    # 測試結束後刪除整個資料庫
    await client.drop_database(unique_db_name)
    
    # 恢復原始方法
    database.get_database = original_get_database
    
    client.close()


@pytest_asyncio.fixture(scope="function")
async def client(test_db) -> AsyncGenerator[AsyncClient, None]:
    """
    測試用 HTTP 客戶端 fixture
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_entry_data():
    """測試用的 Entry 資料"""
    return {
        "user_id": "test_user_123",
        "client_id": "client_uuid_123",
        "memo": "這是一個測試備忘錄",
        "mood": {
            "level": 4,
            "emoji": "😊",
            "label": "happy"
        },
        "location": {
            "latitude": 25.0330,
            "longitude": 121.5654,
            "accuracy": 10.5,
            "address": "台北市中正區"
        },
        "tags": ["測試", "日常"]
    }


@pytest.fixture
def sample_entry_minimal():
    """最小化的 Entry 資料（只有必填欄位）"""
    return {
        "user_id": "test_user_123",
        "client_id": "client_uuid_minimal"
    }


@pytest.fixture
def sample_sync_request():
    """測試用的同步請求資料"""
    return {
        "user_id": "test_user_123",
        "entries": [
            {
                "user_id": "test_user_123",
                "client_id": "sync_client_1",
                "memo": "離線記錄 1",
                "mood": {"level": 3}
            },
            {
                "user_id": "test_user_123",
                "client_id": "sync_client_2",
                "memo": "離線記錄 2",
                "location": {
                    "latitude": 25.0330,
                    "longitude": 121.5654
                }
            },
            {
                "user_id": "test_user_123",
                "client_id": "sync_client_3",
                "memo": "離線記錄 3"
            }
        ]
    }
