from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional

import certifi

from app.config import settings


class Database:
    """MongoDB 連線管理"""
    
    client: Optional[AsyncIOMotorClient] = None
    
    async def connect(self):
        """建立資料庫連線"""
        mongo_url = settings.MONGODB_URL
        client_options = {}
        if "mongodb+srv://" in mongo_url or "tls=true" in mongo_url.lower():
            client_options["tlsCAFile"] = certifi.where()
        self.client = AsyncIOMotorClient(mongo_url, **client_options)
        # 測試連線
        await self.client.admin.command('ping')
        print(f"✅ Connected to MongoDB: {settings.DATABASE_NAME}")
    
    async def disconnect(self):
        """關閉資料庫連線"""
        if self.client:
            self.client.close()
            print("❌ Disconnected from MongoDB")
    
    def get_database(self):
        """取得資料庫實例"""
        return self.client[settings.DATABASE_NAME]
    
    def get_collection(self, collection_name: str):
        """取得集合實例"""
        return self.get_database()[collection_name]


# 全域資料庫實例
database = Database()


async def get_database():
    """依賴注入用的資料庫取得函數"""
    return database.get_database()
