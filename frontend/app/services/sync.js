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
    if (record.videoUri && !record.videoUploaded) {
      try {
        console.log('📹 上傳影片:', record.videoUri);
        const uploadResult = await api.uploadVideo(record.videoUri, userId);
        videoData = {
          file_path: uploadResult.file_path,
          file_url: uploadResult.file_url,
          duration_seconds: record.videoDuration || null,
          size_bytes: uploadResult.size_bytes || null,
        };
        console.log('✅ 影片上傳成功');
      } catch (uploadError) {
        console.error('❌ 影片上傳失敗:', uploadError.message);
        // 影片上傳失敗不阻止文字資料同步
      }
    }

    // 準備 Entry 資料
    const entryData = {
      user_id: userId,
      client_id: record.id, // 使用本地 ID 作為 client_id
      memo: record.content || record.memo || null,
      mood: record.mood ? {
        type: record.mood,
        intensity: record.moodIntensity || 5,
        note: record.moodNote || null,
      } : null,
      video: videoData || (record.serverVideoData ? record.serverVideoData : null),
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
      result = await api.createEntry(entryData);
    }
    
    console.log('✅ 同步成功:', result._id);

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
      const errorStr = typeof result.error === 'string' 
        ? result.error 
        : JSON.stringify(result.error);
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
    let serverEntries;
    
    if (fullSync) {
      // 完整同步 - 取得所有記錄
      serverEntries = await api.getEntries({ user_id: userId, limit: 1000 });
    } else {
      // 增量同步 - 只取得上次同步後的變更
      const lastSync = await getLastSyncTime();
      if (lastSync) {
        serverEntries = await api.getChangesSince(userId, lastSync);
      } else {
        serverEntries = await api.getEntries({ user_id: userId, limit: 1000 });
      }
    }

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
  const health = await api.checkHealth();
  if (!health.connected) {
    return {
      success: false,
      error: '無法連線到伺服器',
      message: '伺服器無回應，請稍後再試',
    };
  }

  // 1. 先推送本地待同步記錄
  if (onProgress) onProgress('uploading', 0, 0);
  const pushResult = await syncPendingRecords(userId, (current, total) => {
    if (onProgress) onProgress('uploading', current, total);
  });

  // 2. 再從伺服器拉取
  if (onProgress) onProgress('downloading', 0, 0);
  const pullResult = await pullFromServer(userId, false);

  return {
    success: pushResult.success && pullResult.success,
    push: pushResult,
    pull: pullResult,
    message: `上傳: ${pushResult.synced}/${pushResult.total}, 下載: ${pullResult.added || 0} 新增, ${pullResult.updated || 0} 更新`,
  };
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
  await addRecord(localRecord);

  // 返回成功，背景同步由用戶手動觸發
  return {
    success: true,
    synced: false,
    record: localRecord,
    message: '記錄已儲存，請到設定頁面同步到雲端',
  };
};

export default {
  isOnline,
  subscribeToNetworkChanges,
  syncSingleRecord,
  syncPendingRecords,
  pullFromServer,
  fullSync,
  saveRecord,
};
