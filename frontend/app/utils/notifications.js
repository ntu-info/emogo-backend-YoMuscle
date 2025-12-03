import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

// 6 小時（毫秒）
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
// 測試用：5 分鐘
// const SIX_HOURS_MS = 5 * 60 * 1000;

// 設定通知顯示方式
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * 請求通知權限
 */
export const requestNotificationPermissions = async () => {
  if (Platform.OS === "web") {
    return false;
  }

  if (!Device.isDevice) {
    console.log("通知只能在實體裝置上使用");
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("通知權限被拒絕");
      return false;
    }

    // Android 需要設定通知頻道
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("reminder", {
        name: "提醒通知",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#007AFF",
      });
    }

    console.log("通知權限已授權");
    return true;
  } catch (error) {
    console.log("設定通知權限失敗:", error.message);
    return false;
  }
};

/**
 * 排程 6 小時後的提醒通知
 */
export const scheduleReminderNotification = async () => {
  if (Platform.OS === "web") {
    return;
  }

  try {
    // 先取消之前的提醒
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 確保 Android 通知頻道已建立
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("reminder", {
        name: "提醒通知",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#007AFF",
        sound: "default",
      });
    }

    // 排程新的提醒（6 小時後）
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "📝 該記錄一下了！",
        body: "已經超過 6 小時沒有新增記錄囉，來記錄一下現在的心情吧！",
        data: { screen: "record" },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: SIX_HOURS_MS / 1000,
        channelId: "reminder",
      },
    });

    console.log("已排程提醒通知，ID:", notificationId);
    return notificationId;
  } catch (error) {
    console.log("排程通知失敗:", error.message);
  }
};

/**
 * 取消所有提醒通知
 */
export const cancelAllReminderNotifications = async () => {
  if (Platform.OS === "web") {
    return;
  }

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("已取消所有排程通知");
  } catch (error) {
    console.log("取消通知失敗:", error.message);
  }
};

/**
 * 設定通知點擊處理
 */
export const setupNotificationResponseListener = (onNavigateToRecord) => {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;
      console.log("通知被點擊，data:", data);

      // 導航到新增記錄頁面
      if (data?.screen === "record" && onNavigateToRecord) {
        onNavigateToRecord();
      }
    }
  );

  return subscription;
};

/**
 * 檢查 app 啟動時是否來自通知
 */
export const checkInitialNotification = async () => {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      return response.notification.request.content.data;
    }
  } catch (error) {
    console.log("檢查初始通知失敗:", error.message);
  }
  return null;
};

/**
 * 測試通知（立即發送）
 */
export const sendTestNotification = async () => {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    // 確保有權限
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return false;
    }

    // 確保 Android 通知頻道已建立
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "預設通知",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        sound: "default",
      });
    }

    // 立即發送測試通知
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🎉 測試通知成功！",
        body: "如果你看到這個，表示通知功能正常運作！",
        data: { screen: "record" },
        sound: true,
      },
      trigger: null, // null = 立即發送
    });

    console.log("測試通知已發送，ID:", notificationId);
    return true;
  } catch (error) {
    console.log("測試通知失敗:", error.message);
    return false;
  }
};