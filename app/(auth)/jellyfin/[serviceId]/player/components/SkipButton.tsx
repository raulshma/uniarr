/**
 * Skip Button Component
 * Shows skip intro/outro button when detected
 */

import { StyleSheet, Pressable } from "react-native";
import { Text } from "react-native-paper";
import { spacing } from "@/theme/spacing";

interface SkipButtonProps {
  type: "intro" | "credits";
  onSkip: () => void;
}

export const SkipButton = ({ type, onSkip }: SkipButtonProps) => {
  const label = type === "intro" ? "Skip Intro" : "Skip Credits";
  const containerStyle =
    type === "intro" ? styles.containerIntro : styles.containerCredits;

  return (
    <Pressable
      style={[styles.button, containerStyle]}
      onPress={onSkip}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text variant="labelLarge" style={styles.text}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  containerIntro: {
    position: "absolute",
    bottom: 120,
    right: spacing.lg,
  },
  containerCredits: {
    position: "absolute",
    bottom: 180,
    right: spacing.lg,
  },
  button: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  text: {
    color: "#000",
    fontWeight: "bold",
  },
});
