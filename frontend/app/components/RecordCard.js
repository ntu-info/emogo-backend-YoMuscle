import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getMoodByValue } from "./MoodPicker";

/**
 * 記錄卡片元件 - 用於首頁列表顯示
 */
export default function RecordCard({ record, onPress, onDelete }) {
  const mood = record.mood ? getMoodByValue(record.mood) : null;
  const date = new Date(record.createdAt);
  const formattedDate = `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        {/* 心情表情 */}
        {mood && <Text style={styles.moodEmoji}>{mood.emoji}</Text>}
        
        {/* 日期時間 */}
        <Text style={styles.date}>{formattedDate}</Text>
        
        {/* 刪除按鈕 */}
        {onDelete && (
          <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Memo 內容 */}
      {record.memo ? (
        <Text style={styles.memo} numberOfLines={2}>
          {record.memo}
        </Text>
      ) : (
        <Text style={styles.noMemo}>無文字記錄</Text>
      )}

      {/* 標籤區 */}
      <View style={styles.tags}>
        {record.hasVideo && (
          <View style={styles.tag}>
            <Ionicons name="videocam" size={14} color="#007AFF" />
            <Text style={styles.tagText}>影片</Text>
          </View>
        )}
        {record.location && (
          <View style={styles.tag}>
            <Ionicons name="location" size={14} color="#4CAF50" />
            <Text style={styles.tagText}>位置</Text>
          </View>
        )}
        {mood && (
          <View style={[styles.tag, { backgroundColor: mood.color + "20" }]}>
            <Text style={styles.tagText}>{mood.label}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  moodEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  date: {
    flex: 1,
    fontSize: 14,
    color: "#666",
  },
  deleteButton: {
    padding: 4,
  },
  memo: {
    fontSize: 16,
    color: "#333",
    lineHeight: 22,
    marginBottom: 12,
  },
  noMemo: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
    marginBottom: 12,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 4,
  },
});
