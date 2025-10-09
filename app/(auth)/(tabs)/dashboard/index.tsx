import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme, IconButton } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";

import { TabHeader } from "@/components/common/TabHeader";
import {
  AnimatedHeader,
  AnimatedListItem,
  AnimatedSection,
} from "@/components/common";

import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import {
  ServiceCard,
  ServiceCardSkeleton,
} from "@/components/service/ServiceCard";
import {
  ListRowSkeleton,
  SkeletonPlaceholder,
} from "@/components/common/Skeleton";
// Unified search has been moved to its own page. Navigate to the search route from the dashboard.
import type { ServiceStatusState } from "@/components/service/ServiceStatus";
import type { ConnectionResult } from "@/connectors/base/IConnector";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { queryKeys } from "@/hooks/queryKeys";
import { useRecentlyAdded } from "@/hooks/useRecentlyAdded";
import type { QBittorrentConnector } from "@/connectors/implementations/QBittorrentConnector";
import { isTorrentActive } from "@/utils/torrent.utils";
import type { AppTheme } from "@/constants/theme";
import type { ServiceConfig, ServiceType } from "@/models/service.types";
import { useAuth } from "@/services/auth/AuthProvider";
import { secureStorage } from "@/services/storage/SecureStorage";
import { spacing } from "@/theme/spacing";
import React from "react";

type ServiceOverviewItem = {
  config: ServiceConfig;
  status: ServiceStatusState;
  statusDescription?: string;
  lastCheckedAt?: Date;
  latency?: number;
  version?: string;
};

type SummaryMetrics = {
  total: number;
  active: number;
  online: number;
  degraded: number;
  offline: number;
  lastUpdated?: Date;
};

type DashboardListItem =
  | { type: "header" }
  | { type: "search" }
  | { type: "services" }
  | { type: "service"; data: ServiceOverviewItem }
  | { type: "activity" }
  | { type: "empty" };

const serviceTypeLabels: Record<ServiceType, string> = {
  sonarr: "Sonarr",
  radarr: "Radarr",
  jellyseerr: "Jellyseerr",
  qbittorrent: "qBittorrent",
  transmission: "Transmission",
  deluge: "Deluge",
  sabnzbd: "SABnzbd",
  nzbget: "NZBGet",
  rtorrent: "rTorrent",
  prowlarr: "Prowlarr",
  bazarr: "Bazarr",
};

const serviceIcons: Partial<Record<ServiceType, string>> = {
  sonarr: "television-classic",
  radarr: "movie-open",
  jellyseerr: "account-search",
  qbittorrent: "download-network",
  prowlarr: "radar",
  bazarr: "subtitles",
};

const deriveStatus = (
  config: ServiceConfig,
  result: ConnectionResult | undefined,
  checkedAt: Date
): Pick<
  ServiceOverviewItem,
  "status" | "statusDescription" | "lastCheckedAt" | "latency" | "version"
> => {
  if (!config.enabled) {
    return {
      status: "offline",
      statusDescription: "Service disabled",
    };
  }

  if (!result) {
    return {
      status: "offline",
      statusDescription: "Status unavailable",
      lastCheckedAt: checkedAt,
    };
  }

  const latency = result.latency ?? undefined;
  const version = result.version ?? undefined;
  const isHighLatency = typeof latency === "number" && latency > 2000;

  const status: ServiceStatusState = result.success
    ? isHighLatency
      ? "degraded"
      : "online"
    : "offline";

  const descriptionParts: string[] = [];
  if (result.message) {
    descriptionParts.push(result.message);
  }
  if (typeof latency === "number") {
    descriptionParts.push(`Latency ${latency}ms`);
  }
  if (version) {
    descriptionParts.push(`Version ${version}`);
  }

  const statusDescription =
    descriptionParts.length > 0 ? descriptionParts.join(" • ") : undefined;

  return {
    status,
    statusDescription,
    lastCheckedAt: checkedAt,
    latency,
    version,
  };
};

