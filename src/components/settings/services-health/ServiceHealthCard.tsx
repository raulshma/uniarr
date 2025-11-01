import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import {
  Text,
  useTheme,
  Card,
  IconButton,
  Button,
  Chip,
} from "react-native-paper";
import { format } from "date-fns";

import { AnimatedListItem } from "@/components/common";
import { ServiceStatus } from "@/components/service/ServiceStatus";
import { getIconForServiceType } from "@/utils/serviceIcons";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import type { ServiceHealthExtended } from "@/hooks/useServicesHealth";

interface ServiceHealthCardProps {
  service: ServiceHealthExtended;
  index: number;
  totalItems: number;
  animated: boolean;
  onTestConnection: () => void;
  onEditService: () => void;
}

export const ServiceHealthCard: React.FC<ServiceHealthCardProps> = ({
  service,
  index,
  totalItems,
  animated,
  onTestConnection,
  onEditService,
}) => {
  const theme = useTheme<AppTheme>();

  const isPendingConfig = useMemo(() => {
    return (
      service.config.enabled &&
      service.status === "offline" &&
      (service.statusDescription?.includes("Status unavailable") ||
        service.statusDescription?.includes("Health check timeout") ||
        service.statusDescription?.includes("Service connector not found") ||
        service.statusDescription?.includes("Network error") ||
        service.statusDescription?.includes("Connection refused"))
    );
  }, [service.status, service.statusDescription, service.config.enabled]);

  const getConfigurationStatus = useMemo(() => {
    if (!service.config.enabled) {
      return { status: "Disabled", color: theme.colors.outline };
    }
    if (service.status === "online") {
      return { status: "Active", color: theme.colors.primary };
    }
    if (service.status === "degraded") {
      return { status: "Degraded", color: theme.colors.secondary };
    }
    if (isPendingConfig) {
      return { status: "Pending", color: theme.colors.error };
    }
    return { status: "Offline", color: theme.colors.error };
  }, [service.status, service.config.enabled, isPendingConfig, theme.colors]);

  const serviceIcon = useMemo(() => {
    return getIconForServiceType(service.config.type);
  }, [service.config.type]);

  const lastCheckedText = useMemo(() => {
    if (!service.lastCheckedAt) {
      return "Never checked";
    }
    return `Last checked: ${format(service.lastCheckedAt, "MMM d, h:mm a")}`;
  }, [service.lastCheckedAt]);

  const getStatusText = (status: string, description?: string) => {
    if (!description || description === "Status unavailable") {
      return status === "online"
        ? "Service is running normally"
        : status === "offline"
          ? "Service is not responding"
          : status === "degraded"
            ? "Service is responding slowly"
            : "Unknown status";
    }
    return description;
  };

  const statusText = getStatusText(service.status, service.statusDescription);

  const styles = StyleSheet.create({
    container: {
      marginHorizontal: spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: borderRadius.xxl,
    },
    cardContent: {
      padding: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    serviceIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.xl,
      backgroundColor: theme.colors.primaryContainer,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    serviceInfo: {
      flex: 1,
    },
    serviceName: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
    },
    serviceUrl: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      marginTop: 2,
    },
    statusContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    statusInfo: {
      flex: 1,
    },
    statusDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      marginTop: 4,
      flex: 1,
    },
    detailsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    detailChip: {
      backgroundColor: theme.colors.surfaceVariant,
      marginRight: spacing.xs,
    },
    detailChipText: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
    },
    configStatusChip: {
      backgroundColor: theme.colors.surfaceVariant,
      marginRight: spacing.xs,
    },
    lastChecked: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
    },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    pendingConfigBanner: {
      backgroundColor: theme.colors.errorContainer,
      borderRadius: borderRadius.lg,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    pendingConfigText: {
      color: theme.colors.onErrorContainer,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
    },
  });

  return (
    <AnimatedListItem
      index={index}
      totalItems={totalItems}
      animated={animated}
      style={styles.container}
    >
      <Card style={styles.card}>
        <View style={styles.cardContent}>
          {/* Header with service info */}
          <View style={styles.header}>
            <View style={styles.serviceIcon}>
              <IconButton
                icon={serviceIcon}
                size={20}
                iconColor={theme.colors.onPrimaryContainer}
              />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{service.config.name}</Text>
              <Text style={styles.serviceUrl} numberOfLines={1}>
                {service.config.url}
              </Text>
            </View>
            <ServiceStatus status={service.status} size="md" />
          </View>

          {/* Pending configuration warning */}
          {isPendingConfig && (
            <View style={styles.pendingConfigBanner}>
              <Text style={styles.pendingConfigText}>
                ⚠️ Configuration pending - Service enabled but not responding
              </Text>
            </View>
          )}

          {/* Status description */}
          <View style={styles.statusContainer}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusDescription}>{statusText}</Text>
            </View>
          </View>

          {/* Configuration status and details */}
          <View style={styles.detailsRow}>
            <View style={{ flexDirection: "row", flex: 1 }}>
              <Chip
                mode="flat"
                compact
                style={[
                  styles.configStatusChip,
                  { backgroundColor: getConfigurationStatus.color + "20" },
                ]}
                textStyle={[
                  styles.detailChipText,
                  { color: getConfigurationStatus.color },
                ]}
              >
                {getConfigurationStatus.status}
              </Chip>
              {service.latency && (
                <Chip
                  mode="flat"
                  compact
                  style={styles.detailChip}
                  textStyle={styles.detailChipText}
                >
                  {service.latency}ms
                </Chip>
              )}
              {service.version && (
                <Chip
                  mode="flat"
                  compact
                  style={styles.detailChip}
                  textStyle={styles.detailChipText}
                >
                  v{service.version}
                </Chip>
              )}
            </View>
          </View>

          {/* Footer with last checked and actions */}
          <View style={styles.statusContainer}>
            <Text style={styles.lastChecked}>{lastCheckedText}</Text>
            <View style={styles.actions}>
              <Button
                mode="outlined"
                compact
                onPress={onTestConnection}
                style={{ borderColor: theme.colors.outline }}
              >
                Test
              </Button>
              <Button
                mode="text"
                compact
                onPress={onEditService}
                textColor={theme.colors.primary}
              >
                Edit
              </Button>
            </View>
          </View>
        </View>
      </Card>
    </AnimatedListItem>
  );
};
