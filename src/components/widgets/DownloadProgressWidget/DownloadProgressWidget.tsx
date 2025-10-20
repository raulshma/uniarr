import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import {
  Text,
  Card,
  IconButton,
  useTheme,
  ProgressBar,
  Badge,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useHaptics } from "@/hooks/useHaptics";
import type { AppTheme } from "@/constants/theme";
import type { Widget } from "@/services/widgets/WidgetService";
import { borderRadius } from "@/constants/sizes";
import { spacing } from "@/theme/spacing";
import { useDownloadStore, selectDownloads } from "@/store/downloadStore";
import type { DownloadItem } from "@/models/download.types";

export interface DownloadProgressWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

interface DisplayDownloadItem {
  id: string;
  title: string;
  service: string;
  serviceType: string;
  progress: number;
  size: number;
  sizeLeft: number;
  speed?: number;
  timeLeft?: string;
  status: "downloading" | "completed" | "paused" | "error";
  protocol: "torrent" | "usenet";
}

// Helper function to convert DownloadItem to display format
const convertToDisplayItem = (download: DownloadItem) => {
  const progress = download.state.progress * 100;
  return {
    id: download.id,
    title: download.content.title,
    service: download.serviceConfig.name,
    serviceType: download.serviceConfig.type,
    progress: Math.round(progress),
    size: download.download.size || download.state.totalBytes || 0,
    sizeLeft: download.state.totalBytes - download.state.bytesDownloaded,
    speed: download.state.downloadSpeed || 0,
    timeLeft:
      download.state.eta > 0 ? formatTime(download.state.eta) : undefined,
    status: download.state.status as
      | "downloading"
      | "completed"
      | "paused"
      | "error",
    protocol: (download.serviceConfig.type === "qbittorrent" ||
    download.serviceConfig.type === "transmission" ||
    download.serviceConfig.type === "deluge"
      ? "torrent"
      : "usenet") as "torrent" | "usenet",
  };
};

// Format time in seconds to human readable string
const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
};

const DownloadProgressWidget: React.FC<DownloadProgressWidgetProps> = ({
  widget,
  onRefresh,
  onEdit,
}) => {
  const theme = useTheme<AppTheme>();
  const { spacing } = useResponsiveLayout();
  const { onPress } = useHaptics();
  const [refreshing, setRefreshing] = useState(false);

  // Use optimized selector to prevent excessive re-renders
  const downloads = useDownloadStore(selectDownloads);

  // Memoize display downloads with progress threshold
  const displayDownloads = React.useMemo(() => {
    const downloadArray = Array.from(downloads.values());
    return downloadArray.map(convertToDisplayItem).sort((a, b) => {
      // Sort by status: downloading first, then by progress
      if (a.status === "downloading" && b.status !== "downloading") return -1;
      if (a.status !== "downloading" && b.status === "downloading") return 1;
      return b.progress - a.progress;
    });
  }, [downloads]);

  const loadDownloads = useCallback(async () => {
    // The download store automatically updates, but we can trigger any refresh logic here if needed
    setRefreshing(true);
    // For now, just wait a bit to show refresh animation
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  useEffect(() => {
    // The download store automatically updates, so we don't need to manually load
    // But we keep the effect for any future initialization logic
  }, []);

  const handleRefresh = async () => {
    onPress();
    setRefreshing(true);
    await loadDownloads();
    setRefreshing(false);
    onRefresh?.();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "downloading":
        return theme.colors.primary;
      case "completed":
        return theme.colors.tertiary;
      case "paused":
        return theme.colors.secondary;
      case "error":
        return theme.colors.error;
      default:
        return theme.colors.onSurfaceVariant;
    }
  };

  const getProtocolIcon = (protocol: string) => {
    return protocol === "torrent" ? "magnet" : "newspaper";
  };

  const renderDownloadItem = (download: DisplayDownloadItem) => (
    <Card key={download.id} style={styles.downloadCard}>
      <View style={styles.downloadContent}>
        <View style={styles.downloadHeader}>
          <View style={styles.downloadInfo}>
            <View
              style={[
                styles.protocolIcon,
                { backgroundColor: `${getStatusColor(download.status)}20` },
              ]}
            >
              <MaterialCommunityIcons
                name={getProtocolIcon(download.protocol)}
                size={16}
                color={getStatusColor(download.status)}
              />
            </View>
            <View style={styles.downloadDetails}>
              <Text
                variant="titleSmall"
                style={styles.downloadTitle}
                numberOfLines={2}
              >
                {download.title}
              </Text>
              <Text variant="labelSmall" style={styles.downloadService}>
                {download.service}
              </Text>
            </View>
          </View>
          <View style={styles.statusContainer}>
            <Badge
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(download.status) },
              ]}
            >
              {download.status.toUpperCase()}
            </Badge>
          </View>
        </View>

        {download.status === "downloading" && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text variant="labelSmall">
                {formatBytes(download.size - download.sizeLeft)} /{" "}
                {formatBytes(download.size)}
              </Text>
              <Text variant="labelSmall">{Math.round(download.progress)}%</Text>
            </View>
            <ProgressBar
              progress={download.progress / 100}
              color={getStatusColor(download.status)}
              style={styles.progressBar}
            />
            {(download.speed || download.timeLeft) && (
              <View style={styles.progressDetails}>
                {download.speed && (
                  <Text variant="labelSmall">
                    {formatBytes(download.speed)}/s
                  </Text>
                )}
                {download.timeLeft && (
                  <Text variant="labelSmall">{download.timeLeft} left</Text>
                )}
              </View>
            )}
          </View>
        )}

        {download.status === "completed" && (
          <View style={styles.completedSection}>
            <Text variant="bodySmall">
              ✓ Completed - {formatBytes(download.size)}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );

  const activeDownloads = displayDownloads.filter(
    (d) => d.status === "downloading",
  );
  const completedDownloads = displayDownloads.filter(
    (d) => d.status === "completed",
  );

  return (
    <Card style={[styles.container, { padding: spacing.medium }]}>
      <View style={styles.header}>
        <Text variant="titleLarge">{widget.title}</Text>
        <View style={styles.headerActions}>
          <IconButton
            icon="refresh"
            onPress={handleRefresh}
            loading={refreshing}
          />
          {onEdit && <IconButton icon="cog" onPress={onEdit} />}
        </View>
      </View>

      {activeDownloads.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Active Downloads ({activeDownloads.length})
          </Text>
          <ScrollView
            style={styles.scrollView}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {activeDownloads.map(renderDownloadItem)}
          </ScrollView>
        </View>
      )}

      {completedDownloads.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Recently Completed ({completedDownloads.length})
          </Text>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {completedDownloads.slice(0, 3).map(renderDownloadItem)}
            {completedDownloads.length > 3 && (
              <Text variant="labelSmall" style={styles.moreText}>
                +{completedDownloads.length - 3} more completed
              </Text>
            )}
          </ScrollView>
        </View>
      )}

      {displayDownloads.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="download-off"
            size={48}
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant="bodyMedium" style={styles.emptyText}>
            No downloads active
          </Text>
          <Text variant="bodySmall" style={styles.emptySubtext}>
            Downloads will appear here when available
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: "row",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 8,
    fontWeight: "600",
  },
  scrollView: {
    maxHeight: 200,
  },
  downloadCard: {
    marginBottom: 8,
  },
  downloadContent: {
    padding: spacing.sm,
  },
  downloadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  downloadInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  protocolIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  downloadDetails: {
    flex: 1,
  },
  downloadTitle: {
    fontWeight: "600",
  },
  downloadService: {
    opacity: 0.7,
  },
  statusContainer: {
    alignItems: "flex-end",
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  progressSection: {
    gap: 4,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressBar: {
    height: 4,
    borderRadius: borderRadius.xs,
  },
  progressDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  completedSection: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  moreText: {
    textAlign: "center",
    opacity: 0.7,
    marginTop: spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontWeight: "500",
  },
  emptySubtext: {
    marginTop: spacing.xs,
    opacity: 0.7,
    textAlign: "center",
  },
});

export default DownloadProgressWidget;
