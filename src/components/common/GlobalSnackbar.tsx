/**
 * Global Snackbar Component
 * One UI 8 inspired design with rounded corners, blur effects, and smooth animations
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Portal, Text, useTheme, ActivityIndicator } from "react-native-paper";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

import type { AppTheme } from "@/constants/theme";
import type { SnackbarOptions } from "@/services/snackbarService";
import {
  registerSnackbarPresenter,
  unregisterSnackbarPresenter,
} from "@/services/snackbarService";

const SNACKBAR_HEIGHT = 56;
const ANIMATION_DURATION = 300;

export const GlobalSnackbar: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<SnackbarOptions>({
    message: "",
    type: "info",
    duration: 3000,
  });

  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const show = (opts: SnackbarOptions) => {
      setOptions(opts);
      setVisible(true);
    };

    const hide = () => {
      setVisible(false);
    };

    registerSnackbarPresenter(show, hide);

    return () => {
      unregisterSnackbarPresenter();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      // Animate in
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
      });
      opacity.value = withTiming(1, { duration: ANIMATION_DURATION });

      // Auto dismiss if duration is set
      if (options.duration && options.duration > 0) {
        const timer = setTimeout(() => {
          setVisible(false);
        }, options.duration);

        return () => clearTimeout(timer);
      }
    } else {
      // Animate out
      translateY.value = withTiming(100, { duration: ANIMATION_DURATION });
      opacity.value = withTiming(0, { duration: ANIMATION_DURATION });
    }
  }, [visible, options.duration, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible && translateY.value === 100) {
    return null;
  }

  const getIconForType = () => {
    switch (options.type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "loading":
        return null; // Will show ActivityIndicator
      case "info":
      default:
        return "ⓘ";
    }
  };

  const getColorForType = () => {
    switch (options.type) {
      case "success":
        return theme.colors.primary;
      case "error":
        return theme.colors.error;
      case "loading":
        return theme.colors.primary;
      case "info":
      default:
        return theme.colors.onSurfaceVariant;
    }
  };

  return (
    <Portal>
      <Animated.View
        style={[
          styles.container,
          {
            bottom: insets.bottom + 16,
          },
          animatedStyle,
        ]}
      >
        <BlurView
          intensity={80}
          tint={theme.dark ? "dark" : "light"}
          style={styles.blurContainer}
        >
          <View
            style={[
              styles.content,
              {
                backgroundColor: theme.dark
                  ? "rgba(0, 0, 0, 0.40)"
                  : "rgba(0, 0, 0, 0.05)",
              },
            ]}
          >
            {/* Icon or Loading Indicator */}
            <View style={styles.iconContainer}>
              {options.type === "loading" ? (
                <ActivityIndicator size={20} color={getColorForType()} />
              ) : (
                <Text
                  style={[
                    styles.icon,
                    {
                      color: getColorForType(),
                    },
                  ]}
                >
                  {getIconForType()}
                </Text>
              )}
            </View>

            {/* Message */}
            <Text
              variant="bodyMedium"
              style={[
                styles.message,
                {
                  color: theme.colors.onSurface,
                },
              ]}
              numberOfLines={2}
            >
              {options.message}
            </Text>

            {/* Action Button */}
            {options.action && (
              <Text
                variant="labelLarge"
                style={[
                  styles.action,
                  {
                    color: theme.colors.primary,
                  },
                ]}
                onPress={() => {
                  options.action?.onPress();
                  setVisible(false);
                }}
              >
                {options.action.label}
              </Text>
            )}
          </View>
        </BlurView>
      </Animated.View>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  blurContainer: {
    borderRadius: 28,
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: SNACKBAR_HEIGHT,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 28,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
    fontWeight: "600",
  },
  message: {
    flex: 1,
    fontWeight: "500",
  },
  action: {
    marginLeft: 16,
    fontWeight: "700",
  },
});
