/**
 * Custom hook for player gesture handling
 */

import { useCallback, useRef } from "react";
import {
  useJellyfinPlayerStore,
  selectGesturesEnabled,
  selectSetGestureSeekDelta,
  selectSetGestureVolumeDelta,
  selectSetGestureBrightnessDelta,
} from "@/store/jellyfinPlayerStore";

interface UsePlayerGesturesProps {
  onSeek: (seconds: number) => void;
  onVolumeChange: (delta: number) => void;
  onBrightnessChange: (delta: number) => void;
  onToggleControls: () => void;
}

export const usePlayerGestures = ({
  onSeek,
  onVolumeChange,
  onBrightnessChange,
  onToggleControls,
}: UsePlayerGesturesProps) => {
  const enabled = useJellyfinPlayerStore(selectGesturesEnabled);
  const setGestureSeekDelta = useJellyfinPlayerStore(selectSetGestureSeekDelta);
  const setGestureVolumeDelta = useJellyfinPlayerStore(
    selectSetGestureVolumeDelta,
  );
  const setGestureBrightnessDelta = useJellyfinPlayerStore(
    selectSetGestureBrightnessDelta,
  );

  const accumulatedSeekRef = useRef(0);
  const accumulatedVolumeRef = useRef(0);
  const accumulatedBrightnessRef = useRef(0);
  const gestureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSeekGesture = useCallback(
    (delta: number) => {
      if (!enabled) return;

      accumulatedSeekRef.current += delta;
      setGestureSeekDelta(accumulatedSeekRef.current);

      if (gestureTimeoutRef.current) {
        clearTimeout(gestureTimeoutRef.current);
      }

      gestureTimeoutRef.current = setTimeout(() => {
        if (Math.abs(accumulatedSeekRef.current) > 0.5) {
          onSeek(accumulatedSeekRef.current);
        }
        accumulatedSeekRef.current = 0;
        setGestureSeekDelta(0);
      }, 100);
    },
    [enabled, onSeek, setGestureSeekDelta],
  );

  const handleVolumeGesture = useCallback(
    (delta: number) => {
      if (!enabled) return;

      accumulatedVolumeRef.current += delta;
      setGestureVolumeDelta(accumulatedVolumeRef.current);

      if (gestureTimeoutRef.current) {
        clearTimeout(gestureTimeoutRef.current);
      }

      gestureTimeoutRef.current = setTimeout(() => {
        if (Math.abs(accumulatedVolumeRef.current) > 0.01) {
          onVolumeChange(accumulatedVolumeRef.current);
        }
        accumulatedVolumeRef.current = 0;
        setGestureVolumeDelta(0);
      }, 100);
    },
    [enabled, onVolumeChange, setGestureVolumeDelta],
  );

  const handleBrightnessGesture = useCallback(
    (delta: number) => {
      if (!enabled) return;

      accumulatedBrightnessRef.current += delta;
      setGestureBrightnessDelta(accumulatedBrightnessRef.current);

      if (gestureTimeoutRef.current) {
        clearTimeout(gestureTimeoutRef.current);
      }

      gestureTimeoutRef.current = setTimeout(() => {
        if (Math.abs(accumulatedBrightnessRef.current) > 0.01) {
          onBrightnessChange(accumulatedBrightnessRef.current);
        }
        accumulatedBrightnessRef.current = 0;
        setGestureBrightnessDelta(0);
      }, 100);
    },
    [enabled, onBrightnessChange, setGestureBrightnessDelta],
  );

  return {
    handleSeekGesture,
    handleVolumeGesture,
    handleBrightnessGesture,
  };
};
