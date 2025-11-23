import { create } from "zustand";

// Export Zustand's shallow helper so consumers can easily avoid unnecessary
// re-renders when selecting multiple values.
export { shallow } from "zustand/shallow";

type PlaybackMode = "download" | "stream";

type JellyfinPlayerUiState = {
  playbackMode: PlaybackMode;
  playbackRate: number;
  volume: number;
  brightness: number;
  controlsVisible: boolean;
  sourceMenuVisible: boolean;
  speedMenuVisible: boolean;
  trackMenuVisible: boolean;
  showVolumeSlider: boolean;
  showBrightnessSlider: boolean;
  pipEnabled: boolean;
  gesturesEnabled: boolean;
  autoPlayNextEpisode: boolean;
  skipIntroEnabled: boolean;
  showPlaybackStats: boolean;
  qualityMenuVisible: boolean;
  selectedQuality: string;
  loadingMessage: string;
  skipIntroVisible: boolean;
  nextEpisodeCountdown: number | null;
  gestureSeekDelta: number;
  gestureVolumeDelta: number;
  gestureBrightnessDelta: number;
  retryCount: number;
  error: Error | null;
};

type JellyfinPlayerActions = {
  setPlaybackMode: (mode: PlaybackMode) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  setBrightness: (brightness: number) => void;
  setControlsVisible: (visible: boolean) => void;
  setSourceMenuVisible: (visible: boolean) => void;
  setSpeedMenuVisible: (visible: boolean) => void;
  setTrackMenuVisible: (visible: boolean) => void;
  setShowVolumeSlider: (visible: boolean) => void;
  setShowBrightnessSlider: (visible: boolean) => void;
  setPipEnabled: (enabled: boolean) => void;
  setGesturesEnabled: (enabled: boolean) => void;
  setAutoPlayNextEpisode: (enabled: boolean) => void;
  setSkipIntroEnabled: (enabled: boolean) => void;
  setShowPlaybackStats: (show: boolean) => void;
  setQualityMenuVisible: (visible: boolean) => void;
  setSelectedQuality: (quality: string) => void;
  setLoadingMessage: (message: string) => void;
  setSkipIntroVisible: (visible: boolean) => void;
  setNextEpisodeCountdown: (countdown: number | null) => void;
  setGestureSeekDelta: (delta: number) => void;
  setGestureVolumeDelta: (delta: number) => void;
  setGestureBrightnessDelta: (delta: number) => void;
  setRetryCount: (count: number) => void;
  setError: (error: Error | null) => void;
  incrementRetryCount: () => void;
  reset: () => void;
};

export type JellyfinPlayerState = JellyfinPlayerUiState & JellyfinPlayerActions;

