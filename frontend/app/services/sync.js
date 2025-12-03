/**
 * 同步服務 - 處理離線/線上資料同步
 */

import NetInfo from '@react-native-community/netinfo';
import * as api from './api';
import { 
  getAllRecords, 
  updateRecord, 
  addRecord,
  getLastSyncTime, 
  setLastSyncTime,
  getPendingSyncRecords,
  markRecordAsSynced,
  removeRecord
} from '../utils/storage';

/**
 * 檢查網路連線狀態
 * @returns {Promise<boolean>} 是否有網路連線
 */
export const isOnline = async () => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected && state.isInternetReachable !== false;
  } catch (error) {
    console.warn('檢查網路狀態失敗:', error);
    return false;
  }
};

/**
 * 訂閱網路狀態變化
 * @param {Function} callback - 網路狀態變化時的回調函數
 * @returns {Function} 取消訂閱的函數
 */
export const subscribeToNetworkChanges = (callback) => {
  return NetInfo.addEventListener(state => {
    callback({
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    });
  });
};

const buildVideoPayload = (uploadResult, durationSeconds = null) => {
  if (!uploadResult) return null;
  const url = uploadResult.url || uploadResult.file_url || uploadResult.file_path;
  if (!url) return null;
  return {
    url,
    file_size: uploadResult.file_size ?? uploadResult.size_bytes ?? null,
    duration: durationSeconds ?? uploadResult.duration ?? null,
    thumbnail_url: uploadResult.thumbnail_url ?? null,
  };
};

/**
 * 同步單筆記錄到後端
 * @param {Object} record - 本地記錄
 * @param {string} userId - 使用者 ID
 * @returns {Object} 同步結果
 */
