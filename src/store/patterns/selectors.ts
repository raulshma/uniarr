/**
 * Selector Pattern Utilities for Zustand Stores
 *
 * These utilities help create efficient selectors that minimize re-renders
 * by ensuring stable references and granular state selection.
 */

/**
 * Type for a selector function that extracts data from a store
 */
export type StoreSelector<T, R> = (state: T) => R;

/**
 * Configuration for a selector with optional equality function
 */
export interface SelectorConfig<T, R> {
  selector: (state: T) => R;
  equalityFn?: (a: R, b: R) => boolean;
  name?: string; // For debugging
}

/**
 * Pattern 1: Single Value Selector
 *
 * Creates a selector that extracts a single value from the store.
 * This ensures components only re-render when that specific value changes.
 *
 * @example
 * const selectTheme = selectSingleValue('theme');
 * const theme = useStore(selectTheme);
 */
export const selectSingleValue = <T, K extends keyof T>(
  key: K,
): StoreSelector<T, T[K]> => {
  return (state: T) => state[key];
};

/**
 * Pattern 2: Multiple Values Selector
 *
 * Creates a selector that extracts multiple values from the store.
 * Returns a new object with only the selected keys.
 * Use with shallow equality comparison to prevent unnecessary re-renders.
 *
 * @example
 * const selectSettings = selectMultipleValues(['theme', 'language']);
 * const { theme, language } = useStore(selectSettings, shallow);
 */
export const selectMultipleValues = <T, K extends keyof T>(
  keys: K[],
): StoreSelector<T, Pick<T, K>> => {
  return (state: T) => {
    const result = {} as Pick<T, K>;
    keys.forEach((key) => {
      result[key] = state[key];
    });
    return result;
  };
};

/**
 * Pattern 3: Derived Value Selector
 *
 * Creates a selector that computes a derived value from the store state.
 * The computation happens during selection, so it re-computes on every render.
 * For expensive computations, consider memoizing within the compute function.
 *
 * @example
 * const selectFullName = selectDerivedValue(
 *   (state) => `${state.firstName} ${state.lastName}`
 * );
 * const fullName = useStore(selectFullName);
 */
export const selectDerivedValue = <T, R>(
  compute: (state: T) => R,
): StoreSelector<T, R> => {
  return compute;
};

/**
 * Pattern 4: Action-Only Selector
 *
 * Creates a selector that extracts only action functions from the store.
 * This selector never causes re-renders because functions are stable references.
 * Separating actions from data prevents unnecessary re-renders when data changes.
 *
 * @example
 * const selectActions = selectActionsOnly(['setTheme', 'resetSettings']);
 * const { setTheme, resetSettings } = useStore(selectActions);
 */
export const selectActionsOnly = <T extends Record<string, any>>(
  actionKeys: (keyof T)[],
): StoreSelector<T, Pick<T, (typeof actionKeys)[number]>> => {
  return (state: T) => {
    const actions = {} as Pick<T, (typeof actionKeys)[number]>;
    actionKeys.forEach((key) => {
      actions[key] = state[key];
    });
    return actions;
  };
};

/**
 * Shallow equality comparison for objects
 * Useful with selectMultipleValues to prevent re-renders when values haven't changed
 *
 * @example
 * const settings = useStore(selectMultipleValues(['theme', 'language']), shallow);
 */
export const shallow = <T>(a: T, b: T): boolean => {
  if (Object.is(a, b)) {
    return true;
  }

  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return false;
  }

  const keysA = Object.keys(a) as (keyof T)[];
  const keysB = Object.keys(b) as (keyof T)[];

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is(a[key], b[key])
    ) {
      return false;
    }
  }

  return true;
};

/**
 * Helper to create a selector configuration with custom equality
 *
 * @example
 * const config = createSelectorConfig(
 *   (state) => state.items,
 *   (a, b) => a.length === b.length,
 *   'items-length-equality'
 * );
 */
export const createSelectorConfig = <T, R>(
  selector: (state: T) => R,
  equalityFn?: (a: R, b: R) => boolean,
  name?: string,
): SelectorConfig<T, R> => {
  return {
    selector,
    equalityFn,
    name,
  };
};
