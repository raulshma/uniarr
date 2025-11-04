import React, { useMemo } from "react";
import { StyleSheet, View, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useTheme, Divider } from "react-native-paper";
import { UniArrLoader } from "@/components/common";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import type { ApiErrorLogEntry } from "@/models/apiErrorLog.types";

interface ErrorDetailModalProps {
  error: ApiErrorLogEntry;
  details?: {
    requestBody?: string;
    responseBody?: string;
    requestHeaders?: string;
  } | null;
  isLoading?: boolean;
  onClose: () => void;
}

export const ErrorDetailModal: React.FC<ErrorDetailModalProps> = ({
  error,
  details,
  isLoading = false,
  onClose,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.outlineVariant,
      borderBottomWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.onSurface,
    },
    content: {
      padding: spacing.md,
      gap: spacing.md,
    },
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primary,
      marginBottom: spacing.xs,
    },
    sectionDivider: {
      marginVertical: spacing.sm,
    },
    infoGrid: {
      gap: spacing.sm,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 6,
      padding: spacing.sm,
      minHeight: 36,
      alignItems: "center",
    },
    infoLabel: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.onSurfaceVariant,
      flex: 1,
    },
    infoValue: {
      fontSize: 13,
      color: theme.colors.onSurface,
      flex: 2,
      textAlign: "right",
    },
    statusCodeError: {
      color: theme.colors.error,
    },
    statusCodeClient: {
      color: theme.colors.tertiary,
    },
    statusCodeOther: {
      color: theme.colors.onSurface,
    },
    codeBlock: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 6,
      padding: spacing.sm,
      borderColor: theme.colors.outlineVariant,
      borderWidth: 1,
      maxHeight: 200,
    },
    codeText: {
      fontSize: 11,
      fontFamily: "Courier New",
      color: theme.colors.onSurfaceVariant,
      lineHeight: 16,
    },
    emptyText: {
      fontSize: 13,
      color: theme.colors.onSurfaceVariant,
      fontStyle: "italic",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      minHeight: 200,
    },
    warningText: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      marginTop: spacing.xs,
      fontStyle: "italic",
    },
    closeButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
  });

  const statusCodeColor = useMemo(() => {
    if (!error.statusCode) return styles.statusCodeOther;
    if (error.statusCode >= 500) return styles.statusCodeError;
    if (error.statusCode >= 400) return styles.statusCodeClient;
    return styles.statusCodeOther;
  }, [
    error.statusCode,
    styles.statusCodeClient,
    styles.statusCodeError,
    styles.statusCodeOther,
  ]);

  const parseJsonIfPossible = (str: string | undefined): string => {
    if (!str) return "";
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  };

  const requestBodyFormatted = parseJsonIfPossible(details?.requestBody);
  const responseBodyFormatted = parseJsonIfPossible(details?.responseBody);
  const requestHeadersFormatted = parseJsonIfPossible(details?.requestHeaders);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Error Details</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text
            style={{
              color: theme.colors.primary,
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            Close
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading State */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <UniArrLoader size={60} />
          <Text
            style={{
              marginTop: spacing.md,
              color: theme.colors.onSurfaceVariant,
              fontSize: 14,
            }}
          >
            Loading details...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* Basic Error Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Error Information</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Endpoint</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {error.endpoint}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Method</Text>
                <Text style={styles.infoValue}>{error.method}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status Code</Text>
                <Text style={[styles.infoValue, statusCodeColor]}>
                  {error.statusCode ?? "N/A"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Error Code</Text>
                <Text style={styles.infoValue}>{error.errorCode || "N/A"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Message</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {error.message}
                </Text>
              </View>
            </View>
          </View>

          <Divider style={styles.sectionDivider} />

          {/* Service Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Information</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Service ID</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {error.serviceId}
                </Text>
              </View>
              {error.serviceType && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Service Type</Text>
                  <Text style={styles.infoValue}>{error.serviceType}</Text>
                </View>
              )}
              {error.operation && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Operation</Text>
                  <Text style={styles.infoValue} numberOfLines={2}>
                    {error.operation}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Divider style={styles.sectionDivider} />

          {/* Timing Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timing</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Timestamp</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {new Date(error.timestamp).toLocaleString()}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Network Error</Text>
                <Text style={styles.infoValue}>
                  {error.isNetworkError ? "Yes" : "No"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Retry Count</Text>
                <Text style={styles.infoValue}>{error.retryCount}</Text>
              </View>
            </View>
          </View>

          <Divider style={styles.sectionDivider} />

          {/* Captured Data Sections */}
          {details &&
          (details.requestBody ||
            details.responseBody ||
            details.requestHeaders) ? (
            <>
              {/* Request Headers */}
              {details.requestHeaders && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Request Headers</Text>
                  <View style={styles.codeBlock}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={true}
                    >
                      <Text style={styles.codeText}>
                        {requestHeadersFormatted}
                      </Text>
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* Request Body */}
              {details.requestBody && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Request Body</Text>
                  <View style={styles.codeBlock}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={true}
                    >
                      <Text style={styles.codeText}>
                        {requestBodyFormatted}
                      </Text>
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* Response Body */}
              {details.responseBody && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Response Body</Text>
                  <View style={styles.codeBlock}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={true}
                    >
                      <Text style={styles.codeText}>
                        {responseBodyFormatted}
                      </Text>
                    </ScrollView>
                  </View>
                </View>
              )}

              <Divider style={styles.sectionDivider} />
            </>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Captured Data</Text>
              <Text style={styles.emptyText}>
                No additional details captured. Enable request/response body or
                header capture in settings to record this information.
              </Text>
            </View>
          )}

          {/* Additional Context */}
          {error.context && Object.keys(error.context).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Context</Text>
              <View style={styles.codeBlock}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <Text style={styles.codeText}>
                    {JSON.stringify(error.context, null, 2)}
                  </Text>
                </ScrollView>
              </View>
            </View>
          )}

          {/* Info Message */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={styles.warningText}>
              💡 Sensitive data like request bodies and headers are only stored
              if you enable capture in settings.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
