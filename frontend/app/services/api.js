/**
 * API 服務層 - 與後端 FastAPI 通訊
 */

import { Platform } from 'react-native';

// API 基礎配置
// 設為 true 使用遠端後端，false 使用本地後端（模擬器測試用）
const USE_REMOTE_BACKEND = true;

const getBaseUrl = () => {
  // 遠端後端 URL
  const REMOTE_URL = 'https://emogo-backend-yomuscle.onrender.com';
  
  // 如果設定使用遠端後端，直接返回遠端 URL
  if (USE_REMOTE_BACKEND) {
    return REMOTE_URL;
  }
  
  // 本地開發（模擬器用）
  if (__DEV__) {
    if (Platform.OS === 'android') {
      // Android 模擬器使用 10.0.2.2 來訪問本機
      return 'http://10.0.2.2:8000';
    } else if (Platform.OS === 'ios') {
      // iOS 模擬器可以使用 localhost
      return 'http://localhost:8000';
    } else {
      // Web
      return 'http://localhost:8000';
    }
  }
  
  return REMOTE_URL;
};

const API_BASE_URL = getBaseUrl();
const API_VERSION = '/api/v1';

/**
 * 通用 API 請求函數
 */
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${API_VERSION}${endpoint}`;
  
  console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    console.log('📤 Request config:', JSON.stringify(config, null, 2));
    const response = await fetch(url, config);
    
    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      let errorData = {};
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { detail: errorText };
      }
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Response data:', JSON.stringify(data, null, 2).substring(0, 500));
    return data;
  } catch (error) {
    console.error('❌ API Error:', error.message);
    if (error.message.includes('Network request failed')) {
      throw new Error('網路連線失敗，請檢查網路狀態');
    }
    throw error;
  }
};

/**
 * 檢查後端連線狀態
 */
export const checkHealth = async () => {
  try {
    // health 端點在根路徑，不使用 /api/v1 前綴
    const url = `${API_BASE_URL}/health`;
    const response = await fetch(url);
    const data = await response.json();
    return { connected: true, data };
  } catch (error) {
    return { connected: false, error: error.message };
  }
};

/**
 * 完整連線測試 - 測試網路、後端、資料庫連線
 * @returns {Object} 測試結果
 */
export const fullConnectionTest = async () => {
  const results = {
    timestamp: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    tests: []
  };

  // 測試 1: 基本網路連線 (ping Google)
  try {
    const startTime = Date.now();
    const response = await fetch('https://www.google.com', { method: 'HEAD', mode: 'no-cors' });
    results.tests.push({
      name: '網路連線',
      success: true,
      latency: Date.now() - startTime,
      message: '網路正常'
    });
  } catch (error) {
    results.tests.push({
      name: '網路連線',
      success: false,
      error: error.message,
      message: '無法連接網路'
    });
  }

  // 測試 2: 後端 Health Check
  try {
    const startTime = Date.now();
    const url = `${API_BASE_URL}/health`;
    const response = await fetch(url);
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      results.tests.push({
        name: '後端連線',
        success: true,
        latency,
        message: `後端正常 (${data.status})`,
        data
      });
    } else {
      results.tests.push({
        name: '後端連線',
        success: false,
        latency,
        message: `HTTP ${response.status}`,
        error: response.statusText
      });
    }
  } catch (error) {
    results.tests.push({
      name: '後端連線',
      success: false,
      error: error.message,
      message: '無法連接後端伺服器'
    });
  }

  // 測試 3: API 端點測試 (GET entries)
  try {
    const startTime = Date.now();
    const url = `${API_BASE_URL}${API_VERSION}/entries?user_id=test_connection&limit=1`;
    const response = await fetch(url);
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      results.tests.push({
        name: 'API 端點',
        success: true,
        latency,
        message: 'API 正常運作'
      });
    } else {
      const errorText = await response.text();
      results.tests.push({
        name: 'API 端點',
        success: false,
        latency,
        message: `HTTP ${response.status}`,
        error: errorText
      });
    }
  } catch (error) {
    results.tests.push({
      name: 'API 端點',
      success: false,
      error: error.message,
      message: '無法存取 API'
    });
  }

  // 測試 4: 寫入測試 (POST entry)
  try {
    const startTime = Date.now();
    const testEntry = {
      user_id: 'connection_test_user',
      client_id: `test_${Date.now()}`,
      memo: 'Connection test - will be deleted'
    };
    
    const response = await fetch(`${API_BASE_URL}${API_VERSION}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testEntry)
    });
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      results.tests.push({
        name: '資料庫寫入',
        success: true,
        latency,
        message: '可以寫入資料庫',
        entryId: data._id
      });
      
      // 清理測試資料
      try {
        await fetch(`${API_BASE_URL}${API_VERSION}/entries/${data._id}`, {
          method: 'DELETE'
        });
      } catch (e) {
        // 忽略清理錯誤
      }
    } else {
      const errorText = await response.text();
      results.tests.push({
        name: '資料庫寫入',
        success: false,
        latency,
        message: `寫入失敗: HTTP ${response.status}`,
        error: errorText
      });
    }
  } catch (error) {
    results.tests.push({
      name: '資料庫寫入',
      success: false,
      error: error.message,
      message: '無法寫入資料庫'
    });
  }

  // 計算整體結果
  results.allPassed = results.tests.every(t => t.success);
  results.passedCount = results.tests.filter(t => t.success).length;
  results.totalCount = results.tests.length;

  return results;
};

