import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Portal, Text, Button, useTheme } from 'react-native-paper';
import type { AppTheme } from '@/constants/theme';

export type CustomConfirmProps = {
  visible: boolean;
  title?: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
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
  onConfirm,
  onCancel,
  onDismiss,
}) => {
  const theme = useTheme<AppTheme>();
  const translateY = useMemo(() => new Animated.Value(100), []);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (!visible) onDismiss?.();
    });
  }, [visible, translateY, onDismiss]);

  if (!visible) return null;

  return (
    <Portal>
      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateY }], backgroundColor: theme.colors.elevation.level1 },
        ]}
        accessibilityLabel={title}
      >
        {title ? (
          <Text style={[styles.title, { color: theme.colors.onSurface }]} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {message ? (
          <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={() => {
              onCancel?.();
              onDismiss?.();
            }}
            accessibilityRole="button"
          >
            {cancelLabel}
          </Button>

          <Button
            mode="contained"
            onPress={() => {
              onConfirm();
              onDismiss?.();
            }}
            buttonColor={destructive ? theme.colors.error : undefined}
            accessibilityRole="button"
            style={styles.confirmButton}
          >
            {confirmLabel}
          </Button>
        </View>
      </Animated.View>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 12,
    padding: 16,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    textAlign: 'center',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  confirmButton: {
    borderBottomRightRadius: 12,
  },
});

export default CustomConfirm;
