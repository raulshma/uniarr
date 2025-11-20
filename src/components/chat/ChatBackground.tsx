import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useTheme";

interface ChatBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const ChatBackground: React.FC<ChatBackgroundProps> = ({
  children,
  style,
}) => {
  const theme = useTheme();

  // Define relaxing gradient colors based on the current theme
  // Using softer, more muted tones for a relaxing effect
  const gradientColors = theme.dark
    ? [
        theme.colors.background, // Start with background color
        theme.colors.surface, // Transition to surface
        theme.colors.surfaceVariant, // End with surface variant
      ]
    : [
        "#F0F4F8", // Soft blue-grey
        "#E6EEF5", // Lighter blue-grey
        "#D9E2EC", // Muted blue
      ];

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={gradientColors as [string, string, ...string[]]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