export const syncSingleRecord = async (record, userId) => {
  try {
    console.log('🔄 開始同步記錄:', record.id);
    console.log('📦 記錄資料:', JSON.stringify(record, null, 2));
    
    // 先上傳影片（如果有的話）
    let videoData = null;
    if ((record.videoUri || record.hasVideo) && !record.videoUploaded) {
      try {
        const videoUri = record.videoUri;
        console.log('📹 準備上傳影片:', videoUri);
        
        if (videoUri && videoUri.startsWith('file://')) {
          const uploadResult = await api.uploadVideo(videoUri, userId);
          console.log('📹 上傳結果:', JSON.stringify(uploadResult));
          videoData = buildVideoPayload(uploadResult, record.videoDuration);
          console.log('✅ 影片上傳成功:', videoData?.url);
        } else {
          console.log('⚠️ 影片 URI 無效或不存在:', videoUri);
        }
      } catch (uploadError) {
        console.error('❌ 影片上傳失敗:', uploadError.message);
        console.error('❌ 影片上傳錯誤詳情:', uploadError);
        // 影片上傳失敗不阻止文字資料同步
      }
    }

    // 心情對應表 (前端 mood value -> level)
    const moodLevelMap = {
      'happy': 5,
      'calm': 4,
      'neutral': 3,
      'sad': 2,
      'angry': 1,
      'anxious': 2,
    };

    // 心情 emoji 對應表
    const moodEmojiMap = {
      'happy': '😄',
      'calm': '😊',
      'neutral': '😐',
      'sad': '😔',
      'angry': '😤',
      'anxious': '😰',
    };

    // 準備 Entry 資料 - 確保 client_id 是字串
    const clientIdStr = String(record.id);
    const entryData = {
      user_id: userId,
      client_id: clientIdStr,
      memo: record.content || record.memo || null,
      mood: record.mood ? {
        level: moodLevelMap[record.mood] || 3,
        emoji: moodEmojiMap[record.mood] || '😐',
        label: record.mood,
      } : null,
      video: videoData || record.serverVideoData || null,
      location: record.location ? {
        latitude: record.location.latitude,
        longitude: record.location.longitude,
        address: record.location.address || null,
        accuracy: record.location.accuracy || null,
      } : null,
      created_at: record.createdAt || new Date().toISOString(),
    };

    console.log('📤 準備發送資料:', JSON.stringify(entryData, null, 2));

    // 建立或更新 Entry
    let result;
    if (record.serverId) {
      // 已有 server ID，更新現有記錄
      console.log('🔄 更新記錄:', record.serverId);
      result = await api.updateEntry(record.serverId, entryData);
    } else {
      // 新記錄，建立
      console.log('➕ 建立新記錄');
      try {
        result = await api.createEntry(entryData);
      } catch (createError) {
        // 如果是 409 (已存在)，嘗試查詢現有記錄
        if (createError.message && createError.message.includes('409')) {
          console.log('⚠️ 記錄已存在，嘗試查詢...');
          try {
            const existingEntries = await api.getEntries({ 
              user_id: userId, 
              limit: 100 
            });
            const existingEntry = existingEntries.entries?.find(
              e => e.client_id === record.id
            );
            if (existingEntry) {
              console.log('✅ 找到已存在的記錄:', existingEntry._id);
              return {
                success: true,
                serverId: existingEntry._id,
                record: existingEntry,
                alreadyExists: true,
              };
            }
          } catch (queryError) {
            console.error('查詢失敗:', queryError);
          }
        }
        throw createError;
      }
    }
    
    console.log('✅ 同步成功:', result._id);

    const serverVideo = result.video || videoData || record.serverVideoData || null;
    if (serverVideo) {
      await updateRecord(record.id, {
        serverVideoData: serverVideo,
        videoUploaded: true,
        videoUri: null,
        hasVideo: true,
      });
    }

    return {
      success: true,
      serverId: result._id,
      record: result,
    };
  } catch (error) {
    // 確保錯誤訊息是字串
    const errorMessage = typeof error === 'string' 
      ? error 
      : error?.message || JSON.stringify(error);
    console.error('❌ 同步失敗:', errorMessage);
    console.error('❌ 錯誤類型:', typeof error);
    console.error('❌ 錯誤物件:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * 批次同步所有待同步的記錄
 * @param {string} userId - 使用者 ID
 * @param {Function} onProgress - 進度回調 (current, total)
 * @returns {Object} 同步結果統計
 */
export const syncPendingRecords = async (userId, onProgress = null) => {
  const pendingRecords = await getPendingSyncRecords();
  
  if (pendingRecords.length === 0) {
    return { 
      success: true, 
      synced: 0, 
      failed: 0, 
      total: 0,
      message: '沒有待同步的記錄' 
    };
  }

  let synced = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < pendingRecords.length; i++) {
    const record = pendingRecords[i];
    
    if (onProgress) {
      onProgress(i + 1, pendingRecords.length);
    }

    const result = await syncSingleRecord(record, userId);
    
      if (result.success) {
      // 更新本地記錄，標記為已同步
      await markRecordAsSynced(record.id, result.serverId);
      synced++;
    } else {
      failed++;
      // 確保錯誤是字串
      let errorStr = '未知錯誤';
      if (typeof result.error === 'string' && result.error.trim()) {
        errorStr = result.error;
      } else if (result.error) {
        try {
          errorStr = JSON.stringify(result.error, Object.getOwnPropertyNames(result.error));
        } catch (jsonErr) {
          errorStr = String(result.error);
        }
      }
      errors.push({
        recordId: record.id,
        error: errorStr,
      });
    }
  }

  // 更新最後同步時間
  await setLastSyncTime(new Date().toISOString());

  return {
    success: failed === 0,
    synced,
    failed,
    total: pendingRecords.length,
    errors,
    message: failed === 0 
      ? `成功同步 ${synced} 筆記錄` 
      : `同步完成: ${synced} 成功, ${failed} 失敗`,
  };
};

/**
 * 從後端拉取記錄
 * @param {string} userId - 使用者 ID
 * @param {boolean} fullSync - 是否完整同步（忽略上次同步時間）
 * @returns {Object} 拉取結果
 */
export const pullFromServer = async (userId, fullSync = false) => {
  try {
    const normalizeEntries = (payload) => {
      if (!payload) return [];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.entries)) return payload.entries;
      return [];
    };

    const fetchAllEntries = async () => {
      const PAGE_SIZE = 100; // FastAPI 限制 page_size <= 100
      let page = 1;
      const allEntries = [];
      let totalPages = 1;

      while (page <= totalPages) {
        let response;
        try {
          response = await api.getEntries({
            user_id: userId,
            page,
            page_size: PAGE_SIZE,
          });
        } catch (err) {
          // Render 會在頁數超出時回傳 404，視為已無更多資料
          const message = err?.message || '';
          const isNotFound = message.includes('404') || message.includes('Not Found');
          if (isNotFound) {
            if (page === 1) {
              console.warn('[sync] 伺服器沒有任何記錄，返回空結果');
              return allEntries;
            }
            break;
          }
          throw err;
        }

        const entries = normalizeEntries(response);
        allEntries.push(...entries);

        const reportedTotalPages = response?.total_pages;
        if (typeof reportedTotalPages === 'number' && reportedTotalPages > 0) {
          totalPages = reportedTotalPages;
        } else if (response?.total) {
          totalPages = Math.max(1, Math.ceil(response.total / PAGE_SIZE));
        } else if (entries.length < PAGE_SIZE) {
          // 沒有更多資料
          break;
        }

        if (entries.length === 0) {
          break;
        }

        page += 1;
      }

      return allEntries;
    };

    // 目前後端尚未提供 /sync/changes，所以統一改用完整同步。
    const serverEntries = await fetchAllEntries();

    // 取得本地記錄以比對
    const localRecords = await getAllRecords();
    const localByClientId = {};
    localRecords.forEach(r => {
      localByClientId[r.id] = r;
    });

    let added = 0;
    let updated = 0;

    for (const entry of serverEntries) {
      const clientId = entry.client_id;
      
      if (clientId && localByClientId[clientId]) {
        // 本地已有此記錄，檢查是否需要更新
        const local = localByClientId[clientId];
        const serverUpdated = new Date(entry.updated_at);
        const localUpdated = local.updatedAt ? new Date(local.updatedAt) : new Date(0);
        
        if (serverUpdated > localUpdated) {
          // 伺服器版本較新，更新本地
          await updateRecord(clientId, {
            serverId: entry._id,
            content: entry.memo,
            mood: entry.mood?.type,
            moodIntensity: entry.mood?.intensity,
            location: entry.location,
            serverVideoData: entry.video,
            videoUploaded: !!entry.video,
            hasVideo: !!entry.video,
            videoUri: entry.video ? null : local.videoUri,
            synced: true,
            updatedAt: entry.updated_at,
          });
          updated++;
        }
      } else {
        // 本地沒有此記錄，新增
        const newRecord = {
          id: clientId || `server_${entry._id}`,
          serverId: entry._id,
          content: entry.memo,
          mood: entry.mood?.type,
          moodIntensity: entry.mood?.intensity,
          location: entry.location,
          serverVideoData: entry.video,
           hasVideo: !!entry.video,
           videoUploaded: !!entry.video,
           videoUri: null,
          createdAt: entry.created_at,
          updatedAt: entry.updated_at,
          synced: true,
        };
        await addRecord(newRecord);
        added++;
      }
    }

    await setLastSyncTime(new Date().toISOString());

    return {
      success: true,
      added,
      updated,
      total: serverEntries.length,
      message: `從伺服器取得 ${serverEntries.length} 筆記錄`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `拉取失敗: ${error.message}`,
    };
  }
};

