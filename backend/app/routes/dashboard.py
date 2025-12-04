"""
資料檢視儀表板
提供網頁介面查看資料庫中的記錄
"""

import html
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse

from app.database import database

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_class=HTMLResponse)
async def dashboard_page(
    start_date: Optional[str] = Query(None, description="開始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="結束日期 (YYYY-MM-DD)"),
    user_id: Optional[str] = Query(None, description="使用者 ID 篩選")
):
    """
    資料檢視儀表板頁面
    """
    # 預設顯示最近 7 天的資料
    if not end_date:
        end_date = datetime.utcnow().strftime("%Y-%m-%d")
    if not start_date:
        start_date = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    
    # 查詢資料
    collection = database.get_collection("entries")
    
    # 建立查詢條件
    query = {}
    
    # 時間範圍篩選
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)  # 包含結束日期當天
        query["created_at"] = {"$gte": start_dt, "$lt": end_dt}
    except ValueError:
        pass
    
    # 使用者篩選
    if user_id:
        query["user_id"] = user_id
    
    # 執行查詢
    cursor = collection.find(query).sort("created_at", -1).limit(500)
    entries = await cursor.to_list(length=500)
    
    # 取得所有不重複的 user_id
    all_user_ids = await collection.distinct("user_id")
    
    # 取得用戶名稱映射
    users_collection = database.get_collection("users")
    users_cursor = users_collection.find({})
    users_list = await users_cursor.to_list(length=1000)
    user_name_map = {u["user_id"]: u.get("username", u["user_id"]) for u in users_list}
    
    # 統計資料
    total_count = await collection.count_documents(query)
    
    # 產生表格 HTML
    table_rows = ""
    for entry in entries:
        entry_id = str(entry.get("_id", ""))
        user = entry.get("user_id", "-")
        username = user_name_map.get(user, user)  # 如果有註冊，顯示用戶名；否則顯示 user_id
        client_id = entry.get("client_id", "-")
        memo = entry.get("memo", "-") or "-"
        
        # 心情資訊
        mood = entry.get("mood", {})
        if mood:
            mood_emoji = mood.get("emoji", "")
            mood_label = mood.get("label", "")
            mood_level = mood.get("level", "")
            if mood_emoji or mood_label:
                mood_str = f"{mood_emoji} {mood_label}" if mood_emoji else mood_label
            elif mood_level:
                mood_str = f"Level {mood_level}"
            else:
                mood_str = "-"
        else:
            mood_str = "-"
        
        # 影片資訊
        video = entry.get("video") or {}
        video_url = ""
        video_label = "播放影片"
        is_google_drive = False
        
        if isinstance(video, dict):
            video_url = video.get("url") or video.get("file_url") or video.get("file_path") or ""
            original_name = video.get("original_filename")
            
            # 檢查是否為 Google Drive 連結
            if "drive.google.com" in video_url:
                is_google_drive = True
                # 從分享連結提取 file ID: /d/{fileId}/view 或 /file/d/{fileId}
                import re
                match = re.search(r'/d/([a-zA-Z0-9_-]+)', video_url)
                if match:
                    file_id = match.group(1)
                    # 使用直接串流連結 (繞過 preview 頁面)
                    video_url = f"https://drive.google.com/uc?export=download&id={file_id}"
            
            if original_name:
                video_label = original_name[:40]
            elif video_url:
                video_label = video_url.split('/')[-1][:40] or "影片"
        
        if video_url:
            escaped_url = html.escape(video_url, quote=True)
            escaped_label = html.escape(video_label, quote=True)
            
            # Google Drive 用 iframe，其他用 video 標籤
            if is_google_drive:
                video_str = f"""
            <details class="video-details" open>
                <summary>▶ {escaped_label}</summary>
                <video controls preload="metadata" src="{escaped_url}" class="video-player">
                    <source src="{escaped_url}" type="video/mp4">
                    您的瀏覽器不支援內嵌影片
                </video>
                <div class="video-actions">
                    <a href="{escaped_url}" target="_blank" rel="noopener" class="video-link">下載影片</a>
                </div>"""
            else:
                video_str = f"""
            <details class="video-details">
                <summary>▶ {escaped_label}</summary>
                <video controls preload="metadata" src="{escaped_url}" class="video-player">
                    <source src="{escaped_url}">
                    您的瀏覽器不支援內嵌影片，請使用
                    <a href="{escaped_url}" target="_blank" rel="noopener">下載影片</a>。
                </video>
                <div class="video-actions">
                    <a href="{escaped_url}" target="_blank" rel="noopener" class="video-link">在新分頁播放</a>
                    <a href="{escaped_url}" download class="video-link">下載</a>
                </div>
            </details>
            """
        else:
            video_str = "-"
        
        # 位置資訊
        location = entry.get("location", {})
        if location:
            lat = location.get("latitude", 0)
            lng = location.get("longitude", 0)
            location_str = f"({lat:.4f}, {lng:.4f})"
        else:
            location_str = "-"
        
        # 時間
        created_at = entry.get("created_at", "")
        if isinstance(created_at, datetime):
            created_str = created_at.strftime("%Y-%m-%d %H:%M:%S")
        else:
            created_str = str(created_at) if created_at else "-"
        
        # 截斷過長的內容
        if len(memo) > 50:
            memo = memo[:50] + "..."
        if len(username) > 30:
            username = username[:30] + "..."
        
        table_rows += f"""
        <tr>
            <td class="id-cell" title="{entry_id}">{entry_id[:8]}...</td>
            <td title="{user}">{username}</td>
            <td>{memo}</td>
            <td>{mood_str}</td>
            <td>{video_str}</td>
            <td>{location_str}</td>
            <td>{created_str}</td>
        </tr>
        """
    
    # 使用者選項
    user_options = '<option value="">全部使用者</option>'
    for uid in all_user_ids:
        selected = 'selected' if uid == user_id else ''
        display_name = user_name_map.get(uid, uid)
        display_name = display_name[:30] + "..." if len(display_name) > 30 else display_name
        user_options += f'<option value="{uid}" {selected}>{display_name}</option>'
    
    # 完整的 HTML 頁面
    html_content = f"""
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Emogo 資料儀表板</title>
        <style>
            * {{
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }}
            
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background-color: #f5f5f5;
                color: #333;
                line-height: 1.6;
            }}
            
            .container {{
                max-width: 1400px;
                margin: 0 auto;
                padding: 20px;
            }}
            
            header {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px 20px;
                margin-bottom: 30px;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }}
            
            header h1 {{
                font-size: 28px;
                margin-bottom: 10px;
            }}
            
            header p {{
                opacity: 0.9;
            }}
            
            .filter-section {{
                background: white;
                padding: 20px;
                border-radius: 10px;
                margin-bottom: 20px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }}
            
            .filter-form {{
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                align-items: flex-end;
            }}
            
            .filter-group {{
                display: flex;
                flex-direction: column;
                gap: 5px;
            }}
            
            .filter-group label {{
                font-size: 14px;
                font-weight: 500;
                color: #666;
            }}
            
            .filter-group input,
            .filter-group select {{
                padding: 10px 15px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
                min-width: 150px;
            }}
            
            .filter-group input:focus,
            .filter-group select:focus {{
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }}
            
            .btn {{
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }}
            
            .btn-primary {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }}
            
            .btn-primary:hover {{
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }}
            
            .btn-secondary {{
                background: #f0f0f0;
                color: #333;
            }}
            
            .btn-secondary:hover {{
                background: #e0e0e0;
            }}
            
            .stats {{
                display: flex;
                gap: 20px;
                margin-bottom: 20px;
            }}
            
            .stat-card {{
                background: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                flex: 1;
                min-width: 150px;
            }}
            
            .stat-card h3 {{
                font-size: 14px;
                color: #666;
                margin-bottom: 5px;
            }}
            
            .stat-card .number {{
                font-size: 32px;
                font-weight: 700;
                color: #667eea;
            }}
            
            .table-section {{
                background: white;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }}
            
            .table-header {{
                padding: 15px 20px;
                background: #fafafa;
                border-bottom: 1px solid #eee;
            }}
            
            .table-header h2 {{
                font-size: 18px;
                color: #333;
            }}
            
            .table-container {{
                overflow-x: auto;
            }}
            
            table {{
                width: 100%;
                border-collapse: collapse;
            }}
            
            th, td {{
                padding: 12px 15px;
                text-align: left;
                border-bottom: 1px solid #eee;
            }}
            
            th {{
                background: #f8f9fa;
                font-weight: 600;
                color: #555;
                font-size: 13px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}
            
            tr:hover {{
                background: #f8f9fa;
            }}
            
            td {{
                font-size: 14px;
            }}
            
            .id-cell {{
                font-family: monospace;
                font-size: 12px;
                color: #888;
            }}
            
            .video-details {{
                display: inline-block;
            }}
            
            .video-details summary {{
                cursor: pointer;
                color: #667eea;
                font-weight: 600;
                outline: none;
            }}
            
            .video-details summary::-webkit-details-marker {{
                display: none;
            }}
            
            .video-details[open] summary {{
                color: #764ba2;
            }}
            
            .video-player {{
                width: 260px;
                max-width: 100%;
                margin-top: 10px;
                border-radius: 8px;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
            }}
            
            .video-actions {{
                margin-top: 8px;
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }}
            
            .video-link {{
                color: #667eea;
                text-decoration: none;
                font-weight: 500;
            }}
            
            .video-link:hover {{
                text-decoration: underline;
            }}
            
            .empty-state {{
                text-align: center;
                padding: 60px 20px;
                color: #888;
            }}
            
            .empty-state h3 {{
                font-size: 18px;
                margin-bottom: 10px;
            }}
            
            .links {{
                margin-top: 20px;
                padding: 15px;
                background: white;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }}
            
            .links a {{
                color: #667eea;
                text-decoration: none;
                margin-right: 20px;
            }}
            
            .links a:hover {{
                text-decoration: underline;
            }}
            
            @media (max-width: 768px) {{
                .filter-form {{
                    flex-direction: column;
                }}
                
                .filter-group input,
                .filter-group select {{
                    width: 100%;
                }}
                
                .stats {{
                    flex-direction: column;
                }}
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>📊 Emogo 資料儀表板</h1>
                <p>查看和管理你的應用程式資料</p>
            </header>
            
            <div class="filter-section">
                <form class="filter-form" method="GET" action="/dashboard">
                    <div class="filter-group">
                        <label for="start_date">開始日期</label>
                        <input type="date" id="start_date" name="start_date" value="{start_date}">
                    </div>
                    <div class="filter-group">
                        <label for="end_date">結束日期</label>
                        <input type="date" id="end_date" name="end_date" value="{end_date}">
                    </div>
                    <div class="filter-group">
                        <label for="user_id">使用者</label>
                        <select id="user_id" name="user_id">
                            {user_options}
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">🔍 查詢</button>
                    <a href="/dashboard" class="btn btn-secondary">重設</a>
                </form>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <h3>查詢結果筆數</h3>
                    <div class="number">{total_count}</div>
                </div>
                <div class="stat-card">
                    <h3>使用者總數</h3>
                    <div class="number">{len(all_user_ids)}</div>
                </div>
                <div class="stat-card">
                    <h3>查詢區間</h3>
                    <div class="number" style="font-size: 16px;">{start_date} ~ {end_date}</div>
                </div>
            </div>
            
            <div class="table-section">
                <div class="table-header">
                    <h2>📋 記錄列表</h2>
                </div>
                <div class="table-container">
                    {"<table><thead><tr><th>ID</th><th>使用者</th><th>備忘錄</th><th>心情</th><th>影片</th><th>位置</th><th>建立時間</th></tr></thead><tbody>" + table_rows + "</tbody></table>" if entries else '<div class="empty-state"><h3>📭 沒有找到資料</h3><p>請調整篩選條件或確認資料是否已同步</p></div>'}
                </div>
            </div>
            
            <div class="links">
                <strong>🔗 其他連結：</strong>
                <a href="/docs">API 文件 (Swagger)</a>
                <a href="/redoc">API 文件 (ReDoc)</a>
                <a href="/health">健康檢查</a>
            </div>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)
