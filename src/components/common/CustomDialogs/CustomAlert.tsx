import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Portal, Text, Button, useTheme } from 'react-native-paper';
import type { AppTheme } from '@/constants/theme';

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
};

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  primaryLabel = 'OK',
  secondaryLabel,
  tertiaryLabel,
  onPrimary,
  onSecondary,
  onTertiary,
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

        <View style={styles.actionsRow}>
          {tertiaryLabel ? (
            <Button mode="text" onPress={() => { onTertiary?.(); onDismiss?.(); }}>
              {tertiaryLabel}
            </Button>
          ) : null}

          {secondaryLabel ? (
            <Button mode="outlined" onPress={() => { onSecondary?.(); onDismiss?.(); }}>
              {secondaryLabel}
            </Button>
          ) : null}

          <Button mode="contained" onPress={() => { onPrimary?.(); onDismiss?.(); }}>
            {primaryLabel}
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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
});

export default CustomAlert;
