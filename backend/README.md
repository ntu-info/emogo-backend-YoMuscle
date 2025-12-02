# Emogo Backend

Emogo 後端 API 服務 - 使用 FastAPI + MongoDB

---

## 📁 後端檔案結構

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 應用程式進入點
│   ├── config.py            # 環境設定
│   ├── database.py          # MongoDB 連線管理
│   ├── models/
│   │   ├── __init__.py
│   │   └── entry.py         # Entry 整合模型 (memo, mood, video, location)
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── entry.py         # Entry Schemas
│   │   └── sync.py          # Sync Schemas
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── entry.py         # Entry CRUD API
│   │   ├── sync.py          # 離線同步 API
│   │   └── upload.py        # 影片上傳 API
│   ├── services/
│   │   ├── __init__.py
│   │   ├── entry_service.py
│   │   ├── sync_service.py
│   │   └── storage_service.py
│   └── utils/
│       ├── __init__.py
│       └── helpers.py
│
├── tests/                   # 測試資料夾
│   ├── __init__.py
│   ├── conftest.py          # 測試配置和 fixtures
│   ├── test_entry.py        # Entry API 測試 (15+ 測試案例)
│   ├── test_sync.py         # Sync API 測試 (8+ 測試案例)
│   ├── test_upload.py       # Upload API 測試 (6+ 測試案例)
│   └── test_health.py       # 健康檢查測試 (4+ 測試案例)
│
├── uploads/                 # 影片上傳目錄
├── .env.example             # 環境變數範例
├── .gitignore
├── requirements.txt         # Python 依賴
├── pytest.ini               # pytest 配置
└── README.md
```

---

## 🚀 啟動服務

### 1. 安裝依賴

```powershell
cd backend

# 建立虛擬環境
python -m venv venv

# 啟動虛擬環境
.\venv\Scripts\activate

# 安裝依賴
pip install -r requirements.txt
```

### 2. 設定環境變數

```powershell
# 複製範例檔案
copy .env.example .env

# 編輯 .env 填入你的 MongoDB 連線字串
# 本地 MongoDB: MONGODB_URL=mongodb://localhost:27017
# MongoDB Atlas: MONGODB_URL=mongodb+srv://<username>:<password>@cluster.mongodb.net/
```

### 3. 確保 MongoDB 已啟動

```powershell
# 檢查 MongoDB 服務狀態
mongod --version
```

### 4. 啟動開發伺服器

```powershell
# 開發模式（支援熱重載）
uvicorn app.main:app --reload --port 8000
```

---

## 📖 API 文件

啟動服務後，可透過以下網址查看互動式 API 文件：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 📡 API 端點

### Entry API

| Method | Endpoint | 說明 |
|--------|----------|------|
| `POST` | `/api/v1/entries` | 建立新記錄 |
| `GET` | `/api/v1/entries` | 取得記錄列表（支援分頁、篩選）|
| `GET` | `/api/v1/entries/{id}` | 取得單一記錄 |
| `PUT` | `/api/v1/entries/{id}` | 更新記錄 |
| `DELETE` | `/api/v1/entries/{id}` | 刪除記錄 |

### Sync API

| Method | Endpoint | 說明 |
|--------|----------|------|
| `POST` | `/api/v1/sync/batch` | 批次同步離線記錄 |
| `GET` | `/api/v1/sync/status` | 檢查同步狀態 |

### Upload API

| Method | Endpoint | 說明 |
|--------|----------|------|
| `POST` | `/api/v1/upload/video` | 上傳影片 |
| `DELETE` | `/api/v1/upload/video` | 刪除影片 |

### Health Check

| Method | Endpoint | 說明 |
|--------|----------|------|
| `GET` | `/` | API 根路徑資訊 |
| `GET` | `/health` | 健康檢查 |

---

## 🧪 如何執行測試

### 1. 確保 MongoDB 已啟動

測試會使用本地 MongoDB（`mongodb://localhost:27017`），並建立一個測試專用的資料庫 `emogo_test_db`。

### 2. 執行測試

```powershell
# 進入 backend 目錄
cd backend

# 啟動虛擬環境
.\venv\Scripts\activate

# 執行所有測試
pytest

# 執行特定測試檔案
pytest tests/test_entry.py
pytest tests/test_sync.py
pytest tests/test_upload.py
pytest tests/test_health.py

# 執行特定測試類別
pytest tests/test_entry.py::TestCreateEntry
pytest tests/test_sync.py::TestBatchSync

# 執行特定測試函數
pytest tests/test_entry.py::TestCreateEntry::test_create_entry_with_all_fields

# 顯示詳細輸出
pytest -v

# 顯示 print 輸出
pytest -s

# 顯示測試覆蓋率
pip install pytest-cov
pytest --cov=app --cov-report=html
```

### 3. 測試檔案說明

| 檔案 | 說明 | 測試內容 |
|------|------|----------|
| `conftest.py` | 測試配置 | fixtures、測試資料庫設定 |
| `test_entry.py` | Entry API 測試 | CRUD 操作、分頁、篩選、驗證 |
| `test_sync.py` | Sync API 測試 | 批次同步、重複處理、狀態檢查 |
| `test_upload.py` | Upload API 測試 | 影片上傳、格式驗證、刪除 |
| `test_health.py` | 健康檢查測試 | 根路徑、健康檢查、API 文件 |

---

## 📝 License

MIT License
