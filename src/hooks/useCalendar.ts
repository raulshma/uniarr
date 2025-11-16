import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  CalendarState,
  CalendarView,
  CalendarFilters,
  MediaRelease,
  CalendarDay,
  CalendarWeek,
  CalendarMonth,
  CalendarRange,
  CalendarStats,
  CalendarNavigation,
  MediaType,
  ReleaseStatus,
} from "@/models/calendar.types";

import { queryKeys } from "@/hooks/queryKeys";
import { QUERY_CONFIG } from "@/hooks/queryConfig";
import {
  useSettingsStore,
  selectLastCalendarView,
  selectLastCalendarRange,
} from "@/store/settingsStore";
import { validateDateString } from "@/utils/calendar.utils";
import { CalendarService } from "@/services/calendar/CalendarService";

export interface UseCalendarReturn {
  state: CalendarState & { isLoading: boolean; error?: string };
  calendarData: CalendarMonth | CalendarWeek | CalendarDay | CalendarRange;
  stats: CalendarStats;
  navigation: CalendarNavigation;
  releases: MediaRelease[];
  setView: (view: CalendarView) => void;
  setCurrentDate: (date: string) => void;
  setSelectedDate: (date?: string) => void;
  setFilters: (filters: Partial<CalendarFilters>) => void;
  clearFilters: () => void;
  goToToday: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
  goToDate: (date: string) => void;
}

const DEFAULT_FILTERS: CalendarFilters = {
  mediaTypes: ["movie", "series", "episode"],
  statuses: ["upcoming", "released"],
  services: [],
  serviceTypes: [],
  monitoredStatus: "all",
};

const DEFAULT_STATE: CalendarState = {
  currentDate: new Date().toISOString().split("T")[0]!,
  view: "week",
  filters: { ...DEFAULT_FILTERS },
  isLoading: false,
};

/**
 * Hook for managing calendar state and data
 */
