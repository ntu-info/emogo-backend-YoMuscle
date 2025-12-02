import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useFocusEffect, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import RecordCard from "../components/RecordCard";
import { getAllRecords, deleteRecord, getPendingSyncCount } from "../utils/storage";
import { isOnline } from "../services/sync";

export default function HomeScreen() {
  const [records, setRecords] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [networkStatus, setNetworkStatus] = useState(null);

  // 載入記錄
  const loadRecords = async () => {
    const [data, pending, online] = await Promise.all([
      getAllRecords(),
      getPendingSyncCount(),
      isOnline(),
    ]);
    setRecords(data);
    setPendingCount(pending);
    setNetworkStatus(online);
  };

  // 每次頁面獲得焦點時重新載入
  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [])
  );

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  };

  // 刪除記錄
  const handleDelete = (id) => {
    Alert.alert("確認刪除", "確定要刪除這筆記錄嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          await deleteRecord(id);
          loadRecords();
        },
      },
    ]);
  };

  // 空狀態顯示
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>還沒有任何記錄</Text>
      <Text style={styles.emptySubtitle}>點擊下方「新增記錄」開始記錄生活</Text>
      <Link href="/(tabs)/record" asChild>
        <TouchableOpacity style={styles.emptyButton}>
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.emptyButtonText}>新增第一筆記錄</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );

  return (
    <View style={styles.container}>
      {records.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <RecordCard
              record={item}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.listHeaderContainer}>
              <Text style={styles.listHeader}>共 {records.length} 筆記錄</Text>
              {pendingCount > 0 && (
                <View style={styles.syncBadge}>
                  <Ionicons 
                    name={networkStatus ? "cloud-upload" : "cloud-offline"} 
                    size={14} 
                    color="#FF9800" 
                  />
                  <Text style={styles.syncBadgeText}>
                    {pendingCount} 筆待同步
                  </Text>
                </View>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  listContent: {
    paddingVertical: 16,
  },
  listHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listHeader: {
    fontSize: 14,
    color: "#666",
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncBadgeText: {
    fontSize: 12,
    color: "#FF9800",
    fontWeight: "500",
    marginLeft: 4,
  },
  // 空狀態樣式
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 24,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
