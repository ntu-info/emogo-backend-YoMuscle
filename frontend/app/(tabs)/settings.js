import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Share, Platform, ActivityIndicator, TextInput, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { clearAllRecords, exportRecordsAsJSON, getAllRecords, getPendingSyncCount, getUserId, getLastSyncTime, getUsername, setUserId, setUsername, isUserRegistered, clearUserData } from "../utils/storage";
import { fullSync, isOnline, subscribeToNetworkChanges } from "../services/sync";
import { checkHealth, getEntries, registerUser } from "../services/api";

export default function SettingsScreen() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(null);
  const [serverStatus, setServerStatus] = useState(null);
  const [lastSyncTime, setLastSyncTimeState] = useState(null);
  
  // 用戶相關狀態
  const [currentUsername, setCurrentUsername] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // 載入用戶資訊
  const loadUserInfo = async () => {
    try {
      const [username, userId] = await Promise.all([
        getUsername(),
        getUserId(),
      ]);
      setCurrentUsername(username);
      setCurrentUserId(userId);
    } catch (error) {
      console.error("載入用戶資訊失敗:", error);
    }
  };

  // 載入同步相關資訊
  const loadSyncInfo = async () => {
    try {
      const [pending, online, lastSync] = await Promise.all([
        getPendingSyncCount(),
        isOnline(),
        getLastSyncTime(),
      ]);
      setPendingCount(pending);
      setNetworkStatus(online);
      setLastSyncTimeState(lastSync);

      // 檢查伺服器連線
      if (online) {
        const health = await checkHealth();
        setServerStatus(health.connected);
      } else {
        setServerStatus(false);
      }
    } catch (error) {
      console.error("載入同步資訊失敗:", error);
    }
  };

  // 頁面聚焦時重新載入
  useFocusEffect(
    useCallback(() => {
      loadSyncInfo();
      loadUserInfo();
    }, [])
  );

  // 訂閱網路狀態變化
  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges((state) => {
      setNetworkStatus(state.isConnected);
      if (state.isConnected) {
        checkHealth().then(h => setServerStatus(h.connected));
      } else {
        setServerStatus(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 用戶註冊
  const handleRegister = async () => {
    if (!registerName.trim()) return;
    
    setIsRegistering(true);
    try {
      const result = await registerUser(registerName.trim());
      
      // 儲存用戶資訊到本地
      await setUserId(result.user_id);
      await setUsername(result.username);
      
      // 更新狀態
      setCurrentUserId(result.user_id);
      setCurrentUsername(result.username);
      setShowRegisterModal(false);
      setRegisterName("");
      
      Alert.alert(
        "✅ 成功", 
        `歡迎，${result.username}！\n\n您的 ID: ${result.user_id}`
      );
    } catch (error) {
      console.error("註冊失敗:", error);
      Alert.alert("註冊失敗", error.message);
    } finally {
      setIsRegistering(false);
    }
  };

  // 用戶登出
  const handleLogout = () => {
    Alert.alert(
      "確認登出",
      "登出後您的本地記錄仍會保留，但需要重新登入才能同步到雲端。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "登出",
          style: "destructive",
          onPress: async () => {
            await clearUserData();
            setCurrentUsername(null);
            setCurrentUserId(null);
            Alert.alert("已登出", "您可以隨時重新登入");
          },
        },
      ]
    );
  };

  // 手動同步
  const handleSync = async () => {
    if (!networkStatus) {
      Alert.alert("無網路", "請連接網路後再試");
      return;
    }

    setIsSyncing(true);
    try {
      const userId = await getUserId();
      console.log("開始同步, userId:", userId);
      
      const result = await fullSync(userId, (phase, current, total) => {
        console.log(`同步進度: ${phase} ${current}/${total}`);
      });

      console.log("同步結果:", JSON.stringify(result, null, 2));

      if (result.success) {
        Alert.alert("同步完成", result.message);
      } else {
        // 顯示詳細錯誤
        const errorDetail = JSON.stringify(result, null, 2);
        Alert.alert("同步失敗", `${result.message || result.error}\n\n詳細: ${errorDetail}`);
      }
      
      // 重新載入同步資訊
      await loadSyncInfo();
    } catch (error) {
      console.error("同步錯誤:", error);
      Alert.alert("同步錯誤", `${error.message}\n\nStack: ${error.stack}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // 格式化時間顯示
  const formatLastSync = (isoString) => {
    if (!isoString) return "從未同步";
    const date = new Date(isoString);
    return date.toLocaleString("zh-TW", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 匯出資料功能
  const handleExportData = async () => {
    try {
      const records = await getAllRecords();
      if (records.length === 0) {
        Alert.alert("提示", "目前沒有任何記錄可匯出");
        return;
      }

      const jsonData = await exportRecordsAsJSON();
      
      // 使用分享功能匯出
      try {
        await Share.share({
          message: jsonData,
          title: "Emogo 記錄備份",
        });
      } catch (e) {
        // 如果分享失敗，顯示在 Alert 中讓使用者複製
        Alert.alert(
          "匯出資料",
          `共 ${records.length} 筆記錄\n\n資料太長無法直接分享，請截圖保存以下資訊：\n\n${jsonData.substring(0, 500)}...`,
        );
      }
    } catch (error) {
      Alert.alert("錯誤", "匯出失敗: " + error.message);
    }
  };

  // 測試通知功能
  const handleTestNotification = async () => {
    try {
      const { sendTestNotification } = require("../utils/notifications");
      const success = await sendTestNotification();
      if (success) {
        Alert.alert("✅ 已發送", "通知應該會立即出現！\n\n如果沒看到，請檢查手機的通知設定。");
      } else {
        Alert.alert("❌ 失敗", "通知權限被拒絕，請到系統設定開啟通知權限。");
      }
    } catch (error) {
      Alert.alert("❌ 錯誤", "通知功能尚不可用：" + error.message);
    }
  };

  const handleClearData = () => {
    Alert.alert(
      "清除所有資料",
      "確定要刪除所有記錄嗎？此操作無法復原。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "確定清除",
          style: "destructive",
          onPress: async () => {
            await clearAllRecords();
            Alert.alert("完成", "所有記錄已清除");
          },
        },
      ]
    );
  };

  // 診斷功能 - 顯示詳細的本地和雲端資料狀態
  const handleDiagnose = async () => {
    try {
      const userId = await getUserId();
      const localRecords = await getAllRecords();
      const pendingCount = await getPendingSyncCount();
      const online = await isOnline();
      
      let serverInfo = "無法連線";
      let serverCount = 0;
      
      if (online) {
        try {
          const serverData = await getEntries({ user_id: userId, limit: 100 });
          serverCount = serverData.total || 0;
          serverInfo = `已連線 (${serverCount} 筆記錄)`;
        } catch (e) {
          serverInfo = `連線錯誤: ${e.message}`;
        }
      }

      const localSynced = localRecords.filter(r => r.synced).length;
      const localPending = localRecords.filter(r => !r.synced).length;

      const diagInfo = `
📱 使用者 ID:
${userId}

📂 本地資料:
- 總筆數: ${localRecords.length}
- 已同步: ${localSynced}
- 待同步: ${localPending}

☁️ 雲端資料:
- 狀態: ${serverInfo}

🌐 網路狀態: ${online ? '已連線' : '離線'}

📋 本地記錄詳情:
${localRecords.slice(0, 5).map((r, i) => 
  `${i + 1}. ${r.synced ? '✅' : '⏳'} ${(r.memo || r.content || '無文字').substring(0, 20)}...`
).join('\n') || '(無記錄)'}
${localRecords.length > 5 ? `\n...還有 ${localRecords.length - 5} 筆` : ''}
      `.trim();

      Alert.alert("🔍 診斷資訊", diagInfo, [
        { text: "複製", onPress: () => {
          if (Platform.OS !== 'web') {
            Share.share({ message: diagInfo });
          }
        }},
        { text: "確定" }
      ]);
    } catch (error) {
      Alert.alert("診斷失敗", error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* 用戶帳號區塊 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 帳號</Text>
        
        {currentUsername ? (
          <>
            <View style={styles.userInfoRow}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {currentUsername.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{currentUsername}</Text>
                <Text style={styles.userIdText} numberOfLines={1}>
                  ID: {currentUserId}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
              <Text style={styles.logoutButtonText}>登出</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.notLoggedIn}>
            <Ionicons name="person-circle-outline" size={50} color="#ccc" />
            <Text style={styles.notLoggedInText}>尚未登入</Text>
            <Text style={styles.notLoggedInHint}>
              登入後可在 Dashboard 看到您的名稱
            </Text>
            <TouchableOpacity 
              style={styles.registerButton} 
              onPress={() => setShowRegisterModal(true)}
            >
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.registerButtonText}>註冊 / 登入</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 註冊 Modal */}
      <Modal
        visible={showRegisterModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRegisterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>註冊 / 登入</Text>
            <Text style={styles.modalHint}>
              輸入您的名稱，如果已註冊過會自動登入
            </Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="請輸入您的名稱"
              value={registerName}
              onChangeText={setRegisterName}
              autoFocus={true}
              maxLength={50}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowRegisterModal(false);
                  setRegisterName("");
                }}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.modalConfirmButton,
                  (!registerName.trim() || isRegistering) && styles.modalButtonDisabled
                ]}
                onPress={handleRegister}
                disabled={!registerName.trim() || isRegistering}
              >
                {isRegistering ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>確認</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>雲端同步</Text>
        
        {/* 連線狀態 */}
        <View style={styles.syncStatusRow}>
          <View style={styles.statusItem}>
            <Ionicons 
              name={networkStatus ? "wifi" : "wifi-outline"} 
              size={20} 
              color={networkStatus ? "#4CAF50" : "#999"} 
            />
            <Text style={styles.statusText}>
              {networkStatus ? "網路已連線" : "無網路"}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Ionicons 
              name={serverStatus ? "server" : "server-outline"} 
              size={20} 
              color={serverStatus ? "#4CAF50" : "#999"} 
            />
            <Text style={styles.statusText}>
              {serverStatus ? "伺服器正常" : "伺服器離線"}
            </Text>
          </View>
        </View>

        {/* 待同步數量 */}
        <View style={styles.syncInfoRow}>
          <Text style={styles.syncInfoLabel}>待同步記錄</Text>
          <View style={[
            styles.syncBadge,
            pendingCount > 0 ? styles.syncBadgeActive : styles.syncBadgeInactive
          ]}>
            <Text style={[
              styles.syncBadgeText,
              pendingCount > 0 ? styles.syncBadgeTextActive : styles.syncBadgeTextInactive
            ]}>
              {pendingCount}
            </Text>
          </View>
        </View>

        <View style={styles.syncInfoRow}>
          <Text style={styles.syncInfoLabel}>上次同步</Text>
          <Text style={styles.syncInfoValue}>{formatLastSync(lastSyncTime)}</Text>
        </View>

        {/* 同步按鈕 */}
        <TouchableOpacity 
          style={[
            styles.syncButton, 
            (!networkStatus || isSyncing) && styles.syncButtonDisabled
          ]} 
          onPress={handleSync}
          disabled={!networkStatus || isSyncing}
        >
          {isSyncing ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.syncButtonText}>同步中...</Text>
            </>
          ) : (
            <>
              <Ionicons name="sync" size={20} color="#fff" />
              <Text style={styles.syncButtonText}>
                {pendingCount > 0 ? `立即同步 (${pendingCount} 筆)` : "同步雲端資料"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>關於應用</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>應用名稱</Text>
          <Text style={styles.infoValue}>Emogo 情緒記錄</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>版本</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>功能說明</Text>
        
        <View style={styles.featureItem}>
          <Ionicons name="videocam" size={24} color="#007AFF" />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>錄製影片</Text>
            <Text style={styles.featureDesc}>用影像記錄當下的時刻</Text>
          </View>
        </View>
        
        <View style={styles.featureItem}>
          <Ionicons name="create" size={24} color="#4CAF50" />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>寫下想法</Text>
            <Text style={styles.featureDesc}>用文字記錄你的心情與想法</Text>
          </View>
        </View>
        
        <View style={styles.featureItem}>
          <Ionicons name="happy" size={24} color="#FFD700" />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>記錄心情</Text>
            <Text style={styles.featureDesc}>選擇當下的情緒狀態</Text>
          </View>
        </View>
        
        <View style={styles.featureItem}>
          <Ionicons name="location" size={24} color="#FF6347" />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>GPS 定位</Text>
            <Text style={styles.featureDesc}>記錄你所在的位置</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>資料管理</Text>
        
        <TouchableOpacity style={styles.exportButton} onPress={handleExportData}>
          <Ionicons name="download-outline" size={20} color="#4CAF50" />
          <Text style={styles.exportButtonText}>匯出所有記錄</Text>
        </TouchableOpacity>

        <View style={{ height: 12 }} />
        
        <TouchableOpacity style={styles.dangerButton} onPress={handleClearData}>
          <Ionicons name="trash" size={20} color="#FF3B30" />
          <Text style={styles.dangerButtonText}>清除所有記錄</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>測試功能</Text>
        
        <TouchableOpacity style={styles.testButton} onPress={handleDiagnose}>
          <Ionicons name="bug" size={20} color="#FF9800" />
          <Text style={[styles.testButtonText, { color: "#FF9800" }]}>診斷同步狀態</Text>
        </TouchableOpacity>

        <View style={{ height: 12 }} />

        <TouchableOpacity style={styles.testButton} onPress={handleTestNotification}>
          <Ionicons name="notifications" size={20} color="#007AFF" />
          <Text style={styles.testButtonText}>測試通知（10 秒後）</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Made with ❤️ by Emogo Team</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  syncStatusRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    marginLeft: 6,
    fontSize: 14,
    color: "#666",
  },
  syncInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  syncInfoLabel: {
    fontSize: 15,
    color: "#666",
  },
  syncInfoValue: {
    fontSize: 15,
    color: "#333",
  },
  syncBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncBadgeActive: {
    backgroundColor: "#FF9800",
  },
  syncBadgeInactive: {
    backgroundColor: "#e0e0e0",
  },
  syncBadgeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  syncBadgeTextActive: {
    color: "#fff",
  },
  syncBadgeTextInactive: {
    color: "#999",
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 8,
    marginTop: 12,
  },
  syncButtonDisabled: {
    backgroundColor: "#ccc",
  },
  syncButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: {
    fontSize: 16,
    color: "#666",
  },
  infoValue: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  featureText: {
    marginLeft: 16,
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  featureDesc: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0F0",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFD0D0",
  },
  dangerButtonText: {
    color: "#FF3B30",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0FFF0",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D0FFD0",
  },
  exportButtonText: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  testButton: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F8FF",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D0E8FF",
  },
  testButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  footer: {
    padding: 32,
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#999",
  },
  // 用戶帳號樣式
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  userIdText: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  notLoggedIn: {
    alignItems: "center",
    paddingVertical: 16,
  },
  notLoggedInText: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  notLoggedInHint: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
    textAlign: "center",
  },
  registerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  registerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0F0",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFD0D0",
  },
  logoutButtonText: {
    color: "#FF3B30",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  // Modal 樣式
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 350,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  modalCancelText: {
    fontSize: 16,
    color: "#666",
  },
  modalConfirmButton: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: "#007AFF",
  },
  modalConfirmText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  modalButtonDisabled: {
    backgroundColor: "#ccc",
  },
});
