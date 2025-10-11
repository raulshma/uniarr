import { FlashList } from "@shopify/flash-list";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { alert } from '@/services/dialogService';
import {
  FAB,
  Icon,
  IconButton,
  Button,
  Dialog,
  Searchbar,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
// Reanimated entering/exiting animations removed for snappy UX on list pages.

import { EmptyState } from "@/components/common/EmptyState";
import BottomDrawer, { DrawerItem } from "@/components/common/BottomDrawer";
import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import type { AppTheme } from "@/constants/theme";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { ProwlarrIndexerResource } from "@/models/prowlarr.types";
import { logger } from "@/services/logger/LoggerService";
import { spacing } from "@/theme/spacing";
import { useProwlarrIndexers } from "@/hooks/useProwlarrIndexers";

const FILTER_ALL = "all";
const FILTER_ENABLED = "enabled";
const FILTER_DISABLED = "disabled";

type FilterValue =
  | typeof FILTER_ALL
  | typeof FILTER_ENABLED
  | typeof FILTER_DISABLED;

const FILTER_OPTIONS: FilterValue[] = [
  FILTER_ALL,
  FILTER_ENABLED,
  FILTER_DISABLED,
];

const FILTER_LABELS: Record<FilterValue, string> = {
  [FILTER_ALL]: "All Indexers",
  [FILTER_ENABLED]: "Enabled",
  [FILTER_DISABLED]: "Disabled",
};

const normalizeSearchTerm = (input: string): string =>
  input.trim().toLowerCase();

const IndexerListItemSkeleton = () => {
  const theme = useTheme<AppTheme>();

  return (
    <View
      style={[
        styles.indexerItem,
        {
          borderColor: theme.colors.outline,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View style={styles.indexerContent}>
        <SkeletonPlaceholder style={styles.indexerIcon} />
        <View style={styles.indexerInfo}>
          <SkeletonPlaceholder style={styles.indexerName} />
          <SkeletonPlaceholder style={styles.indexerImplementation} />
          <SkeletonPlaceholder style={styles.indexerPriority} />
        </View>
        <SkeletonPlaceholder
          style={[
            styles.indexerActions,
            { width: 20, height: 20, borderRadius: 10 },
          ]}
        />
      </View>
    </View>
  );
};

const ProwlarrIndexerListScreen = () => {
  const { serviceId: rawServiceId } = useLocalSearchParams<{
    serviceId?: string;
  }>();
  const serviceId = typeof rawServiceId === "string" ? rawServiceId : "";
  const hasValidServiceId = serviceId.length > 0;

  const router = useRouter();
  const theme = useTheme<AppTheme>();

  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterValue>(FILTER_ALL);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Bottom drawer state replaces per-item Menu popovers. When non-null,
  // the drawer slides up from the bottom and shows either filter options
  // or item-specific actions.
  const [bottomDrawer, setBottomDrawer] = useState<{
    type: "item" | "filter";
    item?: ProwlarrIndexerResource;
  } | null>(null);
  const [isFabMenuVisible, setIsFabMenuVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const multiSelectActive = selectedIds.size > 0;
  const [isAddDialogVisible, setIsAddDialogVisible] = useState(false);
  const [isAppsDialogVisible, setIsAppsDialogVisible] = useState(false);
  const [schemaOptions, setSchemaOptions] = useState<ProwlarrIndexerResource[]>(
    []
  );
  const [isSchemaLoading, setIsSchemaLoading] = useState(false);
  const [selectedSchemaIdx, setSelectedSchemaIdx] = useState<number | null>(
    null
  );
  const [syncStatus, setSyncStatus] = useState<{
    connectedApps: string[];
    lastSyncTime?: string;
    syncInProgress: boolean;
  } | null>(null);
  const handleFilterChange = useCallback((value: FilterValue) => {
    setSelectedFilter(value);
    // Close the drawer when a filter is picked
    setBottomDrawer(null);
  }, []);

  // Use the Prowlarr indexers hook
  const {
    indexers,
    isLoading,
    error,
    refresh,
    testIndexer,
    toggleIndexer,
    deleteIndexer,
    syncIndexersToApps,
    rescanIndexers,
    getSyncStatus,
    getIndexerSchema,
    addIndexer,
    bulkEnableDisable,
    bulkDelete,
    lastApiEvent,
    clearApiEvent,
  } = useProwlarrIndexers(serviceId);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);
  // Load sync status
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const status = await getSyncStatus();
      if (isMounted) setSyncStatus(status);
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [getSyncStatus]);

  // The API banner is persistent until the user dismisses it via the close button.

  const refreshSyncStatus = useCallback(async () => {
    const status = await getSyncStatus();
    setSyncStatus(status);
  }, [getSyncStatus]);

  // Filter and search indexers
  const filteredIndexers = useMemo(() => {
    let filtered = indexers;

    // Apply filter
    if (selectedFilter === FILTER_ENABLED) {
      filtered = filtered.filter((indexer: ProwlarrIndexerResource) =>
        Boolean(indexer.enable)
      );
    } else if (selectedFilter === FILTER_DISABLED) {
      filtered = filtered.filter(
        (indexer: ProwlarrIndexerResource) => !Boolean(indexer.enable)
      );
    }

    // Apply search
    if (searchQuery) {
      const searchTerm = normalizeSearchTerm(searchQuery);
      filtered = filtered.filter(
        (indexer: ProwlarrIndexerResource) =>
          normalizeSearchTerm(indexer.name ?? "").includes(searchTerm) ||
          normalizeSearchTerm(indexer.implementationName ?? "").includes(
            searchTerm
          ) ||
          normalizeSearchTerm(indexer.implementation ?? "").includes(searchTerm)
      );
    }

    return filtered;
  }, [indexers, selectedFilter, searchQuery]);

  // Handle indexer actions
  const handleToggleIndexer = useCallback(
    async (indexer: ProwlarrIndexerResource) => {
      const success = await toggleIndexer(indexer);
      // Errors are surfaced via the API banner; no alert popup.
    },
    [toggleIndexer]
  );

  const handleTestIndexer = useCallback(
    async (indexer: ProwlarrIndexerResource) => {
      // Trigger test; any success/error is shown in the API banner.
      await testIndexer(indexer);
    },
    [testIndexer]
  );

  const handleDeleteIndexer = useCallback(
    async (indexer: ProwlarrIndexerResource) => {
  alert(
        "Delete Indexer",
        `Are you sure you want to delete "${indexer.name}"? This action cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              // Delete and rely on API banner for any errors.
              await deleteIndexer(indexer.id);
            },
          },
        ]
      );
    },
    [deleteIndexer]
  );

  // Handle sync actions
  const handleSyncIndexers = useCallback(async () => {
    const success = await syncIndexersToApps();
    if (success) {
  alert("Success", "Indexers synced to connected applications");
      void refreshSyncStatus();
    } else {
  alert("Error", "Failed to sync indexers");
    }
  }, [syncIndexersToApps]);

  const handleRescanIndexers = useCallback(async () => {
    const success = await rescanIndexers();
    if (success) {
  alert("Success", "Indexers rescanned successfully");
    } else {
  alert("Error", "Failed to rescan indexers");
    }
  }, [rescanIndexers]);

  // Render indexer item
  const renderIndexerItem = ({ item }: { item: ProwlarrIndexerResource }) => (
    <Pressable
      onLongPress={() => {
        const next = new Set(selectedIds);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        setSelectedIds(next);
      }}
      onPress={() => {
        if (multiSelectActive) {
          const next = new Set(selectedIds);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          setSelectedIds(next);
        }
      }}
    >
      <View
        style={[
          styles.indexerItem,
          {
            borderColor: theme.colors.outline,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <View style={styles.indexerContent}>
          <Icon
            source={
              multiSelectActive
                ? selectedIds.has(item.id)
                  ? "checkbox-marked"
                  : "checkbox-blank-outline"
                : "radar"
            }
            size={24}
            color={
              multiSelectActive
                ? selectedIds.has(item.id)
                  ? theme.colors.primary
                  : theme.colors.onSurfaceVariant
                : item.enable
                ? theme.colors.primary
                : theme.colors.outline
            }
          />
          <View style={styles.indexerInfo}>
            <Text variant="bodyLarge" style={styles.indexerName}>
              {item.name}
            </Text>
            <Text
              variant="bodyMedium"
              style={[
                styles.indexerImplementation,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {item.implementationName}
            </Text>
            <Text
              variant="bodySmall"
              style={[
                styles.indexerPriority,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Priority: {item.priority ?? "N/A"}
            </Text>
          </View>
          <View style={styles.indexerActions}>
            <View onStartShouldSetResponder={() => true}>
              <IconButton
                icon="dots-vertical"
                size={20}
                onPress={() => {
                  // Toggle the bottom drawer for this item
                  if (
                    bottomDrawer &&
                    bottomDrawer.type === "item" &&
                    bottomDrawer.item?.id === item.id
                  ) {
                    setBottomDrawer(null);
                  } else {
                    setBottomDrawer({ type: "item", item });
                  }
                }}
              />
            </View>
          </View>
        </View>
  </View>
    </Pressable>
  );

  // Loading state
  if (isLoading && indexers.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Search Container Skeleton */}
        <View style={styles.searchContainer}>
          {/* Sync Banner Skeleton */}
          <View
            style={[
              styles.syncBanner,
              {
                borderColor: theme.colors.outline,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <SkeletonPlaceholder
              style={{ width: 16, height: 16, borderRadius: 8 }}
            />
            <View style={styles.syncTextContainer}>
              <SkeletonPlaceholder
                style={{ width: "60%", height: 14, borderRadius: 7 }}
              />
            </View>
            <View style={styles.syncTextContainer}>
              <View style={styles.summaryRow}>
                <View
                  style={[
                    styles.appCountBadge,
                    { borderColor: theme.colors.outline },
                  ]}
                >
                  <SkeletonPlaceholder
                    style={{ width: 16, height: 14, borderRadius: 7 }}
                  />
                </View>
                <SkeletonPlaceholder
                  style={{ width: 18, height: 18, borderRadius: 9 }}
                />
              </View>
            </View>
            <SkeletonPlaceholder
              style={{
                width: "40%",
                height: 14,
                borderRadius: 7,
                marginLeft: spacing.sm,
              }}
            />
            <SkeletonPlaceholder
              style={{ width: 18, height: 18, borderRadius: 9 }}
            />
          </View>
          {/* API Banner Skeleton */}
          <View
            style={[styles.apiBanner, { borderColor: theme.colors.primary }]}
          >
            <SkeletonPlaceholder
              style={{ width: 16, height: 16, borderRadius: 8 }}
            />
            <View style={styles.syncTextContainer}>
              <SkeletonPlaceholder
                style={{ width: "70%", height: 14, borderRadius: 7 }}
              />
              <SkeletonPlaceholder
                style={{
                  width: "50%",
                  height: 12,
                  borderRadius: 6,
                  marginTop: 2,
                }}
              />
            </View>
            <SkeletonPlaceholder
              style={{ width: 18, height: 18, borderRadius: 9 }}
            />
          </View>
          <SkeletonPlaceholder style={[styles.searchbar, { height: 48 }]} />
          <View
            style={[
              styles.filterChip,
              { height: 36, borderColor: theme.colors.outline },
            ]}
          >
            <SkeletonPlaceholder
              style={{ width: 16, height: 16, borderRadius: 8 }}
            />
            <SkeletonPlaceholder
              style={{ width: 80, height: 16, borderRadius: 8 }}
            />
            <SkeletonPlaceholder
              style={{ width: 16, height: 16, borderRadius: 8 }}
            />
          </View>
        </View>
        {/* Indexer Items Skeleton */}
        <ScrollView contentContainerStyle={styles.loadingContainer}>
          {Array.from({ length: 5 }).map((_, index) => (
            <IndexerListItemSkeleton key={index} />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="alert-circle"
          title="Failed to Load Indexers"
          description={error}
          actionLabel="Retry"
          onActionPress={refresh}
        />
      </SafeAreaView>
    );
  }

  // Empty state
  if (indexers.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="radar"
          title="No Indexers Found"
          description="Add your first indexer to start managing your torrent indexers."
          actionLabel="Add Indexer"
          onActionPress={() => {
            // TODO: Navigate to add indexer screen
            alert("Add Indexer", "Add indexer functionality coming soon");
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Sync Status + Search and Filter Bar */}
      <View style={styles.searchContainer}>
        {syncStatus && (
          <View
            style={[
              styles.syncBanner,
              {
                borderColor: theme.colors.outline,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Icon
              source={syncStatus.syncInProgress ? "sync" : "check-circle"}
              size={16}
              color={theme.colors.onSurfaceVariant}
            />
            <View style={styles.syncTextContainer}>
              <Text
                variant="bodySmall"
                numberOfLines={2}
                ellipsizeMode="tail"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Connected Apps:{" "}
                {syncStatus.connectedApps.length > 0
                  ? syncStatus.connectedApps.join(", ")
                  : "None"}
              </Text>
            </View>
            <View style={styles.syncTextContainer}>
              <View style={styles.summaryRow}>
                <View
                  style={[
                    styles.appCountBadge,
                    { borderColor: theme.colors.outline },
                  ]}
                >
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {syncStatus.connectedApps.length}
                  </Text>
                </View>
                <IconButton
                  icon="information-outline"
                  size={18}
                  onPress={() => setIsAppsDialogVisible(true)}
                  accessibilityLabel="Connected apps details"
                />
              </View>
            </View>
            <Text
              variant="bodySmall"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                { color: theme.colors.onSurfaceVariant },
                styles.lastSyncText,
              ]}
            >
              Last Sync:{" "}
              {syncStatus.lastSyncTime
                ? new Date(syncStatus.lastSyncTime).toLocaleString()
                : "N/A"}
            </Text>
            <IconButton icon="refresh" size={18} onPress={refreshSyncStatus} />
          </View>
        )}
        {/* API Request Banner (shows last API request info / errors) */}
        {lastApiEvent && (
          <View
            style={[
              styles.apiBanner,
              lastApiEvent.status === "error"
                ? { borderColor: theme.colors.error }
                : { borderColor: theme.colors.primary },
            ]}
          >
            <Icon
              source={lastApiEvent.status === "error" ? "alert-circle" : "api"}
              size={16}
              color={
                lastApiEvent.status === "error"
                  ? theme.colors.error
                  : theme.colors.primary
              }
            />
            <View style={styles.syncTextContainer}>
              <Text
                variant="bodySmall"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {lastApiEvent.method?.toUpperCase() ?? ""}{" "}
                {lastApiEvent.endpoint ?? ""} —{" "}
                {lastApiEvent.status.toUpperCase()}
              </Text>
              {lastApiEvent.message && (
                <Text
                  variant="bodySmall"
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={[
                    styles.apiMessage,
                    {
                      color:
                        lastApiEvent.status === "error"
                          ? theme.colors.error
                          : theme.colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {lastApiEvent.message}
                </Text>
              )}
            </View>
            <IconButton
              icon="close"
              size={18}
              onPress={clearApiEvent}
              accessibilityLabel="Dismiss API banner"
            />
          </View>
        )}
        <Searchbar
          placeholder="Search indexers..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
        />

        <TouchableRipple
          borderless={false}
          onPress={() => setBottomDrawer({ type: "filter" })}
        >
          <View
            style={[styles.filterChip, { borderColor: theme.colors.outline }]}
          >
            <Icon
              source="filter-variant"
              size={16}
              color={theme.colors.onSurface}
            />
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface }}
            >
              {FILTER_LABELS[selectedFilter]}
            </Text>
            <Icon
              source="chevron-down"
              size={16}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
        </TouchableRipple>
      </View>

      {/* Indexers List */}
      <FlashList
        data={filteredIndexers}
        renderItem={renderIndexerItem}
        refreshControl={
          <ListRefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="magnify"
            title="No Indexers Match"
            description={`No indexers found matching "${searchQuery}"`}
          />
        }
        contentContainerStyle={
          filteredIndexers.length === 0 ? styles.emptyList : undefined
        }
      />

      <BottomDrawer
        visible={Boolean(bottomDrawer)}
        onDismiss={() => setBottomDrawer(null)}
        title={
          bottomDrawer?.type === "item"
            ? bottomDrawer.item?.name ?? undefined
            : "Filter"
        }
        maxHeight={"60%"}
      >
        {bottomDrawer?.type === "filter" && (
          <>
            {FILTER_OPTIONS.map((filter) => (
              <DrawerItem
                key={filter}
                icon="filter-variant"
                label={FILTER_LABELS[filter]}
                onPress={() => handleFilterChange(filter)}
                selected={selectedFilter === filter}
              />
            ))}
          </>
        )}
        {bottomDrawer?.type === "item" && bottomDrawer.item && (
          <>
            <DrawerItem
              icon="pencil"
              label="Edit"
              onPress={() => {
                setBottomDrawer(null);
                alert("Edit", "Edit indexer functionality coming soon");
              }}
            />
            <DrawerItem
              icon="play-circle"
              label="Test"
              onPress={async () => {
                setBottomDrawer(null);
                await handleTestIndexer(bottomDrawer.item!);
              }}
            />
            <DrawerItem
              icon={bottomDrawer.item.enable ? "pause-circle" : "play-circle"}
              label={bottomDrawer.item.enable ? "Disable" : "Enable"}
              onPress={async () => {
                setBottomDrawer(null);
                await handleToggleIndexer(bottomDrawer.item!);
              }}
            />
            <DrawerItem
              icon="delete"
              label="Delete"
              onPress={() => {
                setBottomDrawer(null);
                void handleDeleteIndexer(bottomDrawer.item!);
              }}
              destructive
            />
          </>
        )}
      </BottomDrawer>

      {/* Floating action button group (replaces Menu-anchored FAB which could be unresponsive on Android/iOS) */}
      <FAB.Group
        visible={true}
        open={isFabMenuVisible}
        icon={isFabMenuVisible ? "close" : "dots-vertical"}
        fabStyle={{ backgroundColor: theme.colors.primaryContainer }}
        style={styles.fab}
        onStateChange={({ open }) => setIsFabMenuVisible(open)}
        onPress={() => {
          // When closed, pressing will open the group. When open, pressing main fab will close it.
          setIsFabMenuVisible((s) => !s);
        }}
        actions={[
          {
            icon: "plus",
            label: "Add Indexer",
            onPress: () => {
              setIsFabMenuVisible(false);
              setIsAddDialogVisible(true);
              setIsSchemaLoading(true);
              setSelectedSchemaIdx(null);
              void (async () => {
                const schema = await getIndexerSchema();
                setSchemaOptions(schema);
                setIsSchemaLoading(false);
              })();
            },
          },
          ...(multiSelectActive
            ? [
                {
                  icon: "check-circle",
                  label: `Enable (${selectedIds.size})`,
                  onPress: async () => {
                    setIsFabMenuVisible(false);
                    await bulkEnableDisable(Array.from(selectedIds), true);
                    setSelectedIds(new Set());
                  },
                },
                {
                  icon: "pause-circle",
                  label: `Disable (${selectedIds.size})`,
                  onPress: async () => {
                    setIsFabMenuVisible(false);
                    await bulkEnableDisable(Array.from(selectedIds), false);
                    setSelectedIds(new Set());
                  },
                },
                {
                  icon: "delete",
                  label: `Delete (${selectedIds.size})`,
                  onPress: async () => {
                    setIsFabMenuVisible(false);
                    await bulkDelete(Array.from(selectedIds));
                    setSelectedIds(new Set());
                  },
                },
                {
                  icon: "close-circle",
                  label: "Clear Selection",
                  onPress: () => {
                    setIsFabMenuVisible(false);
                    setSelectedIds(new Set());
                  },
                },
              ]
            : []),
          {
            icon: "chart-line",
            label: "View Statistics",
            onPress: () => {
              setIsFabMenuVisible(false);
              router.push(`/prowlarr/${serviceId}/statistics`);
            },
          },
          {
            icon: "sync",
            label: "Sync to Apps",
            onPress: async () => {
              setIsFabMenuVisible(false);
              await handleSyncIndexers();
            },
          },
          {
            icon: "refresh",
            label: "Rescan Indexers",
            onPress: async () => {
              setIsFabMenuVisible(false);
              await handleRescanIndexers();
            },
          },
        ]}
      />

      {/* Add Indexer Dialog */}
      <Dialog
        visible={isAddDialogVisible}
        onDismiss={() => setIsAddDialogVisible(false)}
      >
        <Dialog.Title>Add Indexer</Dialog.Title>
        <Dialog.Content>
          {isSchemaLoading ? (
            <Text>Loading indexer types…</Text>
          ) : schemaOptions.length === 0 ? (
            <Text>No indexer templates available.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 240 }}>
              {schemaOptions.map((opt, idx) => (
                <TouchableRipple
                  key={`${opt.implementation}-${idx}`}
                  onPress={() => setSelectedSchemaIdx(idx)}
                >
                  <View style={{ paddingVertical: 8 }}>
                    <Text
                      variant="bodyLarge"
                      style={{
                        fontWeight: selectedSchemaIdx === idx ? "700" : "500",
                      }}
                    >
                      {opt.name}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {opt.implementationName}
                    </Text>
                  </View>
                </TouchableRipple>
              ))}
            </ScrollView>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setIsAddDialogVisible(false)}>Cancel</Button>
          <Button
            disabled={selectedSchemaIdx == null || isSchemaLoading}
            onPress={async () => {
              if (selectedSchemaIdx == null) return;
              const template = schemaOptions[selectedSchemaIdx];
              if (!template) return;
              const payload: ProwlarrIndexerResource = {
                id: 0,
                name: template.name ?? template.implementationName ?? "Indexer",
                implementationName:
                  template.implementationName ??
                  template.implementation ??
                  "Unknown",
                implementation: template.implementation ?? "Unknown",
                configContract: template.configContract ?? "",
                infoLink: template.infoLink ?? "",
                tags: template.tags ?? [],
                fields: template.fields ?? [],
                enable: true,
                priority: template.priority ?? 25,
              };
              const ok = await addIndexer(payload);
              if (ok) setIsAddDialogVisible(false);
            }}
          >
            Add
          </Button>
        </Dialog.Actions>
      </Dialog>
      {/* Connected Apps Dialog */}
      <Dialog
        visible={isAppsDialogVisible}
        onDismiss={() => setIsAppsDialogVisible(false)}
      >
        <Dialog.Title>Connected Applications</Dialog.Title>
        <Dialog.Content>
          {syncStatus?.connectedApps && syncStatus.connectedApps.length > 0 ? (
            <ScrollView style={{ maxHeight: 280 }}>
              {syncStatus.connectedApps.map((name, idx) => (
                <TouchableRipple key={`${name}-${idx}`} onPress={() => {}}>
                  <View style={{ paddingVertical: 8 }}>
                    <Text variant="bodyMedium">{name}</Text>
                  </View>
                </TouchableRipple>
              ))}
            </ScrollView>
          ) : (
            <Text>No connected applications.</Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setIsAppsDialogVisible(false)}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
    gap: spacing.sm,
  },
  searchContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    // Keep banner contents on a single row, with a horizontal scroller for apps
    flexWrap: "nowrap",
  },
  searchbar: {
    elevation: 1,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  appCountBadge: {
    minWidth: 32,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    gap: spacing.xs,
  },
  indexerItem: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: 24,
    elevation: 1,
  },
  indexerContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  indexerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  indexerInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  indexerName: {
    width: 120,
    height: 16,
  },
  indexerImplementation: {
    width: 100,
    height: 14,
  },
  indexerPriority: {
    width: 80,
    height: 12,
  },
  indexerActions: {
    justifyContent: "center",
  },
  syncTextContainer: {
    flex: 1,
    // Required for Text to shrink/wrap correctly inside a flex row on react-native
    minWidth: 0,
  },
  apiBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  apiMessage: {
    marginTop: 2,
  },
  drawerOverlayContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  lastSyncText: {
    // Keep the last sync label compact and avoid forcing full-width
    marginLeft: spacing.sm,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    margin: spacing.lg,
    right: 0,
    bottom: 0,
  },
});

export default ProwlarrIndexerListScreen;
