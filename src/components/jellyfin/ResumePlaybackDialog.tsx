import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Pressable,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { Portal, Text, useTheme } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { ANIMATION_DURATIONS } from "@/utils/animations.utils";

interface ResumePlaybackDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onResume: () => void;
  onStartFromBeginning: () => void;
  itemTitle?: string | null;
  playedPercentage?: number | null;
  positionTicks?: number | null;
}

const formatTime = (ticks?: number | null): string => {
  if (!ticks || ticks <= 0) return "0:00";

  const totalSeconds = Math.floor(ticks / 10_000_000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const ResumePlaybackDialog: React.FC<ResumePlaybackDialogProps> = ({
  visible,
  onDismiss,
  onResume,
  onStartFromBeginning,
  itemTitle,
  playedPercentage,
  positionTicks,
}) => {
  const theme = useTheme<AppTheme>();
  const { height: screenHeight } = useWindowDimensions();

  const bottomOffset = Math.round(screenHeight * 0.4);
  const maxHeight = Math.round(screenHeight * 0.5);

  const translateY = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const isExitingRef = useRef(false);
  const [rendered, setRendered] = React.useState<boolean>(visible);

  const animateOutAndDismiss = useCallback(
    (cb?: () => void) => {
      if (isExitingRef.current) return;
      isExitingRef.current = true;
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 24,
          duration: ANIMATION_DURATIONS.QUICK,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: ANIMATION_DURATIONS.QUICK - 50,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRendered(false);
        try {
          cb?.();
        } finally {
          onDismiss?.();
        }
      });
    },
    [translateY, opacity, onDismiss],
  );

  useEffect(() => {
    if (visible) {
      setRendered(true);
      isExitingRef.current = false;
      translateY.setValue(24);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: ANIMATION_DURATIONS.NORMAL,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: ANIMATION_DURATIONS.NORMAL - 80,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!visible && rendered) {
      animateOutAndDismiss(() => setRendered(false));
    }
  }, [visible, animateOutAndDismiss, opacity, rendered, translateY]);

  if (!rendered) return null;

  const timeString = formatTime(positionTicks);
  const percentString = playedPercentage
    ? `${Math.round(playedPercentage)}%`
    : "";

  return (
    <Portal>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => animateOutAndDismiss()}
      >
        <Animated.View
          style={[
            styles.backdrop,
            { backgroundColor: theme.colors.backdrop, opacity },
          ]}
        />
      </Pressable>

      <Animated.View
        style={[
          styles.container,
          {
            bottom: bottomOffset,
            maxHeight,
            transform: [{ translateY }],
            opacity,
            backgroundColor: theme.colors.elevation.level1,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
          },
        ]}
        accessibilityLabel="Resume Playback?"
      >
        <View style={styles.content}>
          <Text
            style={{
              textAlign: "center",
              color: theme.colors.onSurface,
              fontSize: theme.custom.typography.titleLarge.fontSize,
              fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
            }}
            accessibilityRole="header"
          >
            Resume Playback?
          </Text>
          <ScrollView
            style={{ maxHeight: maxHeight - 120 }}
            contentContainerStyle={{ paddingVertical: 2 }}
          >
            <Text
              style={{
                textAlign: "center",
                color: theme.colors.onSurfaceVariant,
                marginTop: 6,
                fontSize: theme.custom.typography.bodyMedium.fontSize,
                lineHeight: theme.custom.typography.bodyMedium.lineHeight,
              }}
            >
              {itemTitle
                ? `"${itemTitle}" has been partially watched.`
                : "This item has been partially watched."}
            </Text>
            {(timeString || percentString) && (
              <Text
                style={{
                  textAlign: "center",
                  color: theme.colors.onSurfaceVariant,
                  marginTop: 8,
                  fontSize: theme.custom.typography.bodySmall.fontSize,
                  opacity: 0.7,
                }}
              >
                {timeString && `Position: ${timeString}`}
                {timeString && percentString && " • "}
                {percentString && `Progress: ${percentString}`}
              </Text>
            )}
          </ScrollView>
        </View>

        <View
          style={[
            styles.topDivider,
            { backgroundColor: theme.colors.outlineVariant },
          ]}
        />

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.leftAction,
              {
                opacity: pressed ? 0.6 : 1,
                borderRightColor: theme.colors.outlineVariant,
              },
            ]}
            onPress={() => {
              onStartFromBeginning();
              animateOutAndDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel="Start from beginning"
          >
            <Text
              style={{
                color: theme.colors.onSurface,
                fontSize: theme.custom.typography.labelLarge.fontSize,
                fontWeight: "700",
                textAlign: "center",
              }}
            >
              Start from beginning
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.confirmAction,
              {
                backgroundColor: theme.colors.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={() => {
              onResume();
              animateOutAndDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel="Resume"
          >
            <Text
              style={{
                color: theme.colors.onPrimary,
                fontSize: theme.custom.typography.labelLarge.fontSize,
                fontWeight: "700",
                textAlign: "center",
              }}
            >
              Resume
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Portal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  container: {
    position: "absolute",
    left: 12,
    right: 12,
    borderRadius: 28,
    overflow: "hidden",
    elevation: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: "center",
  },
  topDivider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 64,
  },
  leftAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    borderTopLeftRadius: 0,
    borderRightColor: "rgba(0,0,0,0.12)",
  },
  confirmAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    borderBottomRightRadius: 28,
    borderTopRightRadius: 0,
    paddingHorizontal: 12,
  },
});
