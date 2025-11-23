import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Dimensions,
  TouchableWithoutFeedback,
  BackHandler,
} from "react-native";
import { Text, useTheme, Button } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolate,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { MediaPoster } from "@/components/media/MediaPoster";
import type { AppTheme } from "@/constants/theme";

type Layout = {
  x: number;
  y: number;
  width: number;
  height: number;
  pageX: number;
  pageY: number;
};

type QuickViewModalProps = {
  visible: boolean;
  item: {
    id: number | string;
    title: string;
    posterUrl?: string;
    rating?: number;
    overview?: string;
  } | null;
  initialLayout: Layout | null;
  onClose: () => void;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_WIDTH = SCREEN_WIDTH * 0.85;
const MODAL_HEIGHT = MODAL_WIDTH * 1.5; // Aspect ratio for the card

const QuickViewModal: React.FC<QuickViewModalProps> = ({
  visible,
  item,
  initialLayout,
  onClose,
}) => {
  const theme = useTheme<AppTheme>();
  const progress = useSharedValue(0);

  // Preserve item and layout during close animation
  const [displayItem, setDisplayItem] = useState(item);
  const [displayLayout, setDisplayLayout] = useState(initialLayout);

  useEffect(() => {
    if (visible && item && initialLayout) {
      // When opening, immediately update the display data
      setDisplayItem(item);
      setDisplayLayout(initialLayout);
      progress.value = withTiming(1, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    } else if (!visible) {
      // When closing, animate first, then clear data after animation completes
      progress.value = withTiming(
        0,
        {
          duration: 250,
          easing: Easing.ease,
        },
        (finished) => {
          if (finished) {
            // Clear the display data after animation completes
            // Use runOnJS to safely call React state setters from worklet
            runOnJS(setDisplayItem)(null);
            runOnJS(setDisplayLayout)(null);
          }
        },
      );
    }
  }, [visible, item, initialLayout, progress]);

  useEffect(() => {
    const backAction = () => {
      if (visible) {
        onClose();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [visible, onClose]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const containerStyle = useAnimatedStyle(() => {
    if (!displayLayout) return {};

    // Interpolate position and size from initial layout to modal layout
    const targetX = (SCREEN_WIDTH - MODAL_WIDTH) / 2;
    const targetY = (SCREEN_HEIGHT - MODAL_HEIGHT) / 2;

    const left = interpolate(
      progress.value,
      [0, 1],
      [displayLayout.pageX, targetX],
    );
    const top = interpolate(
      progress.value,
      [0, 1],
      [displayLayout.pageY, targetY],
    );
    const width = interpolate(
      progress.value,
      [0, 1],
      [displayLayout.width, MODAL_WIDTH],
    );
    const height = interpolate(
      progress.value,
      [0, 1],
      [displayLayout.height, MODAL_HEIGHT],
    );
    const borderRadius = interpolate(progress.value, [0, 1], [24, 32]);

    return {
      left,
      top,
      width,
      height,
      borderRadius,
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [0.7, 1],
      [0, 1],
      Extrapolate.CLAMP,
    );
    const translateY = interpolate(
      progress.value,
      [0.7, 1],
      [20, 0],
      Extrapolate.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  if (!displayItem || !displayLayout) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? "auto" : "none"}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.6)" },
            backdropStyle,
          ]}
        >
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={100}
            tint="dark"
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(255,255,255,0.05)" },
            ]}
          />
        </Animated.View>
      </TouchableWithoutFeedback>

      {/* Animated Card */}
      <Animated.View
        style={[
          styles.cardContainer,
          { backgroundColor: theme.colors.surface },
          containerStyle,
        ]}
      >
        <View style={{ flex: 1, overflow: "hidden", borderRadius: 32 }}>
          <MediaPoster
            uri={displayItem.posterUrl}
            size={MODAL_WIDTH}
            aspectRatio={undefined}
            style={[StyleSheet.absoluteFill, { elevation: 0 }]}
          />

          {/* Gradient Overlay for text readability */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "rgba(0,0,0,0.4)",
                zIndex: 1,
                elevation: 1,
              },
              contentStyle,
            ]}
          />

          {/* Content */}
          <Animated.View
            style={[styles.content, contentStyle, { zIndex: 2, elevation: 2 }]}
          >
            <Text
              variant="headlineMedium"
              style={[styles.title, { color: "#fff" }]}
              numberOfLines={2}
            >
              {displayItem.title}
            </Text>

            {displayItem.overview && (
              <Text
                variant="bodyMedium"
                style={[styles.overview, { color: "rgba(255,255,255,0.9)" }]}
                numberOfLines={3}
              >
                {displayItem.overview}
              </Text>
            )}

            {displayItem.rating && (
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingText}>
                  ★ {displayItem.rating.toFixed(1)}
                </Text>
              </View>
            )}

            <Button
              mode="contained"
              onPress={onClose}
              style={{ marginTop: 16, backgroundColor: theme.colors.primary }}
            >
              Close
            </Button>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    position: "absolute",
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  content: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    justifyContent: "flex-end",
  },
  title: {
    fontWeight: "bold",
    marginBottom: 8,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  overview: {
    marginBottom: 12,
    lineHeight: 20,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ratingContainer: {
    backgroundColor: "rgba(255, 215, 0, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.5)",
  },
  ratingText: {
    color: "#FFD700",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default QuickViewModal;
