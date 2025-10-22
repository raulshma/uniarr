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
