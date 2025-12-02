import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

// 心情選項配置
export const MOODS = [
  { emoji: "😄", label: "開心", value: "happy", color: "#FFD700" },
  { emoji: "😊", label: "平靜", value: "calm", color: "#87CEEB" },
  { emoji: "😐", label: "普通", value: "neutral", color: "#D3D3D3" },
  { emoji: "😔", label: "低落", value: "sad", color: "#6495ED" },
  { emoji: "😤", label: "生氣", value: "angry", color: "#FF6347" },
  { emoji: "😰", label: "焦慮", value: "anxious", color: "#DDA0DD" },
];

/**
 * 根據 value 取得對應的心情資料
 */
export const getMoodByValue = (value) => {
  return MOODS.find((mood) => mood.value === value);
};

/**
 * 心情選擇器元件
 */
export default function MoodPicker({ selectedMood, onSelect }) {
  return (
    <View style={styles.container}>
      {MOODS.map((mood) => (
        <TouchableOpacity
          key={mood.value}
          style={[
            styles.moodButton,
            selectedMood === mood.value && [
              styles.moodButtonSelected,
              { borderColor: mood.color },
            ],
          ]}
          onPress={() => onSelect(mood.value)}
          activeOpacity={0.7}
        >
          <Text style={styles.moodEmoji}>{mood.emoji}</Text>
          <Text
            style={[
              styles.moodLabel,
              selectedMood === mood.value && { color: mood.color, fontWeight: "600" },
            ]}
          >
            {mood.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    backgroundColor: "#fff",
  },
  moodEmoji: {
    fontSize: 32,
  },
  moodLabel: {
    marginTop: 4,
    fontSize: 14,
    color: "#666",
  },
});
