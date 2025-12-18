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
 * - Gesture controls (swipe for seek, volume, brightness)
 * - Picture-in-Picture support
 * - Quality selection
 * - Skip intro/credits
 * - Next episode autoplay
 * - Playback statistics
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
  StatusBar,
} from "react-native";
import { IconButton, Menu, Text, useTheme } from "react-native-paper";

import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { EmptyState } from "@/components/common/EmptyState";
import { FullscreenLoading } from "@/components/common/FullscreenLoading";
import { useJellyfinItemDetails } from "@/hooks/useJellyfinItemDetails";
import { useJellyfinPlaybackInfo } from "@/hooks/useJellyfinPlaybackInfo";
import { useJellyfinIntroTimestamps } from "@/hooks/useJellyfinIntroTimestamps";
import { GestureOverlay } from "./components/GestureOverlay";
import { NextEpisodeOverlay } from "./components/NextEpisodeOverlay";
import { QualitySelector } from "./components/QualitySelector";
import { PlaybackStats } from "./components/PlaybackStats";
import { ErrorRecovery } from "./components/ErrorRecovery";
import { SkipButton } from "./components/SkipButton";
import { useNextEpisode } from "./hooks/useNextEpisode";
import { useSkipIntro } from "./hooks/useSkipIntro";
import {
  selectGetConnector,
  useConnectorsStore,
} from "@/store/connectorsStore";
import { useDownloadStore } from "@/store/downloadStore";
import {
  useJellyfinPlayerStore,
  selectPlaybackMode,
  selectSetPlaybackMode,
  selectPlaybackRate,
  selectSetPlaybackRate,
  selectPlayerVolume,
  selectSetPlayerVolume,
  selectPlayerBrightness,
  selectSetPlayerBrightness,
  selectControlsVisible,
  selectSetControlsVisible,
  selectSourceMenuVisible,
  selectSetSourceMenuVisible,
  selectSpeedMenuVisible,
  selectSetSpeedMenuVisible,
  selectTrackMenuVisible,
  selectSetTrackMenuVisible,
  selectShowVolumeSlider,
  selectSetShowVolumeSlider,
  selectShowBrightnessSlider,
  selectSetShowBrightnessSlider,
  selectResetPlayerUi,
} from "@/store/jellyfinPlayerStore";
import {
  useSettingsStore,
  selectJellyfinPlayerAutoPlay,
  selectJellyfinPlayerDefaultSubtitleLanguage,
} from "@/store/settingsStore";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

