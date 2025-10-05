import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ServiceCard } from '@/components/service/ServiceCard';
import type { ServiceStatusState } from '@/components/service/ServiceStatus';
import type { ConnectionResult } from '@/connectors/base/IConnector';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { queryKeys } from '@/hooks/queryKeys';
import type { AppTheme } from '@/constants/theme';
import type { ServiceConfig, ServiceType } from '@/models/service.types';
import { useAuth } from '@/services/auth/AuthProvider';
import { secureStorage } from '@/services/storage/SecureStorage';
import { spacing } from '@/theme/spacing';

type ServiceOverviewItem = {
  config: ServiceConfig;
  status: ServiceStatusState;
  statusDescription?: string;
  lastCheckedAt?: Date;
  latency?: number;
  version?: string;
};

type SummaryMetrics = {
  total: number;
  active: number;
  online: number;
  degraded: number;
  offline: number;
  lastUpdated?: Date;
};

const serviceTypeLabels: Record<ServiceType, string> = {
  sonarr: 'Sonarr',
  radarr: 'Radarr',
  jellyseerr: 'Jellyseerr',
  qbittorrent: 'qBittorrent',
  prowlarr: 'Prowlarr',
};

const serviceIcons: Partial<Record<ServiceType, string>> = {
  sonarr: 'television-classic',
  radarr: 'movie-open',
  jellyseerr: 'account-search',
  qbittorrent: 'download-network',
  prowlarr: 'radar',
};

const deriveStatus = (
  config: ServiceConfig,
  result: ConnectionResult | undefined,
  checkedAt: Date,
): Pick<ServiceOverviewItem, 'status' | 'statusDescription' | 'lastCheckedAt' | 'latency' | 'version'> => {
  if (!config.enabled) {
    return {
      status: 'offline',
      statusDescription: 'Service disabled',
    };
  }

  if (!result) {
    return {
      status: 'offline',
      statusDescription: 'Status unavailable',
      lastCheckedAt: checkedAt,
    };
  }

  const latency = result.latency ?? undefined;
  const version = result.version ?? undefined;
  const isHighLatency = typeof latency === 'number' && latency > 2000;

  const status: ServiceStatusState = result.success
    ? isHighLatency
      ? 'degraded'
      : 'online'
    : 'offline';

  const descriptionParts: string[] = [];
  if (result.message) {
    descriptionParts.push(result.message);
  }
  if (typeof latency === 'number') {
    descriptionParts.push(`Latency ${latency}ms`);
  }
  if (version) {
    descriptionParts.push(`Version ${version}`);
  }

  const statusDescription = descriptionParts.length > 0 ? descriptionParts.join(' • ') : undefined;

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

  const connectionResults = await manager.testAllConnections();
  const checkedAt = new Date();

  return configs.map((config) => {
    const connectionResult = connectionResults.get(config.id);
    const statusFields = deriveStatus(config, connectionResult, checkedAt);

    return {
      config,
      ...statusFields,
    };
  });
};

