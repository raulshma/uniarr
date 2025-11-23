/**
 * Custom hook for skip intro/credits detection
 */

import { useEffect, useRef, useState } from "react";
import {
  useJellyfinPlayerStore,
  selectSkipIntroEnabled,
  selectSetSkipIntroVisible,
} from "@/store/jellyfinPlayerStore";

interface IntroMarker {
  start: number;
  end: number;
}

interface UseSkipIntroProps {
  currentTime: number;
  duration: number;
  introMarkers?: IntroMarker;
  creditsStart?: number;
}

export const useSkipIntro = ({
  currentTime,
  duration,
  introMarkers,
  creditsStart,
}: UseSkipIntroProps) => {
  const enabled = useJellyfinPlayerStore(selectSkipIntroEnabled);
  const setSkipIntroVisible = useJellyfinPlayerStore(selectSetSkipIntroVisible);
  const [skipCreditsVisible, setSkipCreditsVisible] = useState(false);
  const skipIntroTimeRef = useRef<number | null>(null);
  const skipCreditsTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSkipIntroVisible(false);
      setSkipCreditsVisible(false);
      return;
    }

    // Check for intro
    if (introMarkers) {
      const inIntro =
        currentTime >= introMarkers.start && currentTime < introMarkers.end;
      setSkipIntroVisible(inIntro);
      if (inIntro) {
        skipIntroTimeRef.current = introMarkers.end;
      } else {
        skipIntroTimeRef.current = null;
      }
    } else {
      // Fallback: assume intro is in first 90 seconds
      const inIntro = currentTime < 90 && currentTime > 5;
      setSkipIntroVisible(inIntro);
      if (inIntro) {
        skipIntroTimeRef.current = 90;
      } else {
        skipIntroTimeRef.current = null;
      }
    }

    // Check for credits
    if (creditsStart) {
      const inCredits = currentTime >= creditsStart && currentTime < duration;
      setSkipCreditsVisible(inCredits);
      if (inCredits) {
        skipCreditsTimeRef.current = duration;
      } else {
        skipCreditsTimeRef.current = null;
      }
    } else {
      // Fallback: assume credits start in last 2 minutes
      const timeRemaining = duration - currentTime;
      const inCredits = timeRemaining < 120 && timeRemaining > 10;
      setSkipCreditsVisible(inCredits);
      if (inCredits) {
        skipCreditsTimeRef.current = duration;
      } else {
        skipCreditsTimeRef.current = null;
      }
    }
  }, [
    enabled,
    currentTime,
    duration,
    introMarkers,
    creditsStart,
    setSkipIntroVisible,
  ]);

  return {
    showSkipIntro: skipIntroTimeRef.current !== null,
    showSkipCredits: skipCreditsVisible,
    skipIntroTime: skipIntroTimeRef.current,
    skipCreditsTime: skipCreditsTimeRef.current,
  };
};
