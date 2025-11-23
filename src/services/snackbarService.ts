/**
 * Global snackbar service for showing toast-like notifications
 * Inspired by One UI 8 design system
 */

export type SnackbarType = "info" | "success" | "error" | "loading";

export interface SnackbarOptions {
  message: string;
  type?: SnackbarType;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

type SnackbarPresenter = (options: SnackbarOptions) => void;
type SnackbarDismisser = () => void;

let presenter: SnackbarPresenter | null = null;
let dismisser: SnackbarDismisser | null = null;

export function registerSnackbarPresenter(
  showFn: SnackbarPresenter,
  hideFn: SnackbarDismisser,
) {
  presenter = showFn;
  dismisser = hideFn;
}

export function unregisterSnackbarPresenter() {
  presenter = null;
  dismisser = null;
}

/**
 * Show a snackbar notification
 */
export function showSnackbar(
  message: string,
  options?: Omit<SnackbarOptions, "message">,
) {
  if (presenter) {
    presenter({ message, ...options });
  } else {
    console.warn("Snackbar presenter not registered:", message);
  }
}

/**
 * Dismiss the current snackbar
 */
export function dismissSnackbar() {
  if (dismisser) {
    dismisser();
  }
}

/**
 * Show a loading snackbar
 */
export function showLoadingSnackbar(message: string) {
  showSnackbar(message, { type: "loading", duration: 0 });
}

/**
 * Show a success snackbar
 */
export function showSuccessSnackbar(message: string, duration = 3000) {
  showSnackbar(message, { type: "success", duration });
}

/**
 * Show an error snackbar
 */
export function showErrorSnackbar(message: string, duration = 4000) {
  showSnackbar(message, { type: "error", duration });
}

/**
 * Show an info snackbar
 */
export function showInfoSnackbar(message: string, duration = 3000) {
  showSnackbar(message, { type: "info", duration });
}

export default {
  showSnackbar,
  dismissSnackbar,
  showLoadingSnackbar,
  showSuccessSnackbar,
  showErrorSnackbar,
  showInfoSnackbar,
  registerSnackbarPresenter,
  unregisterSnackbarPresenter,
};
