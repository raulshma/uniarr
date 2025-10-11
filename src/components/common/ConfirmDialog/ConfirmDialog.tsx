import React from 'react';
import CustomConfirm from '@/components/common/CustomDialogs/CustomConfirm';

export type ConfirmDialogProps = {
  visible: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  onDismiss?: () => void;
};

/**
 * Backwards-compatible wrapper that delegates to the new CustomConfirm.
 * Keeps the old prop names but unifies the UI with CustomConfirm.
 */
const ConfirmDialog = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  onDismiss,
}: ConfirmDialogProps) => {
  return (
    <CustomConfirm
      visible={visible}
      title={title}
      message={message}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      destructive={destructive}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onDismiss={onDismiss ?? onCancel}
    />
  );
};

export default ConfirmDialog;
