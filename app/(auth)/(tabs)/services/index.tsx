import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { alert } from "@/services/dialogService";
import {
  IconButton,
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

// Button removed: unused in this file (kept minimal surface area)
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRefreshControl } from "@/components/common/ListRefreshControl";
import { AnimatedListItem } from "@/components/common/AnimatedComponents";
import { ServiceStatus } from "@/components/service/ServiceStatus";
import type { ServiceStatusState } from "@/components/service/ServiceStatus";
import { ServiceCardSkeleton } from "@/components/service/ServiceCard";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import type { ConnectionResult } from "@/connectors/base/IConnector";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { queryKeys } from "@/hooks/queryKeys";
import type { AppTheme } from "@/constants/theme";
import type { ServiceConfig, ServiceType } from "@/models/service.types";
import { logger } from "@/services/logger/LoggerService";
import { secureStorage } from "@/services/storage/SecureStorage";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";

type ServiceOverviewItem = {
  config: ServiceConfig;
  status: ServiceStatusState;
  statusDescription?: string;
  lastCheckedAt?: Date;
  latency?: number;
  version?: string;
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

const deriveStatus = (
  config: ServiceConfig,
  result: ConnectionResult | undefined,
  checkedAt: Date,
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

  const checkedAt = new Date();

  // Test connections with a timeout and staggered approach to avoid blocking UI
  const connectionResults = await Promise.race([
    manager.testAllConnections(),
    new Promise<Map<string, ConnectionResult>>((resolve) => {
      // Timeout after 8 seconds to show partial results
      setTimeout(() => {
        resolve(new Map());
      }, 8000);
    }),
  ]);

  return configs.map((config) => {
    const connectionResult = connectionResults.get(config.id);
    const statusFields = deriveStatus(config, connectionResult, checkedAt);

    return {
      config,
      ...statusFields,
    };
  });
};

const ServicesScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const queryClient = useQueryClient();

  const [serviceMenuVisible, setServiceMenuVisible] = useState(false);
  const [selectedService, setSelectedService] =
    useState<ServiceOverviewItem | null>(null);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.services.overview,
    queryFn: fetchServicesOverview,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const services = data ?? [];
  const isRefreshing = isFetching && !isLoading;

  // We render the tab header outside of the list so it remains fixed.
  const listData: ServiceOverviewItem[] = services;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        content: {
          flex: 1,
          paddingHorizontal: spacing.xxs,
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
          backgroundColor: theme.colors.elevation.level1,
          marginHorizontal: spacing.md,
          marginVertical: spacing.xs,
          borderRadius: borderRadius.xxxl,
          padding: spacing.sm,
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

  const handleServiceMenuPress = useCallback((service: ServiceOverviewItem) => {
    setSelectedService(service);
    setServiceMenuVisible(true);
  }, []);

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
                queryKey: queryKeys.services.overview,
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

  // Header is rendered outside the scrollable area so it does not scroll with content.

  const ServiceCard = React.memo(
    ({ item, index }: { item: ServiceOverviewItem; index: number }) => {
      const displayName =
        serviceDisplayNames[item.config.type] || item.config.name;
      const serviceType = serviceTypeLabels[item.config.type];
      const iconName = serviceIcons[item.config.type];

      return (
        <AnimatedListItem index={index} totalItems={services.length}>
          <Card
            variant="custom"
            style={styles.serviceCard}
            onPress={() => handleServicePress(item)}
          >
            <View style={styles.serviceContent}>
              <View style={styles.serviceIcon}>
                <IconButton
                  icon={iconName}
                  size={24}
                  iconColor={theme.colors.primary}
                />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{displayName}</Text>
                <Text style={styles.serviceType}>{serviceType}</Text>
                <View style={styles.serviceStatus}>
                  <ServiceStatus
                    status={item.status}
                    showLabel={false}
                    size="sm"
                  />
                  <Text
                    style={{
                      color:
                        item.status === "online"
                          ? theme.colors.primary
                          : item.status === "offline"
                            ? theme.colors.error
                            : theme.colors.tertiary,
                      fontSize: 14,
                      marginLeft: 4,
                    }}
                  >
                    {item.status === "online"
                      ? "Connected"
                      : item.status === "offline"
                        ? "Offline"
                        : "Degraded"}
                  </Text>
                </View>
              </View>
              <IconButton
                icon="dots-vertical"
                size={20}
                iconColor={theme.colors.outline}
                onPress={() => handleServiceMenuPress(item)}
              />
            </View>
          </Card>
        </AnimatedListItem>
      );
    },
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ServiceOverviewItem; index: number }) => (
      <ServiceCard item={item} index={index} />
    ),
    [ServiceCard],
  );

  const keyExtractor = useCallback(
    (item: ServiceOverviewItem) => `service-${item.config.id}`,
    [],
  );

  const getItemType = useCallback(() => "service", []);

  const listEmptyComponent = useMemo(() => {
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
        description="Connect Sonarr, Radarr, Jellyseerr, qBittorrent, and more to manage them here."
        actionLabel="Add Service"
        onActionPress={handleAddService}
      />
    );
  }, [error, handleAddService, isError, refetch]);

  if (isLoading && services.length === 0) {
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
          style={{ paddingHorizontal: spacing.xxs }}
        />
        <ScrollView
          style={styles.content}
          contentContainerStyle={{
            paddingVertical: spacing.lg,
            paddingBottom: spacing.xxxxl,
          }}
        >
          <View style={styles.section}>
            <SkeletonPlaceholder
              width="50%"
              height={28}
              borderRadius={10}
              style={{ marginBottom: spacing.md }}
            />
            {Array.from({ length: 4 }).map((_, index) => (
              <View
                key={index}
                style={{
                  marginBottom: spacing.sm,
                  marginHorizontal: spacing.md,
                }}
              >
                <ServiceCardSkeleton />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
      />
      <FlashList
        style={styles.content}
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          services.length === 0 ? { flex: 1 } : undefined,
          { paddingTop: spacing.xs, paddingBottom: spacing.xxxxl },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>{listEmptyComponent}</View>
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
        scrollEventThrottle={16}
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
