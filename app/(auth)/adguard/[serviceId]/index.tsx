import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconButton, Switch, Text, useTheme } from "react-native-paper";

import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { alert } from "@/services/dialogService";
import { logger } from "@/services/logger/LoggerService";
import { useAdGuardHomeDashboard } from "@/hooks/useAdGuardHomeDashboard";

const numberFormatter = new Intl.NumberFormat();

const formatPercentage = (value: number): string => `${value.toFixed(1)}%`;

const AdGuardHomeDashboardScreen = () => {
  const { serviceId: rawServiceId } = useLocalSearchParams<{
    serviceId?: string;
  }>();
  const serviceId = typeof rawServiceId === "string" ? rawServiceId : "";
  const hasValidServiceId = serviceId.length > 0;

  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const {
    overview,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    toggleProtection,
    isTogglingProtection,
    refreshFilters,
    isRefreshingFilters,
    actionsError,
  } = useAdGuardHomeDashboard(serviceId);

  const connector = hasValidServiceId
    ? manager.getConnector(serviceId)
    : undefined;
  const connectorIsAdGuard = connector?.config.type === "adguard";

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
            : "Failed to preload AdGuard connector.";
        void logger.warn("Failed to bootstrap AdGuard connector.", {
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

  useFocusEffect(
    useCallback(() => {
      if (!hasValidServiceId) {
        return;
      }

      void refetch();
    }, [hasValidServiceId, refetch]),
  );

  useEffect(() => {
    if (!error || !isError) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    alert("AdGuard Home", message);
  }, [error, isError]);

  useEffect(() => {
    if (!actionsError) {
      return;
    }

    const message =
      actionsError instanceof Error
        ? actionsError.message
        : String(actionsError);
    alert("Action failed", message);
  }, [actionsError]);

  const isInitialLoad = isBootstrapping || isLoading;
  const isRefreshing = isFetching && !isLoading;

  const protectionEnabled = overview?.status.protection_enabled ?? false;
  const isConnected = overview?.status.running ?? false;
  const statusColor = isConnected
    ? theme.colors.onTertiaryContainer
    : theme.colors.onErrorContainer;

  const handleToggleProtection = useCallback(
    async (value: boolean) => {
      try {
        await toggleProtection(value);
      } catch (toggleError) {
        const message =
          toggleError instanceof Error
            ? toggleError.message
            : "Unable to update protection state.";
        alert("Protection", message);
      }
    },
    [toggleProtection],
  );

  const handleRefreshFilters = useCallback(async () => {
    try {
      await refreshFilters();
      alert("Filters", "Filter lists refresh requested successfully.");
    } catch (refreshError) {
      const message =
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh filters.";
      alert("Filters", message);
    }
  }, [refreshFilters]);

  const handleOpenQueryLog = useCallback(() => {
    if (!hasValidServiceId) {
      return;
    }

    router.push({
      pathname: "/(auth)/adguard/[serviceId]/query-log",
      params: { serviceId },
    });
  }, [hasValidServiceId, router, serviceId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        container: {
          flexGrow: 1,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xl,
          gap: spacing.lg,
        },
        statusCard: {
          borderRadius: 20,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: isConnected
            ? theme.colors.tertiaryContainer
            : theme.colors.errorContainer,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        statusText: {
          color: statusColor,
          fontWeight: "600",
        },
        sectionCard: {
          borderRadius: 20,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          backgroundColor: theme.colors.elevation.level2,
          gap: spacing.sm,
        },
        sectionHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        sectionTitle: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
        },
        sectionDescription: {
          color: theme.colors.onSurfaceVariant,
        },
        statsGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.md,
        },
        statCard: {
          flexBasis: "48%",
          borderRadius: 18,
          backgroundColor: theme.colors.elevation.level1,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
        },
        statLabel: {
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.xs,
        },
        statValue: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.headlineMedium.fontSize,
          fontFamily: theme.custom.typography.headlineMedium.fontFamily,
          fontWeight: theme.custom.typography.headlineMedium.fontWeight as any,
        },
        domainsSection: {
          borderRadius: 20,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          backgroundColor: theme.colors.elevation.level1,
          gap: spacing.md,
        },
        domainsList: {
          gap: spacing.sm,
        },
        domainRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        domainName: {
          color: theme.colors.onSurface,
          flex: 1,
          marginRight: spacing.md,
        },
        domainCount: {
          color: theme.colors.onSurfaceVariant,
          fontVariant: ["tabular-nums"],
        },
        actionsRow: {
          flexDirection: "row",
          gap: spacing.md,
        },
        actionButton: {
          flex: 1,
        },
        skeletonContainer: {
          gap: spacing.lg,
        },
      }),
    [isConnected, statusColor, theme],
  );

  if (!hasValidServiceId || !connectorIsAdGuard) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Service not found"
          description="The selected AdGuard Home service could not be found."
        />
      </SafeAreaView>
    );
  }

  const stats = overview?.stats;
  const topBlockedDomains = stats?.topBlockedDomains ?? [];
  const statItems = stats
    ? [
        {
          label: "DNS Queries",
          value: numberFormatter.format(stats.dnsQueries),
        },
        {
          label: "Ads Blocked",
          value: numberFormatter.format(stats.adsBlocked),
        },
        {
          label: "Trackers Blocked",
          value: numberFormatter.format(stats.trackersBlocked),
        },
        {
          label: "Blocked Percentage",
          value: formatPercentage(stats.blockedPercentage),
        },
      ]
    : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refetch()}
            tintColor={theme.colors.primary}
          />
        }
      >
        {isInitialLoad ? (
          <View style={styles.skeletonContainer}>
            <SkeletonPlaceholder height={72} borderRadius={20} />
            <SkeletonPlaceholder height={140} borderRadius={20} />
            <SkeletonPlaceholder height={200} borderRadius={20} />
            <SkeletonPlaceholder height={160} borderRadius={20} />
          </View>
        ) : (
          <>
            <View style={styles.statusCard}>
              <Text variant="titleMedium" style={styles.statusText}>
                {isConnected
                  ? "Connected to AdGuard Home"
                  : "Disconnected from AdGuard Home"}
              </Text>
              <IconButton
                icon={isConnected ? "check-circle" : "close-circle"}
                iconColor={statusColor}
                size={24}
                disabled
              />
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>AdGuard Protection</Text>
                <Switch
                  value={protectionEnabled}
                  onValueChange={handleToggleProtection}
                  disabled={isTogglingProtection}
                />
              </View>
              <Text style={styles.sectionDescription}>
                Enable or disable AdGuard protection.
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Statistics</Text>
              <View style={styles.statsGrid}>
                {statItems.map((item) => (
                  <View key={item.label} style={styles.statCard}>
                    <Text style={styles.statLabel}>{item.label}</Text>
                    <Text style={styles.statValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.domainsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Top Blocked Domains</Text>
              </View>
              {topBlockedDomains.length > 0 ? (
                <View style={styles.domainsList}>
                  {topBlockedDomains.map((entry) => (
                    <View key={entry.name} style={styles.domainRow}>
                      <Text style={styles.domainName}>{entry.name}</Text>
                      <Text style={styles.domainCount}>
                        {numberFormatter.format(entry.count)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.sectionDescription}>
                  No domains have been blocked recently.
                </Text>
              )}
            </View>

            <View style={styles.actionsRow}>
              <Button
                mode="outlined"
                onPress={handleOpenQueryLog}
                style={styles.actionButton}
              >
                Query Log
              </Button>
              <Button
                mode="contained"
                onPress={handleRefreshFilters}
                style={styles.actionButton}
                loading={isRefreshingFilters}
              >
                Refresh Filters
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AdGuardHomeDashboardScreen;
