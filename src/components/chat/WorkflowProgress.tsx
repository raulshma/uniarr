import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Text, ProgressBar } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import type { WorkflowProgress as WorkflowProgressType } from "@/models/chat.types";

type WorkflowProgressProps = {
  progress: WorkflowProgressType;
};

const WorkflowProgressComponent: React.FC<WorkflowProgressProps> = ({
  progress,
}) => {
  const theme = useTheme();

  const getStateIcon = () => {
    switch (progress.state) {
      case "completed":
        return "check-circle";
      case "failed":
        return "alert-circle";
      case "cancelled":
        return "close-circle";
      case "executing":
        return "loading";
      case "pending":
      default:
        return "clock-outline";
    }
  };

  const getStateColor = () => {
    switch (progress.state) {
      case "completed":
        return theme.colors.primary;
      case "failed":
        return theme.colors.error;
      case "cancelled":
        return theme.colors.onSurfaceVariant;
      case "executing":
        return theme.colors.tertiary;
      case "pending":
      default:
        return theme.colors.onSurfaceVariant;
    }
  };

  const getStateLabel = () => {
    switch (progress.state) {
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "cancelled":
        return "Cancelled";
      case "executing":
        return "In Progress";
      case "pending":
      default:
        return "Pending";
    }
  };

  const progressValue =
    progress.totalSteps > 0
      ? (progress.currentStepIndex + 1) / progress.totalSteps
      : 0;

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
      backgroundColor: `${getStateColor()}20`,
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
    progressContainer: {
      gap: 8,
    },
    progressInfo: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    stepText: {
      fontSize: 14,
      color: theme.colors.onSurface,
      fontWeight: "500",
    },
    stateLabel: {
      fontSize: 12,
      color: getStateColor(),
      fontWeight: "600",
      textTransform: "uppercase",
    },
    stepDescription: {
      fontSize: 13,
      color: theme.colors.onSurfaceVariant,
      marginTop: 4,
      fontStyle: "italic",
    },
    errorContainer: {
      backgroundColor: theme.colors.errorContainer,
      borderRadius: 8,
      padding: 12,
      marginTop: 4,
    },
    errorText: {
      fontSize: 13,
      color: theme.colors.error,
      lineHeight: 18,
    },
    durationText: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      marginTop: 8,
    },
  });

  const duration = progress.endTime
    ? progress.endTime - progress.startTime
    : Date.now() - progress.startTime;

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <View style={styles.container}>
      {/* Header with icon and title */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={getStateIcon()}
            size={24}
            color={getStateColor()}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{progress.workflowName}</Text>
          <Text style={styles.subtitle}>Multi-step workflow</Text>
        </View>
      </View>

      {/* Progress information */}
      <View style={styles.progressContainer}>
        <View style={styles.progressInfo}>
          <Text style={styles.stepText}>
            Step {progress.currentStepIndex + 1} of {progress.totalSteps}
          </Text>
          <Text style={styles.stateLabel}>{getStateLabel()}</Text>
        </View>

        {/* Progress bar */}
        {progress.state === "executing" || progress.state === "completed" ? (
          <ProgressBar
            progress={progressValue}
            color={getStateColor()}
            style={{ height: 6, borderRadius: 3 }}
          />
        ) : null}

        {/* Step description */}
        {progress.stepDescription ? (
          <Text style={styles.stepDescription}>{progress.stepDescription}</Text>
        ) : null}

        {/* Error message */}
        {progress.error && progress.state === "failed" ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{progress.error}</Text>
          </View>
        ) : null}

        {/* Duration */}
        <Text style={styles.durationText}>
          {progress.state === "completed" || progress.state === "failed"
            ? `Completed in ${formatDuration(duration)}`
            : `Running for ${formatDuration(duration)}`}
        </Text>
      </View>
    </View>
  );
};

export const WorkflowProgress = memo(WorkflowProgressComponent);
