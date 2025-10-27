import {
  Alert as RNAlert,
  type AlertButton,
  type AlertOptions as RNAlertOptions,
} from "react-native";

export type RNAlertButton = {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export type AlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

type PresentPayload = {
  title: string;
  message?: string;
  buttons?: RNAlertButton[];
  options?: AlertOptions;
};

type Presenter = (payload: PresentPayload) => void;
type CustomDialogPresenter = (type: string, payload: any) => void;

let presenter: Presenter | null = null;
let customDialogPresenter: CustomDialogPresenter | null = null;

export function registerDialogPresenter(fn: Presenter) {
  presenter = fn;
}

export function unregisterDialogPresenter() {
  presenter = null;
}

export function registerCustomDialogPresenter(fn: CustomDialogPresenter) {
  customDialogPresenter = fn;
}

export function unregisterCustomDialogPresenter() {
  customDialogPresenter = null;
}

/**
 * Show a themed in-app alert / confirm using the app's DialogProvider if available.
 * Falls back to React Native's Alert.alert when no presenter is registered.
 *
 * Signature mirrors React Native's Alert.alert so replacements are straightforward.
 */
export function alert(
  title: string,
  message?: string,
  buttons?: RNAlertButton[],
  options?: AlertOptions,
) {
  if (presenter) {
    presenter({ title, message, buttons, options });
  } else {
    // Fallback so nothing breaks if provider isn't mounted yet
    // Convert our typed payload into the RN Alert-compatible form without using `any`.
    const safeButtons = Array.isArray(buttons)
      ? (buttons.map((b) => ({
          text: b.text,
          onPress: b.onPress,
          style: b.style,
        })) as AlertButton[])
      : undefined;

    const safeOptions = options
      ? ({
          cancelable: Boolean(options.cancelable),
          onDismiss: options.onDismiss,
        } as RNAlertOptions)
      : undefined;
    RNAlert.alert(title, message ?? undefined, safeButtons, safeOptions);
  }
}

/**
 * Show a custom dialog via the DialogProvider
 * @param type - The type of custom dialog (e.g., 'updateCheck')
 * @param payload - The payload to pass to the custom dialog
 */
export function showCustomDialog(type: string, payload: any) {
  if (customDialogPresenter) {
    customDialogPresenter(type, payload);
  }
}

export default {
  alert,
  showCustomDialog,
  registerDialogPresenter,
  unregisterDialogPresenter,
  registerCustomDialogPresenter,
  unregisterCustomDialogPresenter,
};
