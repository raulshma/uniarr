import React, { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import {
  Avatar,
  Badge,
  Chip,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";

import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import type { AppTheme } from "@/constants/theme";
import type {
  DiscoveredService,
  ScanProgress,
} from "@/services/network/NetworkScannerService";
import {
  sanitizeAndTruncateText,
  sanitizeServiceVersion,
} from "@/utils/validation.utils";
import type { ServiceType } from "@/models/service.types";

export type NetworkScanResultsProps = {
  services: DiscoveredService[];
  isScanning: boolean;
  scanDuration?: number;
  scannedHosts?: number;
  scanProgress?: ScanProgress | null;
  onServicePress?: (service: DiscoveredService) => void;
  onScanAgain?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const NetworkScanResults: React.FC<NetworkScanResultsProps> = ({
  services,
  isScanning,
  scanDuration,
  scannedHosts,
  scanProgress,
  onServicePress,
  onScanAgain,
  style,
  testID,
}) => {
  const theme = useTheme<AppTheme>();

  const serviceIconMap = useMemo(
    () => ({
      sonarr: "server",
      radarr: "movie",
      jellyseerr: "monitor",
      jellyfin: "play-circle",
      qbittorrent: "download",
      transmission: "download",
      deluge: "download",
      sabnzbd: "download",
      nzbget: "download",
      rtorrent: "download",
      prowlarr: "search-web",
      bazarr: "subtitles",
    }),
    [],
  );

  const serviceColorMap = useMemo(
    () => ({
      sonarr: theme.colors.primary,
      radarr: theme.colors.secondary,
      jellyseerr: theme.colors.tertiary,
      jellyfin: theme.colors.primaryContainer,
      qbittorrent: theme.colors.error,
      transmission: theme.colors.primaryContainer,
      deluge: theme.colors.secondaryContainer,
      sabnzbd: theme.colors.tertiaryContainer,
      nzbget: theme.colors.errorContainer,
      rtorrent: theme.colors.inversePrimary,
      prowlarr: theme.colors.surfaceVariant,
      bazarr: theme.colors.inverseSurface,
    }),
    [theme],
  );

  const formatScanDuration = (duration?: number): string => {
    if (!duration) return "";
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  const formatScannedHosts = (hosts?: number): string => {
    if (!hosts) return "";
    return `${hosts} hosts`;
  };

  const groupServicesByType = (
    services: DiscoveredService[],
  ): Record<ServiceType, DiscoveredService[]> => {
    return services.reduce(
      (acc, service) => {
        if (!acc[service.type]) {
          acc[service.type] = [];
        }
        acc[service.type].push(service);
        return acc;
      },
      {} as Record<ServiceType, DiscoveredService[]>,
    );
  };

  const getServiceHealthStatus = (
    service: DiscoveredService,
  ): "healthy" | "warning" | "error" => {
    if (service.requiresAuth) return "warning";
    if (service.authError) return "error";
    return "healthy";
  };

  const getServiceHealthIcon = (
    status: "healthy" | "warning" | "error",
  ): string => {
    switch (status) {
      case "healthy":
        return "check-circle";
      case "warning":
        return "alert-circle";
      case "error":
        return "close-circle";
    }
  };

  const getServiceHealthColor = (status: "healthy" | "warning" | "error") => {
    switch (status) {
      case "healthy":
        return theme.colors.primary;
      case "warning":
        return theme.colors.tertiary;
      case "error":
        return theme.colors.error;
    }
  };

  // Show empty state only when not scanning and no services found
  if (!isScanning && services.length === 0) {
    return (
      <Card contentPadding="lg" style={style} testID={testID}>
        <EmptyState
          icon="lan-disconnect"
          title="No services found"
          description="No supported services were found on your local network. Try scanning again or add services manually."
          actionLabel="Scan Again"
          onActionPress={onScanAgain}
          testID={`${testID}-empty`}
        />
      </Card>
    );
  }

  // Show loading state when scanning but no services found yet
  if (isScanning && services.length === 0) {
    return (
      <Card contentPadding="lg" style={style} testID={testID}>
        <LoadingState
          size="large"
          message="Scanning network for services..."
          testID={`${testID}-loading`}
        />
      </Card>
    );
  }

  return (
    <View style={style}>
      {/* Show progress information when scanning is ongoing */}
      {isScanning && scanProgress ? (
        <Card contentPadding="md" variant="outlined" style={styles.scanSummary}>
          <View style={styles.scanSummaryContent}>
            <Text
              variant="bodySmall"
              style={[styles.scanSummaryText, { color: theme.colors.primary }]}
            >
              Scanning {scanProgress.currentService}... (
              {scanProgress.currentHost}/{scanProgress.totalHosts} hosts)
            </Text>
            <Text
              variant="bodySmall"
              style={[
                styles.scanSummaryText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Found {scanProgress.servicesFound.length} services so far
            </Text>
          </View>
        </Card>
      ) : scanDuration || scannedHosts ? (
        <Card contentPadding="md" variant="outlined" style={styles.scanSummary}>
          <View style={styles.scanSummaryContent}>
            {scanDuration ? (
              <Text
                variant="bodySmall"
                style={[
                  styles.scanSummaryText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Scan completed in {formatScanDuration(scanDuration)}
              </Text>
            ) : null}
            {scannedHosts ? (
              <Text
                variant="bodySmall"
                style={[
                  styles.scanSummaryText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {formatScannedHosts(scannedHosts)} scanned
              </Text>
            ) : null}
          </View>
        </Card>
      ) : null}

      <Card contentPadding="none" style={styles.servicesCard}>
        <View
          style={[
            styles.servicesHeader,
            { borderBottomColor: theme.colors.outlineVariant },
          ]}
        >
          <Text
            variant="titleMedium"
            style={[styles.servicesTitle, { color: theme.colors.onSurface }]}
          >
            Found Services ({services.length})
          </Text>
          {onScanAgain ? (
            <IconButton
              icon="refresh"
              size={20}
              onPress={onScanAgain}
              accessibilityLabel="Scan network again"
              accessibilityHint="Scan the local network for services again"
            />
          ) : null}
        </View>

        <View style={styles.servicesScrollContainer}>
          {Object.entries(groupServicesByType(services)).map(
            ([serviceType, typeServices]) => (
              <View key={serviceType}>
                {/* Service Type Header */}
                <View
                  style={[
                    styles.serviceTypeHeader,
                    {
                      backgroundColor: theme.colors.elevation.level1,
                      borderBottomColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <View style={styles.serviceTypeHeaderContent}>
                    <Avatar.Icon
                      size={24}
                      icon={
                        serviceIconMap[serviceType as ServiceType] || "server"
                      }
                      style={[
                        styles.serviceTypeIcon,
                        {
                          backgroundColor:
                            serviceColorMap[serviceType as ServiceType] ||
                            theme.colors.primaryContainer,
                        },
                      ]}
                      color={theme.colors.onPrimaryContainer}
                    />
                    <Text
                      variant="labelLarge"
                      style={[
                        styles.serviceTypeTitle,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      {serviceType.charAt(0).toUpperCase() +
                        serviceType.slice(1)}{" "}
                      ({typeServices.length})
                    </Text>
                  </View>
                  <Badge
                    size={20}
                    style={{
                      backgroundColor:
                        serviceColorMap[serviceType as ServiceType],
                    }}
                  >
                    {typeServices.length}
                  </Badge>
                </View>

                {/* Services of this type */}
                {typeServices.map((service) => {
                  const healthStatus = getServiceHealthStatus(service);
                  const healthIcon = getServiceHealthIcon(healthStatus);
                  const healthColor = getServiceHealthColor(healthStatus);

                  return (
                    <Card
                      key={service.id}
                      contentPadding="md"
                      onPress={
                        onServicePress
                          ? () => onServicePress(service)
                          : undefined
                      }
                      variant="custom"
                      style={[
                        styles.serviceItem,
                        {
                          borderLeftWidth: 3,
                          borderLeftColor:
                            serviceColorMap[service.type] ||
                            theme.colors.primary,
                        },
                      ]}
                      focusable={Boolean(onServicePress)}
                    >
                      <View style={styles.serviceContent}>
                        <Avatar.Icon
                          size={40}
                          icon={serviceIconMap[service.type] || "server"}
                          style={[
                            styles.serviceIcon,
                            { backgroundColor: theme.colors.surfaceVariant },
                          ]}
                          color={theme.colors.onSurfaceVariant}
                        />

                        <View
                          style={[
                            styles.serviceInfo,
                            { marginLeft: theme.custom.spacing.md, flex: 1 },
                          ]}
                        >
                          <View style={styles.serviceHeaderRow}>
                            <Text
                              variant="titleMedium"
                              style={[
                                styles.serviceName,
                                { color: theme.colors.onSurface },
                              ]}
                              numberOfLines={1}
                            >
                              {sanitizeAndTruncateText(service.name, 35)}
                            </Text>
                            <View
                              style={[
                                styles.healthIndicator,
                                { backgroundColor: healthColor + "20" },
                              ]}
                            >
                              <IconButton
                                icon={healthIcon}
                                size={16}
                                iconColor={healthColor}
                                style={styles.healthIcon}
                              />
                            </View>
                          </View>

                          <Text
                            variant="bodyMedium"
                            style={[
                              styles.serviceUrl,
                              { color: theme.colors.onSurfaceVariant },
                            ]}
                            numberOfLines={1}
                          >
                            {sanitizeAndTruncateText(service.url, 55)}
                          </Text>

                          <View style={styles.serviceDetailsRow}>
                            {service.version && (
                              <Chip
                                icon="tag"
                                compact
                                style={[
                                  styles.serviceChip,
                                  {
                                    backgroundColor:
                                      theme.colors.surfaceVariant,
                                  },
                                ]}
                                textStyle={[
                                  styles.serviceChipText,
                                  { color: theme.colors.onSurfaceVariant },
                                ]}
                              >
                                v{sanitizeServiceVersion(service.version)}
                              </Chip>
                            )}

                            <Chip
                              icon="lan"
                              compact
                              style={[
                                styles.serviceChip,
                                {
                                  backgroundColor: theme.colors.surfaceVariant,
                                },
                              ]}
                              textStyle={[
                                styles.serviceChipText,
                                { color: theme.colors.onSurfaceVariant },
                              ]}
                            >
                              Port {service.port}
                            </Chip>

                            {service.requiresAuth && (
                              <Chip
                                icon="lock"
                                compact
                                style={[
                                  styles.serviceChip,
                                  {
                                    backgroundColor:
                                      theme.colors.errorContainer,
                                  },
                                ]}
                                textStyle={[
                                  styles.serviceChipText,
                                  { color: theme.colors.onErrorContainer },
                                ]}
                              >
                                Auth Required
                              </Chip>
                            )}
                          </View>
                        </View>

                        {onServicePress ? (
                          <IconButton
                            icon="plus"
                            size={20}
                            onPress={() => onServicePress(service)}
                            accessibilityLabel={`Add ${service.name}`}
                            accessibilityHint={`Add ${service.name} to your services`}
                          />
                        ) : null}
                      </View>
                    </Card>
                  );
                })}
              </View>
            ),
          )}
        </View>
      </Card>
    </View>
  );
};

export default NetworkScanResults;

const styles = StyleSheet.create({
  scanSummary: {
    marginBottom: 16,
  },
  scanSummaryContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scanSummaryText: {
    textAlign: "center",
  },
  servicesCard: {
    gap: 0,
  },
  servicesScrollContainer: {
    // Allow content to expand fully; parent screen scrolls
  },
  servicesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0, 0, 0, 0.12)",
  },
  servicesTitle: {
    fontWeight: "600",
  },
  serviceItem: {
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0, 0, 0, 0.12)",
  },
  serviceContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 6,
  },
  serviceIcon: {
    marginRight: 0,
  },
  serviceInfo: {
    flex: 1,
    flexShrink: 1,
  },
  serviceName: {
    fontWeight: "500",
  },
  serviceUrl: {
    marginTop: 2,
  },
  serviceVersion: {
    marginTop: 2,
  },
  authRequired: {
    marginTop: 2,
    fontWeight: "500",
  },
  serviceTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0, 0, 0, 0.12)",
  },
  serviceTypeHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  serviceTypeIcon: {
    marginRight: 0,
  },
  serviceTypeTitle: {
    fontWeight: "600",
  },
  serviceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  healthIndicator: {
    borderRadius: 12,
    padding: 2,
  },
  healthIcon: {
    margin: 0,
  },
  serviceDetailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  serviceChip: {
    // Allow chip to size itself to content to avoid clipping on Android
  },
  serviceChipText: {
    fontSize: 11,
  },
});
