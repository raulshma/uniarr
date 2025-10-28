import React from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Icon, Text, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import { Button } from "@/components/common/Button";

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ComponentProps<typeof Icon>["source"];
  customIcon?: React.ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
  children?: React.ReactNode;
  testID?: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = "inbox-outline",
  actionLabel,
  onActionPress,
  children,
  testID = "empty-state",
  customIcon,
}) => {
  const theme = useTheme<AppTheme>();

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.container, { paddingHorizontal: theme.custom.spacing.xl }]}
      accessibilityRole="summary"
      testID={testID}
    >
      {customIcon || (
        <Icon source={icon} size={48} color={theme.colors.onSurfaceVariant} />
      )}
      <Text
        variant="titleMedium"
        style={[styles.title, { color: theme.colors.onSurface }]}
      >
        {title}
      </Text>
      {description ? (
        <Text
          variant="bodyMedium"
          style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onActionPress ? (
        <Button mode="contained" onPress={onActionPress} fullWidth={false}>
          {actionLabel}
        </Button>
      ) : null}
      {children}
    </Animated.View>
  );
};

export default EmptyState;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  title: {
    marginTop: 16,
    textAlign: "center",
  },
  description: {
    marginTop: 8,
    marginBottom: 24,
    textAlign: "center",
  },
});