/**
 * 完整雙向同步
 * @param {string} userId - 使用者 ID
 * @param {Function} onProgress - 進度回調
 * @returns {Object} 同步結果
 */
export const fullSync = async (userId, onProgress = null) => {
  try {
    // 檢查網路
    const online = await isOnline();
    if (!online) {
      return {
        success: false,
        error: '無網路連線',
        message: '請檢查網路連線後再試',
      };
    }

    // 檢查後端連線
    let health;
    try {
      health = await api.checkHealth();
    } catch (healthError) {
      return {
        success: false,
        error: `健康檢查失敗: ${healthError.message}`,
        message: '無法連線到伺服器',
      };
    }
    
    if (!health.connected) {
      return {
        success: false,
        error: '無法連線到伺服器',
        message: '伺服器無回應，請稍後再試',
      };
    }

    // 1. 先推送本地待同步記錄
    if (onProgress) onProgress('uploading', 0, 0);
    let pushResult;
    try {
      pushResult = await syncPendingRecords(userId, (current, total) => {
        if (onProgress) onProgress('uploading', current, total);
      });
    } catch (pushError) {
      return {
        success: false,
        error: `上傳失敗: ${pushError.message}`,
        message: '上傳記錄時發生錯誤',
      };
    }

    // 2. 再從伺服器拉取
    if (onProgress) onProgress('downloading', 0, 0);
    let pullResult;
    try {
      pullResult = await pullFromServer(userId, false);
    } catch (pullError) {
      return {
        success: false,
        error: `下載失敗: ${pullError.message}`,
        message: '下載記錄時發生錯誤',
        push: pushResult,
      };
    }

    return {
      success: pushResult.success && pullResult.success,
      push: pushResult,
      pull: pullResult,
      message: `上傳: ${pushResult.synced}/${pushResult.total}, 下載: ${pullResult.added || 0} 新增, ${pullResult.updated || 0} 更新`,
    };
  } catch (error) {
    return {
      success: false,
      error: `同步發生未知錯誤: ${error.message}`,
      message: '同步過程發生錯誤',
      stack: error.stack,
    };
  }
};

