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
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
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
};
