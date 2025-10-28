import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, Button, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";

import type { AppTheme } from "@/constants/theme";

interface WidgetConfigPlaceholderProps {
  title: string;
  description: string;
  actionLabel?: string;
  settingsPath?: string;
  onAction?: () => void;
}

const WidgetConfigPlaceholder: React.FC<WidgetConfigPlaceholderProps> = ({
  title,
  description,
  actionLabel = "Configure",
  settingsPath = "/(auth)/settings/widgets",
  onAction,
}) => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();

  const handlePress = () => {
    if (onAction) {
      onAction();
    } else if (settingsPath) {
      router.push(settingsPath as any);
    }
  };

  return (
    <View
      style={StyleSheet.flatten([
        styles.container,
        {
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surface,
        },
      ])}
    >
      <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
        {title}
      </Text>
      <Text
        variant="bodyMedium"
        style={StyleSheet.flatten([
          styles.description,
          { color: theme.colors.onSurfaceVariant },
        ])}
      >
        {description}
      </Text>
      <Button mode="contained" onPress={handlePress} style={styles.button}>
        {actionLabel}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "flex-start",
    gap: 12,
  },
  description: {
    lineHeight: 20,
  },
  button: {
    alignSelf: "flex-start",
  },
});

export default WidgetConfigPlaceholder;
