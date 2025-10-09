import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme, IconButton, ProgressBar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/common/EmptyState';
import { SkeletonPlaceholder } from '@/components/common/Skeleton';
import type { AppTheme } from '@/constants/theme';
import { useProwlarrIndexers } from '@/hooks/useProwlarrIndexers';
import { spacing } from '@/theme/spacing';

const StatisticsCardSkeleton = () => {
  const theme = useTheme<AppTheme>();

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content style={styles.cardContent}>
        <SkeletonPlaceholder width={200} height={24} />
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <SkeletonPlaceholder width={80} height={32} />
            <SkeletonPlaceholder width={60} height={16} style={{ marginTop: spacing.xs }} />
          </View>
          <View style={styles.statItem}>
            <SkeletonPlaceholder width={80} height={32} />
            <SkeletonPlaceholder width={60} height={16} style={{ marginTop: spacing.xs }} />
          </View>
          <View style={styles.statItem}>
            <SkeletonPlaceholder width={80} height={32} />
            <SkeletonPlaceholder width={60} height={16} style={{ marginTop: spacing.xs }} />
          </View>
          <View style={styles.statItem}>
            <SkeletonPlaceholder width={80} height={32} />
            <SkeletonPlaceholder width={60} height={16} style={{ marginTop: spacing.xs }} />
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

const ProwlarrStatisticsScreen = () => {
  const { serviceId: rawServiceId } = useLocalSearchParams<{ serviceId?: string }>();
  const serviceId = typeof rawServiceId === 'string' ? rawServiceId : '';
  const hasValidServiceId = serviceId.length > 0;

  const theme = useTheme<AppTheme>();
  const { indexers, statistics, isLoading, error } = useProwlarrIndexers(serviceId);

  // Calculate aggregate statistics
  const aggregateStats = useMemo(() => {
    const enabledIndexers = indexers.filter(indexer => Boolean((indexer as any).enable)).length;
    const totalIndexers = indexers.length;
    const totalQueries = statistics.reduce((sum, stat) => sum + stat.statistics.queries, 0);
    const totalGrabs = statistics.reduce((sum, stat) => sum + stat.statistics.grabs, 0);
    const avgResponseTime = statistics.length > 0
      ? statistics.reduce((sum, stat) => sum + (stat.statistics.averageResponseTime || 0), 0) / statistics.length
      : 0;

    return {
      enabledIndexers,
      totalIndexers,
      totalQueries,
      totalGrabs,
      avgResponseTime,
      successRate: totalQueries > 0 ? (totalGrabs / totalQueries) * 100 : 0,
    };
  }, [indexers, statistics]);

  // Top performing indexers
  const topIndexers = useMemo(() => {
    return statistics
      .sort((a, b) => b.statistics.grabs - a.statistics.grabs)
      .slice(0, 5);
  }, [statistics]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {Array.from({ length: 3 }).map((_, index) => (
            <StatisticsCardSkeleton key={index} />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="alert-circle"
          title="Failed to Load Statistics"
          description={error}
        />
      </SafeAreaView>
    );
  }

  // Empty state
  if (indexers.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="chart-line"
          title="No Indexers Available"
          description="Add some indexers first to see their performance statistics."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Overview Card */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text variant="titleLarge" style={styles.cardTitle}>
                Indexer Overview
              </Text>
              <IconButton
                icon="chart-pie"
                size={24}
                iconColor={theme.colors.primary}
                style={styles.cardIcon}
              />
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <View style={styles.statHeader}>
                  <IconButton
                    icon="database"
                    size={20}
                    iconColor={theme.colors.primary}
                    style={styles.statIcon}
                  />
                  <Text variant="headlineMedium" style={[styles.statValue, { color: theme.colors.primary }]}>
                    {aggregateStats.totalIndexers}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Total Indexers
                </Text>
              </View>
              <View style={styles.statItem}>
                <View style={styles.statHeader}>
                  <IconButton
                    icon="check-circle"
                    size={20}
                    iconColor={theme.colors.secondary}
                    style={styles.statIcon}
                  />
                  <Text variant="headlineMedium" style={[styles.statValue, { color: theme.colors.secondary }]}>
                    {aggregateStats.enabledIndexers}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Active Indexers
                </Text>
              </View>
              <View style={styles.statItem}>
                <View style={styles.statHeader}>
                  <IconButton
                    icon="magnify"
                    size={20}
                    iconColor={theme.colors.tertiary}
                    style={styles.statIcon}
                  />
                  <Text variant="headlineMedium" style={[styles.statValue, { color: theme.colors.tertiary }]}>
                    {aggregateStats.totalQueries.toLocaleString()}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Total Queries
                </Text>
              </View>
              <View style={styles.statItem}>
                <View style={styles.statHeader}>
                  <IconButton
                    icon="download"
                    size={20}
                    iconColor={theme.colors.error}
                    style={styles.statIcon}
                  />
                  <Text variant="headlineMedium" style={[styles.statValue, { color: theme.colors.error }]}>
                    {aggregateStats.totalGrabs.toLocaleString()}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Total Grabs
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Performance Metrics Card */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text variant="titleLarge" style={styles.cardTitle}>
                Performance Metrics
              </Text>
              <IconButton
                icon="speedometer"
                size={24}
                iconColor={theme.colors.primary}
                style={styles.cardIcon}
              />
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <View style={styles.statHeader}>
                  <IconButton
                    icon="percent"
                    size={20}
                    iconColor={theme.colors.primary}
                    style={styles.statIcon}
                  />
                  <Text variant="headlineSmall" style={[styles.statValue, { color: theme.colors.primary }]}>
                    {aggregateStats.successRate.toFixed(1)}%
                  </Text>
                </View>
                <Text variant="bodyMedium" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Success Rate
                </Text>
                <ProgressBar
                  progress={aggregateStats.successRate / 100}
                  color={theme.colors.primary}
                  style={styles.progressBar}
                />
              </View>
              <View style={styles.statItem}>
                <View style={styles.statHeader}>
                  <IconButton
                    icon="timer"
                    size={20}
                    iconColor={theme.colors.secondary}
                    style={styles.statIcon}
                  />
                  <Text variant="headlineSmall" style={[styles.statValue, { color: theme.colors.secondary }]}>
                    {aggregateStats.avgResponseTime.toFixed(0)}ms
                  </Text>
                </View>
                <Text variant="bodyMedium" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Avg Response Time
                </Text>
              </View>
              <View style={styles.statItem}>
                <View style={styles.statHeader}>
                  <IconButton
                    icon="magnify-scan"
                    size={20}
                    iconColor={theme.colors.tertiary}
                    style={styles.statIcon}
                  />
                  <Text variant="headlineSmall" style={[styles.statValue, { color: theme.colors.tertiary }]}>
                    {aggregateStats.enabledIndexers > 0 ? (aggregateStats.totalQueries / aggregateStats.enabledIndexers).toFixed(0) : '0'}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Queries per Indexer
                </Text>
              </View>
              <View style={styles.statItem}>
                <View style={styles.statHeader}>
                  <IconButton
                    icon="download-multiple"
                    size={20}
                    iconColor={theme.colors.error}
                    style={styles.statIcon}
                  />
                  <Text variant="headlineSmall" style={[styles.statValue, { color: theme.colors.error }]}>
                    {aggregateStats.enabledIndexers > 0 ? (aggregateStats.totalGrabs / aggregateStats.enabledIndexers).toFixed(0) : '0'}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Grabs per Indexer
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Top Performing Indexers Card */}
        {topIndexers.length > 0 && (
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Top Performing Indexers
                </Text>
                <IconButton
                  icon="trophy"
                  size={24}
                  iconColor={theme.colors.primary}
                  style={styles.cardIcon}
                />
              </View>
              <View style={styles.topIndexersList}>
                {topIndexers.map((stat, index) => (
                  <View key={stat.applicationId} style={styles.topIndexerItem}>
                    <View style={styles.topIndexerRank}>
                      <Text variant="bodyLarge" style={[styles.rankText, { color: theme.colors.primary }]}>
                        #{index + 1}
                      </Text>
                    </View>
                    <View style={styles.topIndexerInfo}>
                      <Text variant="bodyLarge" style={styles.topIndexerName}>
                        {stat.applicationName}
                      </Text>
                      <Text variant="bodyMedium" style={[styles.topIndexerStats, { color: theme.colors.onSurfaceVariant }]}>
                        {stat.statistics.grabs} grabs • {stat.statistics.queries} queries
                      </Text>
                    </View>
                    <View style={styles.topIndexerValue}>
                      <Text variant="bodyLarge" style={[styles.grabCount, { color: theme.colors.primary }]}>
                        {stat.statistics.grabs}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Indexer Status Distribution */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text variant="titleLarge" style={styles.cardTitle}>
                Indexer Status Distribution
              </Text>
              <IconButton
                icon="chart-pie"
                size={24}
                iconColor={theme.colors.primary}
                style={styles.cardIcon}
              />
            </View>
            <View style={styles.statusGrid}>
              <View style={styles.statusItem}>
                <View style={[styles.statusIndicator, { backgroundColor: theme.colors.primary }]} />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                  Enabled: {aggregateStats.enabledIndexers}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusIndicator, { backgroundColor: theme.colors.outline }]} />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                  Disabled: {aggregateStats.totalIndexers - aggregateStats.enabledIndexers}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    elevation: 2,
  },
  cardContent: {
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    flex: 1,
  },
  cardIcon: {
    margin: 0,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statItem: {
    flex: 1,
    minWidth: 120,
    alignItems: 'center',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statIcon: {
    margin: 0,
  },
  statValue: {
    fontWeight: '700',
  },
  statLabel: {
    textAlign: 'center',
    fontSize: 12,
  },
  progressBar: {
    width: '100%',
    height: 4,
    marginTop: spacing.xs,
  },
  topIndexersList: {
    gap: spacing.sm,
  },
  topIndexerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  topIndexerRank: {
    width: 32,
    alignItems: 'center',
  },
  rankText: {
    fontWeight: '600',
  },
  topIndexerInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  topIndexerName: {
    fontWeight: '500',
  },
  topIndexerStats: {
    fontSize: 12,
  },
  topIndexerValue: {
    alignItems: 'flex-end',
  },
  grabCount: {
    fontWeight: '600',
  },
  statusGrid: {
    gap: spacing.sm,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

export default ProwlarrStatisticsScreen;
