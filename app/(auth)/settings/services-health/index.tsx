import { useRef, useCallback, useMemo, useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View, RefreshControl, FlatList } from "react-native";
import { Text, useTheme, Button, FAB } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useServicesHealth } from "@/hooks/useServicesHealth";
import { useAvailableServices } from "@/hooks/useAvailableServices";
import {
  useConnectorsStore,
  selectAllConnectorsArray,
} from "@/store/connectorsStore";
import { secureStorage } from "@/services/storage/SecureStorage";
import type { ServiceConfig } from "@/models/service.types";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { shouldAnimateLayout } from "@/utils/animations.utils";
import { alert } from "@/services/dialogService";
import { logger } from "@/services/logger/LoggerService";

// Components
import { ServiceHealthCard } from "@/components/settings/services-health/ServiceHealthCard";
import { HealthOverviewSection } from "@/components/settings/services-health/HealthOverviewSection";
import { AvailableServiceTile } from "@/components/settings/services-health/AvailableServiceTile";

interface ListItemData {
  type: "header" | "overview" | "service" | "available";
  title?: string;
  data?: any;
}

const ServicesHealthScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const scrollViewRef = useRef<FlatList>(null);

  const { overview, services, isLoading, isError, refetch, isRefreshing } =
    useServicesHealth();

  // Read connectors as an array using selector to avoid Map/Object mismatches
  const connectorsArray = useConnectorsStore(selectAllConnectorsArray);

  // Load persisted configs so we can include disabled/persisted-only entries in the UI
  const [persistedConfigs, setPersistedConfigs] = useState<ServiceConfig[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const configs = await secureStorage.getServiceConfigs();
        if (mounted) setPersistedConfigs(configs);
      } catch (err) {
        logger.warn("ServicesHealthScreen: failed to load persisted configs", {
          error: err instanceof Error ? err.message : String(err),
        });
        // ignore; fall back to active connectors only
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const configuredServices = useMemo(() => {
    const map = new Map<string, ServiceConfig>();
    connectorsArray.forEach((c) => map.set(c.config.id, c.config));
    persistedConfigs.forEach((pc) => {
      if (!map.has(pc.id)) map.set(pc.id, pc);
    });
    return Array.from(map.values());
  }, [connectorsArray, persistedConfigs]);

  const { unconfiguredServices } = useAvailableServices(configuredServices);

  const animationsEnabled = shouldAnimateLayout(isLoading, false);

  const listData = useMemo((): ListItemData[] => {
    const result: ListItemData[] = [];

    // Always add overview section
    result.push({
      type: "header",
      title: "Health Overview",
    });
    result.push({
      type: "overview",
      data: { overview, isLoading, isError, refetch },
    });

    // Add Active / Inactive sections
    const activeServices = services.filter((s) => s.config.enabled);
    const inactiveServices = services.filter((s) => !s.config.enabled);

    if (activeServices.length > 0) {
      result.push({ type: "header", title: "Active Services" });
      activeServices.forEach((service) => {
        result.push({ type: "service", data: service });
      });
    }

    if (inactiveServices.length > 0) {
      result.push({ type: "header", title: "Inactive" });
      inactiveServices.forEach((service) => {
        result.push({ type: "service", data: service });
      });
    }

    // Add available services section
    if (unconfiguredServices.length > 0) {
      result.push({
        type: "header",
        title: "Available Services",
      });
      unconfiguredServices.forEach((service) => {
        result.push({
          type: "available",
          data: service,
        });
      });
    }

    return result;
  }, [overview, isLoading, isError, refetch, services, unconfiguredServices]);

  const handleRefreshAll = useCallback(() => {
    logger.info("ServicesHealthScreen: Manual refresh triggered");
    refetch();
  }, [refetch]);

  const handleTestConnection = useCallback(async (serviceId: string) => {
    const manager = ConnectorManager.getInstance();
    try {
      const connector = manager.getConnector(serviceId);
      if (!connector) {
        throw new Error(`Service connector not found: ${serviceId}`);
      }

      const result = await connector.testConnection();
      if (result.success) {
        alert(
          "Connection Test",
          "Service connection test completed successfully",
        );
      } else {
        alert("Connection Test Failed", result.message || "Unknown error");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert("Connection Test Failed", message);
    }
  }, []);

  const handleEditService = useCallback(
    (serviceId: string) => {
      router.push(`/edit-service?serviceId=${serviceId}`);
    },
    [router],
  );

  const handleAddService = useCallback(
    (serviceType: string) => {
      router.push(`/add-service?serviceType=${serviceType}`);
    },
    [router],
  );

  const handleManageServices = useCallback(() => {
    router.push("/(auth)/(tabs)/services");
  }, [router]);
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: spacing.xs,
      paddingBottom: spacing.xxxxl, // Extra padding for FAB
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
    },
    sectionTitle: {
      color: theme.colors.onBackground,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
      letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
    },
    manageButton: {
      marginLeft: spacing.sm,
    },
    fab: {
      position: "absolute",
      margin: spacing.md,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.primaryContainer,
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
    },
    emptyStateText: {
      marginTop: spacing.md,
      textAlign: "center",
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      lineHeight: theme.custom.typography.bodyMedium.lineHeight,
    },
    emptyStateTitle: {
      fontSize: theme.custom.typography.headlineSmall.fontSize,
      fontFamily: theme.custom.typography.headlineSmall.fontFamily,
      lineHeight: theme.custom.typography.headlineSmall.lineHeight,
      fontWeight: theme.custom.typography.headlineSmall.fontWeight as any,
      color: theme.colors.onSurface,
      marginBottom: spacing.sm,
    },
  });

  const renderHeader = useCallback(
    (title: string, showManageButton: boolean = false) => {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {showManageButton && (
            <Button
              mode="text"
              onPress={handleManageServices}
              compact
              style={styles.manageButton}
            >
              Manage All
            </Button>
          )}
        </View>
      );
    },
    [
      handleManageServices,
      styles.manageButton,
      styles.sectionHeader,
      styles.sectionTitle,
    ],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ListItemData; index: number }) => {
      switch (item.type) {
        case "header":
          return renderHeader(
            item.title || "",
            item.title === "Active Services",
          );
        case "overview":
          const { overview, isLoading, isError, refetch } = item.data;
          return (
            <HealthOverviewSection
              overview={overview}
              isLoading={isLoading}
              isError={isError}
              onRefresh={refetch}
            />
          );
        case "service":
          return (
            <ServiceHealthCard
              key={item.data.serviceId}
              service={item.data}
              index={services.findIndex(
                (s) => s.serviceId === item.data.serviceId,
              )}
              animated={animationsEnabled}
              onTestConnection={() => handleTestConnection(item.data.serviceId)}
              onEditService={() => handleEditService(item.data.serviceId)}
              totalItems={services.length}
            />
          );
        case "available":
          return (
            <AvailableServiceTile
              key={item.data.type}
              service={item.data}
              index={unconfiguredServices.findIndex(
                (s) => s.type === item.data.type,
              )}
              animated={animationsEnabled}
              onAddService={() => handleAddService(item.data.type)}
              totalItems={unconfiguredServices.length}
            />
          );
        default:
          return null;
      }
    },
    [
      renderHeader,
      handleTestConnection,
      handleEditService,
      handleAddService,
      services,
      unconfiguredServices,
      animationsEnabled,
    ],
  );

  const keyExtractor = useCallback((item: ListItemData, index: number) => {
    if (item.type === "header") {
      return `header-${item.title}`;
    }
    if (item.type === "overview") {
      return "overview";
    }
    if (item.type === "service") {
      return `service-${item.data.serviceId}`;
    }
    if (item.type === "available") {
      return `available-${item.data.type}`;
    }
    return `item-${index}`;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={scrollViewRef}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.contentContainer}
        // Provide a small vertical gap between list items
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefreshAll}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No Services Configured</Text>
            <Text style={styles.emptyStateText}>
              Add your first service to start monitoring its health and status.
            </Text>
            <Button
              mode="contained-tonal"
              onPress={() => router.push("/add-service")}
              style={{ marginTop: spacing.lg }}
            >
              Add Your First Service
            </Button>
          </View>
        }
      />

      {/* Floating Action Button */}
      {unconfiguredServices.length > 0 && (
        <FAB
          icon="plus"
          style={styles.fab}
          label="Add Service"
          onPress={() => router.push("/add-service")}
          accessibilityLabel="Add new service"
        />
      )}
    </SafeAreaView>
  );
};

export default ServicesHealthScreen;
