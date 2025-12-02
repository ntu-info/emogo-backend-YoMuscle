import uuid
from datetime import datetime
from typing import Optional


def generate_uuid() -> str:
    """產生唯一識別碼"""
    return str(uuid.uuid4())


def format_datetime(dt: datetime) -> str:
    """格式化日期時間為 ISO 8601 格式"""
    return dt.isoformat() + "Z" if dt else None


def parse_datetime(dt_string: str) -> Optional[datetime]:
    """解析 ISO 8601 格式的日期時間字串"""
    if not dt_string:
        return None
    
    try:
        # 處理帶 Z 後綴的格式
        if dt_string.endswith('Z'):
            dt_string = dt_string[:-1]
        return datetime.fromisoformat(dt_string)
    except ValueError:
        return None


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    計算兩個 GPS 座標之間的距離（公尺）
    使用 Haversine 公式
    """
    import math
    
    R = 6371000  # 地球半徑（公尺）
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2) ** 2
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c
