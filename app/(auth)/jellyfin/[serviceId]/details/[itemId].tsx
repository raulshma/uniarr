import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Share, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  HelperText,
  IconButton,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { EmptyState } from '@/components/common/EmptyState';
import { MediaPoster } from '@/components/media/MediaPoster';
import type { AppTheme } from '@/constants/theme';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import type { JellyfinConnector } from '@/connectors/implementations/JellyfinConnector';
import { useJellyfinItemDetails } from '@/hooks/useJellyfinItemDetails';
import { spacing } from '@/theme/spacing';

const formatRuntimeMinutes = (ticks?: number): number | undefined => {
  if (!ticks || ticks <= 0) {
    return undefined;
  }

  const minutes = Math.round(ticks / 600_000_000);
  return minutes > 0 ? minutes : undefined;
};

const deriveYear = (itemPremiere?: string, productionYear?: number): number | undefined => {
  if (productionYear) {
    return productionYear;
  }

  if (itemPremiere) {
    const parsed = new Date(itemPremiere);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getFullYear();
    }
  }

  return undefined;
};

const JellyfinItemDetailsScreen = () => {
  const { serviceId: rawServiceId, itemId: rawItemId } = useLocalSearchParams<{ serviceId?: string; itemId?: string }>();
  const serviceId = typeof rawServiceId === 'string' ? rawServiceId : undefined;
  const itemId = typeof rawItemId === 'string' ? rawItemId : undefined;
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const connector = useMemo(() => {
    if (!serviceId) {
      return undefined;
    }
    return manager.getConnector(serviceId) as JellyfinConnector | undefined;
  }, [manager, serviceId]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!serviceId) {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        if (!manager.getConnector(serviceId)) {
          await manager.loadSavedServices();
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [manager, serviceId]);

  const detailsQuery = useJellyfinItemDetails({ serviceId, itemId });

  const item = detailsQuery.data;
  const isLoading = isBootstrapping || detailsQuery.isLoading;
  const errorMessage = detailsQuery.error instanceof Error ? detailsQuery.error.message : detailsQuery.error ? 'Unable to load item details.' : null;

  const runtimeMinutes = useMemo(() => formatRuntimeMinutes(item?.RunTimeTicks), [item?.RunTimeTicks]);
  const releaseYear = useMemo(() => deriveYear(item?.PremiereDate, item?.ProductionYear), [item?.PremiereDate, item?.ProductionYear]);
  const ratingLabel = item?.OfficialRating ?? (item?.CommunityRating ? `${item.CommunityRating.toFixed(1)}★` : undefined);
  const heroTag = item?.BackdropImageTags?.[0] ?? item?.ImageTags?.Backdrop;
  const heroUri = heroTag && connector && item ? connector.getImageUrl(item.Id, 'Backdrop', { tag: heroTag, width: 1280 }) : undefined;
  const posterUri = item?.Id && connector ? connector.getImageUrl(item.Id, 'Primary', { tag: item.PrimaryImageTag ?? item.ImageTags?.Primary, width: 720 }) : undefined;
  const cast = useMemo(
    () => (item?.People ?? []).filter((person) => person?.Type === 'Actor').slice(0, 12),
    [item?.People],
  );
  const genres = item?.Genres ?? [];

  const providerSummary = useMemo(() => {
    const providers = item?.ProviderIds ?? {};
    const mapped = Object.entries(providers)
      .map(([key, value]) => ({ key, value }))
      .filter((entry) => Boolean(entry.value));

    if (mapped.length === 0) {
      return 'No external identifiers linked.';
    }

    return `Linked providers: ${mapped.map((entry) => entry.key.toUpperCase()).join(', ')}`;
  }, [item?.ProviderIds]);

  const handleNavigateBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleShare = useCallback(async () => {
    if (!item) {
      return;
    }

    const message = [item.Name ?? 'Untitled', item.Overview].filter(Boolean).join('\n\n');

    try {
      await Share.share({ message });
    } catch {
      // Swallow share errors silently.
    }
  }, [item]);

  const handlePlay = useCallback(async () => {
    if (!connector || !item) {
      return;
    }

    const baseUrl = connector.config.url.replace(/\/$/, '');
    const deepLink = `${baseUrl}/web/index.html#!/details?id=${item.Id}`;

    try {
      await Linking.openURL(deepLink);
    } catch {
      setSyncStatus('Unable to open Jellyfin web player.');
    }
  }, [connector, item]);

  const handleSyncMetadata = useCallback(async () => {
    if (!connector || !item) {
      return;
    }

    try {
      setIsSyncing(true);
      await connector.refreshItemMetadata(item.Id, false);
      setSyncStatus('Metadata refresh requested. Jellyfin will update this item shortly.');
      await detailsQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh metadata.';
      setSyncStatus(message);
    } finally {
      setIsSyncing(false);
    }
  }, [connector, detailsQuery, item]);

  const renderCastMember = useCallback(
    ({ item: person }: { item: typeof cast[number] }) => {
      const avatarUri = person?.Id && connector?.getPersonImageUrl(person.Id, person.PrimaryImageTag, { width: 320 });

      return (
        <View style={styles.castCard}>
          <View style={styles.castAvatarShell}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.castAvatar} cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.castAvatar, styles.castAvatarPlaceholder]}>
                <Text variant="titleMedium" style={styles.castAvatarInitial}>
                  {person?.Name?.charAt(0) ?? '?'}
                </Text>
              </View>
            )}
          </View>
          <Text variant="bodyMedium" numberOfLines={1} style={styles.castName}>
            {person?.Name ?? 'Unknown'}
          </Text>
          {person?.Role ? (
            <Text variant="bodySmall" numberOfLines={1} style={styles.castRole}>
              {person.Role}
            </Text>
          ) : null}
        </View>
      );
    },
    [connector, styles],
  );

  if (!serviceId || !itemId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Missing item context"
          description="We could not determine which Jellyfin item to display."
          actionLabel="Go back"
          onActionPress={handleNavigateBack}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator animating size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Unable to load details"
          description={errorMessage}
          actionLabel="Retry"
          onActionPress={() => void detailsQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Item not found"
          description="This media could not be located on the Jellyfin server."
          actionLabel="Close"
          onActionPress={handleNavigateBack}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.scaffold}>
        <View style={styles.heroArea}>
          {heroUri ? <Image source={{ uri: heroUri }} style={styles.heroImage} cachePolicy="memory-disk" /> : null}
          <View style={[StyleSheet.absoluteFill, styles.heroOverlay]} />
          <View style={styles.heroActions}>
            <IconButton icon="arrow-left" accessibilityLabel="Go back" onPress={handleNavigateBack} />
            <IconButton icon="share-variant" accessibilityLabel="Share item" onPress={handleShare} />
          </View>
          <View style={styles.heroPoster}>
            <MediaPoster uri={posterUri} size={200} />
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.detailsContent}>
              <Text variant="headlineSmall" style={styles.title}>
                {item.Name ?? 'Untitled'}
              </Text>
              <View style={styles.metaRow}>
                {releaseYear ? (
                  <Chip icon="calendar" compact>{releaseYear}</Chip>
                ) : null}
                {runtimeMinutes ? (
                  <Chip icon="clock-outline" compact>{`${runtimeMinutes} min`}</Chip>
                ) : null}
                {ratingLabel ? (
                  <Chip icon="star" compact>{ratingLabel}</Chip>
                ) : null}
              </View>

              {item.Overview ? (
                <Text variant="bodyMedium" style={styles.overview}>
                  {item.Overview}
                </Text>
              ) : null}

              <View style={styles.actionRow}>
                <Button mode="contained" icon="play" onPress={handlePlay}>
                  Play on Jellyfin
                </Button>
                <Button mode="outlined" icon="sync" loading={isSyncing} onPress={handleSyncMetadata}>
                  Update
                </Button>
              </View>

              <Surface style={styles.syncCard} elevation={1}>
                <Text variant="titleMedium" style={styles.syncTitle}>
                  Sync Status
                </Text>
                <Text variant="bodySmall" style={styles.syncDescription}>
                  {syncStatus ?? providerSummary}
                </Text>
              </Surface>

              <View style={styles.sectionHeader}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Cast
                </Text>
              </View>
              {cast.length > 0 ? (
                <FlashList
                  data={cast}
                  keyExtractor={(person) => person.Id}
                  renderItem={renderCastMember}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.castList}
                />
              ) : (
                <Text variant="bodySmall" style={styles.sectionEmptyText}>
                  Cast information is not available.
                </Text>
              )}

              <View style={styles.sectionHeader}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Genres
                </Text>
              </View>
              {genres.length > 0 ? (
                <View style={styles.genreRow}>
                  {genres.map((genre) => (
                    <Chip key={genre} mode="flat" style={styles.genreChip}>
                      {genre}
                    </Chip>
                  ))}
                </View>
              ) : (
                <Text variant="bodySmall" style={styles.sectionEmptyText}>
                  No genres available for this item.
                </Text>
              )}
          </View>
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </View>
      <HelperText type="info" visible={Boolean(syncStatus)}>
        {syncStatus ?? ''}
      </HelperText>
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scaffold: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    heroArea: {
      height: 320,
      position: 'relative',
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    heroOverlay: {
      backgroundColor: theme.colors.backdrop,
      opacity: 0.4,
    },
    heroActions: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroPoster: {
      position: 'absolute',
      bottom: -100,
      left: spacing.lg,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    scrollContent: {
      paddingBottom: spacing.xxl,
    },
    detailsContent: {
      paddingTop: spacing.xxxl,
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
    },
    title: {
      color: theme.colors.onSurface,
      fontWeight: '700',
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    overview: {
      color: theme.colors.onSurfaceVariant,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    syncCard: {
      padding: spacing.md,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
    },
    syncTitle: {
      color: theme.colors.onSurface,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    syncDescription: {
      color: theme.colors.onSurfaceVariant,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      color: theme.colors.onSurface,
      fontWeight: '600',
    },
    sectionEmptyText: {
      color: theme.colors.onSurfaceVariant,
    },
    castList: {
      marginTop: spacing.sm,
      gap: spacing.md,
    },
    castCard: {
      width: 120,
      alignItems: 'center',
      gap: spacing.xs,
    },
    castAvatarShell: {
      width: 96,
      height: 96,
      borderRadius: 48,
      overflow: 'hidden',
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    castAvatar: {
      width: '100%',
      height: '100%',
      borderRadius: 48,
    },
    castAvatarPlaceholder: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    castAvatarInitial: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: '600',
    },
    castName: {
      color: theme.colors.onSurface,
      fontWeight: '600',
      textAlign: 'center',
    },
    castRole: {
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    genreRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    genreChip: {
      borderRadius: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default JellyfinItemDetailsScreen;
