import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { Avatar, IconButton, Text, useTheme } from 'react-native-paper';

import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import type { AppTheme } from '@/constants/theme';
import type { DiscoveredService } from '@/services/network/NetworkScannerService';

export type NetworkScanResultsProps = {
  services: DiscoveredService[];
  isScanning: boolean;
  scanDuration?: number;
  scannedHosts?: number;
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
  onServicePress,
  onScanAgain,
  style,
  testID,
}) => {
  const theme = useTheme<AppTheme>();

  const serviceIconMap = useMemo(
    () => ({
      sonarr: 'server',
      radarr: 'movie',
      jellyseerr: 'monitor',
      qbittorrent: 'download',
      prowlarr: 'search-web',
    }),
    [],
  );

  const formatScanDuration = (duration?: number): string => {
    if (!duration) return '';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  const formatScannedHosts = (hosts?: number): string => {
    if (!hosts) return '';
    return `${hosts} hosts`;
  };

  if (isScanning) {
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

  if (services.length === 0) {
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

  return (
    <View style={style}>
      {scanDuration || scannedHosts ? (
        <Card contentPadding="md" variant="outlined" style={styles.scanSummary}>
          <View style={styles.scanSummaryContent}>
            {scanDuration ? (
              <Text variant="bodySmall" style={[styles.scanSummaryText, { color: theme.colors.onSurfaceVariant }]}>
                Scan completed in {formatScanDuration(scanDuration)}
              </Text>
            ) : null}
            {scannedHosts ? (
              <Text variant="bodySmall" style={[styles.scanSummaryText, { color: theme.colors.onSurfaceVariant }]}>
                {formatScannedHosts(scannedHosts)} scanned
              </Text>
            ) : null}
          </View>
        </Card>
      ) : null}

      <Card contentPadding="none" style={styles.servicesCard}>
        <View style={styles.servicesHeader}>
          <Text variant="titleMedium" style={[styles.servicesTitle, { color: theme.colors.onSurface }]}>
            Found Services
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

        {services.map((service) => (
          <View key={service.id}>
            <Card
              contentPadding="md"
              onPress={onServicePress ? () => onServicePress(service) : undefined}
              variant="custom"
              style={styles.serviceItem}
              focusable={Boolean(onServicePress)}
            >
              <View style={styles.serviceContent}>
                <Avatar.Icon
                  size={40}
                  icon={serviceIconMap[service.type] || 'server'}
                  style={[styles.serviceIcon, { backgroundColor: theme.colors.primaryContainer }]}
                  color={theme.colors.onPrimaryContainer}
                />

                <View style={[styles.serviceInfo, { marginLeft: theme.custom.spacing.md }]}>
                  <Text variant="titleMedium" style={[styles.serviceName, { color: theme.colors.onSurface }]}>
                    {service.name}
                  </Text>
                  <Text variant="bodyMedium" style={[styles.serviceUrl, { color: theme.colors.onSurfaceVariant }]}>
                    {service.url}
                  </Text>
                  {service.version ? (
                    <Text variant="bodySmall" style={[styles.serviceVersion, { color: theme.colors.onSurfaceVariant }]}>
                      Version {service.version}
                    </Text>
                  ) : null}
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
          </View>
        ))}
      </Card>
    </View>
  );
};

export default NetworkScanResults;

export type { NetworkScanResultsProps };

const styles = StyleSheet.create({
  scanSummary: {
    marginBottom: 16,
  },
  scanSummaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scanSummaryText: {
    textAlign: 'center',
  },
  servicesCard: {
    gap: 0,
  },
  servicesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.12)',
  },
  servicesTitle: {
    fontWeight: '600',
  },
  serviceItem: {
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.12)',
  },
  serviceContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceIcon: {
    marginRight: 0,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontWeight: '500',
  },
  serviceUrl: {
    marginTop: 2,
  },
  serviceVersion: {
    marginTop: 2,
  },
});