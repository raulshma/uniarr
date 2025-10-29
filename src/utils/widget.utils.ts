import type { Widget } from "@/services/widgets/WidgetService";

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const normalizeForSignature = (input: unknown): unknown => {
  if (Array.isArray(input)) {
    return input.map((item) => normalizeForSignature(item));
  }

  if (isPlainObject(input)) {
    const sortedEntries = Object.keys(input)
      .filter((key) => input[key] !== undefined)
      .sort()
      .map((key) => [key, normalizeForSignature(input[key])]);

    return Object.fromEntries(sortedEntries);
  }

  if (input instanceof Date) {
    return input.toISOString();
  }

  if (typeof input === "number") {
    if (Number.isNaN(input)) {
      return "__NaN";
    }
    if (!Number.isFinite(input)) {
      return input > 0 ? "__Infinity" : "__-Infinity";
    }
  }

  return input ?? null;
};

const fnv1a = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

export const createWidgetConfigSignature = (
  config: Widget["config"] | Record<string, unknown> | undefined,
): string => {
  const normalized = normalizeForSignature(config ?? {});
  const serialized = JSON.stringify(normalized);
  const hash = fnv1a(serialized);
  return `v1:${hash}:${serialized.length}`;
};

type HasConfig = Pick<Widget, "config">;

export const signatureFromWidget = (widget: HasConfig): string =>
  createWidgetConfigSignature(widget.config);
