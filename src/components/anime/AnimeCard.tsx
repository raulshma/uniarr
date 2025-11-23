import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme, Chip } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { AppTheme } from "@/constants/theme";
import { MediaPoster } from "@/components/media/MediaPoster";

export type AnimeCardProps = {
  id: number;
  title: string;
  posterUrl?: string;
  rating?: number;
  isWatchlisted?: boolean;
  isTracked?: boolean;
  onPress?: () => void;
  onLongPress?: (layout: {
    x: number;
    y: number;
    width: number;
    height: number;
    pageX: number;
    pageY: number;
  }) => void;
  width?: number;
};

const AnimeCard: React.FC<AnimeCardProps> = ({
  title,
  posterUrl,
  rating,
  isWatchlisted = false,
  isTracked = false,
  onPress,
  onLongPress,
  width = 160,
}) => {
  const theme = useTheme<AppTheme>();
  const scale = useSharedValue(1);
  const containerRef = React.useRef<View>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width,
          marginRight: theme.custom.spacing.md,
        },
        posterContainer: {
          position: "relative",
          borderRadius: 24, // One UI 8: More rounded corners
          overflow: "hidden",
          marginBottom: theme.custom.spacing.sm,
          backgroundColor: theme.colors.surfaceVariant, // Placeholder color
          elevation: 4, // Subtle shadow
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        badge: {
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 10,
        },
        chip: {
          height: 24,
          backgroundColor: theme.colors.primary,
          borderRadius: 12,
        },
        chipText: {
          fontSize: 10,
          lineHeight: 12,
          color: theme.colors.onPrimary,
          fontWeight: "700",
        },
        ratingContainer: {
          position: "absolute",
          bottom: 10,
          right: 10,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "rgba(0, 0, 0, 0.65)", // Slightly more transparent
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
          zIndex: 10,
          backdropFilter: "blur(4px)", // Web support, ignored on native but good for intent
        },
        ratingText: {
          color: "#FFD700",
          fontSize: 12,
          fontWeight: "800",
          marginLeft: 4,
        },
        title: {
          color: theme.colors.onSurface,
          fontSize: 15, // Slightly larger
          fontWeight: "600",
          lineHeight: 20,
          paddingHorizontal: 4,
        },
      }),
    [theme, width],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 10, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  const handleLongPress = () => {
    if (onLongPress && containerRef.current) {
      containerRef.current.measureInWindow((x, y, width, height) => {
        onLongPress({ x, y, width, height, pageX: x, pageY: y });
      });
    }
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Pressable
        ref={containerRef}
        onPress={onPress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={200}
        accessibilityRole="button"
        accessibilityLabel={`${title}${rating ? `, rated ${rating}` : ""}`}
      >
        <View style={styles.posterContainer}>
          <MediaPoster
            uri={posterUrl}
            size={width}
            aspectRatio={2 / 3}
            borderRadius={24}
            accessibilityLabel={`${title} poster`}
          />

          {isWatchlisted && (
            <View style={styles.badge}>
              <Chip compact style={styles.chip}>
                <Text style={styles.chipText}>Watchlist</Text>
              </Chip>
            </View>
          )}

          {isTracked && !isWatchlisted && (
            <View style={styles.badge}>
              <Chip
                compact
                style={[
                  styles.chip,
                  { backgroundColor: theme.colors.tertiary },
                ]}
              >
                <Text style={styles.chipText}>Tracked</Text>
              </Chip>
            </View>
          )}

          {typeof rating === "number" && (
            <View style={styles.ratingContainer}>
              <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        <Text variant="bodyMedium" numberOfLines={2} style={styles.title}>
          {title}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

export default AnimeCard;
