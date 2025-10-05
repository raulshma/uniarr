import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
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
  const [menuVisible, setMenuVisible] = useState(false);

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
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.xxl,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          backgroundColor: theme.colors.background,
        },
        hamburgerButton: {
          marginLeft: -spacing.xs,
        },
        headerTitle: {
          color: theme.colors.onBackground,
          fontSize: theme.custom.typography.headlineSmall.fontSize,
          fontFamily: theme.custom.typography.headlineSmall.fontFamily,
          lineHeight: theme.custom.typography.headlineSmall.lineHeight,
          letterSpacing: theme.custom.typography.headlineSmall.letterSpacing,
          fontWeight: '700' as const,
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
          paddingHorizontal: spacing.md,
        },
        serviceCard: {
          backgroundColor: theme.colors.elevation.level1,
          marginHorizontal: spacing.md,
          marginVertical: spacing.xs,
          borderRadius: 12,
          padding: spacing.md,
        },
        serviceContent: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        serviceIcon: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.colors.surfaceVariant,
          alignItems: 'center',
          justifyContent: 'center',
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
        serviceStatus: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        statusIndicator: {
          width: 8,
          height: 8,
          borderRadius: 4,
          marginRight: spacing.xs,
        },
        statusOnline: {
          backgroundColor: theme.colors.primary,
        },
        statusOffline: {
          backgroundColor: theme.colors.error,
        },
        statusDegraded: {
          backgroundColor: theme.colors.tertiary,
        },
        serviceStatusText: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          lineHeight: theme.custom.typography.bodyMedium.lineHeight,
          letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
          fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
        },
        serviceArrow: {
          color: theme.colors.outline,
        },
        activityCard: {
          backgroundColor: theme.colors.elevation.level1,
          marginHorizontal: spacing.md,
          marginVertical: spacing.xs,
          borderRadius: 12,
          padding: spacing.md,
        },
        activityContent: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        activityIcon: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.colors.surfaceVariant,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
        },
        activityInfo: {
          flex: 1,
        },
        activityTitle: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          lineHeight: theme.custom.typography.titleMedium.lineHeight,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
          marginBottom: spacing.xxs,
        },
        activitySubtitle: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          lineHeight: theme.custom.typography.bodyMedium.lineHeight,
          letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
          fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
        },
        activityArrow: {
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

  const handleMenuPress = useCallback(() => {
    setMenuVisible(true);
  }, []);

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
        case 'radarr':
          router.push({ pathname: '/(auth)/radarr/[serviceId]', params: { serviceId: service.config.id } });
          break;
        case 'jellyseerr':
          router.push({ pathname: '/(auth)/jellyseerr/[serviceId]', params: { serviceId: service.config.id } });
          break;
        case 'qbittorrent':
          router.push({ pathname: '/(auth)/qbittorrent/[serviceId]', params: { serviceId: service.config.id } });
          break;
        default:
          Alert.alert('Coming soon', `${serviceTypeLabels[service.config.type]} integration is coming soon.`);
          break;
      }
    },
    [router],
  );

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <View style={{ width: 48 }} />
      <Text style={styles.headerTitle}>Dashboard</Text>
      <IconButton
        icon="plus"
        size={24}
        iconColor={theme.colors.primary}
        onPress={handleAddService}
        style={{ marginRight: -spacing.xs }}
      />
    </View>
  ), [styles, theme, handleAddService]);

  const renderServiceItem = useCallback(
    ({ item }: { item: ServiceOverviewItem }) => {
      const getStatusColor = (status: ServiceStatusState) => {
        switch (status) {
          case 'online':
            return styles.statusOnline;
          case 'offline':
            return styles.statusOffline;
          case 'degraded':
            return styles.statusDegraded;
          default:
            return styles.statusOffline;
        }
      };

      const getStatusIcon = (type: ServiceType) => {
        switch (type) {
          case 'sonarr':
            return 'television-classic';
          case 'radarr':
            return 'movie-open';
          case 'jellyseerr':
            return 'account-search';
          case 'qbittorrent':
            return 'download-network';
          default:
            return 'server';
        }
      };

      return (
        <Card variant="custom" style={styles.serviceCard} onPress={() => handleServicePress(item)}>
          <View style={styles.serviceContent}>
            <View style={styles.serviceIcon}>
              <IconButton icon={getStatusIcon(item.config.type)} size={24} iconColor={theme.colors.primary} />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{item.config.name}</Text>
              <View style={styles.serviceStatus}>
                <View style={[styles.statusIndicator, getStatusColor(item.status)]} />
                <Text style={styles.serviceStatusText}>
                  {item.status === 'online' ? 'Healthy' : item.status === 'offline' ? 'Offline' : 'Degraded'}
                </Text>
              </View>
            </View>
            <IconButton icon="chevron-right" size={20} iconColor={theme.colors.outline} />
          </View>
        </Card>
      );
    },
    [handleServicePress, styles],
  );

  const renderActivityItem = useCallback(() => (
    <>
      <Card variant="custom" style={styles.activityCard} onPress={() => router.push('/(auth)/downloads')}>
        <View style={styles.activityContent}>
          <View style={styles.activityIcon}>
            <IconButton icon="download" size={24} iconColor={theme.colors.primary} />
          </View>
          <View style={styles.activityInfo}>
            <Text style={styles.activityTitle}>Downloads</Text>
            <Text style={styles.activitySubtitle}>2 active</Text>
          </View>
          <IconButton icon="chevron-right" size={20} iconColor={theme.colors.outline} />
        </View>
      </Card>
      <Card variant="custom" style={styles.activityCard} onPress={() => {}}>
        <View style={styles.activityContent}>
          <View style={styles.activityIcon}>
            <IconButton icon="plus" size={24} iconColor={theme.colors.primary} />
          </View>
          <View style={styles.activityInfo}>
            <Text style={styles.activityTitle}>Recently Added</Text>
            <Text style={styles.activitySubtitle}>3 added</Text>
          </View>
          <IconButton icon="chevron-right" size={20} iconColor={theme.colors.outline} />
        </View>
      </Card>
    </>
  ), [router, styles]);

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
      <SafeAreaView style={styles.container}>
        <LoadingState message="Loading dashboard…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={services.length > 0 ? ['header', 'services', 'activity'] : ['header']}
        keyExtractor={(item) => item}
        renderItem={({ item }) => {
          switch (item) {
            case 'header':
              return renderHeader();
            case 'services':
              return (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Services</Text>
                  {services.map((service) => (
                    <View key={service.config.id}>
                      {renderServiceItem({ item: service })}
                    </View>
                  ))}
                </View>
              );
            case 'activity':
              return (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Activity</Text>
                  {renderActivityItem()}
                </View>
              );
            default:
              return null;
          }
        }}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.listSpacer} />}
        ListEmptyComponent={<View style={styles.emptyContainer}>{listEmptyComponent}</View>}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refetch()}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

export default DashboardScreen;
