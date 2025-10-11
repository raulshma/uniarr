import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Chip,
  HelperText,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";

import { EmptyState } from "@/components/common/EmptyState";
import { MediaPoster } from "@/components/media/MediaPoster";
import type { AppTheme } from "@/constants/theme";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { useConnectorsStore } from '@/store/connectorsStore';
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { useJellyfinNowPlaying } from "@/hooks/useJellyfinNowPlaying";
import type {
  JellyfinItem,
  JellyfinSession,
  JellyfinSessionPlayState,
} from "@/models/jellyfin.types";
import { spacing } from "@/theme/spacing";

const TICKS_PER_SECOND = 10_000_000;

const hasRunTimeTicks = (
  obj: unknown
): obj is { RunTimeTicks?: number | null } =>
  typeof obj === "object" && obj !== null && "RunTimeTicks" in obj;

const computeProgress = (session: JellyfinSession | undefined): number => {
  const playState = session?.PlayState as JellyfinSessionPlayState | undefined;
  if (!playState) return 0;

  const runtime = hasRunTimeTicks(playState)
    ? playState.RunTimeTicks ?? session?.NowPlayingItem?.RunTimeTicks ?? 0
    : session?.NowPlayingItem?.RunTimeTicks ?? 0;
  const position = playState.PositionTicks ?? 0;

  if (runtime <= 0) return 0;

  return Math.min(Math.max(position / runtime, 0), 1);
};