// ============================================================================
// Constants
// ============================================================================

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
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
  const volumeSliderWidthRef = useRef(0);
  const brightnessSliderWidthRef = useRef(0);
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
  const sourceInitializedRef = useRef(false);
  const isSeekingRef = useRef(false);

  // ============================================================================
  // State
  // ============================================================================

  const playbackMode = useJellyfinPlayerStore(selectPlaybackMode);
  const setPlaybackMode = useJellyfinPlayerStore(selectSetPlaybackMode);
  const playbackRate = useJellyfinPlayerStore(selectPlaybackRate);
  const setPlaybackRate = useJellyfinPlayerStore(selectSetPlaybackRate);
  const volume = useJellyfinPlayerStore(selectPlayerVolume);
  const setVolume = useJellyfinPlayerStore(selectSetPlayerVolume);
  const brightness = useJellyfinPlayerStore(selectPlayerBrightness);
  const setBrightness = useJellyfinPlayerStore(selectSetPlayerBrightness);
  const controlsVisible = useJellyfinPlayerStore(selectControlsVisible);
  const setControlsVisible = useJellyfinPlayerStore(selectSetControlsVisible);
  const sourceMenuVisible = useJellyfinPlayerStore(selectSourceMenuVisible);
  const setSourceMenuVisible = useJellyfinPlayerStore(
    selectSetSourceMenuVisible,
  );
  const speedMenuVisible = useJellyfinPlayerStore(selectSpeedMenuVisible);
  const setSpeedMenuVisible = useJellyfinPlayerStore(selectSetSpeedMenuVisible);
  const trackMenuVisible = useJellyfinPlayerStore(selectTrackMenuVisible);
  const setTrackMenuVisible = useJellyfinPlayerStore(selectSetTrackMenuVisible);
  const showVolumeSlider = useJellyfinPlayerStore(selectShowVolumeSlider);
  const setShowVolumeSlider = useJellyfinPlayerStore(selectSetShowVolumeSlider);
  const showBrightnessSlider = useJellyfinPlayerStore(
    selectShowBrightnessSlider,
  );
  const setShowBrightnessSlider = useJellyfinPlayerStore(
    selectSetShowBrightnessSlider,
  );
  const resetPlayerUi = useJellyfinPlayerStore(selectResetPlayerUi);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [error, setError] = useState<Error | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const controlsOpacityAnim = useRef(new Animated.Value(1)).current;

  // Get player settings from settings store
  const autoPlayEnabled = useSettingsStore(selectJellyfinPlayerAutoPlay);
  const defaultSubtitleLanguage = useSettingsStore(
    selectJellyfinPlayerDefaultSubtitleLanguage,
  );

  useEffect(() => {
    resetPlayerUi();
    return () => {
      resetPlayerUi();
    };
  }, [resetPlayerUi, serviceId, itemId]);

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
  const introTimestampsQuery = useJellyfinIntroTimestamps({
    serviceId,
    itemId,
    mode: "Introduction",
  });
  const creditsTimestampsQuery = useJellyfinIntroTimestamps({
    serviceId,
    itemId,
    mode: "Credits",
  });
  const playbackQuery = useJellyfinPlaybackInfo({
    serviceId,
    itemId,
    disableRefetch: true,
  });

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
  }, [sourcePreference, hasDownload, hasStream, setPlaybackMode]);

  // ============================================================================
  // Video Source
  // ============================================================================

  // Stabilize stream URL to prevent unnecessary source reloads during playback
  const stableStreamUrl = useMemo(
    () => playbackQuery.data?.streamUrl,
    [playbackQuery.data?.streamUrl],
  );

  const playbackSource = useMemo<VideoSource | null>(() => {
    if (playbackMode === "download" && localFileUri) {
      return { uri: localFileUri };
    }
    if (playbackMode === "stream" && stableStreamUrl) {
      return { uri: stableStreamUrl };
    }
    return null;
  }, [playbackMode, localFileUri, stableStreamUrl]);

  const playbackSourceKey = useMemo(() => {
    if (!playbackSource) return "empty";
    if (playbackMode === "download") {
      return `download:${localFileUri ?? ""}`;
    }
    if (playbackMode === "stream") {
      return `stream:${stableStreamUrl ?? ""}`;
    }
    return "unknown";
  }, [playbackMode, localFileUri, stableStreamUrl, playbackSource]);

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
    if (
      playbackSourceKey === lastLoadedSourceKeyRef.current ||
      isSeekingRef.current
    ) {
      return;
    }

    lastLoadedSourceKeyRef.current = playbackSourceKey;
    let cancelled = false;

    const replaceSource = async () => {
      try {
        // Save current position before replacing source
        const savedPosition = player.currentTime ?? 0;
        if (savedPosition > 0 && sourceInitializedRef.current) {
          pendingResumePositionRef.current = savedPosition;
        }

        await player.replaceAsync(playbackSource ?? null);
        sourceInitializedRef.current = true;
      } catch {
        return;
      }

      if (cancelled || playbackSourceKey === "empty") {
        resumePlaybackAfterSourceRef.current = false;
        pendingResumePositionRef.current = null;
        return;
      }

      // Wait a brief moment for the player to be ready after source replacement
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Apply start position if provided (resume decision already made in details screen)
      if (!startPositionAppliedRef.current && startPositionSeconds > 0) {
        const current = player.currentTime ?? 0;
        const delta = startPositionSeconds - current;
        if (Math.abs(delta) > 0.01) {
          if ("seekTo" in player && typeof player.seekTo === "function") {
            void (player.seekTo(startPositionSeconds) as Promise<void>).catch(
              () => player.seekBy(delta),
            );
          } else {
            player.seekBy(delta);
          }
        }
        startPositionAppliedRef.current = true;
      } else if (typeof pendingResumePositionRef.current === "number") {
        const target = pendingResumePositionRef.current;
        if ("seekTo" in player && typeof player.seekTo === "function") {
          void (player.seekTo(target) as Promise<void>).catch(() => {
            const current = player.currentTime ?? 0;
            const delta = target - current;
            if (Math.abs(delta) > 0.01) {
              player.seekBy(delta);
            }
          });
        } else {
          const current = player.currentTime ?? 0;
          const delta = target - current;
          if (Math.abs(delta) > 0.01) {
            player.seekBy(delta);
          }
        }
      }

      try {
        player.playbackRate = playbackRate;
      } catch {
        // Ignore playback rate update errors
      }

      pendingResumePositionRef.current = null;

      // Auto-start playback (respect user setting)
      if (autoPlayEnabled) {
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
    autoPlayEnabled,
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
  const subtitleTracks = useMemo(
    () =>
      availableSubtitleTracksEvent?.availableSubtitleTracks ??
      player.availableSubtitleTracks ??
      [],
    [availableSubtitleTracksEvent, player],
  );

  // Auto-select default subtitle language when tracks become available
  useEffect(() => {
    if (
      !defaultSubtitleLanguage ||
      subtitleTracks.length === 0 ||
      currentSubtitleTrack
    ) {
      return;
    }

    // Find matching subtitle track by language code
    const matchingTrack = subtitleTracks.find((track) => {
      const trackLanguage = track.language?.toLowerCase();
      const preferredLanguage = defaultSubtitleLanguage.toLowerCase();
      return trackLanguage === preferredLanguage;
    });

    if (matchingTrack) {
      player.subtitleTrack = matchingTrack;
    }
  }, [subtitleTracks, defaultSubtitleLanguage, currentSubtitleTrack, player]);

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

    // Hide status bar for immersive playback
    StatusBar.setHidden(true, "fade");

    // Configure audio session for video playback
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });

    return () => {
      isMountedRef.current = false;
      // Unlock orientation on unmount
      void ScreenOrientation.unlockAsync();
      // Show status bar again
      StatusBar.setHidden(false, "fade");
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // ============================================================================
  // Progress Reporting (Jellyfin)
  // ============================================================================

  // Report playback start
  useEffect(() => {
    if (
      playbackMode !== "stream" ||
      !connector ||
      !itemId ||
      !playbackQuery.data ||
      playerStatus !== "readyToPlay"
    )
      return;

    const mediaSourceId = playbackQuery.data.mediaSource?.Id;
    const playSessionId =
      playbackQuery.data.playback?.PlaySessionId ?? undefined;

    if (!mediaSourceId) return;

    // Store streaming context
    streamingContextRef.current = {
      itemId,
      mediaSourceId,
      playSessionId,
    };

    // Report playback start to Jellyfin
    void connector.reportPlaybackStart({
      itemId,
      mediaSourceId,
      playSessionId,
      canSeek: true,
      audioStreamIndex: currentAudioTrack?.id
        ? Number(currentAudioTrack.id)
        : undefined,
      subtitleStreamIndex: currentSubtitleTrack?.id
        ? Number(currentSubtitleTrack.id)
        : undefined,
    });
  }, [
    playbackMode,
    connector,
    itemId,
    playbackQuery.data,
    playerStatus,
    currentAudioTrack,
    currentSubtitleTrack,
  ]);

  // Report playback progress periodically
  useEffect(() => {
    if (
      playbackMode !== "stream" ||
      !connector ||
      !itemId ||
      !playbackQuery.data ||
      playerStatus !== "readyToPlay"
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

      // Report progress to Jellyfin
      void connector.reportPlaybackProgress({
        itemId,
        mediaSourceId,
        playSessionId,
        positionTicks,
        isPaused: !isPlaying,
        isMuted: player.muted,
        volumeLevel: player.volume,
        audioStreamIndex: currentAudioTrack?.id
          ? Number(currentAudioTrack.id)
          : undefined,
        subtitleStreamIndex: currentSubtitleTrack?.id
          ? Number(currentSubtitleTrack.id)
          : undefined,
        playbackRate: player.playbackRate,
      });
    }, PROGRESS_REPORT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [
    playbackMode,
    connector,
    itemId,
    playbackQuery.data,
    playerStatus,
    currentTime,
    isPlaying,
    player,
    currentAudioTrack,
    currentSubtitleTrack,
  ]);

  // Report playback stopped on unmount or when playback ends
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
    }, CONTROLS_HIDE_DELAY_MS);
  }, [isPlaying, setControlsVisible]);

  useEffect(() => {
    if (controlsVisible) {
      resetHideControlsTimer();
    } else if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, [controlsVisible, resetHideControlsTimer]);

  useEffect(() => {
    Animated.timing(controlsOpacityAnim, {
      toValue: controlsVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [controlsVisible, controlsOpacityAnim]);

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
    const next = !controlsVisible;
    setControlsVisible(next);
    if (next) {
      resetHideControlsTimer();
    } else if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, [controlsVisible, resetHideControlsTimer, setControlsVisible]);

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
      resetHideControlsTimer();
    },
    [player, resetHideControlsTimer, setControlsVisible],
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

      isSeekingRef.current = true;

      const seekRelativeFallback = () => {
        try {
          const current = player.currentTime ?? 0;
          const delta = targetTime - current;
          if (Math.abs(delta) > 0.01) {
            player.seekBy(delta);
          }
        } catch {
          // Ignore seek errors
        } finally {
          isSeekingRef.current = false;
        }
      };

      try {
        if ("seekTo" in player && typeof player.seekTo === "function") {
          const result = player.seekTo(targetTime);
          if (result && typeof (result as Promise<void>).catch === "function") {
            void (result as Promise<void>)
              .catch(() => seekRelativeFallback())
              .finally(() => {
                isSeekingRef.current = false;
              });
          } else {
            isSeekingRef.current = false;
          }
        } else {
          seekRelativeFallback();
        }
      } catch {
        seekRelativeFallback();
      }
      setControlsVisible(true);
      resetHideControlsTimer();
    },
    [duration, player, resetHideControlsTimer, setControlsVisible],
  );

  const handleProgressBarLayout = useCallback((event: LayoutChangeEvent) => {
    progressBarWidthRef.current = event.nativeEvent.layout.width;
  }, []);

  const handleVolumeSliderLayout = useCallback((event: LayoutChangeEvent) => {
    volumeSliderWidthRef.current = event.nativeEvent.layout.width;
  }, []);

  const handleBrightnessSliderLayout = useCallback(
    (event: LayoutChangeEvent) => {
      brightnessSliderWidthRef.current = event.nativeEvent.layout.width;
    },
    [],
  );

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
    [
      playbackMode,
      currentTime,
      isPlaying,
      player,
      setPlaybackMode,
      setSourceMenuVisible,
    ],
  );

  const handlePlaybackRateChange = useCallback(
    (rate: number) => {
      setPlaybackRate(rate);
      setSpeedMenuVisible(false);
    },
    [setPlaybackRate, setSpeedMenuVisible],
  );

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
          : "Buffering...",
      );
    }
  }, [
    itemQuery.isLoading,
    playbackQuery.isLoading,
    playerStatus,
    playbackMode,
  ]);

  // Show fullscreen loader only for initial loading (metadata/playback info)
  const showFullscreenLoader = itemQuery.isLoading || playbackQuery.isLoading;

  // Show buffering indicator in corner when player is loading/buffering
  const showBufferingIndicator =
    playerStatus === "loading" && !showFullscreenLoader;

  // ============================================================================
  // Gesture Handlers
  // ============================================================================

  const handleGestureSeek = useCallback(
    (delta: number) => {
      seekRelative(delta);
    },
    [seekRelative],
  );

  const handleGestureVolumeChange = useCallback(
    (delta: number) => {
      const newVolume = clamp(volume + delta, 0, 1);
      setVolume(newVolume);
    },
    [volume, setVolume],
  );

  const handleGestureBrightnessChange = useCallback(
    (delta: number) => {
      const newBrightness = clamp(brightness + delta, 0, 1);
      setBrightness(newBrightness);
    },
    [brightness, setBrightness],
  );

  const handleDoubleTapLeft = useCallback(() => {
    seekRelative(-SEEK_STEP_SECONDS);
  }, [seekRelative]);

  const handleDoubleTapRight = useCallback(() => {
    seekRelative(SEEK_STEP_SECONDS);
  }, [seekRelative]);

  // ============================================================================
  // Skip Intro/Credits Hook
  // ============================================================================

  // Resolve skip markers
  const introMarkers = useMemo(() => {
    // 1. Try Intro Skipper plugin results
    if (
      introTimestampsQuery.data?.Valid &&
      introTimestampsQuery.data.IntroStart !== undefined &&
      introTimestampsQuery.data.IntroEnd !== undefined
    ) {
      return {
        start: introTimestampsQuery.data.IntroStart,
        end: introTimestampsQuery.data.IntroEnd,
      };
    }
    // 2. Fallback to chapters? (Jellyfin doesn't typically mark intros in chapters, but we could check)
    // For now just rely on plugin or null
    return undefined;
  }, [introTimestampsQuery.data]);

  const creditsStart = useMemo(() => {
    // 1. Try Intro Skipper plugin results
    if (
      creditsTimestampsQuery.data?.Valid &&
      creditsTimestampsQuery.data.IntroStart !== undefined
    ) {
      return creditsTimestampsQuery.data.IntroStart;
    }

    // 2. Fallback to chapters
    if (itemQuery.data?.Chapters) {
      const creditsChapter = itemQuery.data.Chapters.find((chapter) =>
        chapter.Name?.toLowerCase().includes("credits"),
      );
      if (creditsChapter?.StartPositionTicks) {
        return creditsChapter.StartPositionTicks / 10_000_000;
      }
    }

    return undefined;
  }, [creditsTimestampsQuery.data, itemQuery.data?.Chapters]);

  const { showSkipIntro, showSkipCredits, skipIntroTime, skipCreditsTime } =
    useSkipIntro({
      currentTime,
      duration,
      introMarkers,
      creditsStart,
    });

  const handleSkipIntro = useCallback(() => {
    if (!skipIntroTime) return;

    isSeekingRef.current = true;

    if ("seekTo" in player && typeof player.seekTo === "function") {
      void (player.seekTo(skipIntroTime) as Promise<void>)
        .catch(() => {
          const delta = skipIntroTime - (player.currentTime ?? 0);
          player.seekBy(delta);
        })
        .finally(() => {
          isSeekingRef.current = false;
        });
    } else {
      const delta = skipIntroTime - (player.currentTime ?? 0);
      player.seekBy(delta);
      isSeekingRef.current = false;
    }
  }, [skipIntroTime, player]);

  const handleSkipCredits = useCallback(() => {
    if (!skipCreditsTime) return;

    isSeekingRef.current = true;

    if ("seekTo" in player && typeof player.seekTo === "function") {
      void (player.seekTo(skipCreditsTime) as Promise<void>)
        .catch(() => {
          const delta = skipCreditsTime - (player.currentTime ?? 0);
          player.seekBy(delta);
        })
        .finally(() => {
          isSeekingRef.current = false;
        });
    } else {
      const delta = skipCreditsTime - (player.currentTime ?? 0);
      player.seekBy(delta);
      isSeekingRef.current = false;
    }
  }, [skipCreditsTime, player]);

  // ============================================================================
  // Next Episode Hook
  // ============================================================================

  const handlePlayNextEpisode = useCallback(() => {
    // TODO: Implement navigation to next episode
    // This would require fetching next episode info from Jellyfin
    console.log("Play next episode");
  }, []);

  const { cancelAutoplay, playNow } = useNextEpisode({
    currentTime,
    duration,
    isPlaying,
    hasNextEpisode: false, // TODO: Determine from Jellyfin API
    onPlayNext: handlePlayNextEpisode,
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setError(null);
    // Retry by reloading the source
    void playbackQuery.refetch().finally(() => {
      setIsRetrying(false);
    });
  }, [playbackQuery]);

  const handleSwitchSource = useCallback(() => {
    setError(null);
    const newMode = playbackMode === "stream" ? "download" : "stream";
    if (newMode === "download" && !hasDownload) return;
    if (newMode === "stream" && !hasStream) return;
    handlePlaybackModeChange(newMode);
  }, [playbackMode, hasDownload, hasStream, handlePlaybackModeChange]);

  // Detect player errors
  useEffect(() => {
    if (playerStatus === "error") {
      setError(new Error("Video playback failed. Please try again."));
    }
  }, [playerStatus]);

  // ============================================================================
  // Playback End
  // ============================================================================

  useEffect(() => {
    if (!playToEndEvent) return;
    player.pause();
    setControlsVisible(true);

    // Report playback stopped when video ends
    if (playbackMode === "stream" && connector && streamingContextRef.current) {
      const {
        itemId: ctxItemId,
        mediaSourceId,
        playSessionId,
      } = streamingContextRef.current;
      const positionTicks = Math.floor(duration * 10_000_000);

      void connector.reportPlaybackStopped({
        itemId: ctxItemId,
        mediaSourceId,
        playSessionId: playSessionId ?? undefined,
        positionTicks,
      });
    }
  }, [
    playToEndEvent,
    player,
    setControlsVisible,
    playbackMode,
    connector,
    duration,
  ]);

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

      {/* Interaction Surface */}
      <Pressable
        style={styles.interactionLayer}
        pointerEvents={controlsVisible ? "none" : "auto"}
        onPress={toggleControls}
        accessibilityRole="button"
        accessibilityLabel="Show playback controls"
      />

      {/* Controls Overlay */}
      <Animated.View
        style={[styles.overlay, { opacity: controlsOpacityAnim }]}
        pointerEvents={controlsVisible ? "auto" : "none"}
      >
        <Pressable
          style={styles.overlayBackdrop}
          onPress={toggleControls}
          accessibilityRole="button"
          accessibilityLabel="Hide playback controls"
        />

        <View style={styles.overlayContent} pointerEvents="box-none">
          {/* Top Bar */}
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

          {/* Center Controls */}
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

          {/* Bottom Section */}
          <View style={styles.bottomSection}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Pressable
                style={styles.progressBar}
                onPress={handleProgressBarPress}
                onLayout={handleProgressBarLayout}
              >
                <View style={styles.progressBackground} />
                <View
                  style={[styles.progressFill, { width: `${progress * 100}%` }]}
                />
                <View
                  style={[styles.progressThumb, { left: `${progress * 100}%` }]}
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
                    onPress={() => {
                      setSourceMenuVisible(true);
                      setControlsVisible(true);
                      resetHideControlsTimer();
                    }}
                    disabled={!hasDownload && !hasStream}
                  />
                }
              >
                <Menu.Item
                  onPress={() => handlePlaybackModeChange("stream")}
                  title="Stream from Jellyfin"
                  disabled={!hasStream}
                  leadingIcon={playbackMode === "stream" ? "check" : undefined}
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
                    onPress={() => {
                      setTrackMenuVisible(true);
                      setControlsVisible(true);
                      resetHideControlsTimer();
                    }}
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
                      leadingIcon={!currentSubtitleTrack ? "check" : undefined}
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
                    onPress={() => {
                      setSpeedMenuVisible(true);
                      setControlsVisible(true);
                      resetHideControlsTimer();
                    }}
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
                onPress={() => {
                  setShowVolumeSlider(!showVolumeSlider);
                  setShowBrightnessSlider(false);
                  setControlsVisible(true);
                  resetHideControlsTimer();
                }}
              />

              {/* Brightness Button */}
              <IconButton
                icon="brightness-7"
                iconColor="white"
                onPress={() => {
                  setShowBrightnessSlider(!showBrightnessSlider);
                  setShowVolumeSlider(false);
                  setControlsVisible(true);
                  resetHideControlsTimer();
                }}
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
                  onLayout={handleVolumeSliderLayout}
                  onPress={(event) => {
                    const width = event.nativeEvent.locationX;
                    const totalWidth = volumeSliderWidthRef.current;
                    if (totalWidth > 0) {
                      const newVolume = clamp(width / totalWidth, 0, 1);
                      setVolume(newVolume);
                      setControlsVisible(true);
                      resetHideControlsTimer();
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
                  onLayout={handleBrightnessSliderLayout}
                  onPress={(event) => {
                    const width = event.nativeEvent.locationX;
                    const totalWidth = brightnessSliderWidthRef.current;
                    if (totalWidth > 0) {
                      const newBrightness = clamp(width / totalWidth, 0, 1);
                      setBrightness(newBrightness);
                      setControlsVisible(true);
                      resetHideControlsTimer();
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
        </View>
      </Animated.View>

      {/* Gesture Overlay */}
      {!controlsVisible && !error && (
        <GestureOverlay
          onSeek={handleGestureSeek}
          onVolumeChange={handleGestureVolumeChange}
          onBrightnessChange={handleGestureBrightnessChange}
          onDoubleTapLeft={handleDoubleTapLeft}
          onDoubleTapRight={handleDoubleTapRight}
          onSingleTap={toggleControls}
        />
      )}

      {/* Skip Intro Button */}
      {showSkipIntro && !error && (
        <SkipButton type="intro" onSkip={handleSkipIntro} />
      )}

      {/* Skip Credits Button */}
      {showSkipCredits && !error && (
        <SkipButton type="credits" onSkip={handleSkipCredits} />
      )}

      {/* Next Episode Overlay */}
      <NextEpisodeOverlay
        nextEpisodeTitle="Next Episode Title" // TODO: Get from API
        nextEpisodeNumber="S01E02" // TODO: Get from API
        onPlayNow={playNow}
        onCancel={cancelAutoplay}
      />

      {/* Quality Selector */}
      <QualitySelector
        options={[
          { id: "auto", label: "Auto", resolution: "Adaptive" },
          {
            id: "1080p",
            label: "1080p",
            resolution: "1920x1080",
            bitrate: 8000000,
          },
          {
            id: "720p",
            label: "720p",
            resolution: "1280x720",
            bitrate: 4000000,
          },
          {
            id: "480p",
            label: "480p",
            resolution: "854x480",
            bitrate: 2000000,
          },
        ]}
      />

      {/* Playback Stats */}
      <PlaybackStats
        currentTime={currentTime}
        duration={duration}
        bufferedPosition={player.bufferedPosition ?? 0}
        resolution={undefined} // TODO: Get from player metadata
        bitrate={undefined} // TODO: Get from player metadata
        codec={undefined} // TODO: Get from player metadata
        fps={undefined} // TODO: Get from player metadata
        droppedFrames={undefined} // TODO: Get from player metadata
        audioTrack={currentAudioTrack?.label}
        subtitleTrack={currentSubtitleTrack?.label}
      />

      {/* Error Recovery */}
      {error && (
        <ErrorRecovery
          maxRetries={3}
          onRetry={handleRetry}
          onSwitchSource={
            hasDownload && hasStream ? handleSwitchSource : undefined
          }
          onGoBack={handleBack}
          isRetrying={isRetrying}
        />
      )}

      {/* Fullscreen Loading Overlay - only for initial loading */}
      {showFullscreenLoader && !error && (
        <FullscreenLoading message={loadingMessage} />
      )}

      {/* Buffering Indicator - bottom left corner */}
      {showBufferingIndicator && !error && (
        <View style={styles.bufferingIndicator}>
          <Text variant="labelMedium" style={styles.bufferingText}>
            {loadingMessage}
          </Text>
        </View>
      )}
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
    },
    overlayContent: {
      flex: 1,
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    overlayBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    interactionLayer: {
      ...StyleSheet.absoluteFillObject,
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
    bufferingIndicator: {
      position: "absolute",
      bottom: spacing.lg,
      left: spacing.lg,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.2)",
    },
    bufferingText: {
      color: "white",
      fontWeight: "500",
    },
  });

export default JellyfinPlayerScreen;
