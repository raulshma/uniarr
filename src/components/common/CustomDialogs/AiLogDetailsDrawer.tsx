import { useCallback, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput as RNTextInput,
  Clipboard,
} from "react-native";
import {
  Text,
  useTheme,
  IconButton,
  Divider,
  Button,
  Chip,
} from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import type { AiApiLogEntry } from "@/models/apiLogger.types";

interface AiLogDetailsDrawerProps {
  visible: boolean;
  log: AiApiLogEntry | null;
  onDismiss: () => void;
}

export const AiLogDetailsDrawer = ({
  visible,
  log,
  onDismiss,
}: AiLogDetailsDrawerProps) => {
  const theme = useTheme<AppTheme>();
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopyToClipboard = useCallback((text: string, label: string) => {
    Clipboard.setString(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  if (!visible || !log) return null;

  const isSuccess = log.status === "success";

  const styles = StyleSheet.create({
    container: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      width: "85%",
      backgroundColor: theme.colors.surface,
      zIndex: 1000,
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
      shadowColor: "#000",
      shadowOffset: { width: -2, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      zIndex: 999,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.onSurface,
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.onSurfaceVariant,
      marginBottom: spacing.md,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    row: {
      marginBottom: spacing.md,
    },
    rowLabel: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.onSurfaceVariant,
      marginBottom: spacing.xs,
    },
    rowValue: {
      fontSize: 13,
      color: theme.colors.onSurface,
      fontFamily: "monospace",
    },
    statusBadge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 6,
      alignSelf: "flex-start",
    },
    statusBadgeSuccess: {
      backgroundColor: theme.colors.primary + "20",
    },
    statusBadgeError: {
      backgroundColor: theme.colors.error + "20",
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: "600",
    },
    statusBadgeTextSuccess: {
      color: theme.colors.primary,
    },
    statusBadgeTextError: {
      color: theme.colors.error,
    },
    copyableText: {
      flex: 1,
      padding: spacing.sm,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 6,
      marginRight: spacing.sm,
    },
    copyButton: {
      justifyContent: "center",
    },
    metaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    metaChip: {
      marginBottom: spacing.sm,
    },
    textInput: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 6,
      padding: spacing.sm,
      color: theme.colors.onSurface,
      minHeight: 80,
      textAlignVertical: "top",
    },
    divider: {
      marginVertical: spacing.md,
    },
  });

  return (
    <>
      {visible && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onDismiss}
        />
      )}
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Log Details</Text>
          <IconButton icon="close" size={24} onPress={onDismiss} />
        </View>

        <Divider style={styles.divider} />

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={true}
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* Status Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                isSuccess ? styles.statusBadgeSuccess : styles.statusBadgeError,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isSuccess
                    ? styles.statusBadgeTextSuccess
                    : styles.statusBadgeTextError,
                ]}
              >
                {log.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Provider & Model</Text>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Provider</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Text style={[styles.rowValue, { flex: 1 }]}>
                  {log.provider}
                </Text>
                <IconButton
                  icon="content-copy"
                  size={18}
                  iconColor={
                    copied === "provider"
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant
                  }
                  onPress={() =>
                    handleCopyToClipboard(log.provider, "provider")
                  }
                />
              </View>
            </View>

            {log.model && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Model</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Text style={[styles.rowValue, { flex: 1 }]}>
                    {log.model}
                  </Text>
                  <IconButton
                    icon="content-copy"
                    size={18}
                    iconColor={
                      copied === "model"
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant
                    }
                    onPress={() => handleCopyToClipboard(log.model!, "model")}
                  />
                </View>
              </View>
            )}
          </View>

          <Divider style={styles.divider} />

          {/* Operation Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Operation</Text>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Operation Type</Text>
              <Text style={styles.rowValue}>{log.operation}</Text>
            </View>

            {log.durationMs !== undefined && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Duration</Text>
                <Text style={styles.rowValue}>{log.durationMs}ms</Text>
              </View>
            )}

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Timestamp</Text>
              <Text style={styles.rowValue}>
                {new Date(log.timestamp).toLocaleString()}
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Prompt (if captured) */}
          {log.prompt && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prompt</Text>
              <RNTextInput
                style={styles.textInput}
                value={log.prompt}
                multiline
                editable={false}
                scrollEnabled={false}
              />
              <Button
                mode="outlined"
                icon="content-copy"
                onPress={() => handleCopyToClipboard(log.prompt!, "prompt")}
                style={{ marginTop: spacing.sm }}
              >
                {copied === "prompt" ? "Copied!" : "Copy Prompt"}
              </Button>
            </View>
          )}

          {/* Response (if captured) */}
          {log.response && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Response</Text>
              <RNTextInput
                style={styles.textInput}
                value={log.response}
                multiline
                editable={false}
                scrollEnabled={false}
              />
              <Button
                mode="outlined"
                icon="content-copy"
                onPress={() => handleCopyToClipboard(log.response!, "response")}
                style={{ marginTop: spacing.sm }}
              >
                {copied === "response" ? "Copied!" : "Copy Response"}
              </Button>
            </View>
          )}

          {/* Error Details (if error) */}
          {log.errorMessage && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Error Details</Text>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Error Message</Text>
                <RNTextInput
                  style={styles.textInput}
                  value={log.errorMessage}
                  multiline
                  editable={false}
                  scrollEnabled={false}
                />
                <Button
                  mode="outlined"
                  icon="content-copy"
                  onPress={() =>
                    handleCopyToClipboard(log.errorMessage!, "errorMessage")
                  }
                  style={{ marginTop: spacing.sm }}
                >
                  {copied === "errorMessage" ? "Copied!" : "Copy Error"}
                </Button>
              </View>

              {log.metadata && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Error Metadata</Text>
                  <RNTextInput
                    style={styles.textInput}
                    value={JSON.stringify(log.metadata, null, 2)}
                    multiline
                    editable={false}
                    scrollEnabled={false}
                  />
                  <Button
                    mode="outlined"
                    icon="content-copy"
                    onPress={() =>
                      handleCopyToClipboard(
                        JSON.stringify(log.metadata, null, 2),
                        "metadata",
                      )
                    }
                    style={{ marginTop: spacing.sm }}
                  >
                    {copied === "metadata" ? "Copied!" : "Copy Metadata"}
                  </Button>
                </View>
              )}
            </View>
          )}

          {/* Additional Metadata */}
          {log.metadata && !log.errorMessage && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Metadata</Text>

              {log.metadata.tokenUsage && (
                <View style={styles.metaGrid}>
                  {log.metadata.tokenUsage.promptTokens !== undefined && (
                    <Chip style={styles.metaChip} compact icon="sigma">
                      Prompt: {log.metadata.tokenUsage.promptTokens}
                    </Chip>
                  )}
                  {log.metadata.tokenUsage.completionTokens !== undefined && (
                    <Chip style={styles.metaChip} compact icon="sigma">
                      Completion: {log.metadata.tokenUsage.completionTokens}
                    </Chip>
                  )}
                  {log.metadata.tokenUsage.totalTokens !== undefined && (
                    <Chip style={styles.metaChip} compact icon="sigma">
                      Total: {log.metadata.tokenUsage.totalTokens}
                    </Chip>
                  )}
                </View>
              )}

              {log.metadata.costUsd && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Cost (USD)</Text>
                  <Text style={styles.rowValue}>
                    ${log.metadata.costUsd.toFixed(4)}
                  </Text>
                </View>
              )}

              {log.metadata.endpoint && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Endpoint</Text>
                  <Text style={styles.rowValue}>{log.metadata.endpoint}</Text>
                </View>
              )}

              {log.metadata.requestId && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Request ID</Text>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Text
                      style={[styles.rowValue, { flex: 1 }]}
                      numberOfLines={2}
                    >
                      {log.metadata.requestId}
                    </Text>
                    <IconButton
                      icon="content-copy"
                      size={18}
                      iconColor={
                        copied === "requestId"
                          ? theme.colors.primary
                          : theme.colors.onSurfaceVariant
                      }
                      onPress={() =>
                        handleCopyToClipboard(
                          log.metadata!.requestId!,
                          "requestId",
                        )
                      }
                    />
                  </View>
                </View>
              )}

              {log.metadata.extras &&
                Object.keys(log.metadata.extras).length > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Additional Data</Text>
                    <RNTextInput
                      style={styles.textInput}
                      value={JSON.stringify(log.metadata.extras, null, 2)}
                      multiline
                      editable={false}
                      scrollEnabled={false}
                    />
                  </View>
                )}
            </View>
          )}

          {/* Tags */}
          {log.tags && log.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.metaGrid}>
                {log.tags.map((tag, index) => (
                  <Chip key={index} style={styles.metaChip} compact icon="tag">
                    {tag}
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {/* Settings Snapshot */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Capture Settings</Text>
            <View style={styles.metaGrid}>
              <Chip
                style={styles.metaChip}
                compact
                icon={log.settingsSnapshot.capturePrompt ? "check" : "close"}
              >
                Prompt: {log.settingsSnapshot.capturePrompt ? "Yes" : "No"}
              </Chip>
              <Chip
                style={styles.metaChip}
                compact
                icon={log.settingsSnapshot.captureResponse ? "check" : "close"}
              >
                Response: {log.settingsSnapshot.captureResponse ? "Yes" : "No"}
              </Chip>
              <Chip
                style={styles.metaChip}
                compact
                icon={log.settingsSnapshot.captureMetadata ? "check" : "close"}
              >
                Metadata: {log.settingsSnapshot.captureMetadata ? "Yes" : "No"}
              </Chip>
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
};
