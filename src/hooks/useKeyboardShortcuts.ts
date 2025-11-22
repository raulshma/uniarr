/**
 * useKeyboardShortcuts Hook
 *
 * Provides keyboard shortcut functionality for React Native components
 */

import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import {
  KeyboardShortcutManager,
  type KeyboardShortcut,
  isKeyboardNavigationAvailable,
} from "@/utils/accessibility/keyboardNavigation.utils";

export interface UseKeyboardShortcutsOptions {
  /**
   * Whether shortcuts are enabled
   */
  enabled?: boolean;

  /**
   * Shortcuts to register
   */
  shortcuts: Record<
    string,
    Omit<KeyboardShortcut, "action"> & { action: () => void }
  >;
}

/**
 * Hook for managing keyboard shortcuts
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   shortcuts: {
 *     refresh: {
 *       key: 'r',
 *       modifiers: ['ctrl'],
 *       description: 'Refresh data',
 *       action: handleRefresh,
 *     },
 *   },
 * });
 * ```
 */
export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions,
): void {
  const { enabled = true, shortcuts } = options;
  const shortcutIdsRef = useRef<string[]>([]);

  // Register shortcuts
  useEffect(() => {
    if (!enabled || !isKeyboardNavigationAvailable()) {
      return;
    }

    // Register all shortcuts
    const ids: string[] = [];
    Object.entries(shortcuts).forEach(([key, shortcut]) => {
      const id = `${key}-${Date.now()}-${Math.random()}`;
      KeyboardShortcutManager.register(id, shortcut as KeyboardShortcut);
      ids.push(id);
    });

    shortcutIdsRef.current = ids;

    // Cleanup
    return () => {
      ids.forEach((id) => {
        KeyboardShortcutManager.unregister(id);
      });
      shortcutIdsRef.current = [];
    };
  }, [enabled, shortcuts]);

  // Handle keyboard events (web only)
  useEffect(() => {
    if (!enabled || Platform.OS !== "web") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const handled = KeyboardShortcutManager.handleKeyPress({
        key: event.key,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      });

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [enabled]);
}

/**
 * Hook for managing focus
 */
export function useFocusManagement(
  elementId: string,
  ref: React.RefObject<any>,
): void {
  useEffect(() => {
    if (!isKeyboardNavigationAvailable()) {
      return;
    }

    // Dynamic import for web-only functionality
    const {
      FocusManager,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
    } = require("@/utils/accessibility/keyboardNavigation.utils");
    FocusManager.register(elementId, ref);

    return () => {
      FocusManager.unregister(elementId);
    };
  }, [elementId, ref]);
}
