import { View, Text, Button, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";

export default function DetailsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* This screen is shown on top of the Tabs stack */}
      <Text style={styles.title}>Details screen</Text>

      {/* Imperative navigation using the router hook */}
      <Button
        title="Go back (router.back())"
        onPress={() => router.back()}
      />

      {/* Declarative navigation using a link back to the home tab */}
      <Link href="/(tabs)" style={styles.link}>
        Back to Home tab
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  title: {
    fontSize: 24,
    marginBottom: 24,
  },
  link: {
    fontSize: 16,
    marginTop: 16,
    textDecorationLine: "underline",
  },
});
