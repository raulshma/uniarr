import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { alert } from "@/services/dialogService";
import {
  Text,
  useTheme,
  Portal,
  Modal,
  List,
  Divider,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";

import { TabHeader } from "@/components/common/TabHeader";

// Card is not needed here because we use the shared ServiceCard component
import { EmptyState } from "@/components/common/EmptyState";
import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import {
  AnimatedListItem,
  AnimatedSection,
} from "@/components/common/AnimatedComponents";
import type { ServiceStatusState } from "@/components/service/ServiceStatus";
import { ServiceCardSkeleton } from "@/components/service/ServiceCard";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import ServiceCard from "@/components/service/ServiceCard/ServiceCard";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { queryKeys } from "@/hooks/queryKeys";
import type { AppTheme } from "@/constants/theme";
import type { ServiceConfig, ServiceType } from "@/models/service.types";
import { logger } from "@/services/logger/LoggerService";
import { secureStorage } from "@/services/storage/SecureStorage";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import { getHomarrIconUrl, getHomarrIconUrls } from "@/utils/homarrIcons.utils";
import { imageCacheService } from "@/services/image/ImageCacheService";
import { useServiceHealth } from "@/hooks/useServiceHealth";

// Custom hook for async icon loading
const useServiceIcon = (serviceType: ServiceType, isDarkTheme: boolean) => {
  const [icon, setIcon] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadIcon = async () => {
      try {
        setLoading(true);
        const url = await getHomarrIconUrl(serviceType, isDarkTheme);
        setIcon(url);
      } catch (error) {
        console.warn(`Failed to load icon for ${serviceType}:`, error);
        setIcon(null);
      } finally {
        setLoading(false);
      }
    };

    void loadIcon();
  }, [serviceType, isDarkTheme]);

  return { icon, loading };
};

type ServiceOverviewItem = {
  config: ServiceConfig;
  status: ServiceStatusState;
  statusDescription?: string;
  lastCheckedAt?: Date;
  latency?: number;
  version?: string;
};

// serviceTypeLabels intentionally omitted here — defined where needed (add-service/edit-service)

const serviceDisplayNames: Record<ServiceType, string> = {
  sonarr: "TV Shows",
  radarr: "Movie Library",
  lidarr: "Music Library",
  jellyseerr: "Request Service",
  jellyfin: "Media Server",
  qbittorrent: "Torrent Client",
  transmission: "Torrent Client",
  deluge: "Torrent Client",
  sabnzbd: "Usenet Client",
  nzbget: "Usenet Client",
  rtorrent: "Torrent Client",
  prowlarr: "Indexer",
  bazarr: "Subtitle Manager",
  adguard: "DNS Protection",
};

const serviceTypeLabels: Record<ServiceType, string> = {
  sonarr: "Sonarr",
  radarr: "Radarr",
  lidarr: "Lidarr",
  jellyseerr: "Jellyseerr",
  jellyfin: "Jellyfin",
  qbittorrent: "qBittorrent",
  transmission: "Transmission",
  deluge: "Deluge",
  sabnzbd: "SABnzbd",
  nzbget: "NZBGet",
  rtorrent: "rTorrent",
  prowlarr: "Prowlarr",
  bazarr: "Bazarr",
  adguard: "AdGuard Home",
};

const serviceIcons: Record<ServiceType, string> = {
  sonarr: "television-classic",
  radarr: "movie-open",
  lidarr: "music-note",
  jellyseerr: "account-search",
  jellyfin: "play-circle",
  qbittorrent: "download-network",
  transmission: "download-network",
  deluge: "download-network",
  sabnzbd: "download-network",
  nzbget: "download-network",
  rtorrent: "download-network",
  prowlarr: "radar",
  bazarr: "subtitles",
  adguard: "shield-check",
};

const fetchServiceConfigs = async (): Promise<ServiceConfig[]> => {
  const configs = await secureStorage.getServiceConfigs();
  return configs;
};