const fetchServicesOverview = async (): Promise<ServiceOverviewItem[]> => {
  const manager = ConnectorManager.getInstance();
  await manager.loadSavedServices();

  const configs = await secureStorage.getServiceConfigs();
  if (configs.length === 0) {
    return [];
  }

  const connectionResults = await manager.testAllConnections();
  const checkedAt = new Date();

  return configs.map((config) => {
    const connectionResult = connectionResults.get(config.id);
    const statusFields = deriveStatus(config, connectionResult, checkedAt);

    return {
      config,
      ...statusFields,
    };
  });
};

const formatRelativeTime = (input?: Date): string | undefined => {
  if (!input) {
    return undefined;
  }

  const diffMs = Date.now() - input.getTime();
  if (diffMs < 0) {
    return "Just now";
  }

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

const fetchDownloadsSummary = async (): Promise<{
  active: number;
  total: number;
}> => {
  const manager = ConnectorManager.getInstance();
  await manager.loadSavedServices();
  const connectors = manager.getConnectorsByType(
    "qbittorrent"
  ) as QBittorrentConnector[];

  if (connectors.length === 0) {
    return { active: 0, total: 0 };
  }

  let totalActive = 0;
  let totalTorrents = 0;

  for (const connector of connectors) {
    try {
      const torrents = await connector.getTorrents();
      totalTorrents += torrents.length;
      totalActive += torrents.filter(isTorrentActive).length;
    } catch (error) {
      // Skip this connector if it fails
      console.warn(
        `Failed to fetch torrents from ${connector.config.name}:`,
        error
      );
    }
  }

  return { active: totalActive, total: totalTorrents };
};

const DashboardScreen = () => {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const [menuVisible, setMenuVisible] = useState(false);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.services.overview,
    queryFn: fetchServicesOverview,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: downloadsData, isLoading: isLoadingDownloads } = useQuery({
    queryKey: queryKeys.activity.downloadsOverview,
    queryFn: fetchDownloadsSummary,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const {
    recentlyAdded: recentlyAddedData,
    isLoading: isLoadingRecentlyAdded,
  } = useRecentlyAdded();

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const services = data ?? [];
  const isRefreshing = isFetching && !isLoading;

  const listData: DashboardListItem[] = useMemo(() => {
    const items: DashboardListItem[] = [{ type: "header" }, { type: "search" }];

    if (services.length === 0) {
      items.push({ type: "empty" });
      return items;
    }

    items.push({ type: "services" });

    services.forEach((service) => {
      items.push({ type: "service", data: service });
    });

    items.push({ type: "activity" });

    return items;
  }, [services]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        listContent: {
          paddingBottom: 100, // Increased to account for curved tab bar (60px + 20px center button extension + extra padding)
        },
        section: {
          marginTop: spacing.xs,
        },
        searchWrapper: {
          marginTop: spacing.xxs,
          marginHorizontal: spacing.md,
        },
        shortcutsWrapper: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          marginHorizontal: spacing.md,
        },
        shortcutTile: {
          width: "100%",
          backgroundColor: theme.colors.elevation.level1,
          borderRadius: 12,
          padding: spacing.sm,
          marginBottom: spacing.sm,
        },
        // wrapper around each shortcut to control column width when using Animated wrappers
        shortcutTileWrapper: {
          width: "48%",
        },
        shortcutInner: {
          alignItems: "center",
        },
        shortcutIcon: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.surfaceVariant,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.xs,
        },
        shortcutLabel: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.titleSmall.fontSize,
          fontFamily: theme.custom.typography.titleSmall.fontFamily,
          lineHeight: theme.custom.typography.titleSmall.lineHeight,
          letterSpacing: theme.custom.typography.titleSmall.letterSpacing,
          fontWeight: theme.custom.typography.titleSmall.fontWeight as any,
          textAlign: "center",
        },
        shortcutSubtitle: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodySmall.fontSize,
          fontFamily: theme.custom.typography.bodySmall.fontFamily,
          lineHeight: theme.custom.typography.bodySmall.lineHeight,
          letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
          fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
          textAlign: "center",
          marginTop: spacing.xs,
        },
        sectionTitle: {
          color: theme.colors.onBackground,
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontFamily: theme.custom.typography.titleLarge.fontFamily,
          lineHeight: theme.custom.typography.titleLarge.lineHeight,
          letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
          fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
          marginBottom: spacing.md,
          paddingHorizontal: spacing.md,
        },
        serviceCard: {
          backgroundColor: theme.colors.elevation.level1,
          marginHorizontal: spacing.md,
          marginVertical: spacing.xs,
          borderRadius: 12,
          padding: spacing.md,
        },
        serviceContent: {
          flexDirection: "row",
          alignItems: "center",
        },
        serviceIcon: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.colors.surfaceVariant,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing.md,
        },
        serviceInfo: {
          flex: 1,
        },
        serviceName: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          lineHeight: theme.custom.typography.titleMedium.lineHeight,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
          marginBottom: spacing.xxs,
        },
        serviceStatus: {
          flexDirection: "row",
          alignItems: "center",
        },
        statusIndicator: {
          width: 8,
          height: 8,
          borderRadius: 4,
          marginRight: spacing.xs,
        },
        statusOnline: {
          backgroundColor: theme.colors.primary,
        },
        statusOffline: {
          backgroundColor: theme.colors.error,
        },
        statusDegraded: {
          backgroundColor: theme.colors.tertiary,
        },
        serviceStatusText: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          lineHeight: theme.custom.typography.bodyMedium.lineHeight,
          letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
          fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
        },
        serviceArrow: {
          color: theme.colors.outline,
        },
        activityCard: {
          backgroundColor: theme.colors.elevation.level1,
          marginHorizontal: spacing.md,
          marginVertical: spacing.xs,
          borderRadius: 12,
          padding: spacing.md,
        },
        activityContent: {
          flexDirection: "row",
          alignItems: "center",
        },
        activityIcon: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.colors.surfaceVariant,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing.md,
        },
        activityInfo: {
          flex: 1,
        },
        activityTitle: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          lineHeight: theme.custom.typography.titleMedium.lineHeight,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
          marginBottom: spacing.xxs,
        },
        activitySubtitle: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          lineHeight: theme.custom.typography.bodyMedium.lineHeight,
          letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
          fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
        },
        activityArrow: {
          color: theme.colors.outline,
        },
        listSpacer: {
          height: spacing.sm,
        },
        emptyContainer: {
          flexGrow: 1,
          paddingTop: spacing.xl,
        },
      }),
    [theme]
  );

  const summary = useMemo<SummaryMetrics>(() => {
    if (services.length === 0) {
      return {
        total: 0,
        active: 0,
        online: 0,
        degraded: 0,
        offline: 0,
      };
    }

    const lastUpdated = services.reduce<Date | undefined>((latest, item) => {
      if (!item.lastCheckedAt) {
        return latest;
      }

      if (!latest || item.lastCheckedAt > latest) {
        return item.lastCheckedAt;
      }

      return latest;
    }, undefined);

    const active = services.filter((service) => service.config.enabled).length;
    const online = services.filter(
      (service) => service.status === "online"
    ).length;
    const degraded = services.filter(
      (service) => service.status === "degraded"
    ).length;
    const offline = services.filter(
      (service) => service.status === "offline"
    ).length;

    return {
      total: services.length,
      active,
      online,
      degraded,
      offline,
      lastUpdated,
    };
  }, [services]);

  const handleMenuPress = useCallback(() => {
    setMenuVisible(true);
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      router.replace("/(public)/login");
    } catch (signOutError) {
      const message =
        signOutError instanceof Error
          ? signOutError.message
          : "Unable to sign out. Please try again.";

      Alert.alert("Sign out failed", message);
    }
  }, [router, signOut]);

  const handleAddService = useCallback(() => {
    router.push("/(auth)/add-service");
  }, [router]);

  const handleServicePress = useCallback(
    (service: ServiceOverviewItem) => {
      switch (service.config.type) {
        case "sonarr":
          router.push({
            pathname: "/(auth)/sonarr/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        case "radarr":
          router.push({
            pathname: "/(auth)/radarr/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        case "jellyseerr":
          router.push({
            pathname: "/(auth)/jellyseerr/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        case "qbittorrent":
          router.push({
            pathname: "/(auth)/qbittorrent/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        case "prowlarr":
          router.push({
            pathname: "/(auth)/prowlarr/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        default:
          Alert.alert(
            "Coming soon",
            `${
              serviceTypeLabels[service.config.type]
            } integration is coming soon.`
          );
          break;
      }
    },
    [router]
  );

  const renderHeader = useCallback(
    () => (
      <AnimatedHeader>
        <TabHeader
          rightAction={{
            icon: "plus",
            onPress: handleAddService,
            accessibilityLabel: "Add service",
          }}
        />
      </AnimatedHeader>
    ),
    [handleAddService]
  );

  const handleOpenSearch = useCallback(() => {
    router.push("/(auth)/search");
  }, [router]);

  const handleOpenCalendar = useCallback(() => {
    router.push("/(auth)/calendar");
  }, [router]);

  const ServiceCard = React.memo(({ item }: { item: ServiceOverviewItem }) => {
    const getStatusColor = (status: ServiceStatusState) => {
      switch (status) {
        case "online":
          return styles.statusOnline;
        case "offline":
          return styles.statusOffline;
        case "degraded":
          return styles.statusDegraded;
        default:
          return styles.statusOffline;
      }
    };

    const getStatusIcon = (type: ServiceType) => {
      switch (type) {
        case "sonarr":
          return "television-classic";
        case "radarr":
          return "movie-open";
        case "jellyseerr":
          return "account-search";
        case "qbittorrent":
          return "download-network";
        case "prowlarr":
          return "radar";
        default:
          return "server";
      }
    };

    return (
      <Card
        variant="custom"
        style={styles.serviceCard}
        onPress={() => handleServicePress(item)}
      >
        <View style={styles.serviceContent}>
          <View style={styles.serviceIcon}>
            <IconButton
              icon={getStatusIcon(item.config.type)}
              size={24}
              iconColor={theme.colors.primary}
            />
          </View>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName}>{item.config.name}</Text>
            <View style={styles.serviceStatus}>
              <View
                style={[styles.statusIndicator, getStatusColor(item.status)]}
              />
              <Text style={styles.serviceStatusText}>
                {item.status === "online"
                  ? "Healthy"
                  : item.status === "offline"
                  ? "Offline"
                  : "Degraded"}
              </Text>
            </View>
          </View>
          <IconButton
            icon="chevron-right"
            size={20}
            iconColor={theme.colors.outline}
          />
        </View>
      </Card>
    );
  });

  const ShortcutTile = ({
    label,
    subtitle,
    icon,
    onPress,
    testID,
  }: {
    label: string;
    subtitle?: string;
    icon: string;
    onPress: () => void;
    testID?: string;
  }) => (
    <Card
      variant="custom"
      onPress={onPress}
      style={styles.shortcutTile}
      testID={testID}
    >
      <View style={styles.shortcutInner}>
        <View style={styles.shortcutIcon}>
          <IconButton icon={icon} size={20} iconColor={theme.colors.primary} />
        </View>
        <Text style={styles.shortcutLabel}>{label}</Text>
        {subtitle ? (
          <Text style={styles.shortcutSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </Card>
  );

  const renderServiceItem = useCallback(
    ({ item }: { item: ServiceOverviewItem }) => <ServiceCard item={item} />,
    []
  );

  const renderActivityItem = useCallback(() => {
    const downloadsActive = downloadsData?.active ?? 0;
    const downloadsTotal = downloadsData?.total ?? 0;
    const recentlyAddedTotal = recentlyAddedData?.total ?? 0;

    return (
      <>
        <AnimatedListItem
          style={styles.shortcutTileWrapper}
          index={0}
          totalItems={2}
        >
          <Card
            variant="custom"
            style={styles.activityCard}
            onPress={() => router.push("/(auth)/downloads")}
          >
            <View style={styles.activityContent}>
              <View style={styles.activityIcon}>
                <IconButton
                  icon="download"
                  size={24}
                  iconColor={theme.colors.primary}
                />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>Downloads</Text>
                <Text style={styles.activitySubtitle}>
                  {downloadsActive > 0
                    ? `${downloadsActive} active`
                    : `${downloadsTotal} total`}
                </Text>
              </View>
              <IconButton
                icon="chevron-right"
                size={20}
                iconColor={theme.colors.outline}
              />
            </View>
          </Card>
        </AnimatedListItem>
        <AnimatedListItem
          style={styles.shortcutTileWrapper}
          index={1}
          totalItems={2}
        >
          <Card
            variant="custom"
            style={styles.activityCard}
            onPress={() => router.push("/(auth)/recently-added")}
          >
            <View style={styles.activityContent}>
              <View style={styles.activityIcon}>
                <IconButton
                  icon="plus"
                  size={24}
                  iconColor={theme.colors.primary}
                />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>Recently Added</Text>
                <Text style={styles.activitySubtitle}>
                  {recentlyAddedTotal > 0
                    ? `${recentlyAddedTotal} added`
                    : "No recent activity"}
                </Text>
              </View>
              <IconButton
                icon="chevron-right"
                size={20}
                iconColor={theme.colors.outline}
              />
            </View>
          </Card>
        </AnimatedListItem>
        {/* Release Calendar removed from Activity section per request */}
      </>
    );
  }, [router, styles, downloadsData, recentlyAddedData, theme]);

  const emptyServicesContent = useMemo(() => {
    if (isError) {
      const message =
        error instanceof Error ? error.message : "Unable to load services.";

      return (
        <EmptyState
          title="Unable to load services"
          description={message}
          actionLabel="Retry"
          onActionPress={() => void refetch()}
        />
      );
    }

    return (
      <EmptyState
        title="No services configured"
        description="Connect Sonarr, Radarr, Jellyseerr, qBittorrent, and more to see their status here."
        actionLabel="Add Service"
        onActionPress={handleAddService}
      />
    );
  }, [error, handleAddService, isError, refetch]);

  const renderItem = useCallback(
    ({ item }: { item: DashboardListItem }) => {
      switch (item.type) {
        case "header":
          return renderHeader();
        case "search":
          return (
            <View style={styles.searchWrapper}>
              <AnimatedSection style={styles.shortcutsWrapper} delay={40}>
                <AnimatedListItem
                  style={styles.shortcutTileWrapper}
                  index={0}
                  totalItems={2}
                >
                  <ShortcutTile
                    testID="shortcut-search"
                    label="Unified Search"
                    subtitle="Search across services"
                    icon="magnify"
                    onPress={handleOpenSearch}
                  />
                </AnimatedListItem>
                <AnimatedListItem
                  style={styles.shortcutTileWrapper}
                  index={1}
                  totalItems={2}
                >
                  <ShortcutTile
                    testID="shortcut-calendar"
                    label="Release Calendar"
                    subtitle="Upcoming releases"
                    icon="calendar"
                    onPress={handleOpenCalendar}
                  />
                </AnimatedListItem>
                {/* Keep layout flexible so more shortcuts can be added easily */}
              </AnimatedSection>
            </View>
          );
        case "services":
          return (
            <AnimatedSection style={styles.section}>
              <Text style={styles.sectionTitle}>Services</Text>
            </AnimatedSection>
          );
        case "service": {
          const serviceItem = item.data;
          const serviceIndex = services.findIndex(
            (s) => s.config.id === serviceItem.config.id
          );

          return (
            <AnimatedListItem
              index={serviceIndex >= 0 ? serviceIndex : 0}
              totalItems={Math.max(services.length, 1)}
            >
              <ServiceCard item={serviceItem} />
            </AnimatedListItem>
          );
        }
        case "activity":
          return (
            <AnimatedSection style={styles.section} delay={20}>
              <Text style={styles.sectionTitle}>Activity</Text>
              {renderActivityItem()}
            </AnimatedSection>
          );
        case "empty":
          return (
            <AnimatedSection style={styles.section}>
              {emptyServicesContent}
            </AnimatedSection>
          );
        default:
          return null;
      }
    },
    [
      emptyServicesContent,
      renderActivityItem,
      renderHeader,
      renderServiceItem,
      styles,
    ]
  );

  const keyExtractor = useCallback((item: DashboardListItem) => {
    switch (item.type) {
      case "header":
        return "header";
      case "search":
        return "search";
      case "services":
        return "services";
      case "service":
        return `service-${item.data.config.id}`;
      case "activity":
        return "activity";
      case "empty":
        return "empty";
      default:
        return "unknown";
    }
  }, []);

  const getItemType = useCallback((item: DashboardListItem) => item.type, []);

  if (isLoading && services.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.listContent}>
          <AnimatedHeader>
            <TabHeader
              rightAction={{
                icon: "plus",
                onPress: handleAddService,
                accessibilityLabel: "Add service",
              }}
            />
          </AnimatedHeader>
          <View style={styles.searchWrapper}>
            <AnimatedSection style={styles.shortcutsWrapper} delay={40}>
              <AnimatedListItem index={0} totalItems={2}>
                <ShortcutTile
                  testID="shortcut-search-loading"
                  label="Unified Search"
                  subtitle="Search across services"
                  icon="magnify"
                  onPress={handleOpenSearch}
                />
              </AnimatedListItem>
              <AnimatedListItem index={1} totalItems={2}>
                <ShortcutTile
                  testID="shortcut-calendar-loading"
                  label="Release Calendar"
                  subtitle="Upcoming releases"
                  icon="calendar"
                  onPress={handleOpenCalendar}
                />
              </AnimatedListItem>
            </AnimatedSection>
          </View>
          <View style={styles.section}>
            <SkeletonPlaceholder
              width="40%"
              height={28}
              borderRadius={10}
              style={{ marginBottom: spacing.md, marginHorizontal: spacing.md }}
            />
            {Array.from({ length: 3 }).map((_, index) => (
              <AnimatedListItem key={index} index={index} totalItems={3}>
                <View
                  style={{
                    marginBottom: spacing.sm,
                    marginHorizontal: spacing.md,
                  }}
                >
                  <ServiceCardSkeleton />
                </View>
              </AnimatedListItem>
            ))}
          </View>
          <View style={styles.section}>
            <SkeletonPlaceholder
              width="40%"
              height={28}
              borderRadius={10}
              style={{ marginBottom: spacing.md, marginHorizontal: spacing.md }}
            />
            {Array.from({ length: 3 }).map((_, index) => (
              <AnimatedListItem
                key={`activity-${index}`}
                index={index}
                totalItems={3}
              >
                <View
                  style={{
                    marginBottom: spacing.sm,
                    marginHorizontal: spacing.md,
                  }}
                >
                  <ListRowSkeleton showSecondaryLine={true} />
                </View>
              </AnimatedListItem>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlashList
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.listSpacer} />}
        ListEmptyComponent={
          <AnimatedSection style={styles.emptyContainer}>
            {emptyServicesContent}
          </AnimatedSection>
        }
        refreshControl={
          <ListRefreshControl
            refreshing={isRefreshing}
            onRefresh={() => refetch()}
          />
        }
        showsVerticalScrollIndicator={false}
        getItemType={getItemType}
        removeClippedSubviews={true}
      />
    </SafeAreaView>
  );
};

export default DashboardScreen;
