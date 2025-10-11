import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Pressable, useWindowDimensions, ScrollView } from 'react-native';
import { Portal, Text, useTheme } from 'react-native-paper';
import type { AppTheme } from '@/constants/theme';

export type CustomConfirmProps = {
  visible: boolean;
  title?: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
  cancelable?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  onDismiss?: () => void;
};

const CustomConfirm: React.FC<CustomConfirmProps> = ({
  visible,
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  destructive = false,
  cancelable = true,
  onConfirm,
  onCancel,
  onDismiss,
}) => {
  const theme = useTheme<AppTheme>();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();

  // Position the dialog so it appears 40% up from the bottom of the screen
  const bottomOffset = Math.round(screenHeight * 0.4);
  // Prevent the dialog from growing too tall
  const maxHeight = Math.round(screenHeight * 0.5);
  // Use flex distribution for actions instead of a fixed confirm width so
  // buttons evenly share available space and center their labels.

  const translateY = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const isExitingRef = useRef(false);
  const [rendered, setRendered] = React.useState<boolean>(visible);

  useEffect(() => {
    // Show: ensure we are rendered and run entrance animation
    if (visible) {
      setRendered(true);
      isExitingRef.current = false;
      translateY.setValue(24);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      return;
    }

    // If visible turned false while mounted, run exit animation and unmount after
    if (!visible && rendered) {
      animateOutAndDismiss(() => setRendered(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animateOutAndDismiss = (cb?: () => void) => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    Animated.parallel([
      Animated.timing(translateY, { toValue: 24, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      // Hide from render tree then invoke callbacks so parent can update
      setRendered(false);
      try {
        cb?.();
      } finally {
        onDismiss?.();
      }
    });
  };

  if (!rendered) return null;

  return (
    <Portal>
      {/* Backdrop (tappable when cancelable) */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          if (!cancelable) return;
          // For confirm dialogs treat backdrop press as cancel
          onCancel?.();
          animateOutAndDismiss();
        }}
      >
        <Animated.View style={[styles.backdrop, { backgroundColor: theme.colors.backdrop, opacity }]} />
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
            shadowColor: '#000',
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
              style={[
                styles.title,
                {
                  color: theme.colors.onSurface,
                  fontSize: theme.custom.typography.titleLarge.fontSize,
                  fontFamily: theme.custom.typography.titleLarge.fontFamily,
                  fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
                },
              ]}
              accessibilityRole="header"
            >
              {title}
            </Text>
          ) : null}
          {message ? (
            <ScrollView style={{ maxHeight: maxHeight - 120 }} contentContainerStyle={{ paddingVertical: 2 }}>
              <Text
                style={{
                  textAlign: 'center',
                  color: theme.colors.onSurfaceVariant,
                  fontSize: theme.custom.typography.bodyMedium.fontSize,
                  lineHeight: theme.custom.typography.bodyMedium.lineHeight,
                  marginTop: 6,
                }}
              >
                {message}
              </Text>
            </ScrollView>
          ) : null}
        </View>

        <View style={[styles.topDivider, { backgroundColor: theme.colors.outlineVariant }]} />

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.leftAction,
              { backgroundColor: 'transparent', opacity: pressed ? 0.6 : 1, borderRightColor: theme.colors.outlineVariant },
            ]}
            onPress={() => {
              // Call cancel callback immediately then animate out and dismiss
              onCancel?.();
              animateOutAndDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
          >
            <Text
              style={{
                color: theme.colors.onSurface,
                fontSize: theme.custom.typography.labelLarge.fontSize,
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              {cancelLabel}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.confirmAction,
              {
                backgroundColor: destructive ? theme.colors.error : theme.colors.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={() => {
              // Call confirm callback immediately then animate out and dismiss
              onConfirm();
              animateOutAndDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
          >
            <Text
              style={{
                color: destructive ? theme.colors.onError : theme.colors.onPrimary,
                fontSize: theme.custom.typography.labelLarge.fontSize,
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              {confirmLabel}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Portal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 0,
  },
  topDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
  },
  leftAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    // Make the top-left corner of the far-left button flat so the action
    // row meets the content with a square corner.
    borderTopLeftRadius: 0,
    borderRightColor: 'rgba(0,0,0,0.12)',
  },
  confirmAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    // Keep the bottom-right rounded to match the container, but ensure
    // the top-right corner is flat so the separator line is square.
    borderBottomRightRadius: 28,
    borderTopRightRadius: 0,
    paddingHorizontal: 12,
  },
});

export default CustomConfirm;
