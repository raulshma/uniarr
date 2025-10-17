import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import { Portal } from "react-native-paper";
import CustomConfirm from "./CustomConfirm";
import CustomAlert from "./CustomAlert";
import {
  registerDialogPresenter,
  unregisterDialogPresenter,
} from "@/services/dialogService";

type DialogPayload = {
  title: string;
  message?: string;
  buttons?: { text: string; onPress?: () => void; style?: string }[];
  options?: { cancelable?: boolean; onDismiss?: () => void };
};

const DialogContext = createContext({
  present: (payload: DialogPayload) => {},
});

export const useDialog = () => useContext(DialogContext);

// Separate component to render dialogs using Portal to avoid affecting the provider tree
const DialogRenderer = ({
  current,
  onDismiss,
}: {
  current: DialogPayload | null;
  onDismiss: () => void;
}) => {
  if (!current) return null;

  const buttons = current.buttons ?? [];

  const handleDismiss = () => {
    current.options?.onDismiss?.();
    onDismiss();
  };

  if (buttons.length === 2) {
    const cancelBtn = buttons.find((b) => b.style === "cancel") ?? buttons[0];
    const confirmBtn =
      buttons.find((b) => b.style !== "cancel") ?? buttons[1] ?? buttons[0];

    return (
      <Portal>
        <CustomConfirm
          visible
          title={current.title}
          message={current.message}
          cancelLabel={cancelBtn?.text}
          confirmLabel={confirmBtn?.text}
          destructive={confirmBtn?.style === "destructive"}
          // Call only the developer-provided onPress here; the component will
          // animate out and call onDismiss after the exit animation completes.
          onCancel={() => cancelBtn?.onPress?.()}
          cancelable={current.options?.cancelable ?? true}
          onConfirm={() => confirmBtn?.onPress?.()}
          onDismiss={handleDismiss}
        />
      </Portal>
    );
  }

  // Fallback to multi action alert (0,1 or >=3 mapped to up to 3 actions)
  const tertiary = buttons[0];
  const secondary = buttons[1];
  const primary = buttons[2] ?? buttons[0];

  return (
    <Portal>
      <CustomAlert
        visible
        title={current.title}
        message={current.message}
        tertiaryLabel={tertiary?.text}
        secondaryLabel={secondary?.text}
        primaryLabel={primary?.text ?? "OK"}
        // Only trigger callbacks here; the components are responsible for
        // animating out and will call onDismiss after the exit animation.
        onTertiary={() => tertiary?.onPress?.()}
        onSecondary={() => secondary?.onPress?.()}
        onPrimary={() => primary?.onPress?.()}
        cancelable={current.options?.cancelable ?? true}
        onDismiss={handleDismiss}
      />
    </Portal>
  );
};

export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const [current, setCurrent] = useState<DialogPayload | null>(null);
  const presentRef = useRef<(payload: DialogPayload) => void>(() => {});

  const present = useCallback((payload: DialogPayload) => {
    setCurrent(payload);
  }, []);

  // Store the latest present function in a ref to avoid stale closure issues
  presentRef.current = present;

  useEffect(() => {
    // Register present function so services.dialogService can call into this provider
    registerDialogPresenter((payload) => {
      presentRef.current(payload as any);
    });

    return () => {
      unregisterDialogPresenter();
    };
  }, []); // Empty dependency array since we use ref

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({ present }), [present]);

  const handleDialogDismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      <DialogRenderer current={current} onDismiss={handleDialogDismiss} />
    </DialogContext.Provider>
  );
};

export default DialogProvider;
