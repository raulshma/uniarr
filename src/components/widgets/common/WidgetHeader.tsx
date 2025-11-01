import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, IconButton, useTheme } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

interface WidgetHeaderProps {
  title: string;
  onEdit?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  additionalActions?: React.ReactNode;
}

/**
 * Standardized widget header component for consistent title and action button styling
 * across all widgets. Ensures uniform font sizes, weights, spacing, and button sizes.
 */
const WidgetHeader: React.FC<WidgetHeaderProps> = ({
  title,
  onEdit,
  onRefresh,
  refreshing = false,
  additionalActions,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useStyles(theme);

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      <View style={styles.actions}>
        {additionalActions}
        {onRefresh && (
          <IconButton
            icon={refreshing ? "progress-clock" : "refresh"}
            size={20}
            onPress={onRefresh}
            disabled={refreshing}
            testID="widget-refresh-button"
          />
        )}
        {onEdit && (
          <IconButton
            icon="cog"
            size={20}
            onPress={onEdit}
            testID="widget-edit-button"
          />
        )}
      </View>
    </View>
  );
};

const useStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.xs,
      gap: spacing.xs,
    },
    title: {
      fontWeight: "600",
      flex: 1,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
  });

export default WidgetHeader;
