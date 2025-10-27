import React from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";

export interface SettingsGroupProps {
  /** Child items (expected to be SettingsListItem components) */
  children: React.ReactNode;
  /** Optional style override */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}

/**
 * SettingsGroup — A rounded, elevated card container for grouped SettingsListItem rows.
 * Provides visual grouping with elevation and overflow clipping.
 */
const SettingsGroup = React.forwardRef<View, SettingsGroupProps>(
  ({ children, style, testID }, ref) => {
    const theme = useTheme<AppTheme>();

    const styles = StyleSheet.create({
      container: {
        backgroundColor: theme.colors.surface,
        borderRadius: 32,
        overflow: "hidden" as const,
        elevation: 1, // level1 equivalent
        shadowColor: theme.colors.shadow || "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
    });

    return (
      <View ref={ref} style={[styles.container, style]} testID={testID}>
        {children}
      </View>
    );
  },
);

SettingsGroup.displayName = "SettingsGroup";

export default SettingsGroup;
