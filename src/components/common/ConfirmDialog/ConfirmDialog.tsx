import React from 'react';
import { StyleSheet } from 'react-native';
import { Portal, Dialog, Button, Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';

export type ConfirmDialogProps = {
  visible: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

export const ConfirmDialog = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    title: {
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      color: theme.colors.onSurface,
      marginBottom: spacing.xs,
    },
    message: {
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      color: theme.colors.onSurfaceVariant,
      marginBottom: spacing.md,
    },
  });

  const confirmMode = destructive ? 'outlined' : 'contained';
  const confirmTextColor = destructive ? theme.colors.error : theme.colors.onPrimary;
  const confirmButtonColor = destructive ? undefined : theme.colors.primary;

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onCancel}
        style={{ borderRadius: 12, backgroundColor: theme.colors.elevation.level1 }}
      >
        {title ? <Dialog.Title style={styles.title}>{title}</Dialog.Title> : null}
        {message ? (
          <Dialog.Content>
            <Text style={styles.message}>{message}</Text>
          </Dialog.Content>
        ) : null}
        <Dialog.Actions>
          <Button mode="outlined" onPress={onCancel} textColor={theme.colors.onSurfaceVariant}>
            {cancelLabel}
          </Button>
          <Button
            mode={confirmMode as any}
            onPress={onConfirm}
            buttonColor={confirmButtonColor}
            textColor={confirmTextColor}
          >
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default ConfirmDialog;
