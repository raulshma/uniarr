import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";

export type ServiceStatusState = "online" | "offline" | "degraded";

export type ServiceStatusProps = {
  status: ServiceStatusState;
  label?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
  testID?: string;
};

const sizeMap = {
  sm: 8,
  md: 10,
} as const;

const statusText: Record<ServiceStatusState, string> = {
  online: "Online",
  offline: "Offline",
  degraded: "Degraded",
};

const ServiceStatus: React.FC<ServiceStatusProps> = ({
  status,
  label,
  size = "md",
  showLabel = true,
  testID = "service-status",
}) => {
  const theme = useTheme<AppTheme>();

  const color = useMemo(() => {
    switch (status) {
      case "online":
        return theme.colors.primary;
      case "degraded":
        return theme.colors.tertiary;
      case "offline":
      default:
        return theme.colors.error;
    }
  }, [status, theme.colors.error, theme.colors.primary, theme.colors.tertiary]);

  const indicatorSize = sizeMap[size];
  const appliedLabel = label ?? statusText[status];

  const accessibilityLabel = appliedLabel;

  return (
    <View
      style={styles.container}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      <View
        style={[
          styles.indicator,
          {
            width: indicatorSize,
            height: indicatorSize,
            borderRadius: indicatorSize / 2,
            backgroundColor: color,
          },
        ]}
      />
      {showLabel ? (
        <Text variant="labelMedium" style={[styles.label, { color }]}>
          {appliedLabel}
        </Text>
      ) : null}
    </View>
  );
};

export default ServiceStatus;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  indicator: {
    marginRight: 6,
  },
  label: {
    fontWeight: "600",
  },
});
