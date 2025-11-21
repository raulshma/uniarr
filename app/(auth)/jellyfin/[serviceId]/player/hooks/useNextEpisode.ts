/**
 * Custom hook for next episode autoplay
 */

import { useEffect, useCallback, useRef } from "react";
import {
  useJellyfinPlayerStore,
  selectAutoPlayNextEpisode,
  selectSetNextEpisodeCountdown,
} from "@/store/jellyfinPlayerStore";

interface UseNextEpisodeProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  hasNextEpisode: boolean;
  onPlayNext: () => void;
}

const COUNTDOWN_START = 10; // Start countdown 10 seconds before end

export const useNextEpisode = ({
  currentTime,
  duration,
  isPlaying,
  hasNextEpisode,
  onPlayNext,
}: UseNextEpisodeProps) => {
  const enabled = useJellyfinPlayerStore(selectAutoPlayNextEpisode);
  const setCountdown = useJellyfinPlayerStore(selectSetNextEpisodeCountdown);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled || !hasNextEpisode || !isPlaying || cancelledRef.current) {
      setCountdown(null);
      return;
    }

    const timeRemaining = duration - currentTime;

    if (timeRemaining <= COUNTDOWN_START && timeRemaining > 0) {
      setCountdown(Math.ceil(timeRemaining));
    } else {
      setCountdown(null);
    }

    if (timeRemaining <= 0 && !cancelledRef.current) {
      onPlayNext();
    }
  }, [
    enabled,
    currentTime,
    duration,
    isPlaying,
    hasNextEpisode,
    onPlayNext,
    setCountdown,
  ]);

  const cancelAutoplay = useCallback(() => {
    cancelledRef.current = true;
    setCountdown(null);
  }, [setCountdown]);

  const playNow = useCallback(() => {
    onPlayNext();
    setCountdown(null);
  }, [onPlayNext, setCountdown]);

  // Reset cancelled state when episode changes
  useEffect(() => {
    cancelledRef.current = false;
  }, [duration]);

  return {
    cancelAutoplay,
    playNow,
  };
};
