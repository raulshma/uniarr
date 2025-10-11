import { Alert as RNAlert } from 'react-native';

export type RNAlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
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

let presenter: Presenter | null = null;

export function registerDialogPresenter(fn: Presenter) {
  presenter = fn;
}

export function unregisterDialogPresenter() {
  presenter = null;
}

/**
 * Show a themed in-app alert / confirm using the app's DialogProvider if available.
 * Falls back to React Native's Alert.alert when no presenter is registered.
 *
 * Signature mirrors React Native's Alert.alert so replacements are straightforward.
 */
export function alert(title: string, message?: string, buttons?: RNAlertButton[], options?: AlertOptions) {
  if (presenter) {
    presenter({ title, message, buttons, options });
  } else {
    // Fallback so nothing breaks if provider isn't mounted yet
    // Types are slightly different so cast to any for compatibility
    RNAlert.alert(title, message as any, buttons as any, options as any);
  }
}

export default {
  alert,
  registerDialogPresenter,
  unregisterDialogPresenter,
};
