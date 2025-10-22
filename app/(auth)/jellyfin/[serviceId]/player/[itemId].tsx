/**
 * Jellyfin Video Player
 *
 * Modern implementation using expo-video (SDK 54) with landscape-only playback.
 * Features:
 * - Landscape-only orientation lock
 * - Stream and offline playback support
 * - Progress reporting to Jellyfin server
 * - Custom controls with auto-hide
 * - Audio/subtitle track selection
 * - Playback speed controls
 * - Elegant fullscreen UI
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { LinearGradient } from "expo-linear-gradient";
import { VideoView, useVideoPlayer } from "expo-video";
import type { AudioTrack, SubtitleTrack, VideoSource } from "expo-video";
import { useEvent } from "expo";
import { setAudioModeAsync } from "expo-audio";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { IconButton, Menu, Text, useTheme } from "react-native-paper";

import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { EmptyState } from "@/components/common/EmptyState";
import { FullscreenLoading } from "@/components/common/FullscreenLoading";
import { useJellyfinItemDetails } from "@/hooks/useJellyfinItemDetails";
import { useJellyfinPlaybackInfo } from "@/hooks/useJellyfinPlaybackInfo";
import {
  selectGetConnector,
  useConnectorsStore,
} from "@/store/connectorsStore";
import { useDownloadStore } from "@/store/downloadStore";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

// ============================================================================
// Constants
// ============================================================================

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const CONTROLS_HIDE_DELAY_MS = 4000;
const SEEK_STEP_SECONDS = 10;
const PROGRESS_REPORT_INTERVAL_MS = 10000;

// ============================================================================
// Utility Functions
// ============================================================================

const formatTime = (seconds?: number): string => {
  if (typeof seconds !== "number" || Number.isNaN(seconds) || seconds < 0) {
    return "0:00";
  }
  const totalSecs = Math.floor(seconds);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60) % 60;
  const hrs = Math.floor(totalSecs / 3600);
  return hrs > 0
    ? `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${mins}:${String(secs).padStart(2, "0")}`;
};

const formatTrackLabel = (track: AudioTrack | SubtitleTrack): string => {
  const parts: string[] = [];
  if (track.label) parts.push(track.label);
  if (track.language) parts.push(track.language.toUpperCase());
  return parts.length > 0 ? parts.join(" - ") : "Track";
};

const ensureFileUri = (uri?: string): string | undefined => {
  if (!uri) return undefined;
  return uri.startsWith("file://") ? uri : `file://${uri}`;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

// ============================================================================
// Main Component
// ============================================================================

const JellyfinPlayerScreen = () => {
  const params = useLocalSearchParams<{
    serviceId?: string;
    itemId?: string;
    source?: string;
    startTicks?: string;
  }>();

  const serviceId =
    typeof params.serviceId === "string" ? params.serviceId : undefined;
  const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
  const sourcePreference =
    params.source === "download" || params.source === "stream"
      ? params.source
      : undefined;
  const startTicks =
    typeof params.startTicks === "string" && params.startTicks.trim().length > 0
      ? Number(params.startTicks)
      : undefined;
  const startPositionSeconds = Number.isFinite(startTicks)
    ? Math.floor((startTicks ?? 0) / 10_000_000)
    : 0;

  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();

  // ============================================================================
  // Refs
  // ============================================================================

  const videoViewRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarWidthRef = useRef(0);
  const lastReportedPositionRef = useRef(-1);
  const streamingContextRef = useRef<{
    itemId: string;
    mediaSourceId: string;
    playSessionId?: string;
  } | null>(null);
  const isMountedRef = useRef(true);
  const startPositionAppliedRef = useRef(startPositionSeconds <= 0);
  const pendingResumePositionRef = useRef<number | null>(null);
  const resumePlaybackAfterSourceRef = useRef(false);
  const lastLoadedSourceKeyRef = useRef<string | null>(null);

  // ============================================================================
  // State
  // ============================================================================

  const [playbackMode, setPlaybackMode] = useState<"download" | "stream">(
    "stream",
  );
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [sourceMenuVisible, setSourceMenuVisible] = useState(false);
  const [speedMenuVisible, setSpeedMenuVisible] = useState(false);
  const [trackMenuVisible, setTrackMenuVisible] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showBrightnessSlider, setShowBrightnessSlider] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  const controlsOpacityAnim = useRef(new Animated.Value(1)).current;

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const getConnector = useConnectorsStore(selectGetConnector);

  useEffect(() => {
    const bootstrap = async () => {
      if (!serviceId || getConnector(serviceId)) return;
      try {
        await ConnectorManager.getInstance().loadSavedServices();
      } catch {
        // Connector errors handled by hooks
      }
    };
    void bootstrap();
  }, [getConnector, serviceId]);

  const connector = useMemo(() => {
    if (!serviceId) return undefined;
    const instance = getConnector(serviceId);
    if (!instance || instance.config.type !== "jellyfin") return undefined;
    return instance as JellyfinConnector;
  }, [getConnector, serviceId]);

  const itemQuery = useJellyfinItemDetails({ serviceId, itemId });
  const playbackQuery = useJellyfinPlaybackInfo({ serviceId, itemId });

  const downloadSelector = useCallback(
    (state: ReturnType<typeof useDownloadStore.getState>) => {
      for (const download of state.downloads.values()) {
        if (
          download.serviceConfig.id === serviceId &&
          download.content.id === itemId &&
          download.state.status === "completed"
        ) {
          return download;
        }
      }
      return undefined;
    },
    [serviceId, itemId],
  );
  const completedDownload = useDownloadStore(downloadSelector);
  const localFileUri = ensureFileUri(completedDownload?.download.localPath);

  const hasDownload = Boolean(localFileUri);
  const hasStream = Boolean(playbackQuery.data?.streamUrl);

  useEffect(() => {
    startPositionAppliedRef.current = startPositionSeconds <= 0;
    pendingResumePositionRef.current = null;
    resumePlaybackAfterSourceRef.current = false;
    lastLoadedSourceKeyRef.current = null;
    lastReportedPositionRef.current = -1;
  }, [itemId, startPositionSeconds]);

  useEffect(() => {
    startPositionAppliedRef.current = startPositionSeconds <= 0;
    pendingResumePositionRef.current = null;
    resumePlaybackAfterSourceRef.current = false;
    lastLoadedSourceKeyRef.current = null;
    lastReportedPositionRef.current = -1;
  }, [itemId, startPositionSeconds]);

  // Set initial playback mode based on availability
  useEffect(() => {
    if (sourcePreference === "download" && hasDownload) {
      setPlaybackMode("download");
    } else if (sourcePreference === "stream" && hasStream) {
      setPlaybackMode("stream");
    } else if (hasDownload) {
      setPlaybackMode("download");
    } else {
      setPlaybackMode("stream");
    }
  }, [sourcePreference, hasDownload, hasStream]);

  // ============================================================================
  // Video Source
  // ============================================================================

  const playbackSource = useMemo<VideoSource | null>(() => {
    if (playbackMode === "download" && localFileUri) {
      return { uri: localFileUri };
    }
    if (playbackMode === "stream" && playbackQuery.data?.streamUrl) {
      return { uri: playbackQuery.data.streamUrl };
    }
    return null;
  }, [playbackMode, localFileUri, playbackQuery.data?.streamUrl]);

  const playbackSourceKey = useMemo(() => {
    if (!playbackSource) return "empty";
    if (playbackMode === "download") {
      return `download:${localFileUri ?? ""}`;
    }
    if (playbackMode === "stream") {
      return `stream:${playbackQuery.data?.streamUrl ?? ""}`;
    }
    return "unknown";
  }, [
    playbackMode,
    localFileUri,
    playbackQuery.data?.streamUrl,
    playbackSource,
  ]);

  // ============================================================================
  // Video Player Setup
  // ============================================================================

  const player = useVideoPlayer(null, (playerInstance) => {
    playerInstance.timeUpdateEventInterval = 1;
    playerInstance.staysActiveInBackground = false;
    playerInstance.showNowPlayingNotification = false;
    playerInstance.preservesPitch = true;
    playerInstance.volume = 1.0;
    playerInstance.muted = false;
  });

  useEffect(() => {
    if (playbackSourceKey === lastLoadedSourceKeyRef.current) {
      return;
    }

    lastLoadedSourceKeyRef.current = playbackSourceKey;
    let cancelled = false;

    const replaceSource = async () => {
      try {
        await player.replaceAsync(playbackSource ?? null);
      } catch {
        return;
      }

      if (cancelled || playbackSourceKey === "empty") {
        resumePlaybackAfterSourceRef.current = false;
        pendingResumePositionRef.current = null;
        return;
      }

      if (!startPositionAppliedRef.current && startPositionSeconds > 0) {
        const current = player.currentTime ?? 0;
        const delta = startPositionSeconds - current;
        if (Math.abs(delta) > 0.01) {
          player.seekBy(delta);
        }
        startPositionAppliedRef.current = true;
      } else if (typeof pendingResumePositionRef.current === "number") {
        const current = player.currentTime ?? 0;
        const target = pendingResumePositionRef.current;
        const delta = target - current;
        if (Math.abs(delta) > 0.01) {
          player.seekBy(delta);
        }
      }

      try {
        // eslint-disable-next-line react-compiler/react-compiler
        player.playbackRate = playbackRate;
      } catch {
        // Ignore playback rate update errors
      }

      pendingResumePositionRef.current = null;

      if (resumePlaybackAfterSourceRef.current) {
        player.play();
      }
      resumePlaybackAfterSourceRef.current = false;
    };

    void replaceSource();

    return () => {
      cancelled = true;
    };
  }, [
    playbackSource,
    playbackSourceKey,
    playbackRate,
    player,
    startPositionSeconds,
  ]);

  // Player events
  const statusEvent = useEvent(player, "statusChange", {
    status: player.status,
  });
  const playingEvent = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const timeEvent = useEvent(player, "timeUpdate", {
    currentTime: player.currentTime ?? 0,
    bufferedPosition: player.bufferedPosition ?? 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });
  const playToEndEvent = useEvent(player, "playToEnd");

  const availableAudioTracksEvent = useEvent(
    player,
    "availableAudioTracksChange",
    {
      availableAudioTracks: player.availableAudioTracks ?? [],
    },
  );
  const availableSubtitleTracksEvent = useEvent(
    player,
    "availableSubtitleTracksChange",
    {
      availableSubtitleTracks: player.availableSubtitleTracks ?? [],
    },
  );
  const audioTrackEvent = useEvent(player, "audioTrackChange", {
    audioTrack: player.audioTrack,
  });
  const subtitleTrackEvent = useEvent(player, "subtitleTrackChange", {
    subtitleTrack: player.subtitleTrack,
  });

  const playerStatus = statusEvent?.status ?? player.status;
  const isPlaying = playingEvent?.isPlaying ?? player.playing;
  const currentTime = timeEvent?.currentTime ?? player.currentTime ?? 0;

  // Use playback metadata duration if player.duration is not available (common with streams)
  const playbackMetadataDuration = useMemo(() => {
    if (playbackQuery.data?.mediaSource?.RunTimeTicks) {
      return playbackQuery.data.mediaSource.RunTimeTicks / 10_000_000;
    }
    return 0;
  }, [playbackQuery.data?.mediaSource?.RunTimeTicks]);

  const duration =
    player.duration > 0 ? player.duration : playbackMetadataDuration;

  const currentAudioTrack = audioTrackEvent?.audioTrack ?? player.audioTrack;
  const currentSubtitleTrack =
    subtitleTrackEvent?.subtitleTrack ?? player.subtitleTrack;
  const audioTracks =
    availableAudioTracksEvent?.availableAudioTracks ??
    player.availableAudioTracks ??
    [];
  const subtitleTracks =
    availableSubtitleTracksEvent?.availableSubtitleTracks ??
    player.availableSubtitleTracks ??
    [];

  // ============================================================================
  // Lifecycle & Orientation
  // ============================================================================

  // Update player volume
  useEffect(() => {
    try {
      player.volume = clamp(volume, 0, 1);
    } catch {
      // Ignore volume adjustment errors
    }
  }, [player, volume]);

  useEffect(() => {
    // Lock to landscape on mount
    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    );

    // Configure audio session for video playback
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });

    return () => {
      isMountedRef.current = false;
      // Unlock orientation on unmount
      void ScreenOrientation.unlockAsync();
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // ============================================================================
  // Progress Reporting (Jellyfin)
  // ============================================================================

  useEffect(() => {
    if (
      playbackMode !== "stream" ||
      !connector ||
      !itemId ||
      !playbackQuery.data
    )
      return;

    const interval = setInterval(() => {
      if (!isMountedRef.current) return;

      const positionTicks = Math.floor(currentTime * 10_000_000);
      const positionSeconds = Math.floor(currentTime);

      // Only report if position changed significantly
      if (Math.abs(positionSeconds - lastReportedPositionRef.current) < 5)
        return;

      lastReportedPositionRef.current = positionSeconds;

      const mediaSourceId = playbackQuery.data.mediaSource?.Id;
      const playSessionId =
        playbackQuery.data.playback?.PlaySessionId ?? undefined;

      if (!mediaSourceId) return;

      // Store streaming context for cleanup
      streamingContextRef.current = {
        itemId,
        mediaSourceId,
        playSessionId,
      };

      // Report progress to Jellyfin
      void connector.reportPlaybackStopped({
        itemId,
        mediaSourceId,
        playSessionId,
        positionTicks,
      });
    }, PROGRESS_REPORT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [playbackMode, connector, itemId, playbackQuery.data, currentTime]);

  // Final progress report on unmount
  useEffect(() => {
    return () => {
      if (
        playbackMode !== "stream" ||
        !connector ||
        !streamingContextRef.current
      )
        return;

      const {
        itemId: ctxItemId,
        mediaSourceId,
        playSessionId,
      } = streamingContextRef.current;
      const positionTicks = Math.floor(currentTime * 10_000_000);

      void connector.reportPlaybackStopped({
        itemId: ctxItemId,
        mediaSourceId,
        playSessionId: playSessionId ?? undefined,
        positionTicks,
      });
    };
  }, [playbackMode, connector, currentTime]);

  // ============================================================================
  // Controls Auto-Hide
  // ============================================================================

  const resetHideControlsTimer = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
    if (!isPlaying) return;

    controlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
      Animated.timing(controlsOpacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, CONTROLS_HIDE_DELAY_MS);
  }, [isPlaying, controlsOpacityAnim]);

  useEffect(() => {
    if (controlsVisible) {
      resetHideControlsTimer();
    }
  }, [controlsVisible, resetHideControlsTimer]);

  useEffect(() => {
    if (!player) return;
    try {
      player.playbackRate = playbackRate;
    } catch {
      // Ignore playback rate update errors
    }
  }, [player, playbackRate]);

  useEffect(() => {
    if (playerStatus !== "readyToPlay") return;
    if (isPlaying) {
      resetHideControlsTimer();
    } else if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, [isPlaying, playerStatus, resetHideControlsTimer]);

  // ============================================================================
  // Playback Controls
  // ============================================================================

  const toggleControls = useCallback(() => {
    setControlsVisible((prev) => {
      const next = !prev;
      Animated.timing(controlsOpacityAnim, {
        toValue: next ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      if (next) {
        resetHideControlsTimer();
      } else if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      return next;
    });
  }, [controlsOpacityAnim, resetHideControlsTimer]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player]);

  const seekRelative = useCallback(
    (seconds: number) => {
      if (!player) return;
      try {
        player.seekBy(seconds);
      } catch {
        // Ignore seek errors
      }
      setControlsVisible(true);
    },
    [player],
  );

  const handleProgressBarPress = useCallback(
    (event: GestureResponderEvent) => {
      if (duration <= 0 || progressBarWidthRef.current <= 0 || !player) return;
      const fraction = clamp(
        event.nativeEvent.locationX / progressBarWidthRef.current,
        0,
        1,
      );
      const targetTime = duration * fraction;

      try {
        const current = player.currentTime ?? 0;
        const delta = targetTime - current;
        if (Math.abs(delta) > 0.01) {
          player.seekBy(delta);
        }
      } catch {
        // Ignore seek errors
      }
      setControlsVisible(true);
    },
    [duration, player],
  );

  const handleProgressBarLayout = useCallback((event: LayoutChangeEvent) => {
    progressBarWidthRef.current = event.nativeEvent.layout.width;
  }, []);

  const handleBack = useCallback(() => {
    player.pause();
    router.back();
  }, [player, router]);

  // ============================================================================
  // Menu Handlers
  // ============================================================================

  const handlePlaybackModeChange = useCallback(
    (mode: "download" | "stream") => {
      if (mode === playbackMode) {
        setSourceMenuVisible(false);
        return;
      }
      pendingResumePositionRef.current = currentTime;
      resumePlaybackAfterSourceRef.current = isPlaying;
      player.pause();
      setPlaybackMode(mode);
      setSourceMenuVisible(false);
    },
    [playbackMode, currentTime, isPlaying, player],
  );

  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    setSpeedMenuVisible(false);
  }, []);

  const isTrackSelected = useCallback(
    (
      track: AudioTrack | SubtitleTrack,
      currentTrack: AudioTrack | SubtitleTrack | null,
    ) => {
      if (!currentTrack) return false;
      if (
        "id" in track &&
        "id" in currentTrack &&
        track.id &&
        currentTrack.id
      ) {
        return track.id === currentTrack.id;
      }
      if (track.label && currentTrack.label) {
        return track.label === currentTrack.label;
      }
      if (track.language && currentTrack.language) {
        return track.language === currentTrack.language;
      }
      return false;
    },
    [],
  );

  // ============================================================================
  // Loading States
  // ============================================================================

  useEffect(() => {
    if (itemQuery.isLoading) {
      setLoadingMessage("Loading media metadata...");
    } else if (playbackQuery.isLoading) {
      setLoadingMessage("Loading playback information...");
    } else if (playerStatus === "loading") {
      setLoadingMessage(
        playbackMode === "download"
          ? "Preparing offline playback..."
          : "Buffering video stream...",
      );
    }
  }, [
    itemQuery.isLoading,
    playbackQuery.isLoading,
    playerStatus,
    playbackMode,
  ]);

  const showLoader =
    itemQuery.isLoading ||
    playbackQuery.isLoading ||
    (playerStatus !== "readyToPlay" && playerStatus !== "error");

  // ============================================================================
  // Playback End
  // ============================================================================

  useEffect(() => {
    if (!playToEndEvent) return;
    player.pause();
    setControlsVisible(true);
  }, [playToEndEvent, player]);

  // ============================================================================
  // Render Guards
  // ============================================================================

  if (!serviceId || !itemId) {
    return (
      <View style={styles.fallbackContainer}>
        <EmptyState
          title="Missing playback context"
          description="Select an item from Jellyfin before opening the media player."
          actionLabel="Go back"
          onActionPress={handleBack}
        />
      </View>
    );
  }

  if (playbackQuery.isError && !hasDownload) {
    return (
      <View style={styles.fallbackContainer}>
        <EmptyState
          title="Playback unavailable"
          description={
            playbackQuery.error instanceof Error
              ? playbackQuery.error.message
              : "Unable to start streaming."
          }
          actionLabel="Retry"
          onActionPress={() => void playbackQuery.refetch()}
        />
      </View>
    );
  }

  // ============================================================================
  // Render UI
  // ============================================================================

  const progress = duration > 0 ? clamp(currentTime / duration, 0, 1) : 0;
  const hasTrackOptions = audioTracks.length > 1 || subtitleTracks.length > 0;

  return (
    <View style={styles.container}>
      {/* Video Player */}
      {playbackSource ? (
        <VideoView
          ref={videoViewRef}
          style={styles.video}
          player={player}
          nativeControls={false}
          contentFit="contain"
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          pointerEvents="none"
        />
      ) : (
        <View style={styles.videoFallback} />
      )}

      {/* Gradients */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.7)", "transparent"]}
        style={styles.gradientTop}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={styles.gradientBottom}
      />

      {/* Controls Overlay */}
      <Animated.View
        style={[styles.overlay, { opacity: controlsOpacityAnim }]}
        pointerEvents="auto"
      >
        <Pressable
          style={styles.overlayPressable}
          onPress={toggleControls}
          hitSlop={0}
        >
          {/* Top Bar */}
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.topBar}>
              <View style={styles.topLeft}>
                <IconButton
                  icon="arrow-left"
                  iconColor="white"
                  onPress={handleBack}
                />
                <View style={styles.titleGroup}>
                  <Text
                    variant="titleMedium"
                    style={styles.titleText}
                    numberOfLines={1}
                  >
                    {itemQuery.data?.Name ?? "Video"}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>

          {/* Center Controls */}
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.centerControls}>
              <IconButton
                icon="rewind-10"
                iconColor="white"
                size={40}
                onPress={() => seekRelative(-SEEK_STEP_SECONDS)}
              />
              <Pressable style={styles.playButton} onPress={togglePlayPause}>
                <IconButton
                  icon={isPlaying ? "pause" : "play"}
                  iconColor="white"
                  size={56}
                />
              </Pressable>
              <IconButton
                icon="fast-forward-10"
                iconColor="white"
                size={40}
                onPress={() => seekRelative(SEEK_STEP_SECONDS)}
              />
            </View>
          </Pressable>

          {/* Bottom Section */}
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.bottomSection}>
              {/* Progress Bar */}
              <View
                style={styles.progressContainer}
                onLayout={handleProgressBarLayout}
              >
                <Pressable
                  style={styles.progressBar}
                  onPress={handleProgressBarPress}
                >
                  <View style={styles.progressBackground} />
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress * 100}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.progressThumb,
                      { left: `${progress * 100}%` },
                    ]}
                  />
                </Pressable>
                <View style={styles.timeRow}>
                  <Text variant="labelSmall" style={styles.timeText}>
                    {formatTime(currentTime)}
                  </Text>
                  <Text variant="labelSmall" style={styles.timeText}>
                    {formatTime(duration)}
                  </Text>
                </View>
              </View>

              {/* Controls Row */}
              <View style={styles.controlsRow}>
                {/* Source Menu */}
                <Menu
                  visible={sourceMenuVisible}
                  onDismiss={() => setSourceMenuVisible(false)}
                  anchor={
                    <IconButton
                      icon="playlist-play"
                      iconColor="white"
                      onPress={() => setSourceMenuVisible(true)}
                      disabled={!hasDownload && !hasStream}
                    />
                  }
                >
                  <Menu.Item
                    onPress={() => handlePlaybackModeChange("stream")}
                    title="Stream from Jellyfin"
                    disabled={!hasStream}
                    leadingIcon={
                      playbackMode === "stream" ? "check" : undefined
                    }
                  />
                  <Menu.Item
                    onPress={() => handlePlaybackModeChange("download")}
                    title="Play downloaded copy"
                    disabled={!hasDownload}
                    leadingIcon={
                      playbackMode === "download" ? "check" : undefined
                    }
                  />
                </Menu>

                {/* Track Menu */}
                <Menu
                  visible={trackMenuVisible}
                  onDismiss={() => setTrackMenuVisible(false)}
                  anchor={
                    <IconButton
                      icon="tune-vertical"
                      iconColor="white"
                      onPress={() => setTrackMenuVisible(true)}
                      disabled={!hasTrackOptions}
                    />
                  }
                >
                  {audioTracks.length > 0 && (
                    <>
                      <Menu.Item title="Audio Tracks" disabled />
                      {audioTracks.map((track, idx) => (
                        <Menu.Item
                          key={track.id ?? `audio-${idx}`}
                          onPress={() => {
                            player.audioTrack = track;
                            setTrackMenuVisible(false);
                          }}
                          title={formatTrackLabel(track)}
                          leadingIcon={
                            isTrackSelected(track, currentAudioTrack)
                              ? "check"
                              : undefined
                          }
                        />
                      ))}
                    </>
                  )}
                  {subtitleTracks.length > 0 && (
                    <>
                      <Menu.Item title="Subtitles" disabled />
                      <Menu.Item
                        onPress={() => {
                          player.subtitleTrack = null;
                          setTrackMenuVisible(false);
                        }}
                        title="Subtitles Off"
                        leadingIcon={
                          !currentSubtitleTrack ? "check" : undefined
                        }
                      />
                      {subtitleTracks.map((track, idx) => (
                        <Menu.Item
                          key={track.id ?? `subtitle-${idx}`}
                          onPress={() => {
                            player.subtitleTrack = track;
                            setTrackMenuVisible(false);
                          }}
                          title={formatTrackLabel(track)}
                          leadingIcon={
                            isTrackSelected(track, currentSubtitleTrack)
                              ? "check"
                              : undefined
                          }
                        />
                      ))}
                    </>
                  )}
                </Menu>

                {/* Speed Menu */}
                <Menu
                  visible={speedMenuVisible}
                  onDismiss={() => setSpeedMenuVisible(false)}
                  anchor={
                    <IconButton
                      icon="speedometer"
                      iconColor="white"
                      onPress={() => setSpeedMenuVisible(true)}
                    />
                  }
                >
                  {PLAYBACK_RATES.map((rate) => (
                    <Menu.Item
                      key={rate}
                      onPress={() => handlePlaybackRateChange(rate)}
                      title={`${rate}×`}
                      leadingIcon={rate === playbackRate ? "check" : undefined}
                    />
                  ))}
                </Menu>

                {/* Volume Button */}
                <IconButton
                  icon="volume-high"
                  iconColor="white"
                  onPress={() => setShowVolumeSlider(!showVolumeSlider)}
                />

                {/* Brightness Button */}
                <IconButton
                  icon="brightness-7"
                  iconColor="white"
                  onPress={() => setShowBrightnessSlider(!showBrightnessSlider)}
                />
              </View>

              {/* Volume Slider */}
              {showVolumeSlider && (
                <View style={styles.sliderContainer}>
                  <Text variant="labelSmall" style={styles.sliderLabel}>
                    Volume: {Math.round(volume * 100)}%
                  </Text>
                  <Pressable
                    style={styles.sliderTrack}
                    onPress={(event) => {
                      const width = event.nativeEvent.locationX;
                      const totalWidth = progressBarWidthRef.current;
                      if (totalWidth > 0) {
                        const newVolume = clamp(width / totalWidth, 0, 1);
                        setVolume(newVolume);
                      }
                    }}
                  >
                    <View style={styles.sliderBackground} />
                    <View
                      style={[styles.sliderFill, { width: `${volume * 100}%` }]}
                    />
                    <View
                      style={[styles.sliderThumb, { left: `${volume * 100}%` }]}
                    />
                  </Pressable>
                </View>
              )}

              {/* Brightness Slider */}
              {showBrightnessSlider && (
                <View style={styles.sliderContainer}>
                  <Text variant="labelSmall" style={styles.sliderLabel}>
                    Brightness: {Math.round(brightness * 100)}%
                  </Text>
                  <Pressable
                    style={styles.sliderTrack}
                    onPress={(event) => {
                      const width = event.nativeEvent.locationX;
                      const totalWidth = progressBarWidthRef.current;
                      if (totalWidth > 0) {
                        const newBrightness = clamp(width / totalWidth, 0, 1);
                        setBrightness(newBrightness);
                      }
                    }}
                  >
                    <View style={styles.sliderBackground} />
                    <View
                      style={[
                        styles.sliderFill,
                        { width: `${brightness * 100}%` },
                      ]}
                    />
                    <View
                      style={[
                        styles.sliderThumb,
                        { left: `${brightness * 100}%` },
                      ]}
                    />
                  </Pressable>
                </View>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Animated.View>

      {/* Loading Overlay */}
      {showLoader && <FullscreenLoading message={loadingMessage} />}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "black",
    },
    fallbackContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: spacing.lg,
      justifyContent: "center",
      alignItems: "center",
    },
    video: {
      width: "100%",
      height: "100%",
    },
    videoFallback: {
      flex: 1,
      backgroundColor: "black",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    overlayPressable: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    gradientTop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 120,
    },
    gradientBottom: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 200,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    topLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: spacing.sm,
    },
    titleGroup: {
      flex: 1,
    },
    titleText: {
      color: "white",
      fontWeight: "700",
    },
    centerControls: {
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: spacing.xl,
    },
    playButton: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.2)",
    },
    bottomSection: {
      gap: spacing.md,
    },
    progressContainer: {
      gap: spacing.xs,
    },
    progressBar: {
      height: 20,
      justifyContent: "center",
    },
    progressBackground: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.3)",
    },
    progressFill: {
      position: "absolute",
      left: 0,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.primary,
    },
    progressThumb: {
      position: "absolute",
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: theme.colors.primary,
      marginLeft: -7,
      borderWidth: 2,
      borderColor: "white",
    },
    timeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    timeText: {
      color: "rgba(255,255,255,0.9)",
      fontWeight: "500",
    },
    controlsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    sliderContainer: {
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    sliderLabel: {
      color: "rgba(255,255,255,0.9)",
      fontWeight: "500",
    },
    sliderTrack: {
      height: 20,
      justifyContent: "center",
    },
    sliderBackground: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.3)",
    },
    sliderFill: {
      position: "absolute",
      left: 0,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.primary,
    },
    sliderThumb: {
      position: "absolute",
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.colors.primary,
      marginLeft: -6,
      borderWidth: 2,
      borderColor: "white",
    },
  });

export default JellyfinPlayerScreen;
