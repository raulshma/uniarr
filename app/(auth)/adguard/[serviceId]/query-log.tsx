import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Appbar,
  Chip,
  Searchbar,
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";

import { AnimatedListItem } from "@/components/common/AnimatedComponents";
import { useAdGuardHomeQueryLog } from "@/hooks/useAdGuardHomeQueryLog";
import type {
  AdGuardQueryLogItem,
  AdGuardQueryLogResponseStatus,
} from "@/models/adguard.types";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { alert } from "@/services/dialogService";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";

type StatusFilter = AdGuardQueryLogResponseStatus | "all";

const QUERY_LIMIT = 100;

const buildLogKey = (item: AdGuardQueryLogItem): string => {
  const domain = item.question?.name ?? "unknown";
  const client = item.client ?? "anonymous";
  const status = item.status ?? "unknown";
  return `${item.time ?? "unknown"}-${client}-${domain}-${status}`;
};

const formatTimestamp = (value?: string): string => {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const getReasonLabel = (item: AdGuardQueryLogItem): string => {
  if (item.reason) {
    switch (item.reason) {
      case "FilteredBlackList":
        return "Blocked";
      case "FilteredSafeBrowsing":
        return "Safe Browsing";
      case "FilteredParental":
        return "Parental";
      case "FilteredSafeSearch":
        return "Safe Search";
      case "FilteredBlockedService":
        return item.service_name ? `Blocked (${item.service_name})` : "Blocked";
      case "NotFilteredWhiteList":
        return "Whitelisted";
      case "Rewrite":
      case "RewriteRule":
        return "Rewritten";
      default:
        return item.reason;
    }
  }

  return item.status === "NOERROR" ? "Processed" : (item.status ?? "Unknown");
};

const deriveStatusTone = (
  theme: AppTheme,
  item: AdGuardQueryLogItem,
): { background: string; foreground: string } => {
  const reason = item.reason ?? "";

  if (reason.startsWith("Filtered") || reason === "NotFilteredError") {
    return {
      background: theme.colors.errorContainer,
      foreground: theme.colors.onErrorContainer,
    };
  }

  if (reason === "NotFilteredWhiteList") {
    return {
      background: theme.colors.secondaryContainer,
      foreground: theme.colors.onSecondaryContainer,
    };
  }

  return {
    background: theme.colors.surfaceVariant,
    foreground: theme.colors.onSurfaceVariant,
  };
};

const AdGuardQueryLogScreen = () => {
  const { serviceId: rawServiceId } = useLocalSearchParams<{
    serviceId?: string;
  }>();
  const serviceId = typeof rawServiceId === "string" ? rawServiceId : "";
  const hasValidServiceId = serviceId.length > 0;

  const theme = useTheme<AppTheme>();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [offset, setOffset] = useState(0);
  const [logItems, setLogItems] = useState<AdGuardQueryLogItem[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setOffset(0);
    setLogItems([]);
  }, [debouncedSearch, statusFilter]);

  const queryParams = useMemo(
    () => ({
      limit: QUERY_LIMIT,
      offset,
      search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      responseStatus: statusFilter === "all" ? undefined : statusFilter,
    }),
    [debouncedSearch, offset, statusFilter],
  );

  const {
    log,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    clearQueryLog,
    isClearing,
    actionError,
  } = useAdGuardHomeQueryLog(serviceId, queryParams);

  useEffect(() => {
    if (!log) {
      if (offset === 0) {
        setLogItems([]);
      }
      return;
    }

    setLogItems((previous) => {
      if (offset === 0) {
        return log.items;
      }

      const existingKeys = new Set(previous.map((item) => buildLogKey(item)));
      const merged = [...previous];

      for (const item of log.items) {
        const key = buildLogKey(item);
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          merged.push(item);
        }
      }

      return merged;
    });
  }, [log, offset]);

  useEffect(() => {
    if (!isError || !error) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    alert("Query log", message);
  }, [error, isError]);

  useEffect(() => {
    if (!actionError) {
      return;
    }

    const message =
      actionError instanceof Error ? actionError.message : String(actionError);
    alert("Query log", message);
  }, [actionError]);

  const isRefreshing = isFetching && !isLoading;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        container: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
        },
        controls: {
          gap: spacing.md,
          marginBottom: spacing.lg,
        },
        listContent: {
          paddingBottom: spacing.xxl,
          gap: spacing.sm,
        },
        logCard: {
          borderRadius: 16,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: theme.colors.elevation.level1,
          gap: spacing.xs,
        },
        logHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
        },
        domainText: {
          color: theme.colors.onSurface,
          flex: 1,
          fontWeight: "600",
        },
        timestamp: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.labelSmall.fontSize,
        },
        detailRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        clientText: {
          color: theme.colors.onSurfaceVariant,
          flex: 1,
          marginRight: spacing.md,
        },
        statusChip: {
          alignSelf: "flex-start",
        },
        emptyState: {
          flex: 1,
          justifyContent: "center",
        },
        footerActions: {
          marginTop: spacing.lg,
        },
        skeletonContainer: {
          gap: spacing.md,
          paddingVertical: spacing.md,
        },
        headerTitle: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
        },
        list: {
          flex: 1,
        },
      }),
    [theme],
  );

  const handleLoadMore = useCallback(() => {
    if (!log || isFetching || log.items.length < QUERY_LIMIT) {
      return;
    }

    setOffset((previous) => previous + QUERY_LIMIT);
  }, [isFetching, log]);

  const handleRefresh = useCallback(() => {
    setOffset(0);
    setLogItems([]);
    void refetch();
  }, [refetch]);

  const handleClearLog = useCallback(async () => {
    try {
      await clearQueryLog();
      setOffset(0);
      setLogItems([]);
      await refetch();
      alert("Query log", "Log cleared successfully.");
    } catch (clearError) {
      const message =
        clearError instanceof Error ? clearError.message : String(clearError);
      alert("Query log", message);
    }
  }, [clearQueryLog, refetch]);

  const renderLogItem = useCallback(
    ({ item, index }: { item: AdGuardQueryLogItem; index: number }) => {
      const domain = item.question?.name ?? "Unknown domain";
      const client = item.client ?? "Unknown client";
      const tone = deriveStatusTone(theme, item);
      const reasonLabel = getReasonLabel(item);

      return (
        <AnimatedListItem index={index}>
          <View style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={styles.domainText} numberOfLines={1}>
                {domain}
              </Text>
              <Text style={styles.timestamp}>{formatTimestamp(item.time)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.clientText} numberOfLines={1}>
                {client}
              </Text>
              <Chip
                compact
                style={[
                  styles.statusChip,
                  { backgroundColor: tone.background },
                ]}
                textStyle={{ color: tone.foreground }}
              >
                {reasonLabel}
              </Chip>
            </View>
          </View>
        </AnimatedListItem>
      );
    },
    [
      styles.logCard,
      styles.logHeader,
      styles.domainText,
      styles.timestamp,
      styles.detailRow,
      styles.clientText,
      styles.statusChip,
      theme,
    ],
  );

  const keyExtractor = useCallback(
    (item: AdGuardQueryLogItem) => buildLogKey(item),
    [],
  );

  if (!hasValidServiceId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
        <Appbar.Header mode="small" elevated={false} style={{ padding: 0 }}>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Query Log" titleStyle={styles.headerTitle} />
        </Appbar.Header>
        <View style={[styles.container, styles.emptyState]}>
          <EmptyState
            title="Service not found"
            description="The selected AdGuard Home service could not be found."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <Appbar.Header mode="small" elevated={true} style={{ padding: 0 }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Query Log" titleStyle={styles.headerTitle} />
      </Appbar.Header>
      <View style={styles.container}>
        <View style={styles.controls}>
          <Searchbar
            placeholder="Search domain or client"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            accessibilityLabel="Search query log"
          />
          <SegmentedButtons
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            buttons={[
              { label: "All", value: "all" },
              { label: "Blocked", value: "blocked" },
              { label: "Processed", value: "processed" },
              { label: "Whitelisted", value: "whitelisted" },
            ]}
          />
          <Button
            mode="contained"
            onPress={handleClearLog}
            loading={isClearing}
            disabled={isClearing}
          >
            Clear Query Log
          </Button>
        </View>
        {isLoading ? (
          <View style={styles.skeletonContainer}>
            <SkeletonPlaceholder height={92} borderRadius={18} />
            <SkeletonPlaceholder height={92} borderRadius={18} />
            <SkeletonPlaceholder height={92} borderRadius={18} />
          </View>
        ) : logItems.length === 0 ? (
          <View style={styles.emptyState}>
            <EmptyState
              title="No results"
              description="We couldn't find any log entries matching the current filters."
            />
          </View>
        ) : (
          <FlashList
            data={logItems}
            renderItem={renderLogItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            style={styles.list}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
              />
            }
            ListFooterComponent={
              log && log.items.length === QUERY_LIMIT ? (
                <View style={styles.footerActions}>
                  <Button mode="outlined" onPress={handleLoadMore}>
                    Load More
                  </Button>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default AdGuardQueryLogScreen;
