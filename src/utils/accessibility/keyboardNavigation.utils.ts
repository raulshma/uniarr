/**
 * Keyboard Navigation Utilities
 *
 * Provides utilities for keyboard navigation and focus management
 * in React Native applications, particularly for accessibility.
 */

import { Platform, AccessibilityInfo, findNodeHandle } from "react-native";
import type { RefObject } from "react";

/**
 * Focus management for keyboard navigation
 */
export class FocusManager {
  private static focusableRefs: Map<string, RefObject<any>> = new Map();
  private static currentFocusId: string | null = null;

  /**
   * Register a focusable element
   */
  static register(id: string, ref: RefObject<any>): void {
    this.focusableRefs.set(id, ref);
  }

  /**
   * Unregister a focusable element
   */
  static unregister(id: string): void {
    this.focusableRefs.delete(id);
    if (this.currentFocusId === id) {
      this.currentFocusId = null;
    }
  }

  /**
   * Focus an element by ID
   */
  static focus(id: string): boolean {
    const ref = this.focusableRefs.get(id);
    if (!ref?.current) {
      return false;
    }

    try {
      // For React Native, we use AccessibilityInfo to set focus
      const reactTag = findNodeHandle(ref.current);
      if (reactTag) {
        AccessibilityInfo.setAccessibilityFocus(reactTag);
        this.currentFocusId = id;
        return true;
      }
    } catch (error) {
      console.warn("Failed to set focus:", error);
    }

    return false;
  }

  /**
   * Get currently focused element ID
   */
  static getCurrentFocus(): string | null {
    return this.currentFocusId;
  }

  /**
   * Clear all registered refs (useful for cleanup)
   */
  static clear(): void {
    this.focusableRefs.clear();
    this.currentFocusId = null;
  }
}

/**
 * Keyboard shortcut configuration
 */
export interface KeyboardShortcut {
  key: string;
  modifiers?: readonly ("ctrl" | "shift" | "alt" | "meta")[];
  action: () => void;
  description: string;
}

/**
 * Keyboard shortcut manager
 * Note: React Native has limited keyboard support on mobile,
 * but this is useful for web and tablet with keyboard
 */
export class KeyboardShortcutManager {
  private static shortcuts: Map<string, KeyboardShortcut> = new Map();

  /**
   * Register a keyboard shortcut
   */
  static register(id: string, shortcut: KeyboardShortcut): void {
    this.shortcuts.set(id, shortcut);
  }

  /**
   * Unregister a keyboard shortcut
   */
  static unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  /**
   * Get all registered shortcuts
   */
  static getAll(): Map<string, KeyboardShortcut> {
    return new Map(this.shortcuts);
  }

  /**
   * Handle keyboard event
   * Returns true if a shortcut was triggered
   */
  static handleKeyPress(event: {
    key: string;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
  }): boolean {
    for (const [, shortcut] of this.shortcuts) {
      // Check if key matches
      if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
        continue;
      }

      // Check modifiers
      const modifiers = shortcut.modifiers || [];
      const ctrlMatch = modifiers.includes("ctrl") === (event.ctrlKey || false);
      const shiftMatch =
        modifiers.includes("shift") === (event.shiftKey || false);
      const altMatch = modifiers.includes("alt") === (event.altKey || false);
      const metaMatch = modifiers.includes("meta") === (event.metaKey || false);

      if (ctrlMatch && shiftMatch && altMatch && metaMatch) {
        shortcut.action();
        return true;
      }
    }

    return false;
  }

  /**
   * Clear all shortcuts
   */
  static clear(): void {
    this.shortcuts.clear();
  }
}

/**
 * Common keyboard shortcuts for the monitoring features
 */
export const MONITORING_SHORTCUTS = {
  REFRESH: {
    key: "r",
    modifiers: ["ctrl"] as const,
    description: "Refresh data",
  },
  SEARCH: {
    key: "f",
    modifiers: ["ctrl"] as const,
    description: "Focus search",
  },
  FILTER: {
    key: "l",
    modifiers: ["ctrl"] as const,
    description: "Toggle filters",
  },
  EXPORT: {
    key: "e",
    modifiers: ["ctrl"] as const,
    description: "Export data",
  },
  CLEAR_FILTERS: {
    key: "Escape",
    modifiers: [] as const,
    description: "Clear filters",
  },
};

/**
 * Check if keyboard navigation is available
 * (primarily for web and tablets with keyboards)
 */
export function isKeyboardNavigationAvailable(): boolean {
  return Platform.OS === "web" || Platform.isTV;
}

/**
 * Announce message to screen reader
 */
export function announceForAccessibility(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}

/**
 * Check if screen reader is enabled
 */
export async function isScreenReaderEnabled(): Promise<boolean> {
  try {
    return await AccessibilityInfo.isScreenReaderEnabled();
  } catch (error) {
    console.warn("Failed to check screen reader status:", error);
    return false;
  }
}
