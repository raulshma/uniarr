import type {
  NotificationCategory,
  QuietHoursConfig,
  QuietHoursDay,
  QuietHoursPreset,
} from "@/models/notification.types";

export const QUIET_HOURS_DAYS: readonly QuietHoursDay[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

const DEFAULT_CUSTOM_DAYS: QuietHoursDay[] = [...QUIET_HOURS_DAYS];

const MINUTES_IN_DAY = 24 * 60;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const dayOrder: Record<QuietHoursDay, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export const QUIET_HOURS_DAY_LABELS: Record<QuietHoursDay, string> = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

const ensureValidTime = (value: string): string => {
  if (TIME_PATTERN.test(value)) {
    return value;
  }

  return "00:00";
};

const parseTimeToMinutes = (value: string): number => {
  const sanitized = ensureValidTime(value);
  const [hourText, minuteText] = sanitized.split(":");
  const hours = Number(hourText);
  const minutes = Number(minuteText);
  return hours * 60 + minutes;
};

const getDayFromDate = (date: Date): QuietHoursDay => {
  const index = date.getDay();
  return QUIET_HOURS_DAYS[index] ?? "sun";
};

const cloneWithTime = (source: Date, minutes: number): Date => {
  const clone = new Date(source.getTime());
  clone.setSeconds(0, 0);
  clone.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return clone;
};

const addDays = (date: Date, days: number): Date => {
  const clone = new Date(date.getTime());
  clone.setDate(clone.getDate() + days);
  return clone;
};

export const getPresetDays = (preset: QuietHoursPreset): QuietHoursDay[] => {
  switch (preset) {
    case "weeknights":
      return ["sun", "mon", "tue", "wed", "thu"];
    case "weekends":
      return ["fri", "sat"];
    case "everyday":
      return [...QUIET_HOURS_DAYS];
    case "custom":
    default:
      return [...DEFAULT_CUSTOM_DAYS];
  }
};

export const createDefaultQuietHoursConfig = (
  preset: QuietHoursPreset = "weeknights",
): QuietHoursConfig => ({
  enabled: false,
  start: "22:00",
  end: "07:00",
  preset,
  days: preset === "custom" ? [...DEFAULT_CUSTOM_DAYS] : getPresetDays(preset),
});

export const normalizeQuietHoursConfig = (
  config: QuietHoursConfig,
): QuietHoursConfig => {
  const sanitizedStart = ensureValidTime(config.start);
  const sanitizedEnd = ensureValidTime(config.end);
  const uniqueDays = Array.from(new Set(config.days)).filter(
    (day): day is QuietHoursDay => QUIET_HOURS_DAYS.includes(day),
  );

  uniqueDays.sort((left, right) => dayOrder[left] - dayOrder[right]);

  return {
    ...config,
    start: sanitizedStart,
    end: sanitizedEnd,
    days: uniqueDays.length > 0 ? uniqueDays : getPresetDays(config.preset),
  };
};

const getMinutesOfDay = (date: Date): number =>
  date.getHours() * 60 + date.getMinutes();

export const isQuietHoursActive = (
  config: QuietHoursConfig,
  reference: Date = new Date(),
): boolean => {
  if (!config.enabled) {
    return false;
  }

  const normalized = normalizeQuietHoursConfig(config);
  if (normalized.days.length === 0) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(normalized.start);
  const endMinutes = parseTimeToMinutes(normalized.end);
  const currentMinutes = getMinutesOfDay(reference);

  const today = getDayFromDate(reference);
  const yesterday = getDayFromDate(addDays(reference, -1));

  if (startMinutes === endMinutes) {
    return normalized.days.includes(today);
  }

  if (startMinutes < endMinutes) {
    return (
      normalized.days.includes(today) &&
      currentMinutes >= startMinutes &&
      currentMinutes < endMinutes
    );
  }

  const isLateDay =
    normalized.days.includes(today) && currentMinutes >= startMinutes;
  const isEarlyDay =
    normalized.days.includes(yesterday) && currentMinutes < endMinutes;

  return isLateDay || isEarlyDay;
};

export const getNextQuietHoursEnd = (
  config: QuietHoursConfig,
  reference: Date = new Date(),
): Date | null => {
  if (!isQuietHoursActive(config, reference)) {
    return null;
  }

  const normalized = normalizeQuietHoursConfig(config);
  const startMinutes = parseTimeToMinutes(normalized.start);
  const endMinutes = parseTimeToMinutes(normalized.end);
  const currentMinutes = getMinutesOfDay(reference);

  if (startMinutes === endMinutes) {
    // Quiet hours cover entire configured days. End at the start minute of the next eligible day.
    const result = cloneWithTime(reference, endMinutes);
    result.setTime(result.getTime() + MINUTES_IN_DAY * 60 * 1000);
    return result;
  }

  if (startMinutes < endMinutes) {
    const todayEnd = cloneWithTime(reference, endMinutes);
    if (todayEnd <= reference) {
      return addDays(todayEnd, 1);
    }
    return todayEnd;
  }

  const endToday = cloneWithTime(reference, endMinutes);
  if (currentMinutes < endMinutes) {
    if (endToday <= reference) {
      return addDays(endToday, 1);
    }
    return endToday;
  }

  return addDays(endToday, 1);
};

export const formatQuietHoursRange = (config: QuietHoursConfig): string =>
  `${ensureValidTime(config.start)} – ${ensureValidTime(config.end)}`;

export const getCategoryFriendlyName = (
  category: NotificationCategory,
): string => {
  switch (category) {
    case "downloads":
      return "Downloads";
    case "failures":
      return "Failures";
    case "requests":
      return "Requests";
    case "serviceHealth":
      return "Service health";
    default:
      return "Notifications";
  }
};
