from fastapi import APIRouter, HTTPException

from app.schemas.user import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    UserListResponse
)
from app.services.user_service import (
    register_user,
    login_user,
    get_user_by_id,
    get_all_users
)


router = APIRouter(prefix="/api/v1/users", tags=["Users"])


@router.post("/register", response_model=UserResponse, summary="用戶註冊")
async def api_register(request: UserRegisterRequest):
    """
    註冊新用戶
    
    - 如果用戶名已存在，會返回現有用戶資訊（等同登入）
    - 如果是新用戶，會建立帳號並返回 user_id
    
    **回傳的 user_id 請保存在前端，用於後續 API 呼叫**
    """
    result = await register_user(
        username=request.username,
        email=request.email,
        device_id=request.device_id
    )
    return UserResponse(
        user_id=result["user_id"],
        username=result["username"],
        email=result.get("email"),
        created_at=result["created_at"],
        last_login=result["last_login"]
    )


@router.post("/login", response_model=UserResponse, summary="用戶登入")
async def api_login(request: UserLoginRequest):
    """
    用戶登入
    
    - 使用用戶名登入
    - 如果用戶不存在，返回 404
    """
    result = await login_user(
        username=request.username,
        device_id=request.device_id
    )
    if not result:
        raise HTTPException(status_code=404, detail="用戶不存在，請先註冊")
    
    return UserResponse(
        user_id=result["user_id"],
        username=result["username"],
        email=result.get("email"),
        created_at=result["created_at"],
        last_login=result["last_login"]
    )


@router.get("/{user_id}", response_model=UserResponse, summary="取得用戶資訊")
async def api_get_user(user_id: str):
    """根據 user_id 取得用戶資訊"""
    result = await get_user_by_id(user_id)
    if not result:
        raise HTTPException(status_code=404, detail="用戶不存在")
    
    return UserResponse(
        user_id=result["user_id"],
        username=result["username"],
        email=result.get("email"),
        created_at=result["created_at"],
        last_login=result["last_login"]
    )


@router.get("/", response_model=UserListResponse, summary="取得所有用戶")
async def api_list_users():
    """取得所有已註冊用戶列表"""
    users = await get_all_users()
    return UserListResponse(
        users=[
            UserResponse(
                user_id=u["user_id"],
                username=u["username"],
                email=u.get("email"),
                created_at=u["created_at"],
                last_login=u["last_login"]
            )
            for u in users
        ],
        total=len(users)
    )
