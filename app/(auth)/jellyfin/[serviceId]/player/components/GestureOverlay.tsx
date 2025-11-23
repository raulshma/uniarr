/**
 * Gesture Overlay Component
 * Handles swipe gestures for seek, volume, and brightness control
 */

import { useCallback, useRef, useEffect } from "react";
import { View, StyleSheet, Animated, Dimensions } from "react-native";
import { Text, IconButton } from "react-native-paper";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import {
  useJellyfinPlayerStore,
  selectGesturesEnabled,
  selectGestureSeekDelta,
  selectGestureVolumeDelta,
  selectGestureBrightnessDelta,
} from "@/store/jellyfinPlayerStore";

interface GestureOverlayProps {
  onSeek: (delta: number) => void;
  onVolumeChange: (delta: number) => void;
  onBrightnessChange: (delta: number) => void;
  onDoubleTapLeft: () => void;
  onDoubleTapRight: () => void;
  onSingleTap: () => void;
}

const SEEK_SENSITIVITY = 0.5;
const VOLUME_SENSITIVITY = 0.01;
const BRIGHTNESS_SENSITIVITY = 0.01;
const DOUBLE_TAP_DELAY = 300;
const SCREEN_WIDTH = Dimensions.get("window").width;

export const GestureOverlay = ({
  onSeek,
  onVolumeChange,
  onBrightnessChange,
  onDoubleTapLeft,
  onDoubleTapRight,
  onSingleTap,
}: GestureOverlayProps) => {
  const enabled = useJellyfinPlayerStore(selectGesturesEnabled);
  const gestureSeekDelta = useJellyfinPlayerStore(selectGestureSeekDelta);
  const gestureVolumeDelta = useJellyfinPlayerStore(selectGestureVolumeDelta);
  const gestureBrightnessDelta = useJellyfinPlayerStore(
    selectGestureBrightnessDelta,
  );

  const lastTapRef = useRef({ time: 0, x: 0 });
  const gestureStartRef = useRef({ x: 0, y: 0 });
  const indicatorOpacity = useRef(new Animated.Value(0)).current;
  const indicatorTypeRef = useRef<"seek" | "volume" | "brightness" | null>(
    null,
  );

  const showIndicator = useCallback(
    (type: "seek" | "volume" | "brightness") => {
      indicatorTypeRef.current = type;
      Animated.sequence([
        Animated.timing(indicatorOpacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.delay(500),
        Animated.timing(indicatorOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [indicatorOpacity],
  );

  // Show indicator when gesture deltas change
  useEffect(() => {
    if (gestureSeekDelta !== 0) {
      showIndicator("seek");
    }
  }, [gestureSeekDelta, showIndicator]);

  useEffect(() => {
    if (gestureVolumeDelta !== 0) {
      showIndicator("volume");
    }
  }, [gestureVolumeDelta, showIndicator]);

  useEffect(() => {
    if (gestureBrightnessDelta !== 0) {
      showIndicator("brightness");
    }
  }, [gestureBrightnessDelta, showIndicator]);

  const handleSeek = useCallback(
    (delta: number) => {
      onSeek(delta);
    },
    [onSeek],
  );

  const handleVolumeChange = useCallback(
    (delta: number) => {
      onVolumeChange(delta);
    },
    [onVolumeChange],
  );

  const handleBrightnessChange = useCallback(
    (delta: number) => {
      onBrightnessChange(delta);
    },
    [onBrightnessChange],
  );

  const handleSingleTap = useCallback(() => {
    onSingleTap();
  }, [onSingleTap]);

  const handleDoubleTapLeftSide = useCallback(() => {
    onDoubleTapLeft();
  }, [onDoubleTapLeft]);

  const handleDoubleTapRightSide = useCallback(() => {
    onDoubleTapRight();
  }, [onDoubleTapRight]);

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .onStart((event) => {
      gestureStartRef.current = { x: event.x, y: event.y };
    })
    .onUpdate((event) => {
      const deltaX = event.translationX;
      const deltaY = event.translationY;
      const startX = gestureStartRef.current.x;
      const midScreen = SCREEN_WIDTH / 2;

      // Horizontal swipe = seek
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
        const seekDelta = deltaX * SEEK_SENSITIVITY;
        runOnJS(handleSeek)(seekDelta);
      }
      // Vertical swipe on left side = brightness
      else if (startX < midScreen && Math.abs(deltaY) > 20) {
        const brightnessDelta = -deltaY * BRIGHTNESS_SENSITIVITY;
        runOnJS(handleBrightnessChange)(brightnessDelta);
      }
      // Vertical swipe on right side = volume
      else if (startX >= midScreen && Math.abs(deltaY) > 20) {
        const volumeDelta = -deltaY * VOLUME_SENSITIVITY;
        runOnJS(handleVolumeChange)(volumeDelta);
      }
    });

  const tapGesture = Gesture.Tap()
    .enabled(enabled)
    .onEnd((event) => {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current.time;
      const isDoubleTap = timeSinceLastTap < DOUBLE_TAP_DELAY;
      const tapX = event.x;
      const midScreen = SCREEN_WIDTH / 2;

      if (isDoubleTap) {
        // Double tap on left = rewind
        if (tapX < midScreen) {
          runOnJS(handleDoubleTapLeftSide)();
        }
        // Double tap on right = fast forward
        else {
          runOnJS(handleDoubleTapRightSide)();
        }
        lastTapRef.current = { time: 0, x: 0 };
      } else {
        lastTapRef.current = { time: now, x: tapX };
        setTimeout(() => {
          if (lastTapRef.current.time === now) {
            runOnJS(handleSingleTap)();
          }
        }, DOUBLE_TAP_DELAY);
      }
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.container}>
        <Animated.View
          style={[styles.indicator, { opacity: indicatorOpacity }]}
          pointerEvents="none"
        >
          {indicatorTypeRef.current === "seek" && (
            <View style={styles.indicatorContent}>
              <IconButton
                icon={gestureSeekDelta > 0 ? "fast-forward" : "rewind"}
                iconColor="white"
                size={32}
              />
              <Text style={styles.indicatorText}>
                {gestureSeekDelta > 0 ? "+" : ""}
                {Math.round(gestureSeekDelta)}s
              </Text>
            </View>
          )}
          {indicatorTypeRef.current === "volume" && (
            <View style={styles.indicatorContent}>
              <IconButton icon="volume-high" iconColor="white" size={32} />
              <Text style={styles.indicatorText}>
                {Math.round(gestureVolumeDelta * 100)}%
              </Text>
            </View>
          )}
          {indicatorTypeRef.current === "brightness" && (
            <View style={styles.indicatorContent}>
              <IconButton icon="brightness-7" iconColor="white" size={32} />
              <Text style={styles.indicatorText}>
                {Math.round(gestureBrightnessDelta * 100)}%
              </Text>
            </View>
          )}
        </Animated.View>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  indicator: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -75 }, { translateY: -75 }],
    width: 150,
    height: 150,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 75,
    justifyContent: "center",
    alignItems: "center",
  },
  indicatorContent: {
    alignItems: "center",
  },
  indicatorText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
