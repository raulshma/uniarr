import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { Card } from '@/components/common/Card';

import { EmptyState } from '@/components/common/EmptyState';
import type { AppTheme } from '@/constants/theme';
import type { NetworkScanHistoryType, RecentIP } from '@/services/storage/SecureStorage';

export type NetworkScanHistoryProps = {
  scanHistory: NetworkScanHistoryType[];
  recentIPs: RecentIP[];
  onClearHistory?: () => void;
  onIPSelect?: (ip: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const NetworkScanHistory: React.FC<NetworkScanHistoryProps> = ({
  scanHistory,
  recentIPs,
  onClearHistory,
  onIPSelect,
  style,
  testID,
}) => {
  const theme = useTheme<AppTheme>();

  const formatDuration = (duration: number): string => {
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: 16,
        },
        section: {
          gap: 8,
        },
        sectionHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 8,
        },
        sectionTitle: {
          fontSize: 18,
          fontWeight: '600',
          color: theme.colors.onSurface,
        },
        historyItem: {
          marginHorizontal: 0,
          marginVertical: 0,
          borderRadius: 0,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.outlineVariant,
        },
        historyContent: {
          padding: 16,
        },
        historyHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        },
        historyTimestamp: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
        },
        historyStats: {
          flexDirection: 'row',
          gap: 16,
          marginBottom: 8,
        },
        historyStat: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
        },
        historyServices: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        historyServiceChip: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 12,
        },
        historyServiceText: {
          fontSize: 11,
          color: theme.colors.onSurfaceVariant,
        },
        recentIPItem: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.outlineVariant,
        },
        recentIPInfo: {
          flex: 1,
        },
        recentIPText: {
          fontSize: 14,
          color: theme.colors.onSurface,
          marginBottom: 2,
        },
        recentIPSubtext: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
        },
        recentIPBadge: {
          backgroundColor: theme.colors.primaryContainer,
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 8,
          marginLeft: 8,
        },
        recentIPBadgeText: {
          fontSize: 10,
          color: theme.colors.onPrimaryContainer,
          fontWeight: '500',
        },
        emptyStateContainer: {
          padding: 16,
        },
      }),
    [theme],
  );

  if (scanHistory.length === 0 && recentIPs.length === 0) {
    return (
      <View style={[styles.emptyStateContainer, style]} testID={testID}>
        <EmptyState
          icon="history"
          title="No scan history"
          description="Your recent network scans and IP addresses will appear here."
          testID={`${testID}-empty`}
        />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, style]} showsVerticalScrollIndicator={false} testID={testID}>
      {/* Recent IPs Section */}
      {recentIPs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Recent IP Addresses
            </Text>
          </View>

          <Card contentPadding="none" variant="outlined">
            {recentIPs.map((recentIP, index) => (
              <View
                key={`${recentIP.ip}-${index}`}
                style={[
                  styles.recentIPItem,
                  index === recentIPs.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.recentIPInfo}>
                  <Text style={styles.recentIPText}>{recentIP.ip}</Text>
                  <Text style={styles.recentIPSubtext}>
                    {formatDate(recentIP.timestamp)}
                    {recentIP.subnet && ` • ${recentIP.subnet}.0/24`}
                  </Text>
                </View>

                <View style={styles.recentIPBadge}>
                  <Text style={styles.recentIPBadgeText}>
                    {recentIP.servicesFound || 0} services
                  </Text>
                </View>

                {onIPSelect && (
                  <IconButton
                    icon="arrow-right"
                    size={16}
                    onPress={() => onIPSelect(recentIP.ip)}
                    accessibilityLabel={`Scan ${recentIP.ip}`}
                  />
                )}
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* Scan History Section */}
      {scanHistory.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Recent Scans
            </Text>
            {onClearHistory && (
              <IconButton
                icon="delete"
                size={20}
                onPress={onClearHistory}
                accessibilityLabel="Clear scan history"
                accessibilityHint="Remove all scan history and recent IP addresses"
              />
            )}
          </View>

          <Card contentPadding="none" variant="outlined">
            {scanHistory.map((scan, index) => (
              <Card
                key={scan.id}
                contentPadding="none"
                variant="outlined"
                style={[
                  styles.historyItem,
                  index === scanHistory.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.historyContent}>
                  <View style={styles.historyHeader}>
                    <Text variant="bodySmall" style={styles.historyTimestamp}>
                      {formatDate(scan.timestamp)}
                    </Text>
                    <Text variant="bodySmall" style={[styles.historyTimestamp, { color: theme.colors.primary }]}>
                      {formatDuration(scan.duration)}
                    </Text>
                  </View>

                  <View style={styles.historyStats}>
                    <Text style={styles.historyStat}>
                      {scan.servicesFound} services found
                    </Text>
                    <Text style={styles.historyStat}>
                      {scan.scannedHosts} hosts scanned
                    </Text>
                    <Text style={styles.historyStat}>
                      {scan.subnet}.0/24
                      {scan.customIp && ` (${scan.customIp})`}
                    </Text>
                  </View>

                  {scan.services.length > 0 && (
                    <View style={styles.historyServices}>
                      {scan.services.slice(0, 3).map((service, serviceIndex) => (
                        <View key={serviceIndex} style={styles.historyServiceChip}>
                          <Text style={styles.historyServiceText}>
                            {service.type} ({service.port})
                          </Text>
                        </View>
                      ))}
                      {scan.services.length > 3 && (
                        <View style={styles.historyServiceChip}>
                          <Text style={styles.historyServiceText}>
                            +{scan.services.length - 3} more
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </Card>
            ))}
          </Card>
        </View>
      )}
    </ScrollView>
  );
};

export default NetworkScanHistory;
