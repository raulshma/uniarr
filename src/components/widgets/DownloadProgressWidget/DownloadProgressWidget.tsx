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
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { Widget } from "@/services/widgets/WidgetService";

export interface DownloadProgressWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

interface DownloadItem {
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

const DownloadProgressWidget: React.FC<DownloadProgressWidgetProps> = ({
  widget,
  onRefresh,
  onEdit,
}) => {
  const theme = useTheme<AppTheme>();
  const { spacing } = useResponsiveLayout();
  const { onPress } = useHaptics();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadDownloads = useCallback(async () => {
    try {
      const connectors = ConnectorManager.getInstance().getAllConnectors();
      const allDownloads: DownloadItem[] = [];

      // Get downloads from torrent clients
      const torrentClients = connectors.filter(
        (c) =>
          c.config.enabled &&
          ["qbittorrent", "transmission", "deluge"].includes(c.config.type),
      );

      for (const client of torrentClients) {
        try {
          const clientDownloads = await getTorrentDownloads(client.config.id);
          allDownloads.push(...clientDownloads);
        } catch (error) {
          console.error(
            `Failed to load downloads from ${client.config.name}:`,
            error,
          );
        }
      }

      // Get downloads from Usenet clients
      const usenetClients = connectors.filter(
        (c) => c.config.enabled && ["sabnzbd"].includes(c.config.type),
      );

      for (const client of usenetClients) {
        try {
          const clientDownloads = await getUsenetDownloads(client.config.id);
          allDownloads.push(...clientDownloads);
        } catch (error) {
          console.error(
            `Failed to load downloads from ${client.config.name}:`,
            error,
          );
        }
      }

      // Sort by progress (active downloads first)
      allDownloads.sort((a, b) => {
        if (a.status === "downloading" && b.status !== "downloading") return -1;
        if (a.status !== "downloading" && b.status === "downloading") return 1;
        return b.progress - a.progress;
      });

      setDownloads(allDownloads);
    } catch (error) {
      console.error("Failed to load downloads:", error);
    }
  }, []);

  useEffect(() => {
    loadDownloads();
  }, [loadDownloads]);

  const getTorrentDownloads = async (
    serviceId: string,
  ): Promise<DownloadItem[]> => {
    // This is a placeholder implementation
    // In reality, you would use the specific connector to get queue items
    const connector = ConnectorManager.getInstance().getConnector(serviceId);
    if (!connector) return [];

    try {
      // For now, return mock data
      return [
        {
          id: `${serviceId}-1`,
          title: "Example Movie 2024",
          service: connector.config.name,
          serviceType: connector.config.type,
          progress: 75,
          size: 8.5 * 1024 * 1024 * 1024, // 8.5 GB
          sizeLeft: 2.1 * 1024 * 1024 * 1024, // 2.1 GB
          speed: 5.2 * 1024 * 1024, // 5.2 MB/s
          timeLeft: "7m 32s",
          status: "downloading",
          protocol: "torrent",
        },
        {
          id: `${serviceId}-2`,
          title: "TV Series S01E01",
          service: connector.config.name,
          serviceType: connector.config.type,
          progress: 100,
          size: 1.2 * 1024 * 1024 * 1024, // 1.2 GB
          sizeLeft: 0,
          status: "completed",
          protocol: "torrent",
        },
      ];
    } catch {
      return [];
    }
  };

  const getUsenetDownloads = async (
    serviceId: string,
  ): Promise<DownloadItem[]> => {
    // Placeholder implementation for Usenet downloads
    return [
      {
        id: `${serviceId}-1`,
        title: "Album Release 2024",
        service: "SABnzbd",
        serviceType: "sabnzbd",
        progress: 45,
        size: 500 * 1024 * 1024, // 500 MB
        sizeLeft: 275 * 1024 * 1024, // 275 MB
        speed: 2.8 * 1024 * 1024, // 2.8 MB/s
        timeLeft: "2m 45s",
        status: "downloading",
        protocol: "usenet",
      },
    ];
  };

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

  const renderDownloadItem = (download: DownloadItem) => (
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

  const activeDownloads = downloads.filter((d) => d.status === "downloading");
  const completedDownloads = downloads.filter((d) => d.status === "completed");

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

      {downloads.length === 0 && (
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
    padding: 12,
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
    borderRadius: 6,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
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
    borderRadius: 2,
  },
  progressDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  completedSection: {
    alignItems: "center",
    paddingVertical: 8,
  },
  moreText: {
    textAlign: "center",
    opacity: 0.7,
    marginTop: 4,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 8,
    fontWeight: "500",
  },
  emptySubtext: {
    marginTop: 4,
    opacity: 0.7,
    textAlign: "center",
  },
});

export default DownloadProgressWidget;
