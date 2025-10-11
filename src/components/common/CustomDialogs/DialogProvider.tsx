import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import CustomConfirm from './CustomConfirm';
import CustomAlert from './CustomAlert';
import { registerDialogPresenter, unregisterDialogPresenter } from '@/services/dialogService';

type DialogPayload = {
  title: string;
  message?: string;
  buttons?: Array<{ text: string; onPress?: () => void; style?: string }>;
  options?: { cancelable?: boolean; onDismiss?: () => void };
};

const DialogContext = createContext({
  present: (payload: DialogPayload) => {},
});

export const useDialog = () => useContext(DialogContext);

export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const [current, setCurrent] = useState<DialogPayload | null>(null);

  const present = useCallback((payload: DialogPayload) => {
    setCurrent(payload);
  }, []);

  useEffect(() => {
    // Register present function so services.dialogService can call into this provider
    registerDialogPresenter((payload) => {
      present(payload as any);
    });

    return () => {
      unregisterDialogPresenter();
    };
  }, [present]);

  if (!current) {
    return <DialogContext.Provider value={{ present }}>{children}</DialogContext.Provider>;
  }

  // Map buttons to either a confirm (two actions) or multi-action alert
  const buttons = current.buttons ?? [];

  const handleDismiss = () => {
    current.options?.onDismiss?.();
    setCurrent(null);
  };

  if (buttons.length === 2) {
    const cancelBtn = buttons.find((b) => b.style === 'cancel') ?? buttons[0];
    const confirmBtn = buttons.find((b) => b.style !== 'cancel') ?? buttons[1] ?? buttons[0];

    return (
      <DialogContext.Provider value={{ present }}>
        {children}
        <CustomConfirm
          visible
          title={current.title}
          message={current.message}
          cancelLabel={cancelBtn?.text}
          confirmLabel={confirmBtn?.text}
          destructive={confirmBtn?.style === 'destructive'}
          onCancel={() => {
            cancelBtn?.onPress?.();
            handleDismiss();
          }}
          onConfirm={() => {
            confirmBtn?.onPress?.();
            handleDismiss();
          }}
          onDismiss={handleDismiss}
        />
      </DialogContext.Provider>
    );
  }

  // Fallback to multi action alert (0,1 or >=3 mapped to up to 3 actions)
  const tertiary = buttons[0];
  const secondary = buttons[1];
  const primary = buttons[2] ?? buttons[0];

  return (
    <DialogContext.Provider value={{ present }}>
      {children}
      <CustomAlert
        visible
        title={current.title}
        message={current.message}
        tertiaryLabel={tertiary?.text}
        secondaryLabel={secondary?.text}
        primaryLabel={primary?.text ?? 'OK'}
        onTertiary={() => {
          tertiary?.onPress?.();
          handleDismiss();
        }}
        onSecondary={() => {
          secondary?.onPress?.();
          handleDismiss();
        }}
        onPrimary={() => {
          primary?.onPress?.();
          handleDismiss();
        }}
        onDismiss={handleDismiss}
      />
    </DialogContext.Provider>
  );
};

export default DialogProvider;
