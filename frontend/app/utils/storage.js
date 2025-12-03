import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const RECORDS_KEY = "emogo_records";
const LAST_OPEN_KEY = "emogo_last_open";
const LAST_SYNC_KEY = "emogo_last_sync";
const USER_ID_KEY = "emogo_user_id";
const USERNAME_KEY = "emogo_username";

/**
 * 跨平台永久儲存
 * - Web: localStorage
 * - Native: expo-secure-store（永久儲存，app 關閉資料仍在）
 */
const storage = {
  async getItem(key) {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }
    // Native 使用 SecureStore 永久儲存
    return await SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }
    // Native 使用 SecureStore 永久儲存
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key) {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    // Native 使用 SecureStore
    await SecureStore.deleteItemAsync(key);
  },
};

/**
 * 取得所有記錄
 */
export const getAllRecords = async () => {
  try {
    const jsonValue = await storage.getItem(RECORDS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error("讀取記錄失敗:", error);
    return [];
  }
};

/**
 * 新增一筆記錄
 * @param {Object} record - 記錄資料
 * @param {string} record.id - 可選，如果沒有會自動產生 client_id
 */
export const addRecord = async (record) => {
  try {
    const records = await getAllRecords();
    const newRecord = {
      ...record,
      id: record.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: record.createdAt || new Date().toISOString(),
      synced: record.synced || false,
    };
    records.unshift(newRecord); // 新記錄放在最前面
    await storage.setItem(RECORDS_KEY, JSON.stringify(records));
    return newRecord;
  } catch (error) {
    console.error("新增記錄失敗:", error);
    throw error;
  }
};

/**
 * 刪除一筆記錄
 * @param {string} id - 記錄 ID (client_id)
 */
export const deleteRecord = async (id) => {
  try {
    const records = await getAllRecords();
    const filteredRecords = records.filter((record) => record.id !== id);
    await storage.setItem(RECORDS_KEY, JSON.stringify(filteredRecords));
    return true;
  } catch (error) {
    console.error("刪除記錄失敗:", error);
    throw error;
  }
};

/**
 * 移除記錄（同 deleteRecord，為了相容性保留）
 */
export const removeRecord = deleteRecord;

/**
 * 更新一筆記錄
 * @param {string} id - 記錄 ID (client_id)
 * @param {Object} updates - 要更新的欄位
 */
export const updateRecord = async (id, updates) => {
  try {
    const records = await getAllRecords();
    const index = records.findIndex((record) => record.id === id);
    if (index !== -1) {
      records[index] = { 
        ...records[index], 
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      await storage.setItem(RECORDS_KEY, JSON.stringify(records));
      return records[index];
    }
    throw new Error("找不到記錄");
  } catch (error) {
    console.error("更新記錄失敗:", error);
    throw error;
  }
};

/**
 * 取得待同步的記錄（synced = false）
 */
export const getPendingSyncRecords = async () => {
  try {
    const records = await getAllRecords();
    return records.filter((record) => !record.synced);
  } catch (error) {
    console.error("取得待同步記錄失敗:", error);
    return [];
  }
};

/**
 * 取得待同步記錄數量
 */
export const getPendingSyncCount = async () => {
  try {
    const pending = await getPendingSyncRecords();
    return pending.length;
  } catch (error) {
    console.error("取得待同步數量失敗:", error);
    return 0;
  }
};

/**
 * 標記記錄為已同步
 * @param {string} clientId - 本地記錄 ID
 * @param {string} serverId - 伺服器回傳的 ID
 */
export const markRecordAsSynced = async (clientId, serverId) => {
  try {
    return await updateRecord(clientId, {
      synced: true,
      serverId: serverId,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("標記同步狀態失敗:", error);
    throw error;
  }
};

/**
 * 取得上次同步時間
 */
export const getLastSyncTime = async () => {
  try {
    return await storage.getItem(LAST_SYNC_KEY);
  } catch (error) {
    console.error("取得上次同步時間失敗:", error);
    return null;
  }
};

/**
 * 設定上次同步時間
 * @param {string} time - ISO 格式時間字串
 */
export const setLastSyncTime = async (time) => {
  try {
    await storage.setItem(LAST_SYNC_KEY, time);
  } catch (error) {
    console.error("設定同步時間失敗:", error);
  }
};

/**
 * 取得或建立使用者 ID
 */
export const getUserId = async () => {
  try {
    let userId = await storage.getItem(USER_ID_KEY);
    if (!userId) {
      // 產生新的 UUID
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await storage.setItem(USER_ID_KEY, userId);
    }
    return userId;
  } catch (error) {
    console.error("取得使用者 ID 失敗:", error);
    // 回傳暫時的 ID
    return `temp_${Date.now()}`;
  }
};

/**
 * 設定使用者 ID
 * @param {string} userId - 使用者 ID
 */
export const setUserId = async (userId) => {
  try {
    await storage.setItem(USER_ID_KEY, userId);
  } catch (error) {
    console.error("設定使用者 ID 失敗:", error);
  }
};

/**
 * 取得使用者名稱
 */
export const getUsername = async () => {
  try {
    return await storage.getItem(USERNAME_KEY);
  } catch (error) {
    console.error("取得使用者名稱失敗:", error);
    return null;
  }
};

/**
 * 設定使用者名稱
 * @param {string} username - 使用者名稱
 */
export const setUsername = async (username) => {
  try {
    await storage.setItem(USERNAME_KEY, username);
  } catch (error) {
    console.error("設定使用者名稱失敗:", error);
  }
};

/**
 * 檢查是否已註冊
 */
export const isUserRegistered = async () => {
  try {
    const userId = await storage.getItem(USER_ID_KEY);
    const username = await storage.getItem(USERNAME_KEY);
    // 只有當有 username 時才算已註冊（舊版自動生成的 user_id 不算）
    return !!(userId && username);
  } catch (error) {
    console.error("檢查註冊狀態失敗:", error);
    return false;
  }
};

/**
 * 清除使用者資料（登出）
 */
export const clearUserData = async () => {
  try {
    await storage.removeItem(USER_ID_KEY);
    await storage.removeItem(USERNAME_KEY);
  } catch (error) {
    console.error("清除使用者資料失敗:", error);
  }
};

/**
 * 清除所有記錄
 */
export const clearAllRecords = async () => {
  try {
    await storage.removeItem(RECORDS_KEY);
    return true;
  } catch (error) {
    console.error("清除記錄失敗:", error);
    throw error;
  }
};

/**
 * 記錄最後開啟 App 的時間
 */
export const updateLastOpenTime = async () => {
  try {
    await storage.setItem(LAST_OPEN_KEY, new Date().toISOString());
  } catch (error) {
    console.error("更新最後開啟時間失敗:", error);
  }
};

/**
 * 取得最後開啟 App 的時間
 */
export const getLastOpenTime = async () => {
  try {
    return await storage.getItem(LAST_OPEN_KEY);
  } catch (error) {
    console.error("取得最後開啟時間失敗:", error);
    return null;
  }
};

/**
 * 匯出所有記錄為 JSON 字串
 */
export const exportRecordsAsJSON = async () => {
  try {
    const records = await getAllRecords();
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalRecords: records.length,
      records: records,
    };
    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error("匯出記錄失敗:", error);
    throw error;
  }
};