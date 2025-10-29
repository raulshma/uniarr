import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { Text, IconButton, useTheme, Badge } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useHaptics } from "@/hooks/useHaptics";
import type { AppTheme } from "@/constants/theme";
import { Card } from "@/components/common";
import WidgetHeader from "@/components/widgets/common/WidgetHeader";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { borderRadius, iconSizes, touchSizes } from "@/constants/sizes";
import { spacing as themeSpacing } from "@/theme/spacing";
import type { Widget } from "@/services/widgets/WidgetService";
import { useSettingsStore } from "@/store/settingsStore";

export interface ServiceStatusWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

interface ServiceStatus {
  id: string;
  name: string;
  type: string;
  status: "online" | "offline" | "error";
  lastChecked: Date;
  message?: string;
  stats?: {
    movies?: number;
    series?: number;
    episodes?: number;
    downloads?: number;
  };
}

const ServiceStatusWidget: React.FC<ServiceStatusWidgetProps> = ({
  widget,
  onRefresh,
  onEdit,
}) => {
  const theme = useTheme<AppTheme>();
  const { spacing } = useResponsiveLayout();
  const { onPress } = useHaptics();
  const frostedEnabled = useSettingsStore((s) => s.frostedWidgetsEnabled);
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadServiceStatuses = useCallback(async () => {
    try {
      const connectors = ConnectorManager.getInstance().getAllConnectors();
      const statuses: ServiceStatus[] = [];

      for (const connector of connectors) {
        if (!connector.config.enabled) continue;

        const status = await checkServiceStatus(connector.config.id);
        statuses.push(status);
      }

      setServiceStatuses(statuses);
    } catch (error) {
      console.error("Failed to load service statuses:", error);
    }
  }, []);

  useEffect(() => {
    loadServiceStatuses();
  }, [loadServiceStatuses]);

  const checkServiceStatus = async (
    serviceId: string,
  ): Promise<ServiceStatus> => {
    const connector = ConnectorManager.getInstance().getConnector(serviceId);
    if (!connector) {
      throw new Error(`Connector not found for service ${serviceId}`);
    }

    try {
      // Check if connector is responsive
      const startTime = Date.now();
      await connector.getVersion();
      const responseTime = Date.now() - startTime;

      return {
        id: serviceId,
        name: connector.config.name,
        type: connector.config.type,
        status: "online",
        lastChecked: new Date(),
        message: `Connected (${responseTime}ms)`,
      };
    } catch {
      return {
        id: serviceId,
        name: connector.config.name,
        type: connector.config.type,
        status: "offline",
        lastChecked: new Date(),
        message: "Connection failed",
      };
    }
  };

  const handleRefresh = async () => {
    onPress();
    setRefreshing(true);
    await loadServiceStatuses();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return theme.colors.primary;
      case "offline":
        return theme.colors.error;
      case "error":
        return theme.colors.error;
      default:
        return theme.colors.onSurfaceVariant;
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case "sonarr":
        return "television";
      case "radarr":
        return "movie";
      case "lidarr":
        return "music-note";
      case "jellyfin":
        return "play-circle";
      case "qbittorrent":
        return "download";
      case "transmission":
        return "download";
      case "deluge":
        return "download";
      case "sabnzbd":
        return "download";
      case "prowlarr":
        return "magnify";
      case "bazarr":
        return "subtitles";
      case "adguard":
        return "shield";
      default:
        return "server";
    }
  };

  const renderServiceCard = (service: ServiceStatus) => (
    <Card
      key={service.id}
      style={styles.serviceCard}
      variant={frostedEnabled ? "frosted" : "custom"}
    >
      <View style={styles.serviceCardContent}>
        <View style={styles.serviceHeader}>
          <View style={styles.serviceInfo}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${getStatusColor(service.status)}20` },
              ]}
            >
              <MaterialCommunityIcons
                name={getServiceIcon(service.type)}
                size={iconSizes.lg} // 24
                color={getStatusColor(service.status)}
              />
            </View>
            <View style={styles.serviceDetails}>
              <Text variant="titleMedium" style={styles.serviceName}>
                {service.name}
              </Text>
              <Text variant="bodySmall" style={styles.serviceType}>
                {service.type.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.statusContainer}>
            <Badge
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(service.status) },
              ]}
            >
              {service.status.toUpperCase()}
            </Badge>
          </View>
        </View>

        {service.message && (
          <Text variant="bodySmall" style={styles.statusMessage}>
            {service.message}
          </Text>
        )}

        <View style={styles.serviceFooter}>
          <Text variant="labelSmall" style={styles.lastChecked}>
            Last checked: {service.lastChecked.toLocaleTimeString()}
          </Text>
          <IconButton
            icon="refresh"
            size={16}
            onPress={() =>
              checkServiceStatus(service.id).then((updatedStatus) => {
                setServiceStatuses((prev) =>
                  prev.map((s) => (s.id === service.id ? updatedStatus : s)),
                );
              })
            }
          />
        </View>
      </View>
    </Card>
  );

  return (
    <Card
      style={[styles.container, { padding: spacing.medium }]}
      variant={frostedEnabled ? "frosted" : "custom"}
    >
      <WidgetHeader
        title={widget.title}
        onEdit={onEdit}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {serviceStatuses.length > 0 ? (
          serviceStatuses.map(renderServiceCard)
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="server-off"
              size={48}
              color={theme.colors.onSurfaceVariant}
            />
            <Text variant="bodyMedium" style={styles.emptyText}>
              No services configured
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              Add services to see their status here
            </Text>
          </View>
        )}
      </ScrollView>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  serviceCard: {
    marginBottom: themeSpacing.sm,
  },
  serviceCardContent: {
    padding: themeSpacing.sm,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: themeSpacing.sm,
  },
  serviceInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: touchSizes.lg - 8, // 40 = 48 - 8
    height: touchSizes.lg - 8,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    marginRight: themeSpacing.sm,
  },
  serviceDetails: {
    flex: 1,
  },
  serviceName: {
    fontWeight: "600",
  },
  serviceType: {
    opacity: 0.7,
    textTransform: "uppercase",
  },
  statusContainer: {
    alignItems: "flex-end",
  },
  statusBadge: {
    paddingHorizontal: themeSpacing.sm,
    paddingVertical: themeSpacing.xs,
  },
  statusMessage: {
    fontStyle: "italic",
    marginBottom: themeSpacing.sm,
    opacity: 0.8,
  },
  serviceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastChecked: {
    opacity: 0.6,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: themeSpacing.xl,
  },
  emptyText: {
    marginTop: themeSpacing.sm,
    fontWeight: "500",
  },
  emptySubtext: {
    marginTop: themeSpacing.xs,
    opacity: 0.7,
    textAlign: "center",
  },
});

export default ServiceStatusWidget;
