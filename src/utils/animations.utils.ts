/**
 * Centralized Animation Utilities for UniArr
 *
 * Provides reusable animation presets, configurations, and helpers
 * for consistent, performance-optimized animations across the app.
 *
 * Uses React Native Reanimated v4 for native-level performance.
 */

import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideInDown,
  SlideInLeft,
  SlideInRight,
  SlideOutUp,
  SlideOutDown,
  SlideOutLeft,
  SlideOutRight,
  ZoomIn,
  ZoomOut,
  BounceIn,
  BounceOut,
  StretchInX,
  StretchInY,
  FlipInEasyX,
  FlipInEasyY,
  Layout,
} from "react-native-reanimated";

/**
 * Animation Duration Presets (milliseconds)
 *
 * - QUICK: 150ms for UI feedback (buttons, badges, micro-interactions)
 * - NORMAL: 300ms for standard screen transitions and card entrances
 * - DELIBERATE: 500ms for emphasis animations (initial page focus)
 *
 * Rationale: Mobile-first; responsive under 300ms; battery-conscious
 */
export const ANIMATION_DURATIONS = {
  QUICK: 150,
  NORMAL: 300,
  DELIBERATE: 500,
} as const;

/**
 * Easing Function Presets
 *
 * Maps to React Native Reanimated easing values
 */
export const EASING = {
  EASE_OUT: "easeOut",
  EASE_IN: "easeIn",
  LINEAR: "linear",
} as const;

/**
 * Screen Transition Presets
 *
 * Used for page-level navigation transitions in Expo Router _layout.tsx files
 * Each preset includes entering and exiting animation pairs
 */
export const SCREEN_TRANSITIONS = {
  /**
   * SLIDE_RIGHT: Natural right-to-left navigation (typical stack pattern)
   * Entering: SlideInRight, Exiting: SlideOutLeft
   */
  SLIDE_RIGHT: {
    entering: SlideInRight.duration(ANIMATION_DURATIONS.NORMAL).springify(),
    exiting: SlideOutLeft.duration(ANIMATION_DURATIONS.NORMAL - 50).springify(),
  },

  /**
   * SLIDE_UP: Bottom-to-top modal-like transition
   * Entering: SlideInUp, Exiting: SlideOutDown
   */
  SLIDE_UP: {
    entering: SlideInUp.duration(ANIMATION_DURATIONS.NORMAL).springify(),
    exiting: SlideOutDown.duration(ANIMATION_DURATIONS.NORMAL - 50).springify(),
  },

  /**
   * FADE: Crossfade transition (neutral, works on all platforms)
   * Entering: FadeIn, Exiting: FadeOut
   */
  FADE: {
    entering: FadeIn.duration(ANIMATION_DURATIONS.NORMAL),
    exiting: FadeOut.duration(ANIMATION_DURATIONS.NORMAL - 50),
  },

  /**
   * NONE: Disabled (for performance-critical paths)
   */
  NONE: {
    entering: undefined,
    exiting: undefined,
  },
} as const;

/**
 * Component-Level Animation Presets
 *
 * Used for individual component animations (lists, cards, modals, etc.)
 * Each preset is a configured animation that can be applied directly
 */
export const COMPONENT_ANIMATIONS = {
  /**
   * LIST_ITEM_STAGGER: Progressive fade-in with per-item delay
   * Usage: Apply to list items with index-based delay (e.g., 50ms per item)
   */
  LIST_ITEM_STAGGER: (index: number, delay = 50) =>
    FadeIn.duration(ANIMATION_DURATIONS.NORMAL)
      .delay(index * delay)
      .springify(),

  /**
   * CARD_ENTRANCE: Zoom-in with fade for card components
   * Creates "pop" effect on initial appearance
   */
  CARD_ENTRANCE: (delay = 0) =>
    ZoomIn.duration(ANIMATION_DURATIONS.NORMAL).delay(delay).springify(),

  /**
   * MODAL_BACKDROP: Quick fade for modal overlays
   * Faster than screen transitions to avoid delay
   */
  MODAL_BACKDROP: FadeIn.duration(ANIMATION_DURATIONS.QUICK),

  /**
   * BADGE_PULSE: Scale loop for notifications/badges
   * Subtle continuous animation (implemented separately with useAnimatedStyle)
   */
  BADGE_PULSE: null, // Implemented as custom hook due to loop nature

  /**
   * DIALOG_ENTRANCE: Fade-in for dialog content
   * Used in custom dialogs
   */
  DIALOG_ENTRANCE: FadeIn.duration(ANIMATION_DURATIONS.QUICK),

  /**
   * SECTION_ENTRANCE: Up slide with fade for page sections
   * Used for grouped content within pages
   */
  // prettier-ignore
  SECTION_ENTRANCE: (delay = 0) => SlideInUp.duration(ANIMATION_DURATIONS.NORMAL).delay(delay).springify(),

  /**
   * LOADING_ENTRANCE: Subtle fade for skeleton loaders
   * Minimal to avoid distraction during data load
   */
  LOADING_ENTRANCE: FadeIn.duration(ANIMATION_DURATIONS.QUICK),
} as const;

