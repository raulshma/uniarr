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

export type CustomAlertProps = {
  visible: boolean;
  title?: string;
  message?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  tertiaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onTertiary?: () => void;
  onDismiss?: () => void;
  cancelable?: boolean;
};

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  primaryLabel = "OK",
  secondaryLabel,
  tertiaryLabel,
  onPrimary,
  onSecondary,
  onTertiary,
  onDismiss,
  cancelable = true,
}) => {
  const theme = useTheme<AppTheme>();
  const { height: screenHeight } = useWindowDimensions();

  const bottomOffset = Math.round(screenHeight * 0.4);
  const maxHeight = Math.round(screenHeight * 0.5);
  // Use flex distribution for actions instead of a fixed primary width so
  // buttons evenly share available space and labels are centered.
  const hasLeftActions = Boolean(secondaryLabel || tertiaryLabel);

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

  return (
    <Portal>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          if (!cancelable) return;
          // Backdrop press: act like dismiss
          animateOutAndDismiss();
        }}
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
        accessibilityLabel={title}
      >
        <View style={styles.content}>
          {title ? (
            <Text
              style={{
                textAlign: "center",
                color: theme.colors.onSurface,
                fontSize: theme.custom.typography.titleLarge.fontSize,
                fontWeight: theme.custom.typography.titleLarge
                  .fontWeight as any,
              }}
              accessibilityRole="header"
            >
              {title}
            </Text>
          ) : null}
          {message ? (
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
                {message}
              </Text>
            </ScrollView>
          ) : null}
        </View>

        <View
          style={[
            styles.topDivider,
            { backgroundColor: theme.colors.outlineVariant },
          ]}
        />

        <View style={styles.actionsRow}>
          {tertiaryLabel ? (
            <Pressable
              style={({ pressed }) => [
                styles.leftAction,
                {
                  opacity: pressed ? 0.6 : 1,
                  borderRightColor: theme.colors.outlineVariant,
                },
              ]}
              onPress={() => {
                onTertiary?.();
                animateOutAndDismiss();
              }}
              accessibilityRole="button"
              accessibilityLabel={tertiaryLabel}
            >
              <Text
                style={{
                  color: theme.colors.onSurface,
                  fontSize: theme.custom.typography.labelLarge.fontSize,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              >
                {tertiaryLabel}
              </Text>
            </Pressable>
          ) : null}

          {secondaryLabel ? (
            <Pressable
              style={({ pressed }) => [
                styles.middleAction,
                {
                  opacity: pressed ? 0.6 : 1,
                  borderRightColor: theme.colors.outlineVariant,
                },
              ]}
              onPress={() => {
                onSecondary?.();
                animateOutAndDismiss();
              }}
              accessibilityRole="button"
              accessibilityLabel={secondaryLabel}
            >
              <Text
                style={{
                  color: theme.colors.onSurface,
                  fontSize: theme.custom.typography.labelLarge.fontSize,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              >
                {secondaryLabel}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryAction,
              {
                flex: 1,
                backgroundColor: theme.colors.primary,
                opacity: pressed ? 0.9 : 1,
                // If there are other actions to the left, only round the right
                // corners of the primary button so the divider/styling stays
                // consistent; when primary is the only action, round both
                // sides so it matches the container corners.
                borderBottomLeftRadius: hasLeftActions ? 0 : 28,
                borderTopLeftRadius: hasLeftActions ? 0 : 28,
              },
            ]}
            onPress={() => {
              onPrimary?.();
              animateOutAndDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
          >
            <Text
              style={{
                color: theme.colors.onPrimary,
                fontSize: theme.custom.typography.labelLarge.fontSize,
                fontWeight: "700",
                textAlign: "center",
              }}
            >
              {primaryLabel}
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
    paddingHorizontal: 12,
    // Ensure the far-left action has a flat top-left corner so it meets
    // the dialog content with a square edge.
    borderTopLeftRadius: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(0,0,0,0.12)",
  },
  middleAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    paddingHorizontal: 12,
    // When this is the left-most action (no tertiary), keep its top-left
    // corner flat as well.
    borderTopLeftRadius: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(0,0,0,0.12)",
  },
  primaryAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    // Keep the bottom-right rounded so the primary button follows the
    // container's outer corner, but make the top-right flat so the
    // separator above is a square edge.
    borderBottomRightRadius: 28,
    borderTopRightRadius: 0,
    paddingHorizontal: 12,
  },
});

export default CustomAlert;