// Component that collects health data from all services for overview metrics
// Handles up to 10 services with individual queries (covers most realistic use cases)
const ServiceOverviewMetrics = React.memo(
  ({
    serviceConfigs,
    children,
  }: {
    serviceConfigs: ServiceConfig[];
    children: (metrics: {
      overviewMetrics: { label: string; value: number }[];
      averageLatency: string;
      isAnyServiceLoading: boolean;
    }) => React.ReactNode;
  }) => {
    // Support up to 10 services with individual queries
    const [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10] = serviceConfigs;
    const h1 = useServiceHealth(s1?.id ?? "");
    const h2 = useServiceHealth(s2?.id ?? "");
    const h3 = useServiceHealth(s3?.id ?? "");
    const h4 = useServiceHealth(s4?.id ?? "");
    const h5 = useServiceHealth(s5?.id ?? "");
    const h6 = useServiceHealth(s6?.id ?? "");
    const h7 = useServiceHealth(s7?.id ?? "");
    const h8 = useServiceHealth(s8?.id ?? "");
    const h9 = useServiceHealth(s9?.id ?? "");
    const h10 = useServiceHealth(s10?.id ?? "");

    const healthQueries = [h1, h2, h3, h4, h5, h6, h7, h8, h9, h10].filter(
      (_, index) => serviceConfigs[index] !== undefined,
    );

    const metrics = useMemo(() => {
      const overviewMetrics = [
        { label: "Configured", value: serviceConfigs.length },
        {
          label: "Online",
          value: healthQueries.filter(
            (query) => query.data?.status === "online",
          ).length,
        },
        {
          label: "Degraded",
          value: healthQueries.filter(
            (query) => query.data?.status === "degraded",
          ).length,
        },
        {
          label: "Offline",
          value: healthQueries.filter(
            (query) => query.data?.status === "offline",
          ).length,
        },
      ];

      const latencies = healthQueries
        .map((query) => query.data?.latency)
        .filter((latency): latency is number => typeof latency === "number");

      const averageLatency =
        latencies.length === 0
          ? "—"
          : `${Math.round(
              latencies.reduce((acc, latency) => acc + latency, 0) /
                latencies.length,
            )} ms`;

      const isAnyServiceLoading = healthQueries.some(
        (query) => query.isLoading,
      );

      return { overviewMetrics, averageLatency, isAnyServiceLoading };
    }, [serviceConfigs.length, healthQueries]);

    return <>{children(metrics)}</>;
  },
);

const ServiceOverviewHeader = React.memo(
  ({
    serviceConfigs,
    animationsEnabled,
    styles,
  }: {
    serviceConfigs: ServiceConfig[];
    animationsEnabled: boolean;
    styles: ReturnType<typeof StyleSheet.create>;
  }) => {
    return (
      <ServiceOverviewMetrics serviceConfigs={serviceConfigs}>
        {({ overviewMetrics, averageLatency, isAnyServiceLoading }) => (
          <AnimatedSection
            animated={animationsEnabled && !isAnyServiceLoading}
            style={styles.summarySection}
            delay={50}
          >
            <Text style={styles.summaryTitle}>Service overview</Text>
            <View style={styles.summaryGrid}>
              {overviewMetrics.map((metric, index) => (
                <AnimatedListItem
                  key={metric.label}
                  animated={animationsEnabled && !isAnyServiceLoading}
                  index={index}
                  totalItems={overviewMetrics.length + 1}
                  style={styles.summaryCard}
                >
                  <Text style={styles.summaryValue}>{metric.value}</Text>
                  <Text style={styles.summaryLabel}>{metric.label}</Text>
                </AnimatedListItem>
              ))}
            </View>
            <AnimatedListItem
              animated={animationsEnabled && !isAnyServiceLoading}
              index={overviewMetrics.length}
              totalItems={overviewMetrics.length + 1}
              style={styles.latencyChip}
            >
              <Text style={styles.latencyLabel}>Average latency</Text>
              <Text style={styles.latencyValue}>{averageLatency}</Text>
            </AnimatedListItem>
          </AnimatedSection>
        )}
      </ServiceOverviewMetrics>
    );
  },
);

