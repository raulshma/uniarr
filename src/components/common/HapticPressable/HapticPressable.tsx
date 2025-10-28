import React from "react";
import {
  Pressable,
  type PressableProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

import { useHaptics, type HapticType } from "@/hooks/useHaptics";

export interface HapticPressableProps extends Omit<PressableProps, "style"> {
  /**
   * Type of haptic feedback to trigger on press
   * @default 'medium'
   */
  hapticType?: HapticType;
  /**
   * Whether to trigger haptic on long press
   * @default false
   */
  hapticOnLongPress?: boolean;
  /**
   * Whether to disable haptic feedback
   * @default false
   */
  disableHaptics?: boolean;
  /**
   * Custom style for pressed state
   */
  pressedStyle?: StyleProp<ViewStyle>;
  /**
   * Whether to add opacity feedback on press
   * @default true
   */
  opacityFeedback?: boolean;
  /**
   * Opacity value when pressed
   * @default 0.7
   */
  pressedOpacity?: number;
  /**
   * Style callback for custom pressed state styling
   */
  style?: StyleProp<ViewStyle> | ((pressed: boolean) => StyleProp<ViewStyle>);
  /**
   * Whether to enable scale animation on press
   * @default true
   */
  enableScaleAnimation?: boolean;
  /**
   * Scale factor when pressed
   * @default 0.95
   */
  pressedScale?: number;
}

const HapticPressable: React.FC<HapticPressableProps> = ({
  children,
  hapticType = "medium",
  hapticOnLongPress = false,
  disableHaptics = false,
  pressedStyle,
  opacityFeedback = true,
  pressedOpacity = 0.7,
  enableScaleAnimation = true,
  pressedScale = 0.95,
  style,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  ...props
}) => {
  const { trigger, onLongPress: hapticLongPress } = useHaptics();

  // Animation values
  const scaleAnim = useSharedValue(1);

  // Handle press in animation
  const handlePressIn = React.useCallback(
    (event: any) => {
      if (enableScaleAnimation) {
        scaleAnim.value = withSpring(pressedScale, {
          damping: 15,
          stiffness: 400,
        });
      }
      onPressIn?.(event);
    },
    [enableScaleAnimation, pressedScale, scaleAnim, onPressIn],
  );

  // Handle press out animation
  const handlePressOut = React.useCallback(
    (event: any) => {
      if (enableScaleAnimation) {
        scaleAnim.value = withSpring(1, {
          damping: 15,
          stiffness: 400,
        });
      }
      onPressOut?.(event);
    },
    [enableScaleAnimation, scaleAnim, onPressOut],
  );

  const handlePress = React.useCallback(
    async (event: any) => {
      if (!disableHaptics) {
        await trigger(hapticType);
      }
      onPress?.(event);
    },
    [disableHaptics, hapticType, trigger, onPress],
  );

  const handleLongPress = React.useCallback(
    async (event: any) => {
      if (hapticOnLongPress && !disableHaptics) {
        await hapticLongPress();
      }
      onLongPress?.(event);
    },
    [hapticOnLongPress, disableHaptics, hapticLongPress, onLongPress],
  );

  const styleCallback = React.useCallback(
    (pressed: boolean) => {
      const styles: StyleProp<ViewStyle>[] = [];

      // Apply base style
      if (typeof style === "function") {
        styles.push(style(pressed));
      } else if (style) {
        styles.push(style);
      }

      // Apply pressed state styles
      if (pressed) {
        if (opacityFeedback) {
          styles.push({ opacity: pressedOpacity });
        }
        if (pressedStyle) {
          styles.push(pressedStyle);
        }
      }

      return styles;
    },
    [style, opacityFeedback, pressedOpacity, pressedStyle],
  );

  // Convert the callback to match the expected PressableStateCallbackType signature
  const pressableStyleCallback = React.useCallback(
    (state: { pressed: boolean }) => styleCallback(state.pressed),
    [styleCallback],
  );

  // Animated style for scale animation
  const animatedStyle = useAnimatedStyle(() => {
    if (!enableScaleAnimation) return {};

    return {
      transform: [{ scale: scaleAnim.value }],
    };
  }, [scaleAnim, enableScaleAnimation]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        {...props}
        style={pressableStyleCallback}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

export default HapticPressable;
