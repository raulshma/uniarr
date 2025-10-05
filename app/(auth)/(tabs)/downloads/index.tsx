import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { IconButton, ProgressBar, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabHeader } from '@/components/common/TabHeader';

import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ListRefreshControl } from '@/components/common/ListRefreshControl';
import { SkeletonPlaceholder } from '@/components/common/Skeleton';
import { TorrentCardSkeleton } from '@/components/torrents';
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

type TorrentWithService = Torrent & {
  serviceId: string;
  serviceName: string;
};

type DownloadsOverview = {
  torrents: TorrentWithService[];
  totals: {
    total: number;
    active: number;
    completed: number;
    paused: number;
    downloadSpeed: number;
    uploadSpeed: number;
  };
};

const fetchDownloadsOverview = async (): Promise<DownloadsOverview> => {
  const manager = ConnectorManager.getInstance();
  await manager.loadSavedServices();
  const connectors = manager.getConnectorsByType('qbittorrent') as QBittorrentConnector[];

  if (connectors.length === 0) {
    return {
      torrents: [],
      totals: {
        total: 0,
        active: 0,
        completed: 0,
        paused: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
      },
    };
  }

  const allTorrents: TorrentWithService[] = [];
  let totalDownloadSpeed = 0;
  let totalUploadSpeed = 0;

  await Promise.all(
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

        // Add service info to each torrent
        const torrentsWithService = torrents.map((torrent) => ({
          ...torrent,
          serviceId: connector.config.id,
          serviceName: connector.config.name,
        }));

        allTorrents.push(...torrentsWithService);
        totalDownloadSpeed += transferInfo?.downloadSpeed ?? 0;
        totalUploadSpeed += transferInfo?.uploadSpeed ?? 0;
      } catch (connectorError) {
        const message = connectorError instanceof Error ? connectorError.message : String(connectorError);
        throw new Error(`Failed to load downloads for ${connector.config.name}: ${message}`);
      }
    }),
  );

  // Sort torrents by download speed (active torrents first)
  const sortedTorrents = allTorrents.sort((a, b) => {
    if (isTorrentActive(a) && !isTorrentActive(b)) return -1;
    if (!isTorrentActive(a) && isTorrentActive(b)) return 1;
    return b.downloadSpeed - a.downloadSpeed;
  });

  const totals = {
    total: allTorrents.length,
    active: allTorrents.filter((torrent) => isTorrentActive(torrent)).length,
    completed: allTorrents.filter((torrent) => isTorrentCompleted(torrent)).length,
    paused: allTorrents.filter((torrent) => isTorrentPaused(torrent)).length,
    downloadSpeed: totalDownloadSpeed,
    uploadSpeed: totalUploadSpeed,
  };

  return { torrents: sortedTorrents, totals };
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
    torrents: [],
    totals: {
      total: 0,
      active: 0,
      completed: 0,
      paused: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
    },
  };

  const hasTorrents = overview.torrents.length > 0;
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
        torrentItem: {
          backgroundColor: theme.colors.elevation.level1,
          borderRadius: spacing.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
        torrentHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.sm,
        },
        torrentName: {
          flex: 1,
          color: theme.colors.onSurface,
          fontSize: 14,
          fontWeight: '500',
          marginRight: spacing.sm,
        },
        torrentActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        actionButton: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: theme.colors.elevation.level2,
          justifyContent: 'center',
          alignItems: 'center',
        },
        progressContainer: {
          marginBottom: spacing.sm,
        },
        progressBar: {
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.elevation.level2,
        },
        progressPercentage: {
          color: theme.colors.onSurface,
          fontSize: 12,
          fontWeight: '500',
          marginTop: spacing.xs,
          textAlign: 'right',
        },
        torrentDetails: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        torrentDetail: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 12,
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

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleTorrentAction = useCallback(async (torrent: TorrentWithService, action: 'pause' | 'resume' | 'delete') => {
    try {
      const manager = ConnectorManager.getInstance();
      const connector = manager.getConnector(torrent.serviceId) as QBittorrentConnector;
      
      if (!connector) {
        throw new Error('Service not found');
      }

      switch (action) {
        case 'pause':
          await connector.pauseTorrent(torrent.hash);
          break;
        case 'resume':
          await connector.resumeTorrent(torrent.hash);
          break;
        case 'delete':
          await connector.deleteTorrent(torrent.hash, true);
          break;
      }
      
      // Refresh data after action
      void refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logger.error('Failed to perform torrent action', { action, torrentHash: torrent.hash, message });
    }
  }, [refetch]);

  const renderTorrentItem = useCallback(
    ({ item }: { item: TorrentWithService }) => {
      const progress = Math.max(0, Math.min(1, item.progress));
      const percent = Math.round(progress * 100);
      const isActive = isTorrentActive(item);
      const isPaused = isTorrentPaused(item);
      const isCompleted = isTorrentCompleted(item);

      const getStatusText = () => {
        if (isCompleted) return 'Completed';
        if (isPaused) return 'Paused';
        if (isActive) return `${formatBytes(item.downloaded)} / ${formatBytes(item.size)} • ${formatSpeed(item.downloadSpeed)} • ~${formatEta(item.eta)} remaining`;
        return deriveTorrentStatusLabel(item);
      };

      const getActionIcon = () => {
        if (isCompleted) return 'check';
        if (isPaused) return 'play';
        return 'pause';
      };

      const handleActionPress = () => {
        if (isCompleted) return; // No action for completed torrents
        if (isPaused) {
          void handleTorrentAction(item, 'resume');
        } else {
          void handleTorrentAction(item, 'pause');
        }
      };

      return (
        <View style={styles.torrentItem}>
          <View style={styles.torrentHeader}>
            <Text style={styles.torrentName} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={styles.torrentActions}>
              <TouchableOpacity style={styles.actionButton} onPress={handleActionPress}>
                <Text style={{ color: theme.colors.onSurface, fontSize: 16 }}>
                  {getActionIcon() === 'check' ? '✓' : getActionIcon() === 'play' ? '▶' : '⏸'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => void handleTorrentAction(item, 'delete')}
              >
                <Text style={{ color: theme.colors.onSurface, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.progressContainer}>
            <ProgressBar 
              progress={progress} 
              color={theme.colors.primary} 
              style={styles.progressBar}
            />
            <Text style={styles.progressPercentage}>
              {percent}%
            </Text>
          </View>
          
          <View style={styles.torrentDetails}>
            <Text style={styles.torrentDetail}>
              {getStatusText()}
            </Text>
          </View>
        </View>
      );
    },
    [handleTorrentAction, styles, theme.colors],
  );

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
        title="No downloads"
        description="No torrents are currently downloading."
      />
    );
  }, [error, handleRefresh, isError]);

  if (isLoading && !hasTorrents) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <TabHeader
          showBackButton={true}
          onBackPress={() => router.back()}
          rightAction={{
            icon: 'plus',
            onPress: handleAddService,
            accessibilityLabel: 'Add service',
          }}
        />
        <ScrollView contentContainerStyle={styles.listContent}>
          <View style={{ marginBottom: spacing.lg }}>
            <SkeletonPlaceholder width="60%" height={28} borderRadius={10} style={{ marginBottom: spacing.xs }} />
            <SkeletonPlaceholder width="40%" height={18} borderRadius={8} />
          </View>
          {Array.from({ length: 5 }).map((_, index) => (
            <View key={index} style={{ marginBottom: spacing.md }}>
              <TorrentCardSkeleton showActions={false} />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <TabHeader
        showBackButton={true}
        onBackPress={() => router.back()}
        rightAction={{
          icon: "plus",
          onPress: handleAddService,
          accessibilityLabel: "Add service",
        }}
      />
      
      <FlashList<TorrentWithService>
        data={overview.torrents}
        keyExtractor={(item) => item.hash}
        renderItem={renderTorrentItem}
        ListEmptyComponent={<View style={styles.emptyContainer}>{listEmptyComponent}</View>}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <ListRefreshControl
            refreshing={isRefreshing}
            onRefresh={() => refetch()}
          />
        }
      />
    </SafeAreaView>
  );
};

export default DownloadsScreen;
