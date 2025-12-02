import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";
import { updateLastOpenTime, getUserId } from "../utils/storage";
import { saveRecord as syncSaveRecord, isOnline } from "../services/sync";
import VideoRecorder from "../components/VideoRecorder";

// 心情選項
const MOODS = [
  { emoji: "😄", label: "開心", value: "happy" },
  { emoji: "😊", label: "平靜", value: "calm" },
  { emoji: "😐", label: "普通", value: "neutral" },
  { emoji: "😔", label: "低落", value: "sad" },
  { emoji: "😤", label: "生氣", value: "angry" },
  { emoji: "😰", label: "焦慮", value: "anxious" },
];

export default function RecordScreen() {
  const [memo, setMemo] = useState("");
  const [selectedMood, setSelectedMood] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [videoUri, setVideoUri] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(null);

  // 取得 GPS 位置的函數
  const fetchLocation = async () => {
    setLocationLoading(true);
    try {
      // Web 使用瀏覽器 API
      if (Platform.OS === "web") {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
              setLocationLoading(false);
            },
            (err) => {
              console.log("Web 定位失敗:", err.message);
              setLocationLoading(false);
            }
          );
        } else {
          setLocationLoading(false);
        }
        return;
      }

      // Native 使用 expo-location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("定位權限被拒絕");
        setLocationLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(currentLocation.coords);
    } catch (error) {
      console.log("自動定位失敗:", error.message);
    } finally {
      setLocationLoading(false);
    }
  };

  // 頁面載入時自動取得 GPS 位置
  useEffect(() => {
    fetchLocation();
    // 檢查網路狀態
    checkNetwork();
  }, []);

  // 檢查網路狀態
  const checkNetwork = async () => {
    const online = await isOnline();
    setNetworkStatus(online);
  };

  // 開啟相機
  const openCamera = () => {
    setShowCamera(true);
  };

  // 錄影完成回調
  const handleVideoRecorded = (video) => {
    console.log("Video recorded:", video);
    setVideoUri(video.uri);
    setShowCamera(false);
  };

  // 移除已錄製的影片
  const removeVideo = () => {
    Alert.alert("移除影片", "確定要移除已錄製的影片嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "移除",
        style: "destructive",
        onPress: () => setVideoUri(null),
      },
    ]);
  };

  // 儲存記錄
  const saveRecord = async () => {
    if (!memo && !selectedMood && !location && !videoUri) {
      Alert.alert("提示", "請至少填寫一項內容");
      return;
    }

    setIsSaving(true);

    try {
      // 取得使用者 ID
      const userId = await getUserId();

      const record = {
        content: memo, // 改用 content 以配合後端 memo 欄位
        memo,
        mood: selectedMood,
        location,
        videoUri,
        hasVideo: !!videoUri,
      };

      // 使用同步服務儲存（會自動判斷線上/離線）
      const result = await syncSaveRecord(record, userId);

      // 重置提醒通知（新增記錄後，重新計算 6 小時）
      await updateLastOpenTime();
      // 動態載入通知模組（避免在舊 APK 崩潰）
      try {
        const { scheduleReminderNotification } = require("../utils/notifications");
        await scheduleReminderNotification();
      } catch (e) {
        console.log("通知功能尚不可用");
      }

      // 根據同步狀態顯示不同訊息
      const syncIcon = result.synced ? "☁️" : "📱";
      const syncMessage = result.synced 
        ? "記錄已同步到雲端！" 
        : "記錄已存到本地，稍後可同步到雲端";

      Alert.alert("成功", `${syncIcon} ${syncMessage}`, [
        {
          text: "確定",
          onPress: () => {
            // 重置表單
            setMemo("");
            setSelectedMood(null);
            setVideoUri(null);
            // 重新取得 GPS 位置（為下一筆記錄準備）
            fetchLocation();
            // 重新檢查網路
            checkNetwork();
            // 跳轉到「我的記錄」頁面
            router.replace("/(tabs)");
          },
        },
      ]);
    } catch (error) {
      Alert.alert("錯誤", "儲存失敗: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>📝 新增記錄</Text>

      {/* 網路狀態指示 */}
      <View style={styles.networkStatus}>
        <Ionicons 
          name={networkStatus ? "cloud-done" : "cloud-offline"} 
          size={16} 
          color={networkStatus ? "#4CAF50" : "#FF9800"} 
        />
        <Text style={[
          styles.networkStatusText,
          { color: networkStatus ? "#4CAF50" : "#FF9800" }
        ]}>
          {networkStatus ? "線上模式 - 即時同步" : "離線模式 - 稍後同步"}
        </Text>
      </View>

      {/* 相機錄影元件 */}
      <VideoRecorder
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onVideoRecorded={handleVideoRecorded}
      />

      {/* 1. 影片區塊 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="videocam" size={20} color="#333" /> 錄製影片
        </Text>
        {videoUri ? (
          <View style={styles.videoPreview}>
            <View style={styles.videoThumbnail}>
              <Ionicons name="videocam" size={48} color="#4CAF50" />
              <Text style={styles.videoRecordedText}>影片已錄製 ✓</Text>
            </View>
            <View style={styles.videoActions}>
              <TouchableOpacity
                style={styles.videoActionButton}
                onPress={openCamera}
              >
                <Ionicons name="refresh" size={20} color="#007AFF" />
                <Text style={styles.videoActionText}>重新錄製</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.videoActionButton, styles.videoRemoveButton]}
                onPress={removeVideo}
              >
                <Ionicons name="trash" size={20} color="#FF3B30" />
                <Text style={[styles.videoActionText, { color: "#FF3B30" }]}>
                  移除
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.videoButton} onPress={openCamera}>
            <Ionicons name="camera" size={48} color="#666" />
            <Text style={styles.videoButtonText}>點擊開始錄影</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Memo 區塊 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="create" size={20} color="#333" /> 記錄想法
        </Text>
        <TextInput
          style={styles.memoInput}
          placeholder="寫下你的想法..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          value={memo}
          onChangeText={setMemo}
        />
      </View>

      {/* 3. 心情區塊 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="happy" size={20} color="#333" /> 今天的心情
        </Text>
        <View style={styles.moodContainer}>
          {MOODS.map((mood) => (
            <TouchableOpacity
              key={mood.value}
              style={[
                styles.moodButton,
                selectedMood === mood.value && styles.moodButtonSelected,
              ]}
              onPress={() => setSelectedMood(mood.value)}
            >
              <Text style={styles.moodEmoji}>{mood.emoji}</Text>
              <Text
                style={[
                  styles.moodLabel,
                  selectedMood === mood.value && styles.moodLabelSelected,
                ]}
              >
                {mood.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 4. GPS 位置區塊（自動取得） */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="location" size={20} color="#333" /> GPS 定位
        </Text>
        <View style={styles.locationStatus}>
          <Ionicons
            name={locationLoading ? "navigate" : location ? "checkmark-circle" : "close-circle"}
            size={24}
            color={locationLoading ? "#007AFF" : location ? "#4CAF50" : "#999"}
          />
          <Text style={styles.locationStatusText}>
            {locationLoading
              ? "自動定位中..."
              : location
              ? `📍 ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
              : "無法取得位置"}
          </Text>
        </View>
      </View>

      {/* 儲存按鈕 */}
      <TouchableOpacity 
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
        onPress={saveRecord}
        disabled={isSaving}
      >
        {isSaving ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.saveButtonText}>儲存中...</Text>
          </>
        ) : (
          <>
            <Ionicons name="save" size={24} color="#fff" />
            <Text style={styles.saveButtonText}>儲存記錄</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
    color: "#333",
  },
  networkStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9f9f9",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  networkStatusText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "500",
  },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
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
    marginBottom: 12,
    color: "#333",
  },
  // 影片相關樣式
  videoButton: {
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ddd",
    borderStyle: "dashed",
  },
  videoButtonRecorded: {
    borderColor: "#4CAF50",
    borderStyle: "solid",
    backgroundColor: "#E8F5E9",
  },
  videoButtonText: {
    marginTop: 8,
    fontSize: 16,
    color: "#666",
  },
  videoPreview: {
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  videoThumbnail: {
    alignItems: "center",
    paddingVertical: 16,
  },
  videoRecordedText: {
    marginTop: 8,
    fontSize: 16,
    color: "#4CAF50",
    fontWeight: "600",
  },
  videoActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
  },
  videoActionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  videoRemoveButton: {
    borderColor: "#FF3B30",
  },
  videoActionText: {
    marginLeft: 6,
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  // Memo 相關樣式
  memoInput: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  // 心情相關樣式
  moodContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  moodButton: {
    width: "30%",
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  moodButtonSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#E3F2FD",
  },
  moodEmoji: {
    fontSize: 32,
  },
  moodLabel: {
    marginTop: 4,
    fontSize: 14,
    color: "#666",
  },
  moodLabelSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
  // GPS 相關樣式
  locationStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 14,
  },
  locationStatusText: {
    marginLeft: 12,
    fontSize: 15,
    color: "#555",
  },
  // 儲存按鈕
  saveButton: {
    flexDirection: "row",
    backgroundColor: "#007AFF",
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#999",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
  },
  bottomPadding: {
    height: 40,
  },
});
