import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import {
  FAB,
  IconButton,
  Portal,
  Searchbar,
  Text,
  useTheme,
  Banner,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppTheme } from "@/constants/theme";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import { SonarrQueueItem } from "@/components/queue/SonarrQueueItem";
import { SonarrQueueStats } from "@/components/queue/SonarrQueueStats";
import { SonarrQueueFilter } from "@/components/queue/SonarrQueueFilter";
import { SonarrNavbar } from "@/components/sonarr/SonarrNavbar";
import { useSonarrQueue, useSonarrQueueActions } from "@/hooks/useSonarrQueue";
import type {
  DetailedSonarrQueueItem,
  QueueFilters,
  QueueStatus,
} from "@/models/queue.types";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { logger } from "@/services/logger/LoggerService";
import { spacing } from "@/theme/spacing";

const SonarrQueueScreen = () => {
  const { serviceId: rawServiceId } = useLocalSearchParams<{
    serviceId?: string;
  }>();
  const serviceId = typeof rawServiceId === "string" ? rawServiceId : "";
  const hasValidServiceId = serviceId.length > 0;
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const manager = useMemo(() => ConnectorManager.getInstance(), []);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const effectiveServiceId =
    hasValidServiceId && !isBootstrapping ? serviceId : "";

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<
    Set<DetailedSonarrQueueItem["id"]>
  >(new Set());
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filters, setFilters] = useState<QueueFilters>({});
  const hasActiveQueueFilters = Object.keys(filters).length > 0;

  // Fetch queue data
  const { items, stats, isLoading, isFetching, error, refetch } =
    useSonarrQueue(effectiveServiceId, filters);

  // Queue actions
  const { removeFromQueue, isRemoving } =
    useSonarrQueueActions(effectiveServiceId);

  // Filter items based on search query and status filter
  const filteredItems = useMemo(() => {
    if (!items) return [];

    let result = items;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item: DetailedSonarrQueueItem) =>
          item.seriesTitle?.toLowerCase().includes(query) ||
          item.episodeTitle?.toLowerCase().includes(query) ||
          item.downloadClient?.toLowerCase().includes(query) ||
          item.indexer?.toLowerCase().includes(query),
      );
    }

    // Filter by status
    if (statusFilter && statusFilter !== "all") {
      result = result.filter(
        (item: DetailedSonarrQueueItem) => item.status === statusFilter,
      );
    }

    return result;
  }, [items, searchQuery, statusFilter]);

  // Handle selection toggle
  const handleSelectItem = (item: DetailedSonarrQueueItem) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(item.id)) {
      newSelected.delete(item.id);
    } else {
      newSelected.add(item.id);
    }
    setSelectedItems(newSelected);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(
        new Set(filteredItems.map((item: DetailedSonarrQueueItem) => item.id)),
      );
    }
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedItems(new Set());
  };

  // Handle queue status filter change
  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
  };

  // Handle filter modal actions
  const handleOpenFilterModal = () => {
    setFilterModalVisible(true);
  };

  const handleCloseFilterModal = () => {
    setFilterModalVisible(false);
  };

  const handleApplyFilters = (newFilters: QueueFilters) => {
    setFilters(newFilters);
    handleCloseFilterModal();
  };

  const handleResetFilters = () => {
    setFilters({});
    handleCloseFilterModal();
  };

  useEffect(() => {
    let isCancelled = false;

    const bootstrap = async () => {
      if (!hasValidServiceId) {
        if (!isCancelled) {
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        if (!manager.getConnector(serviceId)) {
          await manager.loadSavedServices();
        }
      } catch (bootstrapError) {
        const message =
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Unknown connector bootstrap error.";
        void logger.warn("Failed to preload Sonarr connector for queue.", {
          location: "SonarrQueueScreen.bootstrap",
          serviceId,
          message,
        });
      } finally {
        if (!isCancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      isCancelled = true;
    };
  }, [hasValidServiceId, manager, serviceId]);

  const connector = hasValidServiceId
    ? manager.getConnector(serviceId)
    : undefined;
  const connectorIsSonarr = connector?.config.type === "sonarr";
  const serviceName = connector?.config.name ?? "Sonarr";

  const isInitialLoad = isBootstrapping || isLoading;
  const isRefreshing = isFetching && !isLoading;

  const handleNavigateToSeries = () => {
    router.push({
      pathname: "/(auth)/sonarr/[serviceId]",
      params: { serviceId },
    });
  };

  // Check if an item requires manual intervention
  const isItemRequiringAction = (item: DetailedSonarrQueueItem): boolean => {
    return (
      item.trackedDownloadState === "importBlocked" ||
      item.trackedDownloadState === "failedPending" ||
      item.status === "failed" ||
      item.status === "warning"
    );
  };

  // Handle queue item actions
  const handleRemoveItem = (item: DetailedSonarrQueueItem) => {
    const actionMessage =
      item.trackedDownloadState === "importBlocked"
        ? `This item is blocked from importing. Remove "${item.episodeTitle}" from the queue?`
        : item.trackedDownloadState === "failedPending"
          ? `This item failed to import and requires manual intervention. Remove "${item.episodeTitle}" from the queue?`
          : `Remove "${item.episodeTitle}" from the queue?`;

    Alert.alert("Remove from Queue", actionMessage, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          removeFromQueue([item.id]);
        },
      },
    ]);
  };

  const handleBlockItem = (item: DetailedSonarrQueueItem) => {
    const actionMessage =
      item.trackedDownloadState === "importBlocked"
        ? `Block and remove "${item.episodeTitle}" from the queue? This release will be added to the blocklist and won't be downloaded again.`
        : item.trackedDownloadState === "failedPending"
          ? `Block and remove "${item.episodeTitle}" from the queue? The failed release will be added to the blocklist to prevent re-importing.`
          : `Block and remove "${item.episodeTitle}" from the queue? This will add it to the blocklist.`;

    Alert.alert("Block and Remove", actionMessage, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Block",
        style: "destructive",
        onPress: () => {
          removeFromQueue([item.id], { blocklist: true });
        },
      },
    ]);
  };

  const handleRetryItem = (item: DetailedSonarrQueueItem) => {
    // This would need to be implemented in the connector to retry a failed download
    // For now, guide user to block and re-search manually
    Alert.alert(
      "Manual Retry",
      `To retry downloading "${item.episodeTitle}", you can:\n\n1. Block this release (adds to blocklist)\n2. Manually search for another release in the series view`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Block This Release",
          style: "destructive",
          onPress: () => {
            handleBlockItem(item);
          },
        },
        {
          text: "View Series",
          style: "default",
          onPress: () => {
            // Navigate to series details for manual search
            if (item.seriesId) {
              router.push({
                pathname: "/(auth)/sonarr/[serviceId]/series/[seriesId]",
                params: { serviceId, seriesId: item.seriesId.toString() },
              });
            }
          },
        },
      ],
    );
  };

  // Handle bulk actions
  const handleBulkRemove = () => {
    if (selectedItems.size === 0) return;

    Alert.alert(
      "Remove from Queue",
      `Remove ${selectedItems.size} items from the queue?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeFromQueue(Array.from(selectedItems));
            handleClearSelection();
          },
        },
      ],
    );
  };

  const handleBulkBlock = () => {
    if (selectedItems.size === 0) return;

    Alert.alert(
      "Block and Remove",
      `Block and remove ${selectedItems.size} items from the queue? This will add them to the blocklist.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            removeFromQueue(Array.from(selectedItems), { blocklist: true });
            handleClearSelection();
          },
        },
      ],
    );
  };

  // Render queue item
  const renderQueueItem = ({ item }: { item: DetailedSonarrQueueItem }) => (
    <SonarrQueueItem
      item={item}
      selected={selectedItems.has(item.id)}
      onSelect={() => handleSelectItem(item)}
      onRemove={() => handleRemoveItem(item)}
      onBlock={() => handleBlockItem(item)}
      onRetry={() => handleRetryItem(item)}
      showActions={selectedItems.size > 0}
    />
  );

  // Render list empty component
  const renderEmptyComponent = () => {
    if (isInitialLoad) {
      return <LoadingState />;
    }

    if (error) {
      return (
        <EmptyState
          icon="alert-circle"
          title="Error"
          description={error.message || "Failed to load queue"}
          actionLabel="Retry"
          onActionPress={() => refetch()}
        />
      );
    }

    if (filteredItems.length === 0 && items.length === 0) {
      return (
        <EmptyState
          icon="download-off"
          title="Queue is Empty"
          description="There are no items in the download queue"
        />
      );
    }

    if (filteredItems.length === 0 && items.length > 0) {
      return (
        <EmptyState
          icon="filter-off"
          title="No Matches"
          description="No queue items match your filters"
          actionLabel="Clear All Filters"
          onActionPress={() => {
            setFilters({});
            setSearchQuery("");
            setStatusFilter("all");
            handleClearSelection();
          }}
        />
      );
    }

    return null;
  };

  // Count items requiring manual intervention
  const itemsRequiringAction = useMemo(() => {
    return items.filter(isItemRequiringAction);
  }, [items]);

  // Render list header
  const renderListHeader = () => {
    if (items.length === 0) return null;

    return (
      <View style={styles.listHeader}>
        <SonarrQueueStats
          onStatusFilter={handleStatusFilterChange}
          {...stats}
        />
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search queue..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
          />
          <IconButton
            icon="filter-variant"
            size={24}
            onPress={handleOpenFilterModal}
            style={[
              styles.filterButton,
              hasActiveQueueFilters && {
                backgroundColor: theme.colors.primaryContainer,
                borderColor: "transparent",
              },
            ]}
            iconColor={
              hasActiveQueueFilters
                ? theme.colors.onPrimaryContainer
                : theme.colors.onSurfaceVariant
            }
            mode={hasActiveQueueFilters ? "contained-tonal" : "outlined"}
          />
        </View>
      </View>
    );
  };

  if (!hasValidServiceId) {
    return (
      <SafeAreaView
        style={[{ flex: 1, backgroundColor: theme.colors.background }]}
      >
        <EmptyState
          title="Missing service identifier"
          description="Return to the dashboard and select a Sonarr service before continuing."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (
    !isBootstrapping &&
    effectiveServiceId &&
    (!connector || !connectorIsSonarr)
  ) {
    return (
      <SafeAreaView
        style={[{ flex: 1, backgroundColor: theme.colors.background }]}
      >
        <EmptyState
          title="Sonarr connector unavailable"
          description="Verify the service configuration in settings and try again."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <SonarrNavbar
        serviceName={serviceName}
        activeTab="queue"
        onBackPress={() => router.back()}
        onNavigateToSeries={handleNavigateToSeries}
        onNavigateToQueue={() => {}}
      />

      {/* Banner for items requiring action */}
      {itemsRequiringAction.length > 0 && (
        <Banner
          visible={true}
          icon="alert-octagon"
          style={styles.actionBanner}
          contentStyle={styles.actionBannerContent}
          actions={[
            {
              label: "View",
              onPress: () => {
                const newFilters: QueueFilters = {
                  status: ["failed" as QueueStatus, "warning" as QueueStatus],
                };
                setFilters(newFilters);
              },
            },
          ]}
        >
          <Text style={styles.bannerText}>
            {itemsRequiringAction.length} item
            {itemsRequiringAction.length > 1 ? "s" : ""} require
            {itemsRequiringAction.length > 1 ? "" : "s"} manual intervention
          </Text>
        </Banner>
      )}

      <FlashList<DetailedSonarrQueueItem>
        data={filteredItems}
        renderItem={renderQueueItem}
        keyExtractor={(item: DetailedSonarrQueueItem) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={
          <ListRefreshControl
            refreshing={isRefreshing}
            onRefresh={() => refetch()}
          />
        }
        estimatedItemSize={140}
      />

      {/* Filter Modal */}
      <SonarrQueueFilter
        visible={filterModalVisible}
        filters={filters}
        onDismiss={handleCloseFilterModal}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <View style={styles.bulkActions}>
          <View style={styles.selectionInfo}>
            <Text variant="bodyMedium" style={styles.selectionInfoText}>
              {selectedItems.size} item{selectedItems.size > 1 ? "s" : ""}{" "}
              selected
            </Text>
          </View>
          <IconButton icon="select-all" size={24} onPress={handleSelectAll} />
          <IconButton icon="close" size={24} onPress={handleClearSelection} />
          <IconButton icon="delete" size={24} onPress={handleBulkRemove} />
          <IconButton icon="block-helper" size={24} onPress={handleBulkBlock} />
        </View>
      )}

      {/* FAB for select all */}
      {selectedItems.size === 0 && filteredItems.length > 0 && (
        <FAB
          icon="select-all"
          label="Select All"
          style={styles.fab}
          onPress={handleSelectAll}
        />
      )}

      {/* Loading indicator for removing items */}
      {isRemoving && (
        <Portal>
          <View style={styles.overlay}>
            <View style={styles.loadingIndicator}>
              <Text variant="bodyMedium" style={styles.loadingText}>
                Removing items...
              </Text>
            </View>
          </View>
        </Portal>
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    actionBanner: {
      backgroundColor: theme.colors.errorContainer,
    },
    actionBannerContent: {
      paddingVertical: spacing.sm,
    },
    bannerText: {
      color: theme.colors.onErrorContainer,
      fontWeight: "500",
    },
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    listHeader: {
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    searchBar: {
      flex: 1,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
    },
    filterButton: {
      margin: 0,
      borderRadius: spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    bulkActions: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: theme.colors.elevation.level2,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.outlineVariant,
    },
    selectionInfo: {
      flex: 1,
    },
    selectionInfoText: {
      color: theme.colors.onSurface,
    },
    fab: {
      position: "absolute",
      margin: spacing.lg,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.primary,
    },
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.scrim,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 999,
    },
    loadingIndicator: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: spacing.md,
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 6,
    },
    loadingText: {
      color: theme.colors.onSurface,
    },
  });

export default SonarrQueueScreen;