const formatRelativeTime = (input?: Date): string | undefined => {
  if (!input) {
    return undefined;
  }

  const diffMs = Date.now() - input.getTime();
  if (diffMs < 0) {
    return 'Just now';
  }

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

const DashboardScreen = () => {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        listContent: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
        },
        header: {
          marginBottom: spacing.lg,
        },
        headerTopRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.md,
        },
        headerTitle: {
          color: theme.colors.onBackground,
          marginBottom: spacing.xs,
        },
        headerSubtitle: {
          color: theme.colors.onSurfaceVariant,
        },
        headerActions: {
          flexDirection: 'column',
          alignItems: 'flex-end',
        },
        headerActionSpacer: {
          marginTop: spacing.xs,
        },
        summaryCard: {
          marginBottom: spacing.lg,
        },
        summaryRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        },
        summaryItem: {
          flexGrow: 1,
          flexBasis: '40%',
          marginBottom: spacing.md,
        },
        summaryLabel: {
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.xxs,
        },
        summaryValue: {
          color: theme.colors.onSurface,
        },
        summaryMeta: {
          marginTop: spacing.sm,
          color: theme.colors.onSurfaceVariant,
        },
        listSpacer: {
          height: spacing.md,
        },
        emptyContainer: {
          flexGrow: 1,
          paddingTop: spacing.xl,
        },
      }),
    [theme],
  );

  const summary = useMemo<SummaryMetrics>(() => {
    if (services.length === 0) {
      return {
        total: 0,
        active: 0,
        online: 0,
        degraded: 0,
        offline: 0,
      };
    }

    const lastUpdated = services.reduce<Date | undefined>((latest, item) => {
      if (!item.lastCheckedAt) {
        return latest;
      }

      if (!latest || item.lastCheckedAt > latest) {
        return item.lastCheckedAt;
      }

      return latest;
    }, undefined);

    const active = services.filter((service) => service.config.enabled).length;
    const online = services.filter((service) => service.status === 'online').length;
    const degraded = services.filter((service) => service.status === 'degraded').length;
    const offline = services.filter((service) => service.status === 'offline').length;

    return {
      total: services.length,
      active,
      online,
      degraded,
      offline,
      lastUpdated,
    };
  }, [services]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      router.replace('/(public)/login');
    } catch (signOutError) {
      const message =
        signOutError instanceof Error
          ? signOutError.message
          : 'Unable to sign out. Please try again.';

      Alert.alert('Sign out failed', message);
    }
  }, [router, signOut]);

  const handleAddService = useCallback(() => {
    router.push('/(auth)/settings/add-service');
  }, [router]);

  const handleServicePress = useCallback(
    (service: ServiceOverviewItem) => {
      switch (service.config.type) {
        case 'sonarr':
          router.push({ pathname: '/(auth)/sonarr/[serviceId]', params: { serviceId: service.config.id } });
          break;
        default:
          Alert.alert('Coming soon', `${serviceTypeLabels[service.config.type]} integration is coming soon.`);
          break;
      }
    },
    [router],
  );

  const renderHeader = useCallback(() => {
    const lastUpdatedLabel = formatRelativeTime(summary.lastUpdated);

    return (
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text variant="headlineMedium" style={styles.headerTitle}>
              Dashboard
            </Text>
            <Text variant="bodyMedium" style={styles.headerSubtitle}>
              {user ? `Welcome back, ${user.firstName ?? user.email ?? 'there'}!` : 'Loading account…'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Button mode="contained" onPress={handleAddService}>
              Add Service
            </Button>
            <Button mode="text" onPress={handleSignOut} style={styles.headerActionSpacer}>
              Sign Out
            </Button>
          </View>
        </View>

        <Card elevation="low" contentPadding="lg" style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text variant="labelMedium" style={styles.summaryLabel}>
                Total Services
              </Text>
              <Text variant="headlineSmall" style={styles.summaryValue}>
                {summary.total}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text variant="labelMedium" style={styles.summaryLabel}>
                Active
              </Text>
              <Text variant="headlineSmall" style={styles.summaryValue}>
                {summary.active}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text variant="labelMedium" style={styles.summaryLabel}>
                Online
              </Text>
              <Text variant="headlineSmall" style={styles.summaryValue}>
                {summary.online}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text variant="labelMedium" style={styles.summaryLabel}>
                Offline
              </Text>
              <Text variant="headlineSmall" style={styles.summaryValue}>
                {summary.offline}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text variant="labelMedium" style={styles.summaryLabel}>
                Degraded
              </Text>
              <Text variant="headlineSmall" style={styles.summaryValue}>
                {summary.degraded}
              </Text>
            </View>
          </View>
          {lastUpdatedLabel ? (
            <Text variant="bodySmall" style={styles.summaryMeta}>
              Last updated {lastUpdatedLabel}
            </Text>
          ) : null}
        </Card>
      </View>
    );
  }, [handleAddService, handleSignOut, styles, summary, user]);

  const renderItem = useCallback(
    ({ item }: { item: ServiceOverviewItem }) => (
      <ServiceCard
        id={item.config.id}
        name={item.config.name}
        url={item.config.url}
        status={item.status}
        statusDescription={item.statusDescription}
        lastCheckedAt={item.lastCheckedAt}
        icon={serviceIcons[item.config.type] ?? 'server'}
        description={serviceTypeLabels[item.config.type]}
        onPress={() => handleServicePress(item)}
      />
    ),
    [handleServicePress],
  );

  const keyExtractor = useCallback((item: ServiceOverviewItem) => item.config.id, []);

  const listEmptyComponent = useMemo(() => {
    if (isError) {
      const message = error instanceof Error ? error.message : 'Unable to load services.';

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
        description="Connect Sonarr, Radarr, Jellyseerr, qBittorrent, and more to see their status here."
        actionLabel="Add Service"
        onActionPress={handleAddService}
      />
    );
  }, [error, handleAddService, isError, refetch]);

  if (isLoading && services.length === 0) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.background }]}>
        <LoadingState message="Loading dashboard…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={services}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.listSpacer} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={<View style={styles.emptyContainer}>{listEmptyComponent}</View>}
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

export default DashboardScreen;