export const useCalendar = (): UseCalendarReturn => {
  const lastCalendarView = useSettingsStore(selectLastCalendarView);
  const lastCalendarRange = useSettingsStore(selectLastCalendarRange);
  const setLastCalendarView = useSettingsStore((s) => s.setLastCalendarView);
  const setLastCalendarRange = useSettingsStore((s) => s.setLastCalendarRange);

  const [state, setState] = useState<CalendarState>(() => {
    const baseFilters: CalendarFilters = { ...DEFAULT_FILTERS };

    if (lastCalendarRange?.start && lastCalendarRange?.end) {
      return {
        ...DEFAULT_STATE,
        currentDate: lastCalendarRange.start,
        view: "custom",
        filters: {
          ...baseFilters,
          dateRange: { ...lastCalendarRange },
        },
      };
    }

    return {
      ...DEFAULT_STATE,
      view: lastCalendarView ?? DEFAULT_STATE.view,
      filters: baseFilters,
    };
  });

  // Fetch releases from calendar service
  const {
    data: releases = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.calendar.releases(
      state.currentDate,
      state.filters as any,
    ),
    queryFn: async (): Promise<MediaRelease[]> => {
      const calendarService = CalendarService.getInstance();
      return calendarService.getReleases(state.filters);
    },
    ...QUERY_CONFIG.CALENDAR,
  });

  const updateState = useCallback((updates: Partial<CalendarState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setView = useCallback(
    (view: CalendarView) => {
      updateState({ view });
      // Persist last selected view so next time the calendar opens it honors user's choice
      try {
        setLastCalendarView(view);
      } catch (err) {
        // Fail silently - persistence shouldn't break the UI

        console.warn("Failed to persist last calendar view", err);
      }
    },
    [updateState, setLastCalendarView],
  );

  const setCurrentDate = useCallback(
    (date: string) => {
      if (!validateDateString(date)) {
        console.warn("Invalid date string provided to setCurrentDate:", date);
        return;
      }
      updateState({ currentDate: date });
    },
    [updateState],
  );

  const setSelectedDate = useCallback(
    (date?: string) => {
      if (date && !validateDateString(date)) {
        console.warn("Invalid date string provided to setSelectedDate:", date);
        return;
      }
      updateState({ selectedDate: date });
    },
    [updateState],
  );

  const setFilters = useCallback(
    (filters: Partial<CalendarFilters>) => {
      setState((prev) => {
        const nextFilters = { ...prev.filters, ...filters };
        return { ...prev, filters: nextFilters };
      });

      if (Object.prototype.hasOwnProperty.call(filters, "dateRange")) {
        const range = filters.dateRange;
        if (range && range.start && range.end) {
          setLastCalendarRange({
            start: range.start,
            end: range.end,
          });
        } else {
          setLastCalendarRange(undefined);
        }
      }
    },
    [setLastCalendarRange],
  );

  const clearFilters = useCallback(() => {
    updateState({ filters: { ...DEFAULT_FILTERS } });
    setLastCalendarRange(undefined);
  }, [updateState, setLastCalendarRange]);

  const goToToday = useCallback(() => {
    const today = new Date().toISOString().split("T")[0]!;
    setCurrentDate(today);
    setSelectedDate(today);
  }, [setCurrentDate, setSelectedDate]);

  const goToPrevious = useCallback(() => {
    const current = new Date(state.currentDate);
    const newDate = new Date(current);

    switch (state.view) {
      case "month":
        newDate.setMonth(current.getMonth() - 1);
        break;
      case "week":
        newDate.setDate(current.getDate() - 7);
        break;
      case "day":
        newDate.setDate(current.getDate() - 1);
        break;
    }

    setCurrentDate(newDate.toISOString().split("T")[0]!);
  }, [state.currentDate, state.view, setCurrentDate]);

  const goToNext = useCallback(() => {
    const current = new Date(state.currentDate);
    const newDate = new Date(current);

    switch (state.view) {
      case "month":
        newDate.setMonth(current.getMonth() + 1);
        break;
      case "week":
        newDate.setDate(current.getDate() + 7);
        break;
      case "day":
        newDate.setDate(current.getDate() + 1);
        break;
    }

    setCurrentDate(newDate.toISOString().split("T")[0]!);
  }, [state.currentDate, state.view, setCurrentDate]);

  const goToDate = useCallback(
    (date: string) => {
      setCurrentDate(date);
      setSelectedDate(date);
    },
    [setCurrentDate, setSelectedDate],
  );

  // Calendar data computation
  const calendarData = useMemo(() => {
    return generateCalendarData(
      state.currentDate,
      state.view,
      releases,
      state.filters.dateRange,
    );
  }, [state.currentDate, state.view, releases, state.filters.dateRange]);

  // Statistics computation
  const stats = useMemo((): CalendarStats => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const byType: Record<MediaType, number> = {
      movie: 0,
      series: 0,
      episode: 0,
    };

    const byStatus: Record<ReleaseStatus, number> = {
      upcoming: 0,
      released: 0,
      delayed: 0,
      cancelled: 0,
    };

    let upcomingReleases = 0;
    let releasedThisWeek = 0;
    let monitoredReleases = 0;

    releases.forEach((release) => {
      byType[release.type]++;
      byStatus[release.status]++;

      if (release.status === "upcoming") {
        upcomingReleases++;
      }

      if (release.status === "released") {
        const releaseDate = new Date(release.releaseDate);
        if (releaseDate >= weekStart && releaseDate <= weekEnd) {
          releasedThisWeek++;
        }
      }

      if (release.monitored) {
        monitoredReleases++;
      }
    });

    return {
      totalReleases: releases.length,
      upcomingReleases,
      releasedThisWeek,
      monitoredReleases,
      byType,
      byStatus,
    };
  }, [releases]);

  // Navigation helpers
  const navigation: CalendarNavigation = useMemo(() => {
    const current = new Date(state.currentDate);
    let currentPeriod: string;

    switch (state.view) {
      case "month":
        currentPeriod = current.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
        break;
      case "week":
        const weekStart = new Date(current);
        weekStart.setDate(current.getDate() - current.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        currentPeriod = `Week of ${weekStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}`;
        break;
      case "day":
        currentPeriod = current.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        break;
      default:
        currentPeriod = current.toLocaleDateString();
    }

    return {
      canGoBack: true, // Always true for now
      canGoForward: true, // Always true for now
      currentPeriod,
      goToPrevious,
      goToNext,
      goToToday,
      goToDate,
    };
  }, [
    state.currentDate,
    state.view,
    goToPrevious,
    goToNext,
    goToToday,
    goToDate,
  ]);

  return {
    // State
    state: { ...state, isLoading, error: error?.message },
    calendarData,
    stats,
    navigation,
    releases,

    // Actions
    setView,
    setCurrentDate,
    setSelectedDate,
    setFilters,
    clearFilters,
    goToToday,
    goToPrevious,
    goToNext,
    goToDate,
  };
};

// Helper functions for calendar data generation

function generateCalendarData(
  currentDate: string,
  view: CalendarView,
  releases: MediaRelease[],
  dateRange?: { start: string; end: string },
): CalendarMonth | CalendarWeek | CalendarDay | CalendarRange {
  const current = new Date(currentDate);

  switch (view) {
    case "month":
      return generateMonthData(current, releases);
    case "week":
      return generateWeekData(current, releases);
    case "day":
      return generateDayData(current, releases);
    case "custom":
      if (dateRange) {
        return generateRangeData(dateRange.start, dateRange.end, releases);
      }
      return generateMonthData(current, releases);
    default:
      return generateMonthData(current, releases);
  }
}

function generateRangeData(
  startDate: string,
  endDate: string,
  releases: MediaRelease[],
): CalendarRange {
  const rangeReleases = releases.filter((release) => {
    return release.releaseDate >= startDate && release.releaseDate <= endDate;
  });

  return {
    startDate,
    endDate,
    releases: rangeReleases.sort(
      (a, b) =>
        new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime(),
    ),
  };
}

function generateMonthData(
  current: Date,
  releases: MediaRelease[],
): CalendarMonth {
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOfWeek = new Date(firstDay);
  startOfWeek.setDate(firstDay.getDate() - firstDay.getDay());

  const weeks: CalendarWeek[] = [];
  let currentWeek = new Date(startOfWeek);

  while (currentWeek <= lastDay) {
    const weekNumber = Math.ceil(
      (currentWeek.getDate() + firstDay.getDay()) / 7,
    );
    const days: CalendarDay[] = [];

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(currentWeek);
      dayDate.setDate(currentWeek.getDate() + i);
      const dateStr = dayDate.toISOString().split("T")[0]!;

      const dayReleases = releases.filter(
        (release) => release.releaseDate === dateStr,
      );

      days.push({
        date: dateStr,
        isCurrentMonth: dayDate.getMonth() === month,
        isToday: dateStr === new Date().toISOString().split("T")[0]!,
        isSelected: false, // Will be set by parent component
        releases: dayReleases,
      });
    }

    weeks.push({
      weekNumber,
      year,
      days,
    });

    currentWeek.setDate(currentWeek.getDate() + 7);
  }

  const totalReleases = releases.filter((release) => {
    const releaseDate = new Date(release.releaseDate);
    return (
      releaseDate.getMonth() === month && releaseDate.getFullYear() === year
    );
  }).length;

  return {
    year,
    month: month + 1,
    weeks,
    totalReleases,
  };
}

