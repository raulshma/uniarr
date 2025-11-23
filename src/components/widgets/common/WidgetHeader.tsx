import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, IconButton } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

interface WidgetHeaderProps {
  title: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
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
  icon,
  onEdit,
  onRefresh,
  refreshing = false,
  additionalActions,
}) => {
  const theme = useTheme();
  const styles = useStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        {icon && (
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name={icon}
              size={18}
              color={theme.colors.primary}
            />
          </View>
        )}
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
      </View>
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
      marginBottom: spacing.sm,
      gap: spacing.xs,
    },
    titleContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    iconContainer: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: theme.colors.secondaryContainer,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontWeight: "700",
      color: theme.colors.onSurface,
      letterSpacing: 0.2,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
  });

export default WidgetHeader;
