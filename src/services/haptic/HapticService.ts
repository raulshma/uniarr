import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

import { logger } from "@/services/logger/LoggerService";
import { useSettingsStore } from "@/store/settingsStore";

export type HapticType =
  | "light" // Subtle feedback for small interactions
  | "medium" // Standard feedback for button presses
  | "heavy" // Strong feedback for important actions
  | "success" // Positive feedback for successful operations
  | "warning" // Caution feedback for potentially harmful actions
  | "error" // Negative feedback for failed operations
  | "selection" // Feedback for selecting items
  | "impact" // Impact feedback for physical interactions
  | "notification"; // Notification feedback

export type HapticOptions = {
  /**
   * Whether to respect user's haptic preferences
   * @default true
   */
  respectSettings?: boolean;
  /**
   * Custom intensity for haptic feedback (0.0 - 1.0)
   * @default 1.0
   */
  intensity?: number;
  /**
   * Whether to force haptic regardless of settings
   * @default false
   */
  force?: boolean;
};

class HapticService {
  private static instance: HapticService | null = null;

  static getInstance(): HapticService {
    if (!HapticService.instance) {
      HapticService.instance = new HapticService();
    }
    return HapticService.instance;
  }

  /**
   * Trigger haptic feedback based on type
   */
  async trigger(type: HapticType, options: HapticOptions = {}): Promise<void> {
    const { respectSettings = true, force = false } = options;

    // Check if haptics are enabled in settings
    if (respectSettings && !force && !this.shouldTriggerHaptic()) {
      return;
    }

    // Skip on platforms that don't support haptics
    if (Platform.OS === "web") {
      return;
    }

    try {
      switch (type) {
        case "light":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;

        case "medium":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;

        case "heavy":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;

        case "success":
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          break;

        case "warning":
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
          break;

        case "error":
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error,
          );
          break;

        case "selection":
          await Haptics.selectionAsync();
          break;

        case "impact":
          // Use medium impact as default
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;

        case "notification":
          // Use success notification as default
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          break;

        default:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      void logger.debug(`HapticService: triggered ${type} haptic`);
    } catch (error) {
      void logger.debug("HapticService: failed to trigger haptic", {
        type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if haptic feedback should be triggered based on user settings
   */
  private shouldTriggerHaptic(): boolean {
    try {
      const { hapticFeedback } = useSettingsStore.getState();
      return hapticFeedback !== false; // Default to true
    } catch {
      return true; // Default to enabled if settings unavailable
    }
  }

  /**
   * Trigger haptic for button press
   */
  async onPress(): Promise<void> {
    await this.trigger("medium");
  }

  /**
   * Trigger haptic for toggle/switch
   */
  async onToggle(): Promise<void> {
    await this.trigger("selection");
  }

  /**
   * Trigger haptic for successful operation
   */
  async onSuccess(): Promise<void> {
    await this.trigger("success");
  }

  /**
   * Trigger haptic for error/failure
   */
  async onError(): Promise<void> {
    await this.trigger("error");
  }

  /**
   * Trigger haptic for warning
   */
  async onWarning(): Promise<void> {
    await this.trigger("warning");
  }

  /**
   * Trigger haptic for list item selection
   */
  async onSelection(): Promise<void> {
    await this.trigger("selection");
  }

  /**
   * Trigger haptic for destructive actions
   */
  async onDestructive(): Promise<void> {
    await this.trigger("heavy");
  }

  /**
   * Trigger haptic for refresh/pull-to-refresh
   */
  async onRefresh(): Promise<void> {
    await this.trigger("light");
  }

  /**
   * Trigger haptic for long press
   */
  async onLongPress(): Promise<void> {
    await this.trigger("medium");
  }

  /**
   * Test haptic feedback (for settings screen)
   */
  async test(type: HapticType): Promise<void> {
    await this.trigger(type, { force: true });
  }

  /**
   * Check if haptic feedback is available
   */
  isAvailable(): boolean {
    return Platform.OS !== "web";
  }
}

export const hapticService = HapticService.getInstance();
export { HapticService };