/**
 * 取得所有 Entries (支援分頁和過濾)
 * @param {Object} params - 查詢參數
 * @param {string} params.user_id - 使用者 ID (必填)
 * @param {number} params.skip - 跳過筆數
 * @param {number} params.limit - 限制筆數
 * @param {string} params.mood - 過濾心情
 * @param {string} params.start_date - 開始日期 (ISO 格式)
 * @param {string} params.end_date - 結束日期 (ISO 格式)
 */
export const getEntries = async (params = {}) => {
  const queryParams = new URLSearchParams();
  
  if (params.user_id) queryParams.append('user_id', params.user_id);
  if (params.skip) queryParams.append('skip', params.skip);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.mood) queryParams.append('mood', params.mood);
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);

  const query = queryParams.toString();
  const endpoint = `/entries${query ? `?${query}` : ''}`;
  
  return await apiRequest(endpoint, { method: 'GET' });
};

/**
 * 取得單一 Entry
 * @param {string} entryId - Entry ID
 */
export const getEntry = async (entryId) => {
  return await apiRequest(`/entries/${entryId}`, { method: 'GET' });
};

/**
 * 建立新的 Entry
 * @param {Object} entryData - Entry 資料
 */
export const createEntry = async (entryData) => {
  return await apiRequest('/entries', {
    method: 'POST',
    body: JSON.stringify(entryData),
  });
};

/**
 * 更新 Entry
 * @param {string} entryId - Entry ID
 * @param {Object} updateData - 更新資料
 */
export const updateEntry = async (entryId, updateData) => {
  return await apiRequest(`/entries/${entryId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
};

/**
 * 刪除 Entry
 * @param {string} entryId - Entry ID
 */
export const deleteEntry = async (entryId) => {
  return await apiRequest(`/entries/${entryId}`, { method: 'DELETE' });
};

/**
 * 上傳影片檔案
 * @param {string} videoUri - 影片本地 URI
 * @param {string} userId - 使用者 ID
 * @returns {Object} 包含 file_path 和 file_url
 */
export const uploadVideo = async (videoUri, userId) => {
  const url = `${API_BASE_URL}${API_VERSION}/upload/video`;
  
  // 從 URI 取得檔案名稱
  const filename = videoUri.split('/').pop() || `video_${Date.now()}.mp4`;
  
  // 建立 FormData
  const formData = new FormData();
  formData.append('file', {
    uri: videoUri,
    type: 'video/mp4',
    name: filename,
  });
  formData.append('user_id', userId);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `上傳失敗: HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('Network request failed')) {
      throw new Error('網路連線失敗，無法上傳影片');
    }
    throw error;
  }
};

/**
 * 批次同步 Entries (離線資料上傳)
 * @param {Array} entries - 要同步的 Entry 陣列
 * @param {string} userId - 使用者 ID
 */
export const batchSync = async (entries, userId) => {
  return await apiRequest('/sync/batch', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      entries: entries,
    }),
  });
};

/**
 * 取得同步狀態
 * @param {string} userId - 使用者 ID
 * @param {Array} clientIds - 要檢查的 client_id 陣列
 */
export const getSyncStatus = async (userId, clientIds) => {
  return await apiRequest('/sync/status', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      client_ids: clientIds,
    }),
  });
};

/**
 * 取得上次同步時間之後的變更
 * @param {string} userId - 使用者 ID
 * @param {string} lastSyncTime - 上次同步時間 (ISO 格式)
 */
export const getChangesSince = async (userId, lastSyncTime) => {
  return await apiRequest('/sync/changes', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      last_sync_time: lastSyncTime,
    }),
  });
};

// ==================== 用戶 API ====================

/**
 * 用戶註冊/登入（如果用戶名已存在則自動登入）
 * @param {string} username - 用戶名稱
 * @param {string} email - 電子郵件（可選）
 * @returns {Promise<{user_id: string, username: string, email: string, created_at: string, last_login: string}>}
 */
export const registerUser = async (username, email = null) => {
  return await apiRequest('/users/register', {
    method: 'POST',
    body: JSON.stringify({
      username: username,
      email: email,
    }),
  });
};

/**
 * 用戶登入
 * @param {string} username - 用戶名稱
 * @returns {Promise<{user_id: string, username: string, email: string, created_at: string, last_login: string}>}
 */
export const loginUser = async (username) => {
  return await apiRequest('/users/login', {
    method: 'POST',
    body: JSON.stringify({
      username: username,
    }),
  });
};

/**
 * 取得用戶資訊
 * @param {string} userId - 用戶 ID
 */
export const getUser = async (userId) => {
  return await apiRequest(`/users/${userId}`, {
    method: 'GET',
  });
};

/**
 * 取得所有用戶列表
 */
export const getAllUsers = async () => {
  return await apiRequest('/users/', {
    method: 'GET',
  });
};

export default {
  checkHealth,
  getEntries,
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
  uploadVideo,
  batchSync,
  getSyncStatus,
  getChangesSince,
  registerUser,
  loginUser,
  getUser,
  getAllUsers,
};
