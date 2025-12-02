import { Redirect } from "expo-router";

export default function Index() {
  // When opening the app, redirect immediately into the tab navigator
  return <Redirect href="(tabs)" />;
}
