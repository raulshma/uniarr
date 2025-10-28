import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  lazy,
  Suspense,
} from "react";
import type { ReactNode } from "react";
import { Portal, ActivityIndicator } from "react-native-paper";
import CustomConfirm from "./CustomConfirm";
import CustomAlert from "./CustomAlert";
import {
  registerDialogPresenter,
  unregisterDialogPresenter,
  registerCustomDialogPresenter,
  unregisterCustomDialogPresenter,
} from "@/services/dialogService";

const UpdateDialog = lazy(() =>
  import("@/components/common/UpdateDialog").then((module) => ({
    default: module.UpdateDialog,
  })),
);

type DialogPayload = {
  title: string;
  message?: string;
  buttons?: { text: string; onPress?: () => void; style?: string }[];
  options?: { cancelable?: boolean; onDismiss?: () => void };
};

type CustomDialogPayload = {
  type: string;
  payload: any;
};

const DialogContext = createContext({
  present: (payload: DialogPayload) => {},
  presentCustomDialog: (type: string, payload: any) => {},
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

// Separate component to render custom dialogs
const CustomDialogRenderer = ({
  current,
  onDismiss,
}: {
  current: CustomDialogPayload | null;
  onDismiss: () => void;
}) => {
  if (!current) return null;

  // Dynamically import and render custom dialogs based on type
  if (current.type === "updateCheck") {
    return (
      <Portal>
        <Suspense fallback={<ActivityIndicator animating={true} />}>
          <UpdateDialog
            visible
            updateData={current.payload.updateData}
            isLoading={current.payload.isLoading}
            error={current.payload.error}
            onDismiss={onDismiss}
          />
        </Suspense>
      </Portal>
    );
  }

  return null;
};

export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const [current, setCurrent] = useState<DialogPayload | null>(null);
  const [customDialog, setCustomDialog] = useState<CustomDialogPayload | null>(
    null,
  );
  const presentRef = useRef<(payload: DialogPayload) => void>(() => {});
  const presentCustomDialogRef = useRef<(type: string, payload: any) => void>(
    () => {},
  );

  const present = useCallback((payload: DialogPayload) => {
    setCurrent(payload);
  }, []);

  const presentCustomDialog = useCallback((type: string, payload: any) => {
    setCustomDialog({ type, payload });
  }, []);

  // Store the latest present function in a ref to avoid stale closure issues
  presentRef.current = present;
  presentCustomDialogRef.current = presentCustomDialog;

  useEffect(() => {
    // Register present function so services.dialogService can call into this provider
    registerDialogPresenter((payload) => {
      presentRef.current(payload as any);
    });

    registerCustomDialogPresenter((type, payload) => {
      presentCustomDialogRef.current(type, payload);
    });

    return () => {
      unregisterDialogPresenter();
      unregisterCustomDialogPresenter();
    };
  }, []); // Empty dependency array since we use ref

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ present, presentCustomDialog }),
    [present, presentCustomDialog],
  );

  const handleDialogDismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  const handleCustomDialogDismiss = useCallback(() => {
    setCustomDialog(null);
  }, []);

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      <DialogRenderer current={current} onDismiss={handleDialogDismiss} />
      <CustomDialogRenderer
        current={customDialog}
        onDismiss={handleCustomDialogDismiss}
      />
    </DialogContext.Provider>
  );
};

export default DialogProvider;