function generateWeekData(
  current: Date,
  releases: MediaRelease[],
): CalendarWeek {
  const startOfWeek = new Date(current);
  startOfWeek.setDate(current.getDate() - current.getDay());

  const days: CalendarDay[] = [];

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(startOfWeek);
    dayDate.setDate(startOfWeek.getDate() + i);
    const dateStr = dayDate.toISOString().split("T")[0]!;

    const dayReleases = releases.filter(
      (release) => release.releaseDate === dateStr,
    );

    days.push({
      date: dateStr,
      isCurrentMonth: true,
      isToday: dateStr === new Date().toISOString().split("T")[0]!,
      isSelected: false,
      releases: dayReleases,
    });
  }

  return {
    weekNumber: Math.ceil(
      (startOfWeek.getDate() +
        new Date(startOfWeek.getFullYear(), 0, 1).getDay()) /
        7,
    ),
    year: startOfWeek.getFullYear(),
    days,
  };
}

function generateDayData(current: Date, releases: MediaRelease[]): CalendarDay {
  const dateStr = current.toISOString().split("T")[0]!;
  const dayReleases = releases.filter(
    (release) => release.releaseDate === dateStr,
  );

  return {
    date: dateStr,
    isCurrentMonth: true,
    isToday: dateStr === new Date().toISOString().split("T")[0]!,
    isSelected: false,
    releases: dayReleases,
  };
}
