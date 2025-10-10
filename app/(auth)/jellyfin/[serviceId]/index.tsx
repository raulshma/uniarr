import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Chip, HelperText, IconButton, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { MediaPoster } from '@/components/media/MediaPoster';
import type { AppTheme } from '@/constants/theme';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import type { JellyfinConnector } from '@/connectors/implementations/JellyfinConnector';
import { useJellyfinLibraries } from '@/hooks/useJellyfinLibraries';
import { useJellyfinLatestItems } from '@/hooks/useJellyfinLatestItems';
import { useJellyfinResume } from '@/hooks/useJellyfinResume';
import type { JellyfinItem, JellyfinLatestItem, JellyfinResumeItem } from '@/models/jellyfin.types';
import { spacing } from '@/theme/spacing';

const formatEpisodeLabel = (item: JellyfinItem): string | undefined => {
  if (item.Type !== 'Episode') {
    return undefined;
  }

  const season = typeof item.ParentIndexNumber === 'number' ? `S${String(item.ParentIndexNumber).padStart(2, '0')}` : '';
  const episode = typeof item.IndexNumber === 'number' ? `E${String(item.IndexNumber).padStart(2, '0')}` : '';

  if (!season && !episode) {
    return undefined;
  }

  return `${season}${episode}`.trim();
};

const buildPosterUri = (connector: JellyfinConnector | undefined, item: JellyfinItem, fallbackWidth: number): string | undefined => {
  if (!connector) {
    return undefined;
  }

  const tag = item.PrimaryImageTag ?? item.ImageTags?.Primary;
  if (!tag) {
    return undefined;
  }

  return connector.getImageUrl(item.Id, 'Primary', { tag, width: fallbackWidth });
};

