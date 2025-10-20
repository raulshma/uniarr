import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { VideoAirPlayButton, VideoView, useVideoPlayer } from "expo-video";
import type { AudioTrack, SubtitleTrack, VideoSource } from "expo-video";
import { useEvent } from "expo";
import { setAudioModeAsync } from "expo-audio";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  Divider,
  HelperText,
  IconButton,
  Menu,
  Text,
  useTheme,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useQuery } from "@tanstack/react-query";

import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { EmptyState } from "@/components/common/EmptyState";
import { useJellyfinItemDetails } from "@/hooks/useJellyfinItemDetails";
import { useJellyfinPlaybackInfo } from "@/hooks/useJellyfinPlaybackInfo";
import { queryKeys } from "@/hooks/queryKeys";
import {
  selectGetConnector,
  useConnectorsStore,
} from "@/store/connectorsStore";
import { useDownloadStore } from "@/store/downloadStore";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import type { JellyfinItem } from "@/models/jellyfin.types";

const PLAYBACK_RATES: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

const formatMillis = (millis?: number): string => {
  if (typeof millis !== "number" || Number.isNaN(millis) || millis < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(millis / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatBitrate = (bitrate?: number | null): string => {
  if (!bitrate || bitrate <= 0) {
    return "Unknown";
  }
  return `${(bitrate / 1_000_000).toFixed(1)} Mbps`;
};

const formatResolution = (
  width?: number | null,
  height?: number | null,
): string | undefined => {
  if (!width || !height) {
    return undefined;
  }
  return `${width}×${height}`;
};

const formatAudioTrackLabel = (track: AudioTrack): string => {
  if (track.label && track.language) {
    return `${track.label} (${track.language.toUpperCase()})`;
  }
  if (track.label) {
    return track.label;
  }
  if (track.language) {
    return track.language.toUpperCase();
  }
  return "Audio track";
};

const formatSubtitleTrackLabel = (track: SubtitleTrack): string => {
  if (track.label && track.language) {
    return `${track.label} (${track.language.toUpperCase()})`;
  }
  if (track.label) {
    return track.label;
  }
  if (track.language) {
    return track.language.toUpperCase();
  }
  return "Subtitle";
};

const ensureFileUri = (uri: string | undefined): string | undefined => {
  if (!uri) {
    return undefined;
  }
  return uri.startsWith("file://") ? uri : `file://${uri}`;
};

const formatEpisodeCode = (item?: JellyfinItem | null): string | undefined => {
  if (!item) {
    return undefined;
  }
  const season =
    typeof item.ParentIndexNumber === "number"
      ? String(item.ParentIndexNumber).padStart(2, "0")
      : undefined;
  const episode =
    typeof item.IndexNumber === "number"
      ? String(item.IndexNumber).padStart(2, "0")
      : undefined;

  if (season && episode) {
    return `S${season}E${episode}`;
  }

  if (episode) {
    return `Episode ${episode}`;
  }

  return undefined;
};

const JellyfinPlayerScreen = () => {
  "use no memo";
  const {
    serviceId: rawServiceId,
    itemId: rawItemId,
    source: rawSource,
    startTicks: rawStartTicks,
  } = useLocalSearchParams<{
    serviceId?: string;
    itemId?: string;
    source?: string;
    startTicks?: string;
  }>();
  const serviceId = typeof rawServiceId === "string" ? rawServiceId : undefined;
  const itemId = typeof rawItemId === "string" ? rawItemId : undefined;
  const sourcePreference =
    rawSource === "download" || rawSource === "stream" ? rawSource : undefined;
  const startTicks =
    typeof rawStartTicks === "string" && rawStartTicks.trim().length > 0
      ? Number(rawStartTicks)
      : undefined;
  const startPositionMillis = Number.isFinite(startTicks)
    ? Math.floor((startTicks ?? 0) / 10_000)
    : undefined;

  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const getConnector = useConnectorsStore(selectGetConnector);
  useEffect(() => {
    let cancelled = false;

    const ensureConnector = async () => {
      if (!serviceId) {
        return;
      }
      if (getConnector(serviceId)) {
        return;
      }
      try {
        await ConnectorManager.getInstance().loadSavedServices();
      } catch {
        // ignore connector bootstrap failures here; hook will surface errors
      }
      if (cancelled) {
        return;
      }
    };

    void ensureConnector();

    return () => {
      cancelled = true;
    };
  }, [getConnector, serviceId]);

  const connector = useMemo(() => {
    if (!serviceId) {
      return undefined;
    }
    const instance = getConnector(serviceId);
    if (!instance || instance.config.type !== "jellyfin") {
      return undefined;
    }
    return instance as JellyfinConnector;
  }, [getConnector, serviceId]);

  const itemQuery = useJellyfinItemDetails({ serviceId, itemId });
  const playbackQuery = useJellyfinPlaybackInfo({ serviceId, itemId });

  const seriesId = useMemo(() => {
    const item = itemQuery.data;
    if (!item) {
      return undefined;
    }
    if (typeof item.SeriesId === "string" && item.SeriesId.length > 0) {
      return item.SeriesId;
    }
    if (item.Type === "Series" && typeof item.Id === "string") {
      return item.Id;
    }
    return undefined;
  }, [itemQuery.data]);

  const nextUpQuery = useQuery<JellyfinItem | undefined>({
    queryKey:
      serviceId && seriesId
        ? queryKeys.jellyfin.nextUp(serviceId, seriesId, {
            currentItemId: itemId ?? null,
          })
        : queryKeys.jellyfin.base,
    enabled: Boolean(serviceId && seriesId && connector),
    staleTime: 120_000,
    queryFn: async () => {
      if (!connector || !seriesId) {
        return undefined;
      }
      return connector.getNextUpEpisode(seriesId, itemId);
    },
  });

  const downloadSelector = useMemo(
    () => (state: ReturnType<typeof useDownloadStore.getState>) => {
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

  const initialPlaybackMode = useMemo(() => {
    if (sourcePreference) {
      if (sourcePreference === "download" && hasDownload) {
        return "download" as const;
      }
      if (sourcePreference === "stream") {
        return "stream" as const;
      }
    }
    if (hasDownload) {
      return "download" as const;
    }
    return "stream" as const;
  }, [hasDownload, sourcePreference]);

  const [playbackMode, setPlaybackMode] = useState<"download" | "stream">(
    initialPlaybackMode,
  );
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [sourceMenuVisible, setSourceMenuVisible] = useState(false);
  const [speedMenuVisible, setSpeedMenuVisible] = useState(false);
  const [trackMenuVisible, setTrackMenuVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [initialSeekApplied, setInitialSeekApplied] = useState(false);
  const [upNextVisible, setUpNextVisible] = useState(false);

  useEffect(() => {
    setUpNextVisible(false);
  }, [itemId]);

  useEffect(() => {
    if (playbackMode === "download" && !hasDownload && hasStream) {
      setPlaybackMode("stream");
    }
  }, [hasDownload, hasStream, playbackMode]);

  useEffect(() => {
    void (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: "mixWithOthers",
          interruptionModeAndroid: "duckOthers",
        });
      } catch {
        // ignore audio mode configuration failures
      }
    })();
  }, []);

  const playbackInfo = playbackQuery.data;
  const mediaSource = playbackInfo?.mediaSource;
  const streamUrl = playbackInfo?.streamUrl;
  const nextUpItem = nextUpQuery.data;
  const showAirPlayButton = Platform.OS === "ios";

  useEffect(() => {
    if (!nextUpItem) {
      setUpNextVisible(false);
    }
  }, [nextUpItem]);

  const playbackSource = useMemo<VideoSource | null>(() => {
    if (playbackMode === "download" && localFileUri) {
      return { uri: localFileUri };
    }
    if (playbackMode === "stream" && streamUrl) {
      return { uri: streamUrl };
    }
    return null;
  }, [localFileUri, playbackMode, streamUrl]);

  const startPositionSeconds = useMemo(() => {
    if (typeof startPositionMillis === "number" && startPositionMillis > 0) {
      return startPositionMillis / 1000;
    }
    return undefined;
  }, [startPositionMillis]);

  const player = useVideoPlayer(null, (playerInstance) => {
    playerInstance.timeUpdateEventInterval = 0.5;
    playerInstance.staysActiveInBackground = false;
    playerInstance.showNowPlayingNotification = false;
    playerInstance.preservesPitch = true;
    playerInstance.playbackRate = playbackRate;
  });

  useEffect(() => {
    // eslint-disable-next-line react-compiler/react-compiler
    player.allowsExternalPlayback = playbackMode === "stream";
  }, [player, playbackMode]);

  const videoViewRef = useRef<any>(null);
  const pendingSeekSecondsRef = useRef<number | undefined>(
    startPositionSeconds,
  );
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarWidth = useRef(0);
  const lastKnownSecondsRef = useRef<number>(startPositionSeconds ?? 0);
  const startReportedRef = useRef(false);
  const streamingContextRef = useRef<{
    readonly itemId: string;
    readonly mediaSourceId: string;
    readonly playSessionId?: string;
  } | null>(null);
  const lastProgressTicksRef = useRef<number>(-1);
  const isPlayerMountedRef = useRef(true);
  const gestureStartYRef = useRef(0);
  const gestureStartXRef = useRef(0);
  const currentGestureRef = useRef<"brightness" | "volume" | null>(null);
  const [brightnessOverlay, setBrightnessOverlay] = useState<number | null>(
    null,
  );
  const [volumeOverlay, setVolumeOverlay] = useState<number | null>(null);
  const brightnessHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const volumeHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pendingSeekSecondsRef.current = startPositionSeconds;
  }, [startPositionSeconds]);

  useEffect(() => {
    if (typeof startPositionSeconds === "number") {
      lastKnownSecondsRef.current = Math.max(0, startPositionSeconds);
    }
  }, [startPositionSeconds]);

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
      if (brightnessHideTimerRef.current) {
        clearTimeout(brightnessHideTimerRef.current);
      }
      if (volumeHideTimerRef.current) {
        clearTimeout(volumeHideTimerRef.current);
      }
      isPlayerMountedRef.current = false;
    };
  }, []);

  const statusEvent = useEvent(player, "statusChange", {
    status: player.status,
    error: undefined,
  });
  const playingEvent = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const timeEvent = useEvent(player, "timeUpdate", {
    currentTime: player.currentTime ?? 0,
    currentLiveTimestamp: player.currentLiveTimestamp ?? null,
    currentOffsetFromLive: player.currentOffsetFromLive ?? null,
    bufferedPosition: player.bufferedPosition ?? 0,
  });
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
    audioTrack: player.audioTrack ?? null,
  });
  const subtitleTrackEvent = useEvent(player, "subtitleTrackChange", {
    subtitleTrack: player.subtitleTrack ?? null,
  });
  const playToEndEvent = useEvent(player, "playToEnd");

  useEffect(() => {
    if (typeof timeEvent?.currentTime === "number") {
      lastKnownSecondsRef.current = Math.max(0, timeEvent.currentTime);
    }
  }, [timeEvent?.currentTime]);

  const playerStatus = statusEvent?.status ?? player.status ?? "idle";
  const isReadyToPlay = playerStatus === "readyToPlay";
  const isPlaying = playingEvent?.isPlaying ?? player.playing ?? false;

  const currentAudioTrack =
    audioTrackEvent?.audioTrack ?? player.audioTrack ?? null;
  const currentSubtitleTrack =
    subtitleTrackEvent?.subtitleTrack ?? player.subtitleTrack ?? null;

  const audioTrackOptions = useMemo(() => {
    const audioTracks =
      availableAudioTracksEvent?.availableAudioTracks ??
      player.availableAudioTracks ??
      [];
    return audioTracks.filter((track): track is AudioTrack => Boolean(track));
  }, [
    availableAudioTracksEvent?.availableAudioTracks,
    player.availableAudioTracks,
  ]);

  const subtitleTrackOptions = useMemo(() => {
    const subtitleTracks =
      availableSubtitleTracksEvent?.availableSubtitleTracks ??
      player.availableSubtitleTracks ??
      [];
    return subtitleTracks.filter((track): track is SubtitleTrack =>
      Boolean(track),
    ) as SubtitleTrack[];
  }, [
    availableSubtitleTracksEvent?.availableSubtitleTracks,
    player.availableSubtitleTracks,
  ]);

  const isAudioTrackSelected = useCallback(
    (track: AudioTrack) => {
      if (!currentAudioTrack) {
        return false;
      }
      if (currentAudioTrack.id && track.id) {
        return currentAudioTrack.id === track.id;
      }
      if (currentAudioTrack.label && track.label) {
        return currentAudioTrack.label === track.label;
      }
      if (currentAudioTrack.language && track.language) {
        return currentAudioTrack.language === track.language;
      }
      return false;
    },
    [currentAudioTrack],
  );

  const isSubtitleTrackSelected = useCallback(
    (track: SubtitleTrack) => {
      if (!currentSubtitleTrack) {
        return false;
      }
      if (currentSubtitleTrack.id && track.id) {
        return currentSubtitleTrack.id === track.id;
      }
      if (currentSubtitleTrack.label && track.label) {
        return currentSubtitleTrack.label === track.label;
      }
      if (currentSubtitleTrack.language && track.language) {
        return currentSubtitleTrack.language === track.language;
      }
      return false;
    },
    [currentSubtitleTrack],
  );

  const hasTrackOptions =
    audioTrackOptions.length > 1 || subtitleTrackOptions.length > 0;

  const playbackSourceKey = useMemo(() => {
    if (!playbackSource) {
      return null;
    }

    if (typeof playbackSource === "string") {
      return `${playbackMode}:${playbackSource}`;
    }

    if (typeof playbackSource === "number") {
      return `${playbackMode}:asset-${playbackSource}`;
    }

    if (typeof playbackSource === "object") {
      if (
        "assetId" in playbackSource &&
        typeof playbackSource.assetId === "number"
      ) {
        return `${playbackMode}:asset-${playbackSource.assetId}`;
      }

      if ("uri" in playbackSource && playbackSource.uri) {
        return `${playbackMode}:${playbackSource.uri}`;
      }
    }

    return `${playbackMode}:unknown`;
  }, [playbackMode, playbackSource]);

  useEffect(() => {
    startReportedRef.current = false;
    streamingContextRef.current = null;
    lastProgressTicksRef.current = -1;
  }, [playbackSourceKey, playbackMode]);

  useEffect(() => {
    if (!playbackSource || !playbackSourceKey) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        await player.replaceAsync(playbackSource);
        player.play();
        if (!cancelled) {
          setPlaybackError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setPlaybackError(
            error instanceof Error ? error.message : "Unable to load media.",
          );
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [player, playbackSource, playbackSourceKey]);

  // Handle initial seek position separately to avoid React Compiler mutation warnings
  useEffect(() => {
    if (
      !initialSeekApplied &&
      typeof pendingSeekSecondsRef.current === "number" &&
      playerStatus === "readyToPlay"
    ) {
      const seekPosition = pendingSeekSecondsRef.current;
      // Seeking on player instance is an intentional imperative operation
      player.currentTime = seekPosition;
      setInitialSeekApplied(true);
    }
  }, [initialSeekApplied, playerStatus, player]);

  useEffect(() => {
    if (statusEvent?.error) {
      setPlaybackError(statusEvent.error.message ?? "Playback error.");
    } else if (playerStatus === "readyToPlay") {
      setPlaybackError(null);
    }
  }, [playerStatus, statusEvent]);

  const resetHideControlsTimer = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    if (isReadyToPlay && isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [isPlaying, isReadyToPlay]);

  useEffect(() => {
    if (controlsVisible) {
      resetHideControlsTimer();
    }
  }, [controlsVisible, resetHideControlsTimer]);

  useEffect(() => {
    if (!isReadyToPlay) {
      return;
    }

    if (isPlaying) {
      resetHideControlsTimer();
    } else if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
  }, [isPlaying, isReadyToPlay, resetHideControlsTimer]);

  useEffect(() => {
    player.playbackRate = playbackRate;
  }, [player, playbackRate]);

  useEffect(() => {
    if (!controlsVisible) {
      setSourceMenuVisible(false);
      setSpeedMenuVisible(false);
      setTrackMenuVisible(false);
    }
  }, [controlsVisible]);

  useEffect(() => {
    if (!hasTrackOptions) {
      setTrackMenuVisible(false);
    }
  }, [hasTrackOptions]);

  const handleProgressLayout = useCallback((event: LayoutChangeEvent) => {
    progressBarWidth.current = event.nativeEvent.layout.width;
  }, []);

  const toggleControls = useCallback(() => {
    setControlsVisible((prev) => {
      const next = !prev;
      if (next) {
        resetHideControlsTimer();
      }
      return next;
    });
  }, [resetHideControlsTimer]);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      player.pause();
      setControlsVisible(true);
    } else {
      player.play();
    }
  }, [isPlaying, player]);

  const handleSeekRelative = useCallback(
    (seconds: number) => {
      const durationSeconds =
        (player.duration && player.duration > 0
          ? player.duration
          : undefined) ??
        (mediaSource?.RunTimeTicks ? mediaSource.RunTimeTicks / 10_000_000 : 0);

      if (durationSeconds <= 0) {
        return;
      }

      const currentSeconds = timeEvent?.currentTime ?? player.currentTime ?? 0;
      const targetSeconds = Math.min(
        Math.max(currentSeconds + seconds, 0),
        durationSeconds,
      );
      pendingSeekSecondsRef.current = undefined;
      player.currentTime = targetSeconds;
    },
    [mediaSource?.RunTimeTicks, player, timeEvent],
  );

  const handleProgressPress = useCallback(
    (event: GestureResponderEvent) => {
      const durationSeconds =
        (player.duration && player.duration > 0
          ? player.duration
          : undefined) ??
        (mediaSource?.RunTimeTicks ? mediaSource.RunTimeTicks / 10_000_000 : 0);

      if (durationSeconds <= 0) {
        return;
      }

      const width = progressBarWidth.current || 1;
      const fraction = Math.min(
        Math.max(event.nativeEvent.locationX / width, 0),
        1,
      );
      pendingSeekSecondsRef.current = undefined;
      player.currentTime = durationSeconds * fraction;
    },
    [mediaSource?.RunTimeTicks, player],
  );

  const reportStop = useCallback(() => {
    if (
      playbackMode !== "stream" ||
      !connector ||
      !streamingContextRef.current ||
      !startReportedRef.current
    ) {
      return;
    }

    const ticks = Math.max(
      0,
      Math.floor(lastKnownSecondsRef.current * 10_000_000),
    );
    const context = streamingContextRef.current;
    streamingContextRef.current = null;
    startReportedRef.current = false;
    lastProgressTicksRef.current = -1;

    void connector.reportPlaybackStopped({
      itemId: context.itemId,
      mediaSourceId: context.mediaSourceId,
      playSessionId: context.playSessionId,
      positionTicks: ticks,
    });
  }, [connector, playbackMode]);

  useEffect(() => {
    return () => {
      reportStop();
      // Safely pause player - check if mounted and try-catch for released object
      if (isPlayerMountedRef.current) {
        try {
          player.pause();
        } catch {
          // ignore errors from released player instance
        }
      }
    };
  }, [player, reportStop]);

  const handlePlaybackModeChange = useCallback(
    (mode: "download" | "stream") => {
      if (mode === playbackMode) {
        setSourceMenuVisible(false);
        return;
      }

      if (playbackMode === "stream" && mode === "download") {
        reportStop();
      }

      const resumeSeconds =
        timeEvent?.currentTime ??
        player.currentTime ??
        pendingSeekSecondsRef.current ??
        0;

      pendingSeekSecondsRef.current = resumeSeconds;
      player.pause();
      setPlaybackMode(mode);
      setSourceMenuVisible(false);
      setControlsVisible(true);
    },
    [playbackMode, player, reportStop, timeEvent],
  );

  const handlePlaybackRateChange = useCallback(
    (rate: number) => {
      setPlaybackRate(rate);
      setSpeedMenuVisible(false);
      player.playbackRate = rate;
    },
    [player],
  );

  const handleAudioTrackSelect = useCallback(
    (track: AudioTrack) => {
      player.audioTrack = track;
      setTrackMenuVisible(false);
    },
    [player],
  );

  const handleSubtitleTrackSelect = useCallback(
    (track: SubtitleTrack | null) => {
      player.subtitleTrack = track;
      setTrackMenuVisible(false);
    },
    [player],
  );

  const handleEnterFullscreen = useCallback(() => {
    const view = videoViewRef.current;
    if (view?.enterFullscreen) {
      void view.enterFullscreen();
    }
  }, []);

  const handleShare = useCallback(async () => {
    const item = itemQuery.data;
    if (!item) {
      return;
    }

    const message = [item.Name, item.Overview].filter(Boolean).join("\n\n");
    try {
      await Share.share({ message });
    } catch {
      // ignore share errors
    }
  }, [itemQuery.data]);

  const handlePlayNext = useCallback(() => {
    if (!serviceId || !nextUpItem?.Id) {
      return;
    }

    player.pause();
    reportStop();
    setUpNextVisible(false);

    const params: Record<string, string> = {
      serviceId,
      itemId: nextUpItem.Id,
      source: playbackMode,
    };

    const resumeTicks = (
      nextUpItem as unknown as {
        UserData?: { PlaybackPositionTicks?: number };
      }
    )?.UserData?.PlaybackPositionTicks;
    if (typeof resumeTicks === "number" && resumeTicks > 0) {
      params.startTicks = String(resumeTicks);
    }

    router.replace({
      pathname: "/(auth)/jellyfin/[serviceId]/player/[itemId]",
      params,
    });
  }, [nextUpItem, playbackMode, player, reportStop, router, serviceId]);

  const handleDismissUpNext = useCallback(() => {
    setUpNextVisible(false);
    setControlsVisible(true);
  }, []);

  const handleBack = useCallback(() => {
    player.pause();
    reportStop();
    router.back();
  }, [player, reportStop, router]);

  const toggleInfo = useCallback(() => {
    setInfoVisible((prev) => !prev);
  }, []);

  const handleGestureStart = useCallback((event: GestureResponderEvent) => {
    gestureStartXRef.current = event.nativeEvent.locationX;
    gestureStartYRef.current = event.nativeEvent.locationY;

    const screenWidth = Dimensions.get("window").width;
    const isLeftSide = gestureStartXRef.current < screenWidth / 3;
    const isRightSide = gestureStartXRef.current > (screenWidth * 2) / 3;

    if (isLeftSide) {
      currentGestureRef.current = "brightness";
    } else if (isRightSide) {
      currentGestureRef.current = "volume";
    } else {
      currentGestureRef.current = null;
    }
  }, []);

  const handleGestureMove = useCallback((event: GestureResponderEvent) => {
    if (!currentGestureRef.current) {
      return;
    }

    const deltaY = gestureStartYRef.current - event.nativeEvent.locationY;
    const screenHeight = Dimensions.get("window").height;
    const sensitivity = screenHeight / 100;
    const delta = deltaY / sensitivity;

    if (currentGestureRef.current === "brightness") {
      setBrightnessOverlay((prev) => {
        const next = Math.max(0, Math.min(100, (prev ?? 50) + delta));
        if (brightnessHideTimerRef.current) {
          clearTimeout(brightnessHideTimerRef.current);
        }
        brightnessHideTimerRef.current = setTimeout(() => {
          setBrightnessOverlay(null);
        }, 1500);
        return next;
      });
    } else if (currentGestureRef.current === "volume") {
      setVolumeOverlay((prev) => {
        const next = Math.max(0, Math.min(100, (prev ?? 50) + delta));
        if (volumeHideTimerRef.current) {
          clearTimeout(volumeHideTimerRef.current);
        }
        volumeHideTimerRef.current = setTimeout(() => {
          setVolumeOverlay(null);
        }, 1500);
        return next;
      });
    }

    gestureStartYRef.current = event.nativeEvent.locationY;
  }, []);

  const handleGestureEnd = useCallback(() => {
    currentGestureRef.current = null;
  }, []);

  const panResponderRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => handleGestureStart(event),
      onPanResponderMove: (event) => handleGestureMove(event),
      onPanResponderRelease: handleGestureEnd,
      onPanResponderTerminate: handleGestureEnd,
    }),
  );

  const playbackErrorMessage = playbackError
    ? playbackError
    : playbackQuery.error instanceof Error
      ? playbackQuery.error.message
      : playbackQuery.error
        ? "Unable to load playback information."
        : null;

  const videoStream = useMemo(
    () => mediaSource?.MediaStreams?.find((stream) => stream?.Type === "Video"),
    [mediaSource],
  );

  const audioStream = useMemo(
    () =>
      mediaSource?.MediaStreams?.find(
        (stream) => stream?.Type === "Audio" && stream?.IsDefault,
      ) ??
      mediaSource?.MediaStreams?.find((stream) => stream?.Type === "Audio"),
    [mediaSource],
  );

  useEffect(() => {
    if (!playToEndEvent) {
      return;
    }

    player.pause();
    reportStop();
    if (nextUpItem) {
      setUpNextVisible(true);
      setControlsVisible(true);
    }
  }, [nextUpItem, playToEndEvent, player, reportStop]);

  useEffect(() => {
    if (upNextVisible) {
      setControlsVisible(true);
    }
  }, [upNextVisible]);

  if (!serviceId || !itemId) {
    return (
      <SafeAreaView style={styles.fallbackSafeArea}>
        <EmptyState
          title="Missing playback context"
          description="Select an item from Jellyfin before opening the media player."
          actionLabel="Go back"
          onActionPress={handleBack}
        />
      </SafeAreaView>
    );
  }

  if (playbackMode === "stream" && !hasDownload && playbackQuery.isError) {
    return (
      <SafeAreaView style={styles.fallbackSafeArea}>
        <EmptyState
          title="Playback unavailable"
          description={playbackErrorMessage ?? "Unable to start streaming."}
          actionLabel="Retry"
          onActionPress={() => void playbackQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  const posterTag =
    (itemQuery.data as unknown as { PrimaryImageTag?: string })
      ?.PrimaryImageTag ?? itemQuery.data?.ImageTags?.Primary;
  const backdropTag =
    itemQuery.data?.BackdropImageTags?.[0] ??
    itemQuery.data?.ImageTags?.Backdrop ??
    undefined;

  const posterUri =
    connector && itemQuery.data?.Id && posterTag
      ? connector.getImageUrl(itemQuery.data.Id, "Primary", {
          tag: posterTag,
          width: 640,
        })
      : undefined;

  const backdropUri =
    connector && itemQuery.data?.Id && backdropTag
      ? connector.getImageUrl(itemQuery.data.Id, "Backdrop", {
          tag: backdropTag,
          width: Dimensions.get("window").width * 2,
        })
      : undefined;

  const positionMillis = (() => {
    if (typeof timeEvent?.currentTime === "number") {
      return Math.max(0, timeEvent.currentTime) * 1000;
    }
    if (typeof player.currentTime === "number") {
      return Math.max(0, player.currentTime) * 1000;
    }
    if (typeof pendingSeekSecondsRef.current === "number") {
      return Math.max(0, pendingSeekSecondsRef.current) * 1000;
    }
    return 0;
  })();

  const durationMillis = (() => {
    if (typeof player.duration === "number" && player.duration > 0) {
      return player.duration * 1000;
    }
    if (mediaSource?.RunTimeTicks) {
      return Math.floor(mediaSource.RunTimeTicks / 10_000);
    }
    return 0;
  })();
  const progressFraction = durationMillis
    ? Math.min(Math.max(positionMillis / durationMillis, 0), 1)
    : 0;

  const title = itemQuery.data?.Name ?? "Untitled";
  const subtitle = (() => {
    const year = itemQuery.data?.ProductionYear
      ? String(itemQuery.data.ProductionYear)
      : itemQuery.data?.PremiereDate
        ? String(new Date(itemQuery.data.PremiereDate).getFullYear())
        : undefined;
    const runtime = durationMillis
      ? `${Math.round(durationMillis / 60000)}m`
      : undefined;
    if (year && runtime) {
      return `${year} • ${runtime}`;
    }
    return year ?? runtime ?? undefined;
  })();

  const sourceLabel =
    playbackMode === "download"
      ? "Offline playback"
      : "Streaming from Jellyfin";

  const resolutionLabel = formatResolution(
    videoStream?.Width ?? undefined,
    videoStream?.Height ?? undefined,
  );
  const bitrateLabel = formatBitrate(
    videoStream?.BitRate ?? audioStream?.BitRate ?? mediaSource?.Bitrate,
  );
  const videoCodecLabel = videoStream?.Codec
    ? videoStream.Codec.toUpperCase()
    : undefined;
  const audioCodecLabel = audioStream?.Codec
    ? `${audioStream.Codec.toUpperCase()} ${audioStream.Channels ?? ""}ch`
    : undefined;

  const nextUpEpisodeCode = formatEpisodeCode(nextUpItem);
  const nextUpRuntimeLabel = nextUpItem?.RunTimeTicks
    ? `${Math.round(nextUpItem.RunTimeTicks / 600_000_000)}m`
    : undefined;
  const nextUpSubtitleLabel = [nextUpEpisodeCode, nextUpRuntimeLabel]
    .filter(Boolean)
    .join(" • ");
  const nextUpPosterTag =
    (nextUpItem as unknown as { ImageTags?: { Primary?: string } })?.ImageTags
      ?.Primary ??
    (nextUpItem as unknown as { ParentThumbImageTag?: string })
      ?.ParentThumbImageTag ??
    (nextUpItem as unknown as { ImageTags?: { Thumb?: string } })?.ImageTags
      ?.Thumb ??
    undefined;
  const nextUpPosterUri =
    connector && nextUpItem?.Id
      ? connector.getImageUrl(
          nextUpItem.Id,
          "Primary",
          nextUpPosterTag
            ? {
                tag: nextUpPosterTag,
                width: 480,
              }
            : undefined,
        )
      : undefined;

  const showLoader =
    !playbackSource ||
    (playerStatus !== "readyToPlay" && playerStatus !== "error");

  return (
    <View style={styles.container} {...panResponderRef.current?.panHandlers}>
      {backdropUri ? (
        <Image
          source={{ uri: backdropUri }}
          style={styles.backdrop}
          contentFit="cover"
          blurRadius={20}
        />
      ) : null}
      <Pressable style={styles.videoSurface} onPress={toggleControls}>
        {playbackSource ? (
          <VideoView
            style={styles.video}
            player={player}
            nativeControls={false}
            fullscreenOptions={{ enable: true, orientation: "landscape" }}
            allowsPictureInPicture={false}
            contentFit="contain"
            ref={videoViewRef}
          />
        ) : (
          <View style={styles.videoFallback}>
            <ActivityIndicator animating size="large" />
          </View>
        )}
      </Pressable>

      <LinearGradient
        colors={["rgba(0,0,0,0.6)", "transparent"]}
        style={[styles.gradientTop, { paddingTop: insets.top + spacing.sm }]}
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={[
          styles.gradientBottom,
          { paddingBottom: insets.bottom + spacing.md },
        ]}
      />

      <View
        pointerEvents={controlsVisible ? "auto" : "none"}
        style={[styles.overlay, { opacity: controlsVisible ? 1 : 0 }]}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.topLeft}>
            <IconButton icon="arrow-left" onPress={handleBack} />
            <View style={styles.titleGroup}>
              <Text
                variant="titleMedium"
                style={styles.titleText}
                numberOfLines={1}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text
                  variant="bodySmall"
                  style={styles.subtitleText}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.topActions}>
            {showAirPlayButton && playbackMode === "stream" ? (
              <View style={styles.airPlayWrapper}>
                <VideoAirPlayButton tint="white" style={styles.airPlayButton} />
              </View>
            ) : null}
            <IconButton icon="share-variant" onPress={handleShare} />
            <IconButton icon="information-outline" onPress={toggleInfo} />
          </View>
        </View>

        <View style={styles.centerControls}>
          <IconButton
            icon="rewind-10"
            size={36}
            onPress={() => handleSeekRelative(-10)}
          />
          <Pressable style={styles.playButton} onPress={handleTogglePlay}>
            <IconButton icon={isPlaying ? "pause" : "play"} size={48} />
          </Pressable>
          <IconButton
            icon="fast-forward-10"
            size={36}
            onPress={() => handleSeekRelative(10)}
          />
        </View>

        <View
          style={[
            styles.bottomSection,
            { paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <View
            style={styles.progressContainer}
            onLayout={handleProgressLayout}
          >
            <Pressable style={styles.progressBar} onPress={handleProgressPress}>
              <View style={styles.progressBackground} />
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressFraction * 100}%` },
                ]}
              />
              <View
                style={[
                  styles.progressThumb,
                  { left: `${progressFraction * 100}%` },
                ]}
              />
            </Pressable>
            <View style={styles.timeRow}>
              <Text variant="labelSmall" style={styles.timeText}>
                {formatMillis(positionMillis)}
              </Text>
              <Text variant="labelSmall" style={styles.timeText}>
                {formatMillis(durationMillis)}
              </Text>
            </View>
          </View>

          <View style={styles.bottomMetadata}>
            <Text
              variant="labelSmall"
              style={styles.sourceText}
              numberOfLines={1}
            >
              {sourceLabel}
            </Text>
            <View style={styles.metaRow}>
              {videoCodecLabel ? (
                <Text variant="labelSmall" style={styles.metaText}>
                  {videoCodecLabel}
                </Text>
              ) : null}
              {audioCodecLabel ? (
                <Text variant="labelSmall" style={styles.metaText}>
                  {audioCodecLabel}
                </Text>
              ) : null}
              {resolutionLabel ? (
                <Text variant="labelSmall" style={styles.metaText}>
                  {resolutionLabel}
                </Text>
              ) : null}
              {bitrateLabel ? (
                <Text variant="labelSmall" style={styles.metaText}>
                  {bitrateLabel}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.controlsRow}>
            <Menu
              visible={sourceMenuVisible}
              onDismiss={() => setSourceMenuVisible(false)}
              anchor={
                <View>
                  <IconButton
                    icon="playlist-play"
                    onPress={() => setSourceMenuVisible(true)}
                    disabled={!hasDownload && !hasStream}
                  />
                </View>
              }
            >
              <Menu.Item
                onPress={() => handlePlaybackModeChange("stream")}
                title="Stream from Jellyfin"
                disabled={!hasStream}
              />
              <Menu.Item
                onPress={() => handlePlaybackModeChange("download")}
                title="Play downloaded copy"
                disabled={!hasDownload}
              />
            </Menu>

            <Menu
              visible={trackMenuVisible}
              onDismiss={() => setTrackMenuVisible(false)}
              anchor={
                <View>
                  <IconButton
                    icon="tune-vertical"
                    onPress={() => setTrackMenuVisible(true)}
                    disabled={!hasTrackOptions}
                  />
                </View>
              }
            >
              {audioTrackOptions.length > 0 ? (
                <>
                  <Menu.Item
                    title="Audio tracks"
                    disabled
                    onPress={() => undefined}
                    titleStyle={styles.menuSectionLabel}
                  />
                  {audioTrackOptions.map((track, index) => {
                    const key =
                      track.id ?? `${track.language ?? "audio"}-${index}`;
                    return (
                      <Menu.Item
                        key={`audio-${key}`}
                        onPress={() => handleAudioTrackSelect(track)}
                        title={formatAudioTrackLabel(track)}
                        trailingIcon={
                          isAudioTrackSelected(track) ? "check" : undefined
                        }
                      />
                    );
                  })}
                </>
              ) : null}

              {audioTrackOptions.length > 0 &&
              subtitleTrackOptions.length > 0 ? (
                <Divider />
              ) : null}

              {subtitleTrackOptions.length > 0 ? (
                <>
                  <Menu.Item
                    title="Subtitles"
                    disabled
                    onPress={() => undefined}
                    titleStyle={styles.menuSectionLabel}
                  />
                  <Menu.Item
                    onPress={() => handleSubtitleTrackSelect(null)}
                    title="Subtitles off"
                    trailingIcon={currentSubtitleTrack ? undefined : "check"}
                  />
                  {subtitleTrackOptions.map((track, index) => {
                    const key =
                      track.id ?? `${track.language ?? "subtitle"}-${index}`;
                    return (
                      <Menu.Item
                        key={`subtitle-${key}`}
                        onPress={() => handleSubtitleTrackSelect(track)}
                        title={formatSubtitleTrackLabel(track)}
                        trailingIcon={
                          isSubtitleTrackSelected(track) ? "check" : undefined
                        }
                      />
                    );
                  })}
                </>
              ) : null}
            </Menu>

            <Menu
              visible={speedMenuVisible}
              onDismiss={() => setSpeedMenuVisible(false)}
              anchor={
                <View>
                  <IconButton
                    icon="speedometer"
                    onPress={() => setSpeedMenuVisible(true)}
                  />
                </View>
              }
            >
              {PLAYBACK_RATES.map((rate) => (
                <Menu.Item
                  key={rate}
                  onPress={() => handlePlaybackRateChange(rate)}
                  title={`${rate}x`}
                  trailingIcon={rate === playbackRate ? "check" : undefined}
                />
              ))}
            </Menu>

            <View style={styles.controlsSpacer} />

            <IconButton
              icon="skip-next"
              onPress={handlePlayNext}
              disabled={!nextUpItem}
            />
            <IconButton icon="fullscreen" onPress={handleEnterFullscreen} />
          </View>
        </View>
      </View>

      {showLoader ? (
        <View style={styles.loaderOverlay} pointerEvents="none">
          <ActivityIndicator animating size="large" />
        </View>
      ) : null}

      {nextUpItem && upNextVisible ? (
        <View style={styles.upNextOverlay} pointerEvents="auto">
          <View style={styles.upNextCard}>
            {nextUpPosterUri ? (
              <Image
                source={{ uri: nextUpPosterUri }}
                style={styles.upNextPoster}
              />
            ) : null}
            <View style={styles.upNextInfo}>
              <Text variant="labelSmall" style={styles.upNextLabel}>
                Up next
              </Text>
              <Text variant="titleMedium" style={styles.upNextTitle}>
                {nextUpItem.Name ?? "Next episode"}
              </Text>
              {nextUpSubtitleLabel ? (
                <Text variant="bodySmall" style={styles.upNextSubtitle}>
                  {nextUpSubtitleLabel}
                </Text>
              ) : null}
              <View style={styles.upNextActions}>
                <Button mode="contained" onPress={handlePlayNext}>
                  Play next
                </Button>
                <Button mode="text" onPress={handleDismissUpNext}>
                  Not now
                </Button>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {infoVisible ? (
        <View style={styles.infoOverlay}>
          <View style={styles.infoCard}>
            <Text variant="titleMedium" style={styles.infoTitle}>
              Media information
            </Text>
            {posterUri ? (
              <Image source={{ uri: posterUri }} style={styles.infoPoster} />
            ) : null}
            <View style={styles.infoList}>
              <Text variant="bodySmall" style={styles.infoRow}>
                Video: {videoCodecLabel ?? "Unknown"}
              </Text>
              <Text variant="bodySmall" style={styles.infoRow}>
                Audio: {audioCodecLabel ?? "Unknown"}
              </Text>
              <Text variant="bodySmall" style={styles.infoRow}>
                Resolution: {resolutionLabel ?? "Unknown"}
              </Text>
              <Text variant="bodySmall" style={styles.infoRow}>
                Bitrate: {bitrateLabel}
              </Text>
            </View>
            <Button mode="contained" onPress={() => setInfoVisible(false)}>
              Close
            </Button>
          </View>
        </View>
      ) : null}

      {playbackMode === "stream" && hasDownload && playbackQuery.isError ? (
        <HelperText type="info" visible style={styles.helperText}>
          Streaming is unavailable right now. You can still play the downloaded
          copy.
        </HelperText>
      ) : null}

      {playbackErrorMessage && playbackMode === "stream" && !hasDownload ? (
        <HelperText type="error" visible style={styles.helperText}>
          {playbackErrorMessage}
        </HelperText>
      ) : null}

      {brightnessOverlay !== null ? (
        <View style={styles.gestureOverlayContainer} pointerEvents="none">
          <View style={styles.gestureOverlay}>
            <IconButton
              icon="brightness-7"
              size={32}
              iconColor="white"
              style={styles.gestureIcon}
            />
            <View style={styles.gestureBar}>
              <View
                style={[
                  styles.gestureFill,
                  { width: `${brightnessOverlay}%` },
                  { backgroundColor: theme.colors.primary },
                ]}
              />
            </View>
            <Text style={styles.gestureText}>
              {Math.round(brightnessOverlay)}%
            </Text>
          </View>
        </View>
      ) : null}

      {volumeOverlay !== null ? (
        <View style={styles.gestureOverlayContainer} pointerEvents="none">
          <View style={[styles.gestureOverlay, styles.gestureOverlayRight]}>
            <IconButton
              icon="volume-high"
              size={32}
              iconColor="white"
              style={styles.gestureIcon}
            />
            <View style={styles.gestureBar}>
              <View
                style={[
                  styles.gestureFill,
                  { width: `${volumeOverlay}%` },
                  { backgroundColor: theme.colors.primary },
                ]}
              />
            </View>
            <Text style={styles.gestureText}>{Math.round(volumeOverlay)}%</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "black",
    },
    fallbackSafeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: spacing.lg,
    },
    videoSurface: {
      flex: 1,
      backgroundColor: "black",
    },
    video: {
      width: "100%",
      height: "100%",
    },
    videoFallback: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "black",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
    },
    gradientTop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 200,
    },
    gradientBottom: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 280,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: spacing.md,
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
    subtitleText: {
      color: "rgba(255,255,255,0.8)",
    },
    topActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    centerControls: {
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: spacing.lg,
    },
    playButton: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
    },
    bottomSection: {
      gap: spacing.md,
    },
    progressContainer: {
      gap: spacing.xs,
    },
    progressBar: {
      height: 16,
      justifyContent: "center",
    },
    progressBackground: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.25)",
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
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.colors.primary,
      marginLeft: -6,
      borderWidth: 2,
      borderColor: "black",
    },
    timeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    timeText: {
      color: "rgba(255,255,255,0.8)",
    },
    bottomMetadata: {
      gap: spacing.xxxs,
    },
    sourceText: {
      color: theme.colors.primary,
      fontWeight: "600",
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    metaText: {
      color: "rgba(255,255,255,0.7)",
    },
    controlsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    controlsSpacer: {
      flex: 1,
    },
    menuSectionLabel: {
      fontWeight: "600",
      color: theme.colors.onSurfaceVariant,
    },
    loaderOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.2)",
    },
    infoOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    infoCard: {
      width: "100%",
      maxWidth: 360,
      borderRadius: spacing.lg,
      backgroundColor: theme.colors.surface,
      padding: spacing.lg,
      alignItems: "center",
      gap: spacing.md,
    },
    infoTitle: {
      color: theme.colors.onSurface,
      fontWeight: "700",
    },
    infoList: {
      alignSelf: "stretch",
      gap: spacing.xs,
    },
    infoRow: {
      color: theme.colors.onSurfaceVariant,
    },
    infoPoster: {
      width: 160,
      height: 240,
      borderRadius: spacing.md,
    },
    helperText: {
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg,
      bottom: spacing.lg,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.35,
    },
    airPlayWrapper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    airPlayButton: {
      width: 24,
      height: 24,
    },
    upNextOverlay: {
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg,
      bottom: spacing.xl,
    },
    upNextCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: "rgba(18, 18, 18, 0.92)",
      borderRadius: spacing.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
    },
    upNextPoster: {
      width: 100,
      height: 150,
      borderRadius: spacing.md,
    },
    upNextInfo: {
      flex: 1,
      gap: spacing.xs,
    },
    upNextLabel: {
      textTransform: "uppercase",
      letterSpacing: 1,
      color: theme.colors.primary,
      fontWeight: "600",
    },
    upNextTitle: {
      color: "white",
      fontWeight: "700",
    },
    upNextSubtitle: {
      color: "rgba(255,255,255,0.75)",
    },
    upNextActions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    gestureOverlayContainer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
    },
    gestureOverlay: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.7)",
      borderRadius: spacing.lg,
      padding: spacing.lg,
      minWidth: 140,
      gap: spacing.md,
    },
    gestureOverlayRight: {
      alignSelf: "flex-end",
      marginRight: spacing.lg,
      marginBottom: spacing.xl,
    },
    gestureIcon: {
      margin: 0,
    },
    gestureBar: {
      width: 120,
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.25)",
      overflow: "hidden",
    },
    gestureFill: {
      height: "100%",
      borderRadius: 2,
    },
    gestureText: {
      color: "white",
      fontWeight: "600",
      fontSize: 14,
    },
  });

export default JellyfinPlayerScreen;