// Individual service row component that uses its own health query
const ServiceRowWithHealth = React.memo(
  ({
    config,
    index,
    animationsEnabled,
    totalServices,
    isDarkTheme,
    serviceDisplayNames,
    serviceTypeLabels,
    serviceIcons,
    styles,
    handleServicePress,
    setSelectedService,
    handleEditService,
    handleDeleteService,
  }: {
    config: ServiceConfig;
    index: number;
    animationsEnabled: boolean;
    totalServices: number;
    isDarkTheme: boolean;
    serviceDisplayNames: Record<ServiceType, string>;
    serviceTypeLabels: Record<ServiceType, string>;
    serviceIcons: Record<ServiceType, string>;
    styles: ReturnType<typeof StyleSheet.create>;
    handleServicePress: (service: ServiceOverviewItem) => void;
    setSelectedService: (service: ServiceOverviewItem | null) => void;
    handleEditService: () => void;
    handleDeleteService: () => void;
  }) => {
    const { data: healthData } = useServiceHealth(config.id);
    const { icon: homarrUrl } = useServiceIcon(config.type, isDarkTheme);

    const serviceItem: ServiceOverviewItem = useMemo(
      () => ({
        config,
        status: healthData?.status || "offline",
        statusDescription: healthData?.statusDescription,
        lastCheckedAt: healthData?.lastCheckedAt,
        latency: healthData?.latency,
        version: healthData?.version,
      }),
      [config, healthData],
    );

    const displayName = serviceDisplayNames[config.type] || config.name;
    const icon = homarrUrl ? { uri: homarrUrl } : serviceIcons[config.type];
    const serviceTypeLabel = serviceTypeLabels[config.type];

    return (
      <AnimatedListItem
        animated={animationsEnabled}
        index={index}
        totalItems={totalServices}
      >
        <ServiceCard
          key={config.id}
          id={config.id}
          name={displayName}
          url={config.url}
          description={serviceTypeLabel}
          status={serviceItem.status}
          statusDescription={serviceItem.statusDescription}
          latency={serviceItem.latency}
          version={serviceItem.version}
          lastCheckedAt={serviceItem.lastCheckedAt}
          icon={icon}
          onPress={() => handleServicePress(serviceItem)}
          onEditPress={() => {
            setSelectedService(serviceItem);
            handleEditService();
          }}
          onDeletePress={() => {
            setSelectedService(serviceItem);
            handleDeleteService();
          }}
          style={styles.serviceCard}
        />
      </AnimatedListItem>
    );
  },
);

const ServicesScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const queryClient = useQueryClient();

  const [serviceMenuVisible, setServiceMenuVisible] = useState(false);
  const [selectedService, setSelectedService] =
    useState<ServiceOverviewItem | null>(null);

  const isDarkTheme = theme.dark;

  // Prefetch Homarr icons once on component mount, not on every refresh
  useEffect(() => {
    const prefetchIcons = async () => {
      try {
        const configs = await secureStorage.getServiceConfigs();
        if (configs.length > 0) {
          const serviceTypes = [...new Set(configs.map((c) => c.type))];
          const iconUrls = await getHomarrIconUrls(serviceTypes, isDarkTheme);
          await imageCacheService.prefetch(iconUrls);
        }
      } catch (error) {
        logger.error("Failed to prefetch service icons", {
          location: "ServicesScreen.prefetchIcons",
          error,
        });
      }
    };

    void prefetchIcons();
  }, [isDarkTheme]);

  // Get service configs (static data, only changes when services are added/removed)
  const {
    data: configs = [],
    isLoading: isLoadingConfigs,
    error: configsError,
  } = useQuery({
    queryKey: queryKeys.services.base,
    queryFn: fetchServiceConfigs,
    staleTime: 5 * 60 * 1000, // 5 minutes - configs don't change often
  });

  const showSkeleton = isLoadingConfigs && configs.length === 0;
  const isError = configsError;
  const hasAnyServices = configs.length > 0;
  const animationsEnabled = !showSkeleton;

  const refreshControl = useMemo(() => {
    if (showSkeleton) {
      return undefined;
    }

    return (
      <ListRefreshControl
        refreshing={false} // Will be handled by individual components
        onRefresh={() => {
          // Refresh all service health queries
          configs.forEach((config) => {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.services.health(config.id),
            });
          });
        }}
      />
    );
  }, [showSkeleton, configs, queryClient]);

  // We render the tab header outside of the list so it remains fixed.

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
        },
        content: {
          flex: 1,
          paddingHorizontal: spacing.xxs,
        },
        summarySection: {
          paddingHorizontal: spacing.md,
          marginTop: spacing.md,
          gap: spacing.sm,
        },
        summaryTitle: {
          color: theme.colors.onSurface,
          fontSize: 18,
          fontWeight: "600",
        },
        summaryGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: spacing.sm,
        },
        summaryCard: {
          width: "48%",
          backgroundColor: theme.colors.surface,
          borderRadius: spacing.lg,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
        },
        summaryValue: {
          color: theme.colors.onSurface,
          fontSize: 20,
          fontWeight: "700",
        },
        summaryLabel: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 12,
          marginTop: spacing.xs,
        },
        latencyChip: {
          backgroundColor: theme.colors.surface,
          borderRadius: borderRadius.lg,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        latencyLabel: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 12,
          marginBottom: spacing.xs,
        },
        latencyValue: {
          color: theme.colors.primary,
          fontSize: 14,
          fontWeight: "600",
        },
        section: {
          marginTop: spacing.lg,
        },
        sectionTitle: {
          color: theme.colors.onBackground,
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontFamily: theme.custom.typography.titleLarge.fontFamily,
          lineHeight: theme.custom.typography.titleLarge.lineHeight,
          letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
          fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
          marginBottom: spacing.md,
        },
        serviceCard: {
          backgroundColor: theme.colors.surface,
          marginHorizontal: spacing.md,
          marginVertical: spacing.xs,
          borderRadius: borderRadius.xxxl,
          padding: spacing.xs,
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
        serviceType: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          lineHeight: theme.custom.typography.bodyMedium.lineHeight,
          letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
          fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
          marginBottom: spacing.xs,
        },
        serviceStatus: {
          flexDirection: "row",
          alignItems: "center",
        },
        serviceMenu: {
          color: theme.colors.outline,
        },
        listSpacer: {
          height: spacing.sm,
        },
        emptyContainer: {
          flexGrow: 1,
          paddingTop: spacing.xl,
        },
        skeletonContainer: {
          paddingVertical: spacing.lg,
          paddingBottom: spacing.xxxxl,
          gap: spacing.md,
        },
        skeletonHeader: {
          marginHorizontal: spacing.md,
        },
        skeletonCard: {
          marginBottom: spacing.sm,
          marginHorizontal: spacing.md,
        },
      }),
    [theme],
  );

  const handleBackPress = useCallback(() => {
    router.back();
  }, [router]);

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
        case "lidarr":
          router.push({
            pathname: "/(auth)/lidarr/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        case "jellyseerr":
          router.push({
            pathname: "/(auth)/jellyseerr/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        case "jellyfin":
          router.push({
            pathname: "/(auth)/jellyfin/[serviceId]",
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
        case "adguard":
          router.push({
            pathname: "/(auth)/adguard/[serviceId]",
            params: { serviceId: service.config.id },
          });
          break;
        default:
          // For now, just show a message for unsupported services
          break;
      }
    },
    [router],
  );

  // service menu is opened via card edit/delete callbacks; keep modal below for confirmation

  const handleEditService = useCallback(() => {
    if (!selectedService) return;

    setServiceMenuVisible(false);
    router.push({
      pathname: "/(auth)/edit-service",
      params: { serviceId: selectedService.config.id },
    });
  }, [selectedService, router]);

  const handleDeleteService = useCallback(async () => {
    if (!selectedService) return;

    setServiceMenuVisible(false);

    alert(
      "Delete Service",
      `Are you sure you want to delete "${selectedService.config.name}"? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const manager = ConnectorManager.getInstance();
              await manager.removeConnector(selectedService.config.id);

              await queryClient.invalidateQueries({
                queryKey: queryKeys.services.base,
              });

              alert(
                "Service Deleted",
                `${selectedService.config.name} has been removed.`,
              );
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Failed to delete service.";
              alert("Error", message);

              void logger.error("Failed to delete service.", {
                location: "ServicesScreen.handleDeleteService",
                serviceId: selectedService.config.id,
                serviceType: selectedService.config.type,
                message,
              });
            }
          },
        },
      ],
    );
  }, [selectedService, queryClient]);

  const renderItem = useCallback(
    ({ item, index }: { item: ServiceConfig; index: number }) => (
      <ServiceRowWithHealth
        config={item}
        index={index}
        animationsEnabled={animationsEnabled}
        totalServices={configs.length}
        isDarkTheme={isDarkTheme}
        serviceDisplayNames={serviceDisplayNames}
        serviceTypeLabels={serviceTypeLabels}
        serviceIcons={serviceIcons}
        styles={styles}
        handleServicePress={handleServicePress}
        setSelectedService={setSelectedService}
        handleEditService={handleEditService}
        handleDeleteService={handleDeleteService}
      />
    ),
    [
      animationsEnabled,
      configs.length,
      isDarkTheme,
      styles,
      handleServicePress,
      setSelectedService,
      handleEditService,
      handleDeleteService,
    ],
  );

  const keyExtractor = useCallback(
    (item: ServiceConfig) => `service-${item.id}`,
    [],
  );

  const getItemType = useCallback(() => "service", []);

  const listEmptyComponent = useMemo(() => {
    if (isError) {
      const message =
        configsError instanceof Error
          ? configsError.message
          : "Unable to load services.";

      return (
        <EmptyState
          title="Unable to load services"
          description={message}
          actionLabel="Retry"
          onActionPress={() => {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.services.base,
            });
          }}
        />
      );
    }

    return (
      <EmptyState
        title="No services configured"
        description="Connect Sonarr, Radarr, Jellyseerr, qBittorrent, and more to manage them here."
        actionLabel="Add Service"
        onActionPress={handleAddService}
      />
    );
  }, [configsError, handleAddService, isError, queryClient]);

  return (
    <SafeAreaView style={styles.container}>
      <TabHeader
        showBackButton={true}
        onBackPress={handleBackPress}
        rightAction={{
          icon: "plus",
          onPress: handleAddService,
          accessibilityLabel: "Add service",
        }}
        style={{ paddingHorizontal: spacing.md }}
        animated={!showSkeleton}
      />
      <FlashList
        style={styles.content}
        data={configs}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          configs.length === 0 ? { flex: 1 } : undefined,
          { paddingTop: spacing.xs, paddingBottom: spacing.xxxxl },
        ]}
        ListHeaderComponent={
          !showSkeleton && hasAnyServices ? (
            <ServiceOverviewHeader
              serviceConfigs={configs}
              animationsEnabled={animationsEnabled}
              styles={styles}
            />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {showSkeleton ? (
              <View style={styles.skeletonContainer}>
                <View style={styles.skeletonHeader}>
                  <SkeletonPlaceholder
                    width="50%"
                    height={28}
                    borderRadius={10}
                  />
                </View>
                {Array.from({ length: 4 }).map((_, index) => (
                  <View key={index} style={styles.skeletonCard}>
                    <ServiceCardSkeleton />
                  </View>
                ))}
              </View>
            ) : (
              listEmptyComponent
            )}
          </View>
        }
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        getItemType={getItemType}
        removeClippedSubviews={true}
        scrollEventThrottle={16}
        estimatedItemSize={140}
      />

      <Portal>
        <Modal
          visible={serviceMenuVisible}
          onDismiss={() => setServiceMenuVisible(false)}
          contentContainerStyle={{
            backgroundColor: theme.colors.surface,
            marginHorizontal: spacing.lg,
            borderRadius: 12,
          }}
        >
          <View>
            <List.Item
              title="Edit Service"
              left={(props) => <List.Icon {...props} icon="pencil" />}
              onPress={handleEditService}
            />
            <Divider />
            <List.Item
              title="Delete Service"
              titleStyle={{ color: theme.colors.error }}
              left={(props) => (
                <List.Icon
                  {...props}
                  icon="delete"
                  color={theme.colors.error}
                />
              )}
              onPress={handleDeleteService}
            />
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

export default ServicesScreen;