const JellyfinServiceScreen = () => {
  const { serviceId: rawServiceId } = useLocalSearchParams<{ serviceId?: string }>();
  const serviceId = typeof rawServiceId === 'string' ? rawServiceId : undefined;
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [serverVersion, setServerVersion] = useState<string | null>(null);

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

  useEffect(() => {
    let mounted = true;

    const resolveVersion = async () => {
      if (!connector) {
        return;
      }

      try {
        const fetched = await connector.getVersion();
        if (mounted) {
          setServerVersion(fetched);
        }
      } catch {
        if (mounted) {
          setServerVersion(null);
        }
      }
    };

    void resolveVersion();

    return () => {
      mounted = false;
    };
  }, [connector]);

  const librariesQuery = useJellyfinLibraries(serviceId);
  const resumeQuery = useJellyfinResume({ serviceId, limit: 20 });
  const latestQuery = useJellyfinLatestItems({ serviceId, libraryId: selectedLibraryId ?? undefined, limit: 24 });

  useEffect(() => {
    if (!selectedLibraryId && librariesQuery.data && librariesQuery.data.length > 0) {
      const firstLibrary = librariesQuery.data[0];
      if (firstLibrary) {
        setSelectedLibraryId(firstLibrary.Id);
      }
    }
  }, [librariesQuery.data, selectedLibraryId]);

  const isLoading =
    isBootstrapping ||
    librariesQuery.isLoading ||
    resumeQuery.isLoading ||
    latestQuery.isLoading;

  const errorMessage = useMemo(() => {
    const error = librariesQuery.error ?? resumeQuery.error ?? latestQuery.error;
    if (error instanceof Error) {
      return error.message;
    }
    return error ? 'Unable to load Jellyfin data.' : null;
  }, [latestQuery.error, librariesQuery.error, resumeQuery.error]);

  const serviceName = connector?.config.name ?? 'Jellyfin';

  const handleRefresh = useCallback(async () => {
    await Promise.all([librariesQuery.refetch(), resumeQuery.refetch(), latestQuery.refetch()]);
  }, [latestQuery, librariesQuery, resumeQuery]);

  const handleOpenSettings = useCallback(() => {
    if (!serviceId) {
      return;
    }
    router.push({ pathname: '/(auth)/edit-service', params: { serviceId } });
  }, [router, serviceId]);

  const handleNavigateBack = useCallback(() => {
    router.back();
  }, [router]);

  const renderResumeItem = useCallback(
    ({ item }: { item: JellyfinResumeItem }) => {
      const title = item.SeriesName ?? item.Name ?? 'Untitled';
      const subtitle = item.Type === 'Episode' ? item.Name ?? undefined : item.Overview ?? undefined;
      const posterUri = buildPosterUri(connector, item, 360);
      const progress =
        typeof item.UserData?.PlaybackPositionTicks === 'number' && typeof item.RunTimeTicks === 'number'
          ? Math.min(Math.max(item.UserData.PlaybackPositionTicks / item.RunTimeTicks, 0), 1)
          : undefined;

      return (
        <View style={styles.resumeCard}>
          <MediaPoster uri={posterUri} size={120} accessibilityLabel={`Continue watching ${title}`} />
          <View style={styles.resumeMeta}>
            <Text variant="bodyMedium" numberOfLines={1} style={styles.resumeTitle}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="bodySmall" numberOfLines={2} style={styles.resumeSubtitle}>
                {subtitle}
              </Text>
            ) : null}
            {typeof progress === 'number' ? (
              <View style={styles.progressRail}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
            ) : null}
          </View>
        </View>
      );
    },
    [connector, styles],
  );

  const renderLatestItem = useCallback(
    ({ item }: { item: JellyfinLatestItem }) => {
      const posterUri = buildPosterUri(connector, item, 420);
      const subtitle = item.Type === 'Episode' ? item.SeriesName : undefined;
      const status = formatEpisodeLabel(item);

      return (
        <View style={styles.latestCard}>
          <MediaPoster uri={posterUri} size={96} />
          <View style={styles.latestMeta}>
            <Text variant="titleSmall" numberOfLines={1} style={styles.latestTitle}>
              {item.Name ?? 'Untitled'}
            </Text>
            {subtitle ? (
              <Text variant="bodySmall" numberOfLines={1} style={styles.latestSubtitle}>
                {subtitle}
              </Text>
            ) : null}
            {status ? (
              <Chip compact mode="outlined" style={styles.episodeChip}>
                {status}
              </Chip>
            ) : null}
          </View>
        </View>
      );
    },
    [connector, styles],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextGroup}>
            <Text variant="headlineSmall" style={styles.headerTitle}>
              {serviceName}
            </Text>
            <Text variant="bodyMedium" style={styles.headerSubtitle}>
              Unified Jellyfin dashboard
            </Text>
            <View style={styles.headerChips}>
              <Chip icon="server" compact>
                {serverVersion ? `Server ${serverVersion}` : 'Server connected'}
              </Chip>
              {selectedLibraryId ? (
                <Chip icon="folder-multiple" compact>
                  {librariesQuery.data?.find((library) => library.Id === selectedLibraryId)?.Name ?? 'Library'}
                </Chip>
              ) : null}
            </View>
          </View>
          <View style={styles.headerActions}>
            <IconButton icon="refresh" accessibilityLabel="Refresh" onPress={handleRefresh} />
            <IconButton icon="cog" accessibilityLabel="Edit service" onPress={handleOpenSettings} />
          </View>
        </View>

        {!serviceId ? (
          <View style={styles.emptyState}>
            <EmptyState
              title="Service not specified"
              description="Return to the dashboard and select a Jellyfin service to continue."
            />
          </View>
        ) : !connector && !isBootstrapping ? (
          <View style={styles.emptyState}>
            <EmptyState
              title="Service unavailable"
              description="We couldn't load this Jellyfin connection. Try refreshing or reconfiguring the service."
            />
          </View>
        ) : (
          <>
            {isLoading ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator animating size="large" />
              </View>
            ) : null}

            {errorMessage ? <HelperText type="error">{errorMessage}</HelperText> : null}

            {!isLoading && !errorMessage ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Continue Watching
                  </Text>
                  <Button mode="text" onPress={() => void resumeQuery.refetch()}>
                    Refresh
                  </Button>
                </View>

                {resumeQuery.data && resumeQuery.data.length > 0 ? (
                  <FlashList
                    data={resumeQuery.data}
                    keyExtractor={(item) => item.Id}
                    renderItem={renderResumeItem}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.resumeList}
                  />
                ) : (
                  <View style={styles.emptyState}>
                    <EmptyState
                      title="Nothing queued up"
                      description="Start something in Jellyfin to see it here."
                    />
                  </View>
                )}

                <View style={styles.sectionHeader}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Libraries
                  </Text>
                </View>

                {librariesQuery.data && librariesQuery.data.length > 0 ? (
                  <View style={styles.libraryList}>
                    {librariesQuery.data.map((library) => (
                      <Chip
                        key={library.Id}
                        mode={selectedLibraryId === library.Id ? 'flat' : 'outlined'}
                        selected={selectedLibraryId === library.Id}
                        onPress={() => setSelectedLibraryId(library.Id)}
                        style={styles.libraryChip}
                      >
                        {library.Name}
                      </Chip>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <EmptyState
                      title="No libraries detected"
                      description="Verify your Jellyfin server exposes libraries for this account."
                    />
                  </View>
                )}

                <View style={styles.sectionHeader}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Latest Additions
                  </Text>
                  <Button mode="text" onPress={() => void latestQuery.refetch()}>
                    Refresh
                  </Button>
                </View>

                {latestQuery.data && latestQuery.data.length > 0 ? (
                  <FlashList
                    data={latestQuery.data}
                    keyExtractor={(item) => item.Id}
                    renderItem={renderLatestItem}
                    contentContainerStyle={styles.latestList}
                  />
                ) : (
                  <View style={styles.emptyState}>
                    <EmptyState
                      title="No recent additions"
                      description="Newly added media will appear here as soon as Jellyfin indexes them."
                    />
                  </View>
                )}
              </>
            ) : null}
          </>
        )}

        <View style={styles.footerActions}>
          <Button mode="text" icon="arrow-left" onPress={handleNavigateBack}>
            Back
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.xl,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTextGroup: {
      flex: 1,
      gap: spacing.xs,
    },
    headerTitle: {
      color: theme.colors.onBackground,
      fontWeight: '600',
    },
    headerSubtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    headerChips: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    loadingBlock: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
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
    resumeList: {
      paddingVertical: spacing.sm,
      gap: spacing.md,
    },
    resumeCard: {
      width: 180,
      gap: spacing.sm,
    },
    resumeMeta: {
      gap: spacing.xs,
    },
    resumeTitle: {
      color: theme.colors.onSurface,
      fontWeight: '600',
    },
    resumeSubtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    progressRail: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.surfaceVariant,
      overflow: 'hidden',
      width: '100%',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: 3,
    },
    libraryList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    libraryChip: {
      borderRadius: 16,
    },
    latestList: {
      gap: spacing.sm,
    },
    latestCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.sm,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
    },
    latestMeta: {
      flex: 1,
      gap: spacing.xs,
    },
    latestTitle: {
      color: theme.colors.onSurface,
      fontWeight: '600',
    },
    latestSubtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    episodeChip: {
      alignSelf: 'flex-start',
    },
    emptyState: {
      marginTop: spacing.sm,
      alignSelf: 'stretch',
    },
    footerActions: {
      alignItems: 'flex-start',
    },
  });

export default JellyfinServiceScreen;
