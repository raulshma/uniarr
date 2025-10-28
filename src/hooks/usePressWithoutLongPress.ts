import { useRef } from "react";

/**
 * Hook to prevent onPress from firing during a long press.
 * Returns a callback that only fires on regular press, not on long press.
 *
 * Usage:
 * const handlePress = usePressWithoutLongPress(() => {
 *   // This won't be called during long press
 * });
 */
export const usePressWithoutLongPress = (callback: () => void) => {
  const longPressDetectedRef = useRef(false);

  const handlePressIn = () => {
    longPressDetectedRef.current = false;
  };

  const handleLongPress = () => {
    longPressDetectedRef.current = true;
  };

  const handlePress = () => {
    if (!longPressDetectedRef.current) {
      callback();
    }
  };

  return { handlePress, handlePressIn, handleLongPress };
};
