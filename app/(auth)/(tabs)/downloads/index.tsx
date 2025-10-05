import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { IconButton, ProgressBar, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import type { AppTheme } from '@/constants/theme';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import type { QBittorrentConnector } from '@/connectors/implementations/QBittorrentConnector';
import { queryKeys } from '@/hooks/queryKeys';
import type { Torrent } from '@/models/torrent.types';
import type { TorrentTransferInfo } from '@/models/torrent.types';
import { logger } from '@/services/logger/LoggerService';
import { spacing } from '@/theme/spacing';
import {
  deriveTorrentStatusLabel,
  formatBytes,
  formatEta,
  formatSpeed,
  isTorrentActive,
  isTorrentCompleted,
  isTorrentPaused,
} from '@/utils/torrent.utils';

type ServiceDownloads = {
  serviceId: string;
  serviceName: string;
  torrents: Torrent[];
  counts: {
    total: number;
    active: number;
    completed: number;
    paused: number;
  };
  transferInfo?: TorrentTransferInfo;
};

type DownloadsOverview = {
  totals: {
    total: number;
    active: number;
    completed: number;
    paused: number;
    downloadSpeed: number;
    uploadSpeed: number;
  };
  services: ServiceDownloads[];
};

const fetchDownloadsOverview = async (): Promise<DownloadsOverview> => {
  const manager = ConnectorManager.getInstance();
  await manager.loadSavedServices();
  const connectors = manager.getConnectorsByType('qbittorrent') as QBittorrentConnector[];

  if (connectors.length === 0) {
    return {
      totals: {
        total: 0,
        active: 0,
        completed: 0,
        paused: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
      },
      services: [],
    };
  }

  const services = await Promise.all(
    connectors.map(async (connector) => {
      try {
        const [torrents, transferInfo] = await Promise.all([
          connector.getTorrents(),
          connector
            .getTransferInfo()
            .catch((transferError) => {
              const message = transferError instanceof Error ? transferError.message : String(transferError);
              void logger.warn('Failed to load transfer info for qBittorrent.', {
                serviceId: connector.config.id,
                message,
              });
              return undefined;
            }),
        ]);

        const counts = {
          total: torrents.length,
          active: torrents.filter((torrent) => isTorrentActive(torrent)).length,
          completed: torrents.filter((torrent) => isTorrentCompleted(torrent)).length,
          paused: torrents.filter((torrent) => isTorrentPaused(torrent)).length,
        };

        const sortedTorrents = torrents
          .slice()
          .sort((a, b) => b.downloadSpeed - a.downloadSpeed);

        return {
          serviceId: connector.config.id,
          serviceName: connector.config.name,
          torrents: sortedTorrents,
          counts,
          transferInfo,
        } satisfies ServiceDownloads;
      } catch (connectorError) {
        const message = connectorError instanceof Error ? connectorError.message : String(connectorError);
        throw new Error(`Failed to load downloads for ${connector.config.name}: ${message}`);
      }
    }),
  );

  const totals = services.reduce<DownloadsOverview['totals']>(
    (accumulator, service) => {
      accumulator.total += service.counts.total;
      accumulator.active += service.counts.active;
      accumulator.completed += service.counts.completed;
      accumulator.paused += service.counts.paused;
      accumulator.downloadSpeed += service.transferInfo?.downloadSpeed ?? 0;
      accumulator.uploadSpeed += service.transferInfo?.uploadSpeed ?? 0;
      return accumulator;
    },
    {
      total: 0,
      active: 0,
      completed: 0,
      paused: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
    },
  );

  return { totals, services };
};

const DownloadsScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.qbittorrent.base,
    queryFn: fetchDownloadsOverview,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const overview = data ?? {
    totals: {
      total: 0,
      active: 0,
      completed: 0,
      paused: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
    },
    services: [],
  };

  const hasServices = overview.services.length > 0;
  const isRefreshing = isFetching && !isLoading;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        listContent: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
        },
        summaryCard: {
          marginBottom: spacing.lg,
          padding: spacing.lg,
          backgroundColor: theme.colors.elevation.level2,
          borderRadius: spacing.lg,
        },
        summaryTitle: {
          color: theme.colors.onSurface,
          marginBottom: spacing.sm,
        },
        summaryMetrics: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.md,
        },
        metricChip: {
          flexGrow: 1,
          flexBasis: '45%',
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          backgroundColor: theme.colors.elevation.level3,
          borderRadius: spacing.sm,
        },
        metricLabel: {
          color: theme.colors.onSurfaceVariant,
        },
        metricValue: {
          color: theme.colors.onSurface,
          fontWeight: '600',
        },
        serviceCard: {
          marginBottom: spacing.lg,
          padding: spacing.lg,
          borderRadius: spacing.lg,
        },
        serviceHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
        },
        serviceTitle: {
          color: theme.colors.onSurface,
        },
        serviceMeta: {
          color: theme.colors.onSurfaceVariant,
        },
        serviceStats: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.md,
        },
        statChip: {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          backgroundColor: theme.colors.elevation.level2,
          borderRadius: spacing.sm,
        },
        statText: {
          color: theme.colors.onSurfaceVariant,
        },
        torrentList: {
          gap: spacing.sm,
        },
        torrentRow: {
          backgroundColor: theme.colors.elevation.level1,
          borderRadius: spacing.md,
          padding: spacing.md,
        },
        torrentHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.xs,
        },
        torrentName: {
          flex: 1,
          color: theme.colors.onSurface,
          marginRight: spacing.sm,
        },
        torrentStatus: {
          color: theme.colors.onSurfaceVariant,
        },
        torrentMeta: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginTop: spacing.xs,
        },
        emptyContainer: {
          flexGrow: 1,
          paddingTop: spacing.xl,
        },
      }),
    [theme],
  );

  const handleAddService = useCallback(() => {
    router.push('/(auth)/add-service');
  }, [router]);

  const handleOpenService = useCallback(
    (service: ServiceDownloads) => {
      router.push({ pathname: '/(auth)/qbittorrent/[serviceId]', params: { serviceId: service.serviceId } });
    },
    [router],
  );

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const renderServiceItem = useCallback(
    ({ item }: { item: ServiceDownloads }) => {
      const transferInfo = item.transferInfo;
      const topTorrents = item.torrents.slice(0, 3);

      return (
        <Card variant="custom" style={styles.serviceCard} onPress={() => handleOpenService(item)}>
          <View style={styles.serviceHeader}>
            <View>
              <Text variant="titleLarge" style={styles.serviceTitle}>
                {item.serviceName}
              </Text>
              <Text variant="bodySmall" style={styles.serviceMeta}>
                {item.counts.active} active • {item.counts.paused} paused • {item.counts.completed} completed
              </Text>
            </View>
            <Button mode="text" onPress={() => handleOpenService(item)}>
              Open
            </Button>
          </View>
          <View style={styles.serviceStats}>
            <View style={styles.statChip}>
              <Text variant="labelSmall" style={styles.statText}>
                Download speed
              </Text>
              <Text variant="bodyMedium" style={styles.serviceTitle}>
                {formatSpeed(transferInfo?.downloadSpeed ?? 0)}
              </Text>
            </View>
            <View style={styles.statChip}>
              <Text variant="labelSmall" style={styles.statText}>
                Upload speed
              </Text>
              <Text variant="bodyMedium" style={styles.serviceTitle}>
                {formatSpeed(transferInfo?.uploadSpeed ?? 0)}
              </Text>
            </View>
          </View>
          <View style={styles.torrentList}>
            {topTorrents.length === 0 ? (
              <Text variant="bodySmall" style={styles.serviceMeta}>
                No torrents currently running.
              </Text>
            ) : (
              topTorrents.map((torrent) => {
                const progress = Math.max(0, Math.min(1, torrent.progress));
                const percent = Math.round(progress * 1000) / 10;
                return (
                  <View key={torrent.hash} style={styles.torrentRow}>
                    <View style={styles.torrentHeader}>
                      <Text variant="titleSmall" numberOfLines={1} style={styles.torrentName}>
                        {torrent.name}
                      </Text>
                      <Text variant="bodySmall" style={styles.torrentStatus}>
                        {deriveTorrentStatusLabel(torrent)}
                      </Text>
                    </View>
                    <ProgressBar progress={progress} color={theme.colors.primary} />
                    <View style={styles.torrentMeta}>
                      <Text variant="bodySmall" style={styles.torrentStatus}>
                        {percent.toFixed(1)}%
                      </Text>
                      <Text variant="bodySmall" style={styles.torrentStatus}>
                        {formatSpeed(torrent.downloadSpeed)}
                      </Text>
                      <Text variant="bodySmall" style={styles.torrentStatus}>
                        {formatBytes(torrent.downloaded)} / {formatBytes(torrent.size)}
                      </Text>
                      <Text variant="bodySmall" style={styles.torrentStatus}>
                        ETA {formatEta(torrent.eta)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </Card>
      );
    },
    [handleOpenService, styles.serviceCard, styles.serviceHeader, styles.serviceMeta, styles.serviceStats, styles.statChip, styles.statText, styles.torrentHeader, styles.torrentList, styles.torrentMeta, styles.torrentName, styles.torrentRow, styles.torrentStatus, styles.serviceTitle, theme.colors.primary],
  );

  const listHeader = useMemo(() => (
    <View style={styles.summaryCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text variant="headlineSmall" style={styles.summaryTitle}>
          Downloads
        </Text>
        <IconButton icon="refresh" size={24} onPress={handleRefresh} />
      </View>
      <View style={styles.summaryMetrics}>
        <View style={styles.metricChip}>
          <Text variant="labelSmall" style={styles.metricLabel}>
            Active
          </Text>
          <Text variant="titleMedium" style={styles.metricValue}>
            {overview.totals.active}
          </Text>
        </View>
        <View style={styles.metricChip}>
          <Text variant="labelSmall" style={styles.metricLabel}>
            Paused
          </Text>
          <Text variant="titleMedium" style={styles.metricValue}>
            {overview.totals.paused}
          </Text>
        </View>
        <View style={styles.metricChip}>
          <Text variant="labelSmall" style={styles.metricLabel}>
            Completed
          </Text>
          <Text variant="titleMedium" style={styles.metricValue}>
            {overview.totals.completed}
          </Text>
        </View>
        <View style={styles.metricChip}>
          <Text variant="labelSmall" style={styles.metricLabel}>
            Download speed
          </Text>
          <Text variant="titleMedium" style={styles.metricValue}>
            {formatSpeed(overview.totals.downloadSpeed)}
          </Text>
        </View>
        <View style={styles.metricChip}>
          <Text variant="labelSmall" style={styles.metricLabel}>
            Upload speed
          </Text>
          <Text variant="titleMedium" style={styles.metricValue}>
            {formatSpeed(overview.totals.uploadSpeed)}
          </Text>
        </View>
      </View>
    </View>
  ), [handleRefresh, overview.totals.active, overview.totals.completed, overview.totals.downloadSpeed, overview.totals.paused, overview.totals.uploadSpeed, styles.metricChip, styles.metricLabel, styles.metricValue, styles.summaryCard, styles.summaryMetrics, styles.summaryTitle]);

  const listEmptyComponent = useMemo(() => {
    if (isError) {
      const message = error instanceof Error ? error.message : 'Unable to load downloads overview.';

      return (
        <EmptyState
          title="Failed to load downloads"
          description={message}
          actionLabel="Retry"
          onActionPress={handleRefresh}
        />
      );
    }

    return (
      <EmptyState
        title="No download services"
        description="Connect a qBittorrent service to monitor downloads."
        actionLabel="Add Service"
        onActionPress={handleAddService}
      />
    );
  }, [error, handleAddService, handleRefresh, isError]);

  if (isLoading && !hasServices) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <LoadingState message="Loading downloads overview..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlashList<ServiceDownloads>
        data={overview.services}
        keyExtractor={(item) => item.serviceId}
        renderItem={renderServiceItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<View style={styles.emptyContainer}>{listEmptyComponent}</View>}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refetch()}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
};

export default DownloadsScreen;