/**
 * 儲存記錄（先存本地，不阻塞同步）
 * @param {Object} recordData - 記錄資料
 * @param {string} userId - 使用者 ID
 * @returns {Object} 儲存結果
 */
export const saveRecord = async (recordData, userId) => {
  // 產生唯一的 client_id
  const clientId = recordData.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const localRecord = {
    ...recordData,
    id: clientId,
    createdAt: recordData.createdAt || new Date().toISOString(),
    synced: false,
  };

  // 儲存到本地（快速返回）
  const storedRecord = await addRecord(localRecord);

  // 嘗試自動同步（若線上）
  let autoSync = {
    attempted: false,
    success: false,
  };

  const online = await isOnline();

  if (online && userId) {
    autoSync.attempted = true;
    try {
      const syncResult = await syncSingleRecord(storedRecord, userId);
      if (syncResult.success) {
        const syncedRecord = await markRecordAsSynced(storedRecord.id, syncResult.serverId);
        autoSync = {
          attempted: true,
          success: true,
          serverId: syncResult.serverId,
          record: syncedRecord,
        };
      } else {
        autoSync = {
          attempted: true,
          success: false,
          error: syncResult.error,
        };
      }
    } catch (autoError) {
      autoSync = {
        attempted: true,
        success: false,
        error: autoError?.message || String(autoError),
      };
    }
  } else if (!online) {
    autoSync.reason = 'offline';
  }

  return {
    success: true,
    synced: autoSync.success,
    record: autoSync.success ? autoSync.record : storedRecord,
    autoSync,
    message: autoSync.success
      ? '記錄已儲存並同步到雲端'
      : '記錄已儲存，待網路恢復後可同步到雲端',
  };
};

/**
 * Debug 同步 - 收集所有 log 並返回
 * @param {string} userId - 使用者 ID
 * @returns {Object} 包含所有 debug log 的同步結果
 */