const formatTimeLabel = (ticks?: number): string => {
  if (!ticks || ticks <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.max(0, Math.floor(ticks / TICKS_PER_SECOND));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const deriveSubtitle = (item: JellyfinItem | undefined): string | undefined => {
  if (!item) {
    return undefined;
  }

  if (item.SeriesName) {
    return item.SeriesName;
  }

  return item.Studios?.[0]?.Name ?? undefined;
};

const JellyfinNowPlayingScreen = () => {
  const { serviceId: rawServiceId } = useLocalSearchParams<{
    serviceId?: string;
  }>();
  const serviceId = typeof rawServiceId === "string" ? rawServiceId : undefined;
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const manager = useMemo(() => ConnectorManager.getInstance(), []);
  const connector = useConnectorsStore((s) =>
    serviceId ? (s.getConnector(serviceId) as JellyfinConnector | undefined) : undefined,
  );

  const [isBootstrapping, setIsBootstrapping] = useState(true);


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

  const nowPlayingQuery = useJellyfinNowPlaying({
    serviceId,
    refetchInterval: 10_000,
  });
  const sessions = nowPlayingQuery.data ?? [];

  // Preserve the last-known active session that contains a NowPlayingItem. Some
  // Jellyfin session responses (for paused / transitioning states) may omit
  // the NowPlayingItem while still returning a session object. In that case we
  // want to keep showing the last-known item rather than replacing it with an
  // empty/partial response which causes a transient "Nothing is playing" UI.
  const [cachedActiveSession, setCachedActiveSession] = useState<
    (typeof sessions)[number] | null
  >(sessions.length && sessions[0]?.NowPlayingItem ? sessions[0] : null);

  useEffect(() => {
    if (!sessions.length) return;

    const incoming = sessions[0];
    // Only update the cached active session when the incoming session includes
    // a NowPlayingItem. If it's missing, keep the previous cached value.
    if (incoming?.NowPlayingItem) {
      setCachedActiveSession(incoming);
    }
  }, [sessions]);

  // Determine which session to render. Prefer a current session that includes
  // a NowPlayingItem; otherwise fall back to the cached active session.
  const activeSession =
    (sessions.length && sessions[0]?.NowPlayingItem && sessions[0]) ||
    cachedActiveSession ||
    sessions[0];

  const item = activeSession?.NowPlayingItem;
  const progress = computeProgress(activeSession);
  const activePlayState = activeSession?.PlayState as
    | JellyfinSessionPlayState
    | undefined;
  const positionTicks = activePlayState?.PositionTicks ?? 0;
  const runtimeTicks = hasRunTimeTicks(activePlayState)
    ? activePlayState?.RunTimeTicks ?? item?.RunTimeTicks ?? 0
    : item?.RunTimeTicks ?? 0;
  const volumeLevel = activePlayState?.VolumeLevel ?? 0;

  // Consider loading only if we're bootstrapping or the query is loading and we
  // have no cached active session to show. If we have a cached active session
  // prefer showing that instead of the loading spinner / empty state.
  const isLoading =
    isBootstrapping || (nowPlayingQuery.isLoading && sessions.length === 0 && !cachedActiveSession);
  const errorMessage =
    nowPlayingQuery.error instanceof Error
      ? nowPlayingQuery.error.message
      : nowPlayingQuery.error
      ? "Unable to load playback status."
      : null;

  const primaryImageTag =
    (item as unknown as { PrimaryImageTag?: string })?.PrimaryImageTag ??
    item?.ImageTags?.Primary;

  const posterUri =
    item && connector && item.Id
      ? connector.getImageUrl(item.Id, "Primary", {
          tag: primaryImageTag,
          width: 720,
        })
      : undefined;
  const backdropTag = item?.BackdropImageTags?.[0] ?? item?.ImageTags?.Backdrop;
  const backdropUri =
    item && connector && backdropTag && item.Id
      ? connector.getImageUrl(item.Id, "Backdrop", {
          tag: backdropTag,
          width: 1280,
        })
      : undefined;

  const handleNavigateBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleReload = useCallback(() => {
    void nowPlayingQuery.refetch();
  }, [nowPlayingQuery]);

  const ensureControlsReady = useCallback(() => {
    if (!connector) {
      return false;
    }
    if (!activeSession) {
      return false;
    }
    return true;
  }, [activeSession, connector]);

  const handleTogglePlay = useCallback(async () => {
    if (!ensureControlsReady() || !connector || !activeSession) {
      return;
    }

    try {
      if (!activeSession.Id) throw new Error('Session id missing');
      await connector.sendPlaystateCommand(activeSession.Id, 'PlayPause');
      // Optimistically toggle paused state so UI remains responsive until refetch
      try {
        setCachedActiveSession((prev) => {
          if (!prev) return prev;
          const existing = (prev.PlayState ?? {}) as JellyfinSessionPlayState;
          const newPlayState: JellyfinSessionPlayState = {
            ...existing,
            IsPaused: !(existing.IsPaused ?? false),
          };
          return { ...prev, PlayState: newPlayState } as JellyfinSession;
        });
      } catch {
        // ignore optimistic update failures
      }

      void nowPlayingQuery.refetch();
    } catch (error) {
      // swallow errors silently per request
    }
  }, [activeSession, connector, ensureControlsReady, nowPlayingQuery]);

  const handleSkip = useCallback(
    async (direction: "NextTrack" | "PreviousTrack") => {
      if (!ensureControlsReady() || !connector || !activeSession) {
        return;
      }

      try {
        if (!activeSession.Id) throw new Error('Session id missing');
        await connector.sendPlaystateCommand(activeSession.Id, direction);
        // Optimistically reset position and mark unpaused so subsequent commands
        // can operate against the expected state until the server responds.
        setCachedActiveSession((prev) => {
          if (!prev) return prev;
          const existing = (prev.PlayState ?? {}) as JellyfinSessionPlayState;
          const newPlayState: JellyfinSessionPlayState = {
            ...existing,
            PositionTicks: 0,
            IsPaused: false,
          };
          return { ...prev, PlayState: newPlayState } as JellyfinSession;
        });

        void nowPlayingQuery.refetch();
      } catch (error) {
        // swallow errors silently per request
      }
    },
    [activeSession, connector, ensureControlsReady, nowPlayingQuery]
  );

  const handleSeekRelative = useCallback(
    async (deltaSeconds: number) => {
      if (!ensureControlsReady() || !connector || !activeSession) {
        return;
      }

      const deltaTicks = deltaSeconds * TICKS_PER_SECOND;
      const target = Math.min(
        Math.max((activeSession.PlayState?.PositionTicks ?? 0) + deltaTicks, 0),
        runtimeTicks
      );

      try {
        if (!activeSession.Id) throw new Error('Session id missing');
        await connector.sendPlaystateCommand(activeSession.Id, 'Seek', {
          seekPositionTicks: Math.round(target),
        });
        // Optimistically update position
        setCachedActiveSession((prev) => {
          if (!prev) return prev;
          const existing = (prev.PlayState ?? {}) as JellyfinSessionPlayState;
          const newPlayState: JellyfinSessionPlayState = {
            ...existing,
            PositionTicks: Math.round(target),
          };
          return { ...prev, PlayState: newPlayState } as JellyfinSession;
        });

        void nowPlayingQuery.refetch();
      } catch (error) {
        // swallow errors silently per request
      }
    },
    [
      activeSession,
      connector,
      ensureControlsReady,
      nowPlayingQuery,
      runtimeTicks,
    ]
  );

  const handleAdjustVolume = useCallback(
    async (delta: number) => {
      if (!ensureControlsReady() || !connector || !activeSession) {
        return;
      }

      const nextVolume = Math.min(100, Math.max(0, Math.round(volumeLevel + delta)));
      try {
        if (!activeSession.Id) throw new Error('Session id missing');
        await connector.setVolume(activeSession.Id, nextVolume);
        // Optimistically update volume so repeated presses use updated value
        setCachedActiveSession((prev) => {
          if (!prev) return prev;
          const existing = (prev.PlayState ?? {}) as JellyfinSessionPlayState;
          const newPlayState: JellyfinSessionPlayState = {
            ...existing,
            VolumeLevel: nextVolume,
          };
          return { ...prev, PlayState: newPlayState } as JellyfinSession;
        });

        void nowPlayingQuery.refetch();
      } catch (error) {
        // swallow errors silently per request
      }
    },
    [
      activeSession,
      connector,
      ensureControlsReady,
      nowPlayingQuery,
      volumeLevel,
    ]
  );

  if (!serviceId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Service not specified"
          description="Select a Jellyfin connection before controlling playback."
          actionLabel="Close"
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
          title="Playback unavailable"
          description={errorMessage}
          actionLabel="Retry"
          onActionPress={handleReload}
        />
      </SafeAreaView>
    );
  }

  if (!activeSession || !item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Nothing is playing"
          description="Start playback in Jellyfin and it will appear here."
          actionLabel="Refresh"
          onActionPress={handleReload}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {backdropUri ? (
        <Image
          source={{ uri: backdropUri }}
          style={[StyleSheet.absoluteFillObject, styles.backdropImage]}
          cachePolicy="memory-disk"
          contentFit="cover"
        />
      ) : null}
      {backdropUri ? (
        <View style={[StyleSheet.absoluteFillObject, styles.backdropOverlay]} />
      ) : null}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <IconButton
            icon="close"
            accessibilityLabel="Close now playing"
            onPress={handleNavigateBack}
          />
          <Text variant="titleLarge" style={styles.headerTitle}>
            Now Playing
          </Text>
          <IconButton
            icon="refresh"
            accessibilityLabel="Refresh status"
            onPress={handleReload}
          />
        </View>
        <View style={styles.body}>
          <View style={styles.posterContainer}>
            <MediaPoster uri={posterUri} size={260} borderRadius={20} />
          </View>
          <View style={styles.nowPlayingMeta}>
            <Text variant="headlineSmall" style={styles.trackTitle}>
              {item.Name ?? "Untitled"}
            </Text>
            {deriveSubtitle(item) ? (
              <Text variant="bodyMedium" style={styles.trackSubtitle}>
                {deriveSubtitle(item)}
              </Text>
            ) : null}
            <Chip icon="monitor" compact style={styles.deviceChip}>
              {activeSession.DeviceName ?? "Unknown Device"}
            </Chip>
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressLabels}>
              <Text variant="labelSmall" style={styles.progressLabel}>
                {formatTimeLabel(positionTicks)}
              </Text>
              <Text variant="labelSmall" style={styles.progressLabel}>
                {formatTimeLabel(runtimeTicks)}
              </Text>
            </View>
            <View style={styles.progressRail}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progress * 100)}%` },
                ]}
              />
            </View>
          </View>
          <View style={styles.controlsRow}>
            <IconButton
              icon="skip-previous"
              onPress={() => void handleSkip("PreviousTrack")}
              disabled={!connector}
              accessibilityState={{ disabled: !connector }}
            />
            <IconButton
              icon="rewind-10"
              onPress={() => void handleSeekRelative(-10)}
              disabled={!connector}
              accessibilityState={{ disabled: !connector }}
            />
            <Button
              mode="contained"
              icon={activeSession.PlayState?.IsPaused ? "play" : "pause"}
              onPress={handleTogglePlay}
              disabled={!connector}
            >
              {activeSession.PlayState?.IsPaused ? "Play" : "Pause"}
            </Button>
            <IconButton
              icon="fast-forward-10"
              onPress={() => void handleSeekRelative(10)}
              disabled={!connector}
              accessibilityState={{ disabled: !connector }}
            />
            <IconButton
              icon="skip-next"
              onPress={() => void handleSkip("NextTrack")}
              disabled={!connector}
              accessibilityState={{ disabled: !connector }}
            />
          </View>
          <View style={styles.volumeRow}>
            <IconButton
              icon="volume-minus"
              onPress={() => void handleAdjustVolume(-5)}
              disabled={!connector}
              accessibilityState={{ disabled: !connector }}
            />
            <View style={styles.volumeRail}>
              <View
                style={[
                  styles.volumeFill,
                  { width: `${Math.round(volumeLevel)}%` },
                ]}
              />
            </View>
            <IconButton
              icon="volume-plus"
              onPress={() => void handleAdjustVolume(5)}
              disabled={!connector}
              accessibilityState={{ disabled: !connector }}
            />
          </View>

          {!connector ? (
            <HelperText type="info" visible>
              Playback controls unavailable while the connector is initializing.
            </HelperText>
          ) : null}
        </View>
      </View>
      {/* status messages removed per request */}
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    content: {
      flex: 1,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.lg,
    },
    headerTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    body: {
      flex: 1,
      alignItems: "center",
      gap: spacing.lg,
    },
    posterContainer: {
      marginTop: spacing.sm,
    },
    nowPlayingMeta: {
      alignItems: "center",
      gap: spacing.xs,
    },
    trackTitle: {
      color: theme.colors.onSurface,
      fontWeight: "700",
      textAlign: "center",
    },
    trackSubtitle: {
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
    },
    deviceChip: {
      borderRadius: 20,
    },
    progressContainer: {
      width: "100%",
      gap: spacing.xs,
    },
    progressLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    progressLabel: {
      color: theme.colors.onSurfaceVariant,
    },
    progressRail: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.surfaceVariant,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.colors.primary,
    },
    controlsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      gap: spacing.sm,
    },
    volumeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      width: "80%",
      maxWidth: 360,
    },
    volumeRail: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.surfaceVariant,
      overflow: "hidden",
    },
    volumeFill: {
      height: "100%",
      backgroundColor: theme.colors.onSurface,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    backdropImage: {
      opacity: 0.2,
    },
    backdropOverlay: {
      backgroundColor: theme.colors.backdrop,
      opacity: 0.1,
    },
  });

export default JellyfinNowPlayingScreen;
