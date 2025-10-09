import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  Portal,
  Text,
  useTheme,
} from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';

export interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
  confirmIcon?: string;
}
import { spacing } from '@/theme/spacing';

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
  confirmIcon,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    dialogContent: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    message: {
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.md,
    },
    cancelButton: {
      minWidth: 80,
    },
    confirmButton: {
      minWidth: 80,
    },
  });

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCancel}>
        <Dialog.Title>{title}</Dialog.Title>
        <View style={styles.dialogContent}>
          <Text variant="bodyMedium" style={styles.message}>
            {message}
          </Text>
        </View>
        <Dialog.Actions>
          <Button
            onPress={onCancel}
            style={styles.cancelButton}
          >
            {cancelLabel}
          </Button>
          <Button
            onPress={onConfirm}
            mode={isDestructive ? 'contained' : 'outlined'}
            buttonColor={isDestructive ? theme.colors.error : theme.colors.primary}
            textColor={isDestructive ? theme.colors.onError : theme.colors.onPrimary}
            icon={confirmIcon}
            style={styles.confirmButton}
          >
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default ConfirmationDialog;