export const debugSync = async (userId) => {
  const logs = [];
  const log = (msg) => {
    const timestamp = new Date().toISOString().substr(11, 8);
    logs.push(`[${timestamp}] ${msg}`);
  };

  try {
    log(`開始 Debug 同步, userId: ${userId}`);

    // 1. 取得待同步記錄
    const pendingRecords = await getPendingSyncRecords();
    log(`待同步記錄數: ${pendingRecords.length}`);
    
    if (pendingRecords.length === 0) {
      log('沒有待同步的記錄');
      return { success: true, logs, message: '沒有待同步的記錄' };
    }

    // 2. 顯示第一筆記錄的詳細資料
    const firstRecord = pendingRecords[0];
    log(`第一筆記錄 ID: ${firstRecord.id}`);
    log(`有影片: ${firstRecord.hasVideo || !!firstRecord.videoUri}`);
    log(`影片 URI: ${firstRecord.videoUri || '無'}`);
    log(`記錄內容: ${JSON.stringify(firstRecord).substring(0, 200)}...`);

    // 3. 先上傳影片（如果有的話）
    let videoData = null;
    if ((firstRecord.videoUri || firstRecord.hasVideo) && !firstRecord.videoUploaded) {
      const videoUri = firstRecord.videoUri;
      log(`準備上傳影片: ${videoUri}`);
      
      if (videoUri && videoUri.startsWith('file://')) {
        try {
          const uploadResult = await api.uploadVideo(videoUri, userId);
          log(`影片上傳結果: ${JSON.stringify(uploadResult)}`);
          videoData = buildVideoPayload(uploadResult, firstRecord.videoDuration);
          log(`✅ 影片上傳成功: ${videoData?.url}`);
        } catch (videoError) {
          log(`❌ 影片上傳失敗: ${videoError.message}`);
        }
      } else {
        log(`⚠️ 影片 URI 無效: ${videoUri}`);
      }
    }

    // 4. 準備要發送的資料 - 確保 client_id 是字串
    const moodLevelMap = { 'happy': 5, 'calm': 4, 'neutral': 3, 'sad': 2, 'angry': 1, 'anxious': 2 };
    const moodEmojiMap = { 'happy': '😄', 'calm': '😊', 'neutral': '😐', 'sad': '😔', 'angry': '😤', 'anxious': '😰' };

    const clientIdStr = String(firstRecord.id);
    const entryData = {
      user_id: userId,
      client_id: clientIdStr,
      memo: firstRecord.content || firstRecord.memo || null,
      mood: firstRecord.mood ? {
        level: moodLevelMap[firstRecord.mood] || 3,
        emoji: moodEmojiMap[firstRecord.mood] || '😐',
        label: firstRecord.mood,
      } : null,
      video: videoData,
      location: firstRecord.location ? {
        latitude: firstRecord.location.latitude,
        longitude: firstRecord.location.longitude,
        address: firstRecord.location.address || null,
        accuracy: firstRecord.location.accuracy || null,
      } : null,
      created_at: firstRecord.createdAt || new Date().toISOString(),
    };

    log(`準備發送的資料: ${JSON.stringify(entryData)}`);

    // 5. 嘗試發送到後端
    log('開始發送到後端...');
    try {
      const result = await api.createEntry(entryData);
      log(`✅ 成功! Server ID: ${result._id}`);
      
      // 標記為已同步
      await markRecordAsSynced(firstRecord.id, result._id);
      if (result.video || videoData) {
        await updateRecord(firstRecord.id, {
          serverVideoData: result.video || videoData,
          videoUploaded: true,
          videoUri: null,
          hasVideo: true,
        });
      }
      log('已標記為同步完成');
      
      return { 
        success: true, 
        logs, 
        serverId: result._id,
        message: '同步成功！' 
      };
    } catch (apiError) {
      log(`❌ API 錯誤: ${apiError.message}`);
      log(`錯誤詳情: ${JSON.stringify(apiError)}`);
      return { 
        success: false, 
        logs, 
        error: apiError.message,
        message: `API 錯誤: ${apiError.message}`
      };
    }
  } catch (error) {
    log(`❌ 未知錯誤: ${error.message}`);
    log(`Stack: ${error.stack}`);
    return { 
      success: false, 
      logs, 
      error: error.message,
      message: `錯誤: ${error.message}`
    };
  }
};

export default {
  isOnline,
  subscribeToNetworkChanges,
  syncSingleRecord,
  syncPendingRecords,
  pullFromServer,
  fullSync,
  saveRecord,
  debugSync,
};