const INITIAL_STATE: JellyfinPlayerUiState = {
  playbackMode: "stream",
  playbackRate: 1,
  volume: 1,
  brightness: 1,
  controlsVisible: true,
  sourceMenuVisible: false,
  speedMenuVisible: false,
  trackMenuVisible: false,
  showVolumeSlider: false,
  showBrightnessSlider: false,
  pipEnabled: false,
  gesturesEnabled: true,
  autoPlayNextEpisode: true,
  skipIntroEnabled: true,
  showPlaybackStats: false,
  qualityMenuVisible: false,
  selectedQuality: "auto",
  loadingMessage: "Loading...",
  skipIntroVisible: false,
  nextEpisodeCountdown: null,
  gestureSeekDelta: 0,
  gestureVolumeDelta: 0,
  gestureBrightnessDelta: 0,
  retryCount: 0,
  error: null,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const useJellyfinPlayerStore = create<JellyfinPlayerState>()((set) => ({
  ...INITIAL_STATE,
  setPlaybackMode: (mode) =>
    set((state) =>
      state.playbackMode === mode ? state : { playbackMode: mode },
    ),
  setPlaybackRate: (rate) =>
    set((state) =>
      state.playbackRate === rate ? state : { playbackRate: rate },
    ),
  setVolume: (volume) =>
    set((state) => {
      const next = clamp(volume, 0, 1);
      return state.volume === next ? state : { volume: next };
    }),
  setBrightness: (brightness) =>
    set((state) => {
      const next = clamp(brightness, 0, 1);
      return state.brightness === next ? state : { brightness: next };
    }),
  setControlsVisible: (visible) =>
    set((state) =>
      state.controlsVisible === visible ? state : { controlsVisible: visible },
    ),
  setSourceMenuVisible: (visible) =>
    set((state) =>
      state.sourceMenuVisible === visible
        ? state
        : { sourceMenuVisible: visible },
    ),
  setSpeedMenuVisible: (visible) =>
    set((state) =>
      state.speedMenuVisible === visible
        ? state
        : { speedMenuVisible: visible },
    ),
  setTrackMenuVisible: (visible) =>
    set((state) =>
      state.trackMenuVisible === visible
        ? state
        : { trackMenuVisible: visible },
    ),
  setShowVolumeSlider: (visible) =>
    set((state) =>
      state.showVolumeSlider === visible
        ? state
        : { showVolumeSlider: visible },
    ),
  setShowBrightnessSlider: (visible) =>
    set((state) =>
      state.showBrightnessSlider === visible
        ? state
        : { showBrightnessSlider: visible },
    ),
  setPipEnabled: (enabled) =>
    set((state) =>
      state.pipEnabled === enabled ? state : { pipEnabled: enabled },
    ),
  setGesturesEnabled: (enabled) =>
    set((state) =>
      state.gesturesEnabled === enabled ? state : { gesturesEnabled: enabled },
    ),
  setAutoPlayNextEpisode: (enabled) =>
    set((state) =>
      state.autoPlayNextEpisode === enabled
        ? state
        : { autoPlayNextEpisode: enabled },
    ),
  setSkipIntroEnabled: (enabled) =>
    set((state) =>
      state.skipIntroEnabled === enabled
        ? state
        : { skipIntroEnabled: enabled },
    ),
  setShowPlaybackStats: (show) =>
    set((state) =>
      state.showPlaybackStats === show ? state : { showPlaybackStats: show },
    ),
  setQualityMenuVisible: (visible) =>
    set((state) =>
      state.qualityMenuVisible === visible
        ? state
        : { qualityMenuVisible: visible },
    ),
  setSelectedQuality: (quality) =>
    set((state) =>
      state.selectedQuality === quality ? state : { selectedQuality: quality },
    ),
  setLoadingMessage: (message) =>
    set((state) =>
      state.loadingMessage === message ? state : { loadingMessage: message },
    ),
  setSkipIntroVisible: (visible) =>
    set((state) =>
      state.skipIntroVisible === visible
        ? state
        : { skipIntroVisible: visible },
    ),
  setNextEpisodeCountdown: (countdown) =>
    set((state) =>
      state.nextEpisodeCountdown === countdown
        ? state
        : { nextEpisodeCountdown: countdown },
    ),
  setGestureSeekDelta: (delta) =>
    set((state) =>
      state.gestureSeekDelta === delta ? state : { gestureSeekDelta: delta },
    ),
  setGestureVolumeDelta: (delta) =>
    set((state) =>
      state.gestureVolumeDelta === delta
        ? state
        : { gestureVolumeDelta: delta },
    ),
  setGestureBrightnessDelta: (delta) =>
    set((state) =>
      state.gestureBrightnessDelta === delta
        ? state
        : { gestureBrightnessDelta: delta },
    ),
  setRetryCount: (count) =>
    set((state) =>
      state.retryCount === count ? state : { retryCount: count },
    ),
  setError: (error) =>
    set((state) => (state.error === error ? state : { error })),
  incrementRetryCount: () =>
    set((state) => ({ retryCount: state.retryCount + 1 })),
  reset: () => set(() => ({ ...INITIAL_STATE })),
}));

export const selectPlaybackMode = (state: JellyfinPlayerState) =>
  state.playbackMode;
export const selectPlaybackRate = (state: JellyfinPlayerState) =>
  state.playbackRate;
export const selectPlayerVolume = (state: JellyfinPlayerState) => state.volume;
export const selectPlayerBrightness = (state: JellyfinPlayerState) =>
  state.brightness;
export const selectControlsVisible = (state: JellyfinPlayerState) =>
  state.controlsVisible;
export const selectSourceMenuVisible = (state: JellyfinPlayerState) =>
  state.sourceMenuVisible;
export const selectSpeedMenuVisible = (state: JellyfinPlayerState) =>
  state.speedMenuVisible;
export const selectTrackMenuVisible = (state: JellyfinPlayerState) =>
  state.trackMenuVisible;
export const selectShowVolumeSlider = (state: JellyfinPlayerState) =>
  state.showVolumeSlider;
export const selectShowBrightnessSlider = (state: JellyfinPlayerState) =>
  state.showBrightnessSlider;
export const selectPipEnabled = (state: JellyfinPlayerState) =>
  state.pipEnabled;
export const selectGesturesEnabled = (state: JellyfinPlayerState) =>
  state.gesturesEnabled;
export const selectAutoPlayNextEpisode = (state: JellyfinPlayerState) =>
  state.autoPlayNextEpisode;
export const selectSkipIntroEnabled = (state: JellyfinPlayerState) =>
  state.skipIntroEnabled;
export const selectShowPlaybackStats = (state: JellyfinPlayerState) =>
  state.showPlaybackStats;
export const selectResetPlayerUi = (state: JellyfinPlayerState) => state.reset;
export const selectSetPlaybackMode = (state: JellyfinPlayerState) =>
  state.setPlaybackMode;
export const selectSetPlaybackRate = (state: JellyfinPlayerState) =>
  state.setPlaybackRate;
export const selectSetPlayerVolume = (state: JellyfinPlayerState) =>
  state.setVolume;
export const selectSetPlayerBrightness = (state: JellyfinPlayerState) =>
  state.setBrightness;
export const selectSetControlsVisible = (state: JellyfinPlayerState) =>
  state.setControlsVisible;
export const selectSetSourceMenuVisible = (state: JellyfinPlayerState) =>
  state.setSourceMenuVisible;
export const selectSetSpeedMenuVisible = (state: JellyfinPlayerState) =>
  state.setSpeedMenuVisible;
export const selectSetTrackMenuVisible = (state: JellyfinPlayerState) =>
  state.setTrackMenuVisible;
export const selectSetShowVolumeSlider = (state: JellyfinPlayerState) =>
  state.setShowVolumeSlider;
export const selectSetShowBrightnessSlider = (state: JellyfinPlayerState) =>
  state.setShowBrightnessSlider;
export const selectSetPipEnabled = (state: JellyfinPlayerState) =>
  state.setPipEnabled;
export const selectSetGesturesEnabled = (state: JellyfinPlayerState) =>
  state.setGesturesEnabled;
export const selectSetAutoPlayNextEpisode = (state: JellyfinPlayerState) =>
  state.setAutoPlayNextEpisode;
export const selectSetSkipIntroEnabled = (state: JellyfinPlayerState) =>
  state.setSkipIntroEnabled;
export const selectSetShowPlaybackStats = (state: JellyfinPlayerState) =>
  state.setShowPlaybackStats;
export const selectQualityMenuVisible = (state: JellyfinPlayerState) =>
  state.qualityMenuVisible;
export const selectSetQualityMenuVisible = (state: JellyfinPlayerState) =>
  state.setQualityMenuVisible;
export const selectSelectedQuality = (state: JellyfinPlayerState) =>
  state.selectedQuality;
export const selectSetSelectedQuality = (state: JellyfinPlayerState) =>
  state.setSelectedQuality;
export const selectLoadingMessage = (state: JellyfinPlayerState) =>
  state.loadingMessage;
export const selectSetLoadingMessage = (state: JellyfinPlayerState) =>
  state.setLoadingMessage;
export const selectSkipIntroVisible = (state: JellyfinPlayerState) =>
  state.skipIntroVisible;
export const selectSetSkipIntroVisible = (state: JellyfinPlayerState) =>
  state.setSkipIntroVisible;
export const selectNextEpisodeCountdown = (state: JellyfinPlayerState) =>
  state.nextEpisodeCountdown;
export const selectSetNextEpisodeCountdown = (state: JellyfinPlayerState) =>
  state.setNextEpisodeCountdown;
export const selectGestureSeekDelta = (state: JellyfinPlayerState) =>
  state.gestureSeekDelta;
export const selectSetGestureSeekDelta = (state: JellyfinPlayerState) =>
  state.setGestureSeekDelta;
export const selectGestureVolumeDelta = (state: JellyfinPlayerState) =>
  state.gestureVolumeDelta;
export const selectSetGestureVolumeDelta = (state: JellyfinPlayerState) =>
  state.setGestureVolumeDelta;
export const selectGestureBrightnessDelta = (state: JellyfinPlayerState) =>
  state.gestureBrightnessDelta;
export const selectSetGestureBrightnessDelta = (state: JellyfinPlayerState) =>
  state.setGestureBrightnessDelta;
export const selectRetryCount = (state: JellyfinPlayerState) =>
  state.retryCount;
export const selectSetRetryCount = (state: JellyfinPlayerState) =>
  state.setRetryCount;
export const selectIncrementRetryCount = (state: JellyfinPlayerState) =>
  state.incrementRetryCount;
export const selectError = (state: JellyfinPlayerState) => state.error;
export const selectSetError = (state: JellyfinPlayerState) => state.setError;
