import { FlashList } from "@shopify/flash-list";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { Text, useTheme, Divider, Searchbar } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { TabHeader } from "@/components/common/TabHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import {
  AnimatedListItem,
  AnimatedSection,
} from "@/components/common/AnimatedComponents";

import type { AppTheme } from "@/constants/theme";
import type { DownloadItem } from "@/models/download.types";
import { spacing } from "@/theme/spacing";
import {
  useDownloadStore,
  selectCompletedDownloadsArray,
  selectDownloadsByStatus,
} from "@/store/downloadStore";
import { NAVIGATION_ROUTES, navigateToRoute } from "@/utils/navigation.utils";
import { formatBytes } from "@/utils/torrent.utils";
import { formatDate } from "@/utils/calendar.utils";

type JellyfinDownloadItem = DownloadItem & {
  isJellyfinDownload: boolean;
};

type JellyfinDownloadsOverview = {
  activeDownloads: JellyfinDownloadItem[];
  completedDownloads: JellyfinDownloadItem[];
  totalStats: {
    totalSize: number;
    itemCount: number;
  };
};

const isJellyfinDownload = (
  download: DownloadItem,
): download is JellyfinDownloadItem => {
  return download.serviceConfig.type === "jellyfin";
};

const filterJellyfinDownloads = (
  downloads: DownloadItem[],
): JellyfinDownloadItem[] => {
  return downloads.filter(isJellyfinDownload) as JellyfinDownloadItem[];
};

const JellyfinDownloadsScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Get downloads from store
  const activeDownloads = useDownloadStore(
    selectDownloadsByStatus("downloading"),
  );
  const retryingDownloads = useDownloadStore(
    selectDownloadsByStatus("retrying"),
  );
  const completedDownloads = useDownloadStore(selectCompletedDownloadsArray);

  // Filter for Jellyfin downloads
  const jellyfinActive = useMemo(
    () =>
      filterJellyfinDownloads([
        ...activeDownloads,
        ...retryingDownloads,
      ] as DownloadItem[]),
    [activeDownloads, retryingDownloads],
  );

  const jellyfinCompleted = useMemo(
    () => filterJellyfinDownloads(completedDownloads as DownloadItem[]),
    [completedDownloads],
  );

  // Search filter
  const filteredActive = useMemo(() => {
    if (!searchQuery.trim()) return jellyfinActive;
    return jellyfinActive.filter((download) =>
      download.content.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [jellyfinActive, searchQuery]);

  const filteredCompleted = useMemo(() => {
    if (!searchQuery.trim()) return jellyfinCompleted;
    return jellyfinCompleted.filter((download) =>
      download.content.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [jellyfinCompleted, searchQuery]);

  const overview: JellyfinDownloadsOverview = useMemo(() => {
    const allDownloads = [...jellyfinActive, ...jellyfinCompleted];
    return {
      activeDownloads: filteredActive,
      completedDownloads: filteredCompleted,
      totalStats: {
        totalSize: allDownloads.reduce(
          (sum, d) => sum + (d.download.size || 0),
          0,
        ),
        itemCount: allDownloads.length,
      },
    };
  }, [filteredActive, filteredCompleted, jellyfinActive, jellyfinCompleted]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const useFocusEffectCallback = useCallback(() => {
    // Refresh on focus
  }, []);

  useFocusEffect(useFocusEffectCallback);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        listContent: {
          paddingHorizontal: spacing.md,
          paddingBottom: 80,
        },
        headerContainer: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
        },
        searchbar: {
          marginBottom: spacing.md,
        },
        sectionHeader: {
          fontSize: 16,
          fontWeight: "600",
          color: theme.colors.onBackground,
          marginBottom: spacing.md,
          marginTop: spacing.lg,
        },
        downloadItem: {
          backgroundColor: theme.colors.elevation.level1,
          borderRadius: spacing.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
        downloadHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: spacing.sm,
        },
        downloadTitle: {
          flex: 1,
          color: theme.colors.onSurface,
          fontSize: 14,
          fontWeight: "500",
          marginRight: spacing.sm,
        },
        downloadStatus: {
          fontSize: 12,
          fontWeight: "500",
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: 4,
        },
        activeStatus: {
          color: theme.colors.onPrimary,
          backgroundColor: theme.colors.primary,
        },
        completedStatus: {
          color: theme.colors.onTertiary,
          backgroundColor: theme.colors.tertiary,
        },
        downloadMeta: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: spacing.sm,
        },
        downloadDetail: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 12,
        },
        progressContainer: {
          marginTop: spacing.sm,
        },
        progressBar: {
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.elevation.level2,
          overflow: "hidden",
        },
        progressFill: {
          height: "100%",
          backgroundColor: theme.colors.primary,
        },
        progressText: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 11,
          marginTop: spacing.xs,
        },
        emptyContainer: {
          flexGrow: 1,
          paddingTop: spacing.xl,
        },
        statsContainer: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
        },
        statRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: spacing.sm,
        },
        statLabel: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 14,
        },
        statValue: {
          color: theme.colors.onSurface,
          fontSize: 14,
          fontWeight: "600",
        },
      }),
    [theme],
  );

  const renderDownloadItem = useCallback(
    ({ item, index }: { item: JellyfinDownloadItem; index: number }) => {
      const progress = Math.max(0, Math.min(1, item.state.progress));
      const percent = Math.round(progress * 100);
      const isActive =
        item.state.status === "downloading" || item.state.status === "retrying";
      const isCompleted = item.state.status === "completed";

      const getStatusLabel = () => {
        if (isCompleted) return "Completed";
        if (item.state.status === "paused") return "Paused";
        if (item.state.status === "downloading") return "Downloading";
        if (item.state.status === "retrying") return "Retrying";
        if (item.state.status === "failed") return "Failed";
        return (
          item.state.status.charAt(0).toUpperCase() + item.state.status.slice(1)
        );
      };

      const getDetailText = () => {
        if (isCompleted) {
          return `${formatBytes(item.download.size || 0)} • ${formatDate(
            item.state.completedAt || item.state.updatedAt,
          )}`;
        }

        if (isActive) {
          const remaining = item.state.eta
            ? `~${Math.ceil(item.state.eta / 60)}m`
            : "—";
          return `${formatBytes(item.state.bytesDownloaded)} / ${formatBytes(
            item.state.totalBytes,
          )} • ${remaining}`;
        }

        return `${formatBytes(item.state.bytesDownloaded || 0)} downloaded`;
      };

      return (
        <AnimatedListItem
          index={index}
          totalItems={
            overview.activeDownloads.length + overview.completedDownloads.length
          }
        >
          <TouchableOpacity style={styles.downloadItem} activeOpacity={0.7}>
            <View style={styles.downloadHeader}>
              <Text style={styles.downloadTitle} numberOfLines={2}>
                {item.content.title}
              </Text>
              <Text
                style={[
                  styles.downloadStatus,
                  isActive
                    ? styles.activeStatus
                    : isCompleted
                      ? styles.completedStatus
                      : {},
                ]}
              >
                {getStatusLabel()}
              </Text>
            </View>

            <View style={styles.downloadMeta}>
              <Text style={styles.downloadDetail}>{getDetailText()}</Text>
            </View>

            {isActive && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${percent}%` }]}
                  />
                </View>
                <Text style={styles.progressText}>{percent}% complete</Text>
              </View>
            )}
          </TouchableOpacity>
        </AnimatedListItem>
      );
    },
    [styles, overview],
  );

  const hasDownloads =
    overview.activeDownloads.length > 0 ||
    overview.completedDownloads.length > 0;

  const listEmptyComponent = useMemo(() => {
    const handleGoToJellyfin = async () => {
      navigateToRoute(router, NAVIGATION_ROUTES.SERVICES);
    };

    return (
      <EmptyState
        title="No Jellyfin downloads"
        description="Start downloading movies and episodes from Jellyfin to manage them here."
        actionLabel="Go to Jellyfin"
        onActionPress={handleGoToJellyfin}
      />
    );
  }, [router]);

  const renderListHeader = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <Searchbar
          placeholder="Search downloads..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        {hasDownloads && (
          <>
            <View style={styles.statsContainer}>
              {overview.activeDownloads.length > 0 && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Active Downloads</Text>
                  <Text style={styles.statValue}>
                    {overview.activeDownloads.length}
                  </Text>
                </View>
              )}
              {overview.completedDownloads.length > 0 && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Completed</Text>
                  <Text style={styles.statValue}>
                    {overview.completedDownloads.length}
                  </Text>
                </View>
              )}
              {overview.totalStats.totalSize > 0 && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total Size</Text>
                  <Text style={styles.statValue}>
                    {formatBytes(overview.totalStats.totalSize)}
                  </Text>
                </View>
              )}
            </View>

            {overview.activeDownloads.length > 0 && (
              <Text style={styles.sectionHeader}>Active Downloads</Text>
            )}
          </>
        )}
      </View>
    );
  }, [styles, searchQuery, hasDownloads, overview]);

  const allDownloads = useMemo(() => {
    return [
      ...overview.activeDownloads,
      ...(overview.activeDownloads.length > 0 &&
      overview.completedDownloads.length > 0
        ? [{ type: "divider" as const }]
        : []),
      ...overview.completedDownloads,
    ];
  }, [overview.activeDownloads, overview.completedDownloads]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <TabHeader showBackButton={true} onBackPress={() => router.back()} />

      {hasDownloads ? (
        <FlashList
          data={allDownloads}
          keyExtractor={(item, index) => {
            if (
              typeof item === "object" &&
              item !== null &&
              "type" in item &&
              item.type === "divider"
            ) {
              return `divider-${index}`;
            }
            const download = item as JellyfinDownloadItem;
            return download.id;
          }}
          renderItem={(props) => {
            const item = props.item;
            if (
              typeof item === "object" &&
              item !== null &&
              "type" in item &&
              item.type === "divider"
            ) {
              return <Divider style={{ marginVertical: spacing.md }} />;
            }
            return renderDownloadItem({
              item: item as JellyfinDownloadItem,
              index: props.index,
            });
          }}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <ListRefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
        />
      ) : (
        <FlashList
          data={[]}
          renderItem={() => null}
          keyExtractor={() => "empty"}
          ListEmptyComponent={
            <AnimatedSection style={styles.emptyContainer} delay={100}>
              {listEmptyComponent}
            </AnimatedSection>
          }
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

export default JellyfinDownloadsScreen;
