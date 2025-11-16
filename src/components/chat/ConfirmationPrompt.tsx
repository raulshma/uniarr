import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import type { PendingConfirmation } from "@/services/ai/tools/ConfirmationManager";

type ConfirmationPromptProps = {
  confirmation: PendingConfirmation;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
};

const ConfirmationPromptComponent: React.FC<ConfirmationPromptProps> = ({
  confirmation,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const theme = useTheme();

  const getSeverityColor = () => {
    switch (confirmation.severity) {
      case "high":
        return theme.colors.error;
      case "medium":
        return theme.colors.tertiary;
      case "low":
      default:
        return theme.colors.primary;
    }
  };

  const getSeverityIcon = () => {
    switch (confirmation.severity) {
      case "high":
        return "alert-octagon";
      case "medium":
        return "alert";
      case "low":
      default:
        return "information";
    }
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 12,
      padding: 16,
      marginVertical: 8,
      gap: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${getSeverityColor()}20`,
      alignItems: "center",
      justifyContent: "center",
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: theme.colors.onSurfaceVariant,
    },
    description: {
      fontSize: 14,
      color: theme.colors.onSurface,
      lineHeight: 20,
    },
    targetContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 12,
      borderLeftWidth: 3,
      borderLeftColor: getSeverityColor(),
    },
    targetLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.onSurfaceVariant,
      marginBottom: 4,
      textTransform: "uppercase",
    },
    targetText: {
      fontSize: 14,
      color: theme.colors.onSurface,
      fontWeight: "500",
    },
    buttonContainer: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
    },
    button: {
      flex: 1,
    },
  });

  return (
    <View style={styles.container}>
      {/* Header with icon and title */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={getSeverityIcon()}
            size={24}
            color={getSeverityColor()}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Confirmation Required</Text>
          <Text style={styles.subtitle}>
            {confirmation.severity === "high"
              ? "This action cannot be undone"
              : confirmation.severity === "medium"
                ? "Please review before proceeding"
                : "Please confirm this action"}
          </Text>
        </View>
      </View>

      {/* Action description */}
      <Text style={styles.description}>{confirmation.action}</Text>

      {/* Target information */}
      <View style={styles.targetContainer}>
        <Text style={styles.targetLabel}>Target</Text>
        <Text style={styles.targetText}>{confirmation.target}</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.buttonContainer}>
        <Button
          mode="outlined"
          onPress={onCancel}
          disabled={isLoading}
          style={styles.button}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={onConfirm}
          loading={isLoading}
          disabled={isLoading}
          buttonColor={
            confirmation.severity === "high"
              ? theme.colors.error
              : confirmation.severity === "medium"
                ? theme.colors.tertiary
                : theme.colors.primary
          }
          style={styles.button}
        >
          {confirmation.severity === "high" ? "Delete" : "Confirm"}
        </Button>
      </View>
    </View>
  );
};

export const ConfirmationPrompt = memo(ConfirmationPromptComponent);
