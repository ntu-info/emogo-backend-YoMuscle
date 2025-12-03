from datetime import datetime
from typing import Optional
import re

from app.database import database


def generate_user_id(username: str) -> str:
    """根據用戶名生成易讀的 user_id"""
    # 移除特殊字符，保留字母數字和中文
    clean_name = re.sub(r'[^\w\u4e00-\u9fff]', '', username)
    # 取前10個字符
    clean_name = clean_name[:10] if clean_name else "user"
    # 加上時間戳確保唯一
    timestamp = int(datetime.utcnow().timestamp() * 1000)
    return f"user_{clean_name}_{timestamp}"


async def register_user(username: str, email: Optional[str] = None, device_id: Optional[str] = None) -> dict:
    """註冊新用戶"""
    collection = database.get_collection("users")
    
    # 檢查用戶名是否已存在
    existing = await collection.find_one({"username": username})
    if existing:
        # 如果用戶名已存在，返回現有用戶（簡單登入邏輯）
        await collection.update_one(
            {"username": username},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        existing["last_login"] = datetime.utcnow()
        return {
            "user_id": existing["user_id"],
            "username": existing["username"],
            "email": existing.get("email"),
            "created_at": existing["created_at"],
            "last_login": existing["last_login"],
            "is_new": False
        }
    
    # 建立新用戶
    user_id = generate_user_id(username)
    now = datetime.utcnow()
    
    user_doc = {
        "user_id": user_id,
        "username": username,
        "email": email,
        "device_id": device_id,
        "created_at": now,
        "last_login": now
    }
    
    await collection.insert_one(user_doc)
    
    return {
        "user_id": user_id,
        "username": username,
        "email": email,
        "created_at": now,
        "last_login": now,
        "is_new": True
    }


async def login_user(username: str, device_id: Optional[str] = None) -> Optional[dict]:
    """用戶登入（如果不存在則返回 None）"""
    collection = database.get_collection("users")
    
    user = await collection.find_one({"username": username})
    if not user:
        return None
    
    # 更新最後登入時間
    await collection.update_one(
        {"username": username},
        {"$set": {"last_login": datetime.utcnow(), "device_id": device_id}}
    )
    
    user["last_login"] = datetime.utcnow()
    return {
        "user_id": user["user_id"],
        "username": user["username"],
        "email": user.get("email"),
        "created_at": user["created_at"],
        "last_login": user["last_login"]
    }


async def get_user_by_id(user_id: str) -> Optional[dict]:
    """根據 user_id 取得用戶"""
    collection = database.get_collection("users")
    user = await collection.find_one({"user_id": user_id})
    if user:
        return {
            "user_id": user["user_id"],
            "username": user["username"],
            "email": user.get("email"),
            "created_at": user["created_at"],
            "last_login": user["last_login"]
        }
    return None


async def get_all_users() -> list[dict]:
    """取得所有用戶"""
    collection = database.get_collection("users")
    cursor = collection.find({}).sort("created_at", -1)
    users = []
    async for user in cursor:
        users.append({
            "user_id": user["user_id"],
            "username": user["username"],
            "email": user.get("email"),
            "created_at": user["created_at"],
            "last_login": user["last_login"]
        })
    return users
