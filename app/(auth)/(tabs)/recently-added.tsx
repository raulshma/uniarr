import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { MediaCard } from '@/components/media/MediaCard';
import { useRecentlyAdded, type RecentlyAddedItem } from '@/hooks/useRecentlyAdded';
import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';

const RecentlyAddedScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();

  const {
    recentlyAdded,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useRecentlyAdded();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: theme.colors.background,
        },
        backButton: {
          marginLeft: -spacing.xs,
        },
        listContent: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
        },
        mediaItem: {
          backgroundColor: theme.colors.elevation.level1,
          marginVertical: spacing.xs,
          borderRadius: 12,
        },
        mediaContent: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
        },
        mediaIcon: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.colors.surfaceVariant,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
        },
        mediaInfo: {
          flex: 1,
        },
        mediaTitle: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          lineHeight: theme.custom.typography.titleMedium.lineHeight,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
          marginBottom: spacing.xxs,
        },
        mediaSubtitle: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          lineHeight: theme.custom.typography.bodyMedium.lineHeight,
          letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
          fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
        },
        mediaArrow: {
          color: theme.colors.outline,
        },
        emptyContainer: {
          flexGrow: 1,
          paddingTop: spacing.xl,
        },
      }),
    [theme],
  );

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleMediaPress = useCallback((item: RecentlyAddedItem) => {
    // Navigate to service-specific pages
    switch (item.type) {
      case 'series':
        router.push({ pathname: '/(auth)/sonarr/[serviceId]', params: { serviceId: item.serviceId } });
        break;
      case 'movie':
        router.push({ pathname: '/(auth)/radarr/[serviceId]', params: { serviceId: item.serviceId } });
        break;
    }
  }, [router]);

  const getMediaIcon = (type: 'series' | 'movie') => {
    return type === 'series' ? 'television-classic' : 'movie-open';
  };

  const renderMediaItem = useCallback(
    ({ item }: { item: RecentlyAddedItem }) => (
      <Card variant="custom" style={styles.mediaItem} onPress={() => handleMediaPress(item)}>
        <View style={styles.mediaContent}>
          <View style={styles.mediaIcon}>
            <IconButton icon={getMediaIcon(item.type)} size={24} iconColor={theme.colors.primary} />
          </View>
          <View style={styles.mediaInfo}>
            <Text style={styles.mediaTitle}>{item.title}</Text>
            <Text style={styles.mediaSubtitle}>
              {item.type === 'series' ? 'TV Series' : 'Movie'} • Added {formatRelativeTime(new Date(item.addedDate))} • {item.serviceName}
            </Text>
          </View>
          <IconButton icon="chevron-right" size={20} iconColor={theme.colors.outline} />
        </View>
      </Card>
    ),
    [handleMediaPress, styles, theme],
  );

  const formatRelativeTime = (input: Date): string => {
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

  const listEmptyComponent = useMemo(() => {
    if (isError) {
      const message = error instanceof Error ? error.message : 'Unable to load recently added content.';

      return (
        <EmptyState
          title="Failed to load recently added"
          description={message}
          actionLabel="Retry"
          onActionPress={handleRefresh}
        />
      );
    }

    return (
      <EmptyState
        title="No recently added content"
        description="No movies or TV series have been recently added to your services."
      />
    );
  }, [error, handleRefresh, isError]);

  if (isLoading && recentlyAdded.items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState message="Loading recently added..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={theme.colors.onBackground}
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <View style={{ flex: 1 }} />
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.listContent}>
        {recentlyAdded.items.map((item) => (
          <View key={item.id}>
            {renderMediaItem({ item })}
          </View>
        ))}
        {recentlyAdded.items.length === 0 && (
          <View style={styles.emptyContainer}>{listEmptyComponent}</View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default RecentlyAddedScreen;
