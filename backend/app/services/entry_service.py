from datetime import datetime
from typing import Optional, List, Tuple
from bson import ObjectId

from app.database import database
from app.schemas.entry import EntryCreate, EntryUpdate


class EntryService:
    """Entry 業務邏輯服務"""
    
    COLLECTION_NAME = "entries"
    
    @classmethod
    def _get_collection(cls):
        """取得 entries collection"""
        return database.get_collection(cls.COLLECTION_NAME)
    
    @classmethod
    async def create(cls, entry_data: EntryCreate) -> dict:
        """建立新的 Entry"""
        collection = cls._get_collection()
        
        now = datetime.utcnow()
        entry_dict = entry_data.model_dump(exclude_none=True)
        
        # 如果沒有提供 created_at，使用現在時間
        if "created_at" not in entry_dict or entry_dict["created_at"] is None:
            entry_dict["created_at"] = now
        
        entry_dict["updated_at"] = now
        entry_dict["synced_at"] = now
        entry_dict["is_synced"] = True
        
        result = await collection.insert_one(entry_dict)
        entry_dict["_id"] = str(result.inserted_id)
        
        return entry_dict
    
    @classmethod
    async def get_by_id(cls, entry_id: str) -> Optional[dict]:
        """根據 ID 取得 Entry"""
        collection = cls._get_collection()
        
        try:
            entry = await collection.find_one({"_id": ObjectId(entry_id)})
            if entry:
                entry["_id"] = str(entry["_id"])
            return entry
        except Exception:
            return None
    
    @classmethod
    async def get_by_client_id(cls, client_id: str, user_id: str) -> Optional[dict]:
        """根據 client_id 和 user_id 取得 Entry"""
        collection = cls._get_collection()
        
        entry = await collection.find_one({
            "client_id": client_id,
            "user_id": user_id
        })
        
        if entry:
            entry["_id"] = str(entry["_id"])
        return entry
    
    @classmethod
    async def get_list(
        cls,
        user_id: str,
        page: int = 1,
        page_size: int = 20,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        mood_level: Optional[int] = None,
        tags: Optional[List[str]] = None
    ) -> Tuple[List[dict], int]:
        """取得 Entry 列表（支援分頁與篩選）"""
        collection = cls._get_collection()
        
        # 建立查詢條件
        query = {"user_id": user_id}
        
        if start_date:
            query["created_at"] = {"$gte": start_date}
        if end_date:
            if "created_at" in query:
                query["created_at"]["$lte"] = end_date
            else:
                query["created_at"] = {"$lte": end_date}
        
        if mood_level:
            query["mood.level"] = mood_level
        
        if tags:
            query["tags"] = {"$in": tags}
        
        # 計算總數
        total = await collection.count_documents(query)
        
        # 分頁查詢
        skip = (page - 1) * page_size
        cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)
        
        entries = []
        async for entry in cursor:
            entry["_id"] = str(entry["_id"])
            entries.append(entry)
        
        return entries, total
    
    @classmethod
    async def update(cls, entry_id: str, entry_data: EntryUpdate) -> Optional[dict]:
        """更新 Entry"""
        collection = cls._get_collection()
        
        update_dict = entry_data.model_dump(exclude_none=True)
        update_dict["updated_at"] = datetime.utcnow()
        
        try:
            result = await collection.find_one_and_update(
                {"_id": ObjectId(entry_id)},
                {"$set": update_dict},
                return_document=True
            )
            
            if result:
                result["_id"] = str(result["_id"])
            return result
        except Exception:
            return None
    
    @classmethod
    async def delete(cls, entry_id: str) -> bool:
        """刪除 Entry"""
        collection = cls._get_collection()
        
        try:
            result = await collection.delete_one({"_id": ObjectId(entry_id)})
            return result.deleted_count > 0
        except Exception:
            return False
    
    @classmethod
    async def get_user_entries_count(cls, user_id: str) -> int:
        """取得使用者的 Entry 總數"""
        collection = cls._get_collection()
        return await collection.count_documents({"user_id": user_id})