/**
 * Helper: Springify Animation
 *
 * Applies spring physics to animations for natural, delightful motion
 * Improves perceived quality without sacrificing performance
 *
 * @param animation - Base Reanimated animation
 * @param duration - Optional override duration in ms
 * @returns Springified animation
 *
 * @example
 * entering={springify(FadeInUp.duration(300))}
 */
export const springify = (
  animation: any,
  duration = ANIMATION_DURATIONS.NORMAL,
) => {
  return animation.duration(duration).springify();
};

/**
 * Helper: Apply Stagger Delay to Animation
 *
 * Adds per-item delay for list stagger effects
 *
 * @param animation - Base animation
 * @param index - Item index in list
 * @param delayPerItem - Milliseconds between each item (default: 50ms)
 * @returns Animation with applied delay
 *
 * @example
 * items.map((item, index) => (
 *   <Animated.View
 *     key={item.id}
 *     entering={staggerDelay(FadeInLeft.duration(300), index)}
 *   >
 *     item content
 *   </Animated.View>
 * ))
 */
export const staggerDelay = (
  animation: any,
  index: number,
  delayPerItem = 50,
) => {
  return animation.delay(index * delayPerItem);
};

/**
 * Performance Optimization Props
 *
 * Recommended props for Animated.View to minimize battery drain
 * Apply to all animated components
 */
export const PERFORMANCE_OPTIMIZATIONS = {
  removeClippedSubviews: true, // Hide views outside bounds
  collapsable: true, // Allow collapse when not rendered
} as const;

/**
 * Animation Configuration per Context
 *
 * Determines when animations should be disabled (e.g., during loading)
 * Always check these flags before rendering animations
 */
export const ANIMATION_CONTEXTS = {
  /**
   * Should animations run during data loading?
   * Answer: NO - disable to prevent jank and allow UI to settle
   */
  SKIP_DURING_LOADING: true,

  /**
   * Should animations run during network requests?
   * Answer: NO - disable to prioritize data fetching performance
   */
  SKIP_DURING_NETWORK: true,

  /**
   * Should animations run during data mutations?
   * Answer: NO - disable to avoid animated changes masking mutations
   */
  SKIP_DURING_MUTATION: true,

  /**
   * Minimum frame rate for enabling animations
   * Below this FPS, animations are disabled to save battery
   */
  MIN_FPS_FOR_ANIMATIONS: 30,
} as const;

/**
 * Type Guards for Animation Props
 *
 * Used to safely check if animations should be applied
 */
export const shouldAnimateLayout = (
  isLoading: boolean,
  isNetworking: boolean = false,
  isMutating: boolean = false,
): boolean => {
  return !(
    (isLoading && ANIMATION_CONTEXTS.SKIP_DURING_LOADING) ||
    (isNetworking && ANIMATION_CONTEXTS.SKIP_DURING_NETWORK) ||
    (isMutating && ANIMATION_CONTEXTS.SKIP_DURING_MUTATION)
  );
};

/**
 * Export all Reanimated animation builders for convenience
 *
 * Allows: import { FadeIn, SlideInUp } from '@/utils/animations.utils'
 */
export {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideInDown,
  SlideInLeft,
  SlideInRight,
  SlideOutUp,
  SlideOutDown,
  SlideOutLeft,
  SlideOutRight,
  ZoomIn,
  ZoomOut,
  BounceIn,
  BounceOut,
  StretchInX,
  StretchInY,
  FlipInEasyX,
  FlipInEasyY,
  Layout,
};

/**
 * Re-export Animated from react-native-reanimated
 * Allows: import { Animated } from '@/utils/animations.utils'
 */
export { Animated };
