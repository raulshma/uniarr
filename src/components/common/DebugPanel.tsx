import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Card,
  Text,
  Button,
  useTheme,
  Divider,
  Chip,
} from "react-native-paper";
import { spacing } from "@/theme/spacing";

export interface DebugStep {
  id: string;
  title: string;
  status: "pending" | "running" | "success" | "error" | "warning";
  message?: string;
  details?: string;
  timestamp: Date;
}

interface DebugPanelProps {
  steps: DebugStep[];
  isVisible: boolean;
  onClose: () => void;
  onClear: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  steps,
  isVisible,
  onClose,
  onClear,
}: DebugPanelProps) => {
  const theme = useTheme();

  if (!isVisible) return null;

  const getStatusColor = (status: DebugStep["status"]) => {
    switch (status) {
      case "success":
        return theme.colors.primary;
      case "error":
        return theme.colors.error;
      case "warning":
        return theme.colors.tertiary;
      case "running":
        return theme.colors.tertiary;
      case "pending":
      default:
        return theme.colors.onSurfaceVariant;
    }
  };

  const getStatusIcon = (status: DebugStep["status"]) => {
    switch (status) {
      case "success":
        return "check-circle";
      case "error":
        return "alert-circle";
      case "warning":
        return "alert";
      case "running":
        return "loading";
      case "pending":
      default:
        return "circle-outline";
    }
  };

  return (
    <Card style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <View style={styles.header}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            Debug Information
          </Text>
          <View style={styles.headerActions}>
            <Button mode="text" onPress={onClear} compact>
              Clear
            </Button>
            <Button mode="text" onPress={onClose} compact>
              Close
            </Button>
          </View>
        </View>

        <Divider style={styles.divider} />

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {steps.length === 0 ? (
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                padding: spacing.lg,
              }}
            >
              No debug information available. Try testing a connection.
            </Text>
          ) : (
            steps.map((step: DebugStep, index: number) => (
              <View key={step.id} style={styles.stepContainer}>
                <View style={styles.stepHeader}>
                  <Chip
                    icon={getStatusIcon(step.status)}
                    style={[
                      styles.statusChip,
                      { backgroundColor: getStatusColor(step.status) + "20" },
                    ]}
                    textStyle={{ color: getStatusColor(step.status) }}
                    compact
                  >
                    {step.status.toUpperCase()}
                  </Chip>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {step.timestamp?.toLocaleTimeString() || "Now"}
                  </Text>
                </View>

                <Text
                  variant="titleSmall"
                  style={[styles.stepTitle, { color: theme.colors.onSurface }]}
                >
                  {step.title}
                </Text>

                {step.message && (
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.stepMessage,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {step.message}
                  </Text>
                )}

                {step.details && (
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.stepDetails,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {step.details}
                  </Text>
                )}

                {index < steps.length - 1 && (
                  <Divider style={styles.stepDivider} />
                )}
              </View>
            ))
          )}
        </ScrollView>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: spacing.md,
    maxHeight: 400,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  divider: {
    marginBottom: spacing.sm,
  },
  scrollView: {
    maxHeight: 300,
  },
  stepContainer: {
    marginBottom: spacing.sm,
  },
  stepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  statusChip: {
    height: 24,
  },
  stepTitle: {
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  stepMessage: {
    marginBottom: spacing.xs,
  },
  stepDetails: {
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 16,
  },
  stepDivider: {
    marginTop: spacing.sm,
  },
});
