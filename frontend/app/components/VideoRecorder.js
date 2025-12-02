import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";

/**
 * 影片錄製元件
 * @param {boolean} visible - 是否顯示相機
 * @param {function} onClose - 關閉相機回調
 * @param {function} onVideoRecorded - 錄影完成回調，回傳影片 URI
 */
export default function VideoRecorder({ visible, onClose, onVideoRecorded }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaPermission, setMediaPermission] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facing, setFacing] = useState("back");
  const cameraRef = useRef(null);
  const timerRef = useRef(null);

  // 請求媒體庫權限
  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setMediaPermission(status === "granted");
    })();
  }, []);

  // 請求麥克風權限
  useEffect(() => {
    if (visible && !microphonePermission?.granted) {
      requestMicrophonePermission();
    }
  }, [visible]);

  // 計時器
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setRecordingTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  // 格式化時間
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 切換前後鏡頭
  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  // 開始/停止錄影
  const toggleRecording = async () => {
    if (!cameraRef.current) return;

    if (isRecording) {
      // 停止錄影
      setIsRecording(false);
      cameraRef.current.stopRecording();
    } else {
      // 檢查麥克風權限
      if (!microphonePermission?.granted) {
        const result = await requestMicrophonePermission();
        if (!result.granted) {
          Alert.alert("權限不足", "需要麥克風權限才能錄製影片");
          return;
        }
      }

      // 開始錄影
      setIsRecording(true);
      try {
        const video = await cameraRef.current.recordAsync({
          maxDuration: 60, // 最長 60 秒
          quality: "720p",
        });

        console.log("Video recorded:", video);

        // 儲存到媒體庫
        if (mediaPermission && video.uri) {
          try {
            const asset = await MediaLibrary.createAssetAsync(video.uri);
            console.log("Video saved to library:", asset);
          } catch (saveError) {
            console.warn("Could not save to library:", saveError);
          }
        }

        // 回傳影片資訊
        if (onVideoRecorded) {
          onVideoRecorded(video);
        }

        onClose();
      } catch (error) {
        console.error("Recording error:", error);
        Alert.alert("錯誤", "錄影失敗: " + error.message);
      } finally {
        setIsRecording(false);
      }
    }
  };

  // Web 平台不支援
  if (Platform.OS === "web") {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.container}>
          <View style={styles.webNotSupported}>
            <Ionicons name="videocam-off" size={64} color="#999" />
            <Text style={styles.webNotSupportedText}>
              網頁版暫不支援錄影功能
            </Text>
            <Text style={styles.webNotSupportedSubtext}>
              請使用手機 App 來錄製影片
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>關閉</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // 檢查權限
  if (!cameraPermission) {
    return null;
  }

  if (!cameraPermission.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera" size={64} color="#007AFF" />
            <Text style={styles.permissionText}>需要相機權限來錄製影片</Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestCameraPermission}
            >
              <Text style={styles.permissionButtonText}>授予權限</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mode="video"
        >
          {/* 頂部控制列 */}
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.iconButton} onPress={onClose}>
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>

            {/* 錄影時間 */}
            {isRecording && (
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTime}>{formatTime(recordingTime)}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing}>
              <Ionicons name="camera-reverse" size={32} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* 底部控制列 */}
          <View style={styles.bottomControls}>
            <View style={styles.placeholder} />

            {/* 錄影按鈕 */}
            <TouchableOpacity
              style={[styles.recordButton, isRecording && styles.recordButtonRecording]}
              onPress={toggleRecording}
            >
              {isRecording ? (
                <View style={styles.stopIcon} />
              ) : (
                <View style={styles.recordIcon} />
              )}
            </TouchableOpacity>

            <View style={styles.placeholder} />
          </View>

          {/* 提示文字 */}
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>
              {isRecording ? "點擊停止錄影" : "點擊開始錄影（最長 60 秒）"}
            </Text>
          </View>
        </CameraView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  // 頂部控制
  topControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    marginRight: 8,
  },
  recordingTime: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  // 底部控制
  bottomControls: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  placeholder: {
    width: 50,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  recordButtonRecording: {
    backgroundColor: "rgba(255,0,0,0.3)",
    borderColor: "#ff0000",
  },
  recordIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ff0000",
  },
  stopIcon: {
    width: 30,
    height: 30,
    backgroundColor: "#ff0000",
    borderRadius: 4,
  },
  // 提示
  hintContainer: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hintText: {
    color: "#fff",
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  // 權限請求頁
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  permissionText: {
    fontSize: 18,
    color: "#fff",
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  permissionButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  cancelButtonText: {
    color: "#999",
    fontSize: 16,
  },
  // Web 不支援提示
  webNotSupported: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  webNotSupportedText: {
    fontSize: 20,
    color: "#fff",
    marginTop: 16,
    fontWeight: "600",
  },
  webNotSupportedSubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
    marginBottom: 32,
  },
  closeButton: {
    backgroundColor: "#333",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
  },
});
