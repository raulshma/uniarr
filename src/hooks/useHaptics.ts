import { useCallback } from "react";

import {
  hapticService,
  type HapticType,
  type HapticOptions,
} from "@/services/haptic/HapticService";

// Re-export HapticType for convenience
export type { HapticType };

/**
 * Hook for providing easy access to haptic feedback
 * Returns methods for common haptic interactions
 */
export const useHaptics = () => {
  /**
   * Trigger haptic feedback of specified type
   */
  const trigger = useCallback(
    async (type: HapticType, options?: HapticOptions) => {
      await hapticService.trigger(type, options);
    },
    [],
  );

  /**
   * Haptic for button presses
   */
  const onPress = useCallback(async () => {
    await hapticService.onPress();
  }, []);

  /**
   * Haptic for toggle/switch changes
   */
  const onToggle = useCallback(async () => {
    await hapticService.onToggle();
  }, []);

  /**
   * Haptic for successful operations
   */
  const onSuccess = useCallback(async () => {
    await hapticService.onSuccess();
  }, []);

  /**
   * Haptic for errors
   */
  const onError = useCallback(async () => {
    await hapticService.onError();
  }, []);

  /**
   * Haptic for warnings
   */
  const onWarning = useCallback(async () => {
    await hapticService.onWarning();
  }, []);

  /**
   * Haptic for list item selection
   */
  const onSelection = useCallback(async () => {
    await hapticService.onSelection();
  }, []);

  /**
   * Haptic for destructive actions (delete, etc.)
   */
  const onDestructive = useCallback(async () => {
    await hapticService.onDestructive();
  }, []);

  /**
   * Haptic for refresh/pull-to-refresh
   */
  const onRefresh = useCallback(async () => {
    await hapticService.onRefresh();
  }, []);

  /**
   * Haptic for long press
   */
  const onLongPress = useCallback(async () => {
    await hapticService.onLongPress();
  }, []);

  /**
   * Test haptic feedback (for settings)
   */
  const test = useCallback(async (type: HapticType) => {
    await hapticService.test(type);
  }, []);

  /**
   * Check if haptics are available on this device
   */
  const isAvailable = useCallback(() => {
    return hapticService.isAvailable();
  }, []);

  return {
    trigger,
    onPress,
    onToggle,
    onSuccess,
    onError,
    onWarning,
    onSelection,
    onDestructive,
    onRefresh,
    onLongPress,
    test,
    isAvailable,
  };
};
