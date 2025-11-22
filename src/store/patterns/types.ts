/**
 * Type definitions for store patterns
 */

import type { StoreSelector, SelectorConfig } from "./selectors";

/**
 * Store slice structure with state, actions, and selectors
 */
export interface StoreSlice<T> {
  state: T;
  actions: Record<string, (...args: any[]) => void>;
  selectors: Record<string, SelectorConfig<T, any>>;
}

/**
 * Equality function type for comparing selector results
 */
export type EqualityFn<T> = (a: T, b: T) => boolean;

/**
 * Selector hook type that matches Zustand's useStore signature
 */
export type UseSelectorHook<T> = <R>(
  selector: StoreSelector<T, R>,
  equalityFn?: EqualityFn<R>,
) => R;

/**
 * Store with selector utilities
 */
export interface StoreWithSelectors<T> {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
  selectors: Record<string, SelectorConfig<T, any>>;
}

/**
 * Re-export selector types for convenience
 */
export type { StoreSelector, SelectorConfig };
