import { useEffect } from "react";
import { Stack, router, useRootNavigationState } from "expo-router";
import { updateLastOpenTime } from "./utils/storage";
import {
  requestNotificationPermissions,
  scheduleReminderNotification,
  setupNotificationResponseListener,
  checkInitialNotification,
} from "./utils/notifications";

export default function RootLayout() {
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    // 等待導航器準備好
    if (!rootNavigationState?.key) return;

    // 初始化通知功能
    const initNotifications = async () => {
      // 請求通知權限
      const granted = await requestNotificationPermissions();
      console.log("通知權限:", granted ? "已授權" : "未授權");

      if (granted) {
        // 設定通知點擊監聽，點擊後導航到新增記錄頁面
        const subscription = setupNotificationResponseListener(() => {
          try {
            router.push("/(tabs)/record");
          } catch (e) {
            console.log("導航失敗:", e.message);
          }
        });

        // 檢查是否從通知啟動
        const initialData = await checkInitialNotification();
        if (initialData?.screen === "record") {
          setTimeout(() => {
            try {
              router.push("/(tabs)/record");
            } catch (e) {
              console.log("初始導航失敗:", e.message);
            }
          }, 500);
        }

        // 排程 6 小時提醒
        await scheduleReminderNotification();

        return () => {
          subscription.remove();
        };
      }

      // 記錄開啟時間
      await updateLastOpenTime();
    };

    initNotifications();
  }, [rootNavigationState?.key]);

  return (
    <>
      {/* Root stack controls screen transitions for the whole app */}
      <Stack>
        {/* The (tabs) group is one Stack screen with its own tab navigator */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* This screen is pushed on top of tabs when you navigate to /details */}
        <Stack.Screen name="details" options={{ title: "Details" }} />
      </Stack>
    </>
  );
}
