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

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

  const nowPlayingQuery = useJellyfinNowPlaying({
    serviceId,
    refetchInterval: 10_000,
  });
  const sessions = nowPlayingQuery.data ?? [];
  // Preserve the last known non-empty sessions list to avoid transient "nothing is playing"
  // while the query is refetching after issuing playback commands.
  const [cachedSessions, setCachedSessions] = useState<typeof sessions | null>(
    sessions.length ? sessions : null
  );

  useEffect(() => {
    if (sessions.length) {
      setCachedSessions(sessions);
    }
  }, [sessions]);

  const sessionsToShow = sessions.length ? sessions : cachedSessions ?? [];
  // Use the preserved sessions list for rendering to avoid flicker
  const activeSession = sessionsToShow[0];
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

  // Consider loading only if we're bootstrapping or the query is loading and we have no cached sessions.
  const isLoading = isBootstrapping || (nowPlayingQuery.isLoading && sessions.length === 0);
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
      setStatusMessage("Playback controls are unavailable.");
      return false;
    }
    if (!activeSession) {
      setStatusMessage("No active Jellyfin session detected.");
      return false;
    }
    return true;
  }, [activeSession, connector]);

  const handleTogglePlay = useCallback(async () => {
    if (!ensureControlsReady() || !connector || !activeSession) {
      return;
    }

    try {
      if (!activeSession.Id) throw new Error("Session id missing");
      await connector.sendPlaystateCommand(activeSession.Id, "PlayPause");
      void nowPlayingQuery.refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to toggle playback.";
      setStatusMessage(message);
    }
  }, [activeSession, connector, ensureControlsReady, nowPlayingQuery]);

  const handleSkip = useCallback(
    async (direction: "NextTrack" | "PreviousTrack") => {
      if (!ensureControlsReady() || !connector || !activeSession) {
        return;
      }

      try {
        if (!activeSession.Id) throw new Error("Session id missing");
        await connector.sendPlaystateCommand(activeSession.Id, direction);
        void nowPlayingQuery.refetch();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to change track.";
        setStatusMessage(message);
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
        if (!activeSession.Id) throw new Error("Session id missing");
        await connector.sendPlaystateCommand(activeSession.Id, "Seek", {
          seekPositionTicks: Math.round(target),
        });
        void nowPlayingQuery.refetch();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to seek to the requested position.";
        setStatusMessage(message);
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

      const nextVolume = Math.min(
        100,
        Math.max(0, Math.round(volumeLevel + delta))
      );
      try {
        if (!activeSession.Id) throw new Error("Session id missing");
        await connector.setVolume(activeSession.Id, nextVolume);
        void nowPlayingQuery.refetch();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to adjust the volume.";
        setStatusMessage(message);
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
            />
            <IconButton
              icon="rewind-10"
              onPress={() => void handleSeekRelative(-10)}
            />
            <Button
              mode="contained"
              icon={activeSession.PlayState?.IsPaused ? "play" : "pause"}
              onPress={handleTogglePlay}
            >
              {activeSession.PlayState?.IsPaused ? "Play" : "Pause"}
            </Button>
            <IconButton
              icon="fast-forward-10"
              onPress={() => void handleSeekRelative(10)}
            />
            <IconButton
              icon="skip-next"
              onPress={() => void handleSkip("NextTrack")}
            />
          </View>
          <View style={styles.volumeRow}>
            <IconButton
              icon="volume-minus"
              onPress={() => void handleAdjustVolume(-5)}
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
            />
          </View>
        </View>
      </View>
      <HelperText type="info" visible={Boolean(statusMessage)}>
        {statusMessage ?? ""}
      </HelperText>
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
