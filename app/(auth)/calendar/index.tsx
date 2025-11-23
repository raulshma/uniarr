import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInDown,
  SlideOutUp,
} from "react-native-reanimated";
import {
  Button,
  Chip,
  IconButton,
  Searchbar,
  Text,
  useTheme,
} from "react-native-paper";
import {
  differenceInCalendarDays,
  format,
  formatRelative,
  isAfter,
  parseISO,
} from "date-fns";

import {
  CalendarDayView,
  CalendarMonthView,
  CalendarStats,
  CalendarWeekView,
  EnhancedCalendarHeader,
  MediaReleaseCard,
} from "@/components/calendar";
import {
  AnimatedSection,
  AnimatedView,
} from "@/components/common/AnimatedComponents";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { LoadingState } from "@/components/common/LoadingState";
import BottomDrawer from "@/components/common/BottomDrawer";
import type { AppTheme } from "@/constants/theme";
import { useCalendar } from "@/hooks/useCalendar";
import { useImagePrefetch } from "@/hooks/useImagePrefetch";
import type {
  CalendarDay,
  CalendarFilters,
  CalendarMonth,
  CalendarRange,
  CalendarServiceType,
  CalendarWeek,
  MediaRelease,
  MediaType,
  ReleaseStatus,
} from "@/models/calendar.types";
import { logger } from "@/services/logger/LoggerService";
import { secureStorage } from "@/services/storage/SecureStorage";
import { validateDateString } from "@/utils/calendar.utils";

type DateField = "start" | "end";
type ServiceOption = {
  id: string;
  name: string;
  type: CalendarServiceType;
};
type AgendaSection = {
  date: string;
  releases: MediaRelease[];
};

type QuickRangeOption = {
  label: string;
  days: number;
};

const ALL_MEDIA_TYPES: MediaType[] = ["movie", "series", "episode"];
const ALL_STATUSES: ReleaseStatus[] = [
  "upcoming",
  "released",
  "delayed",
  "cancelled",
];
const DEFAULT_STATUSES: ReleaseStatus[] = ["upcoming", "released"];
const SERVICE_TYPES: CalendarServiceType[] = ["sonarr", "radarr", "jellyseerr"];

const QUICK_RANGES: QuickRangeOption[] = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  movie: "Movies",
  series: "Series",
  episode: "Episodes",
};

const STATUS_LABELS: Record<ReleaseStatus, string> = {
  upcoming: "Upcoming",
  released: "Released",
  delayed: "Delayed",
  cancelled: "Cancelled",
};

const SERVICE_TYPE_LABELS: Record<CalendarServiceType, string> = {
  sonarr: "Sonarr",
  radarr: "Radarr",
  jellyseerr: "Jellyseerr",
};

const cloneFilters = (filters: CalendarFilters): CalendarFilters => ({
  ...filters,
  mediaTypes: [...filters.mediaTypes],
  statuses: [...filters.statuses],
  services: [...filters.services],
  serviceTypes: [...filters.serviceTypes],
  dateRange: filters.dateRange ? { ...filters.dateRange } : undefined,
  searchQuery: filters.searchQuery,
});

const CalendarScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const localSearchParams = useLocalSearchParams<{ date?: string }>();
  const {
    state,
    calendarData,
    stats,
    navigation,
    releases,
    setView,
    setCurrentDate,
    setSelectedDate,
    setFilters,
    clearFilters,
    goToToday,
    goToDate,
  } = useCalendar();

  const [isFilterDrawerVisible, setIsFilterDrawerVisible] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<CalendarFilters>(() =>
    cloneFilters(state.filters),
  );
  const [activeDateField, setActiveDateField] = useState<DateField | null>(
    null,
  );
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [searchText, setSearchText] = useState(state.filters.searchQuery ?? "");
  const [activeQuickRange, setActiveQuickRange] = useState<number | null>(null);
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const configs = await secureStorage.getServiceConfigs();
        if (!isMounted) return;
        const enabled = configs.filter((config) => config.enabled);
        setServiceOptions(
          enabled.map((config) => ({
            id: config.id,
            name: config.name,
            type: config.type as CalendarServiceType,
          })),
        );
      } catch (error) {
        void logger.warn("calendar.loadServiceOptions.failed", {
          location: "CalendarScreen",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (localSearchParams.date && validateDateString(localSearchParams.date)) {
      goToDate(localSearchParams.date);
    }
  }, [localSearchParams.date, goToDate]);

  useEffect(() => {
    if (isFilterDrawerVisible) {
      setPendingFilters(cloneFilters(state.filters));
    }
  }, [isFilterDrawerVisible, state.filters]);

  useEffect(() => {
    setSearchText(state.filters.searchQuery ?? "");
    if (state.filters.searchQuery) {
      setIsSearchVisible(true);
    }
  }, [state.filters.searchQuery]);

  useEffect(() => {
    const range = state.filters.dateRange;
    if (!range) {
      setActiveQuickRange(null);
      return;
    }
    const start = parseISO(range.start);
    const end = parseISO(range.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setActiveQuickRange(null);
      return;
    }
    const diff = differenceInCalendarDays(end, start) + 1;
    setActiveQuickRange(diff > 0 ? diff : null);
  }, [state.filters.dateRange]);

  // Prefetch poster images for visible releases
  useImagePrefetch(
    (index: number) => {
      const release = releasesForView[index];
      return release?.posterUrl ?? release?.backdropUrl;
    },
    {
      prefetchRange: { before: 2, after: 5 },
      priority: "low",
      maxConcurrent: 2,
    },
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        listContent: {
          paddingBottom: theme.custom.spacing.xl,
          paddingHorizontal: theme.custom.spacing.sm,
          gap: theme.custom.spacing.md,
        },
        headerContainer: {
          gap: theme.custom.spacing.sm,
          paddingTop: theme.custom.spacing.xs,
        },
        topBar: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: theme.custom.spacing.xs,
          marginBottom: theme.custom.spacing.xs,
        },
        headingText: {
          fontSize: theme.custom.typography.headlineMedium.fontSize,
          fontFamily: theme.custom.typography.headlineMedium.fontFamily,
          fontWeight: theme.custom.typography.headlineMedium.fontWeight as any,
          letterSpacing: theme.custom.typography.headlineMedium.letterSpacing,
          color: theme.colors.onBackground,
        },
        subheadingText: {
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
          letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
          color: theme.colors.onSurfaceVariant,
        },
        topBarActions: {
          flexDirection: "row",
          alignItems: "center",
        },
        searchContainer: {
          marginBottom: theme.custom.spacing.sm,
        },
        quickFiltersRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.custom.spacing.sm,
          alignItems: "center",
          paddingHorizontal: theme.custom.spacing.xs,
        },
        summaryScrollContent: {
          paddingVertical: theme.custom.spacing.xs,
          paddingHorizontal: theme.custom.spacing.xs,
          alignItems: "center",
        },
        summaryChip: {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: "transparent",
        },
        summaryChipSpacing: {
          marginRight: theme.custom.spacing.sm,
        },
        calendarCardWrapper: {
          borderRadius: 24,
          overflow: "hidden",
          backgroundColor: theme.colors.surface,
          // Subtle shadow for depth
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
          marginHorizontal: theme.custom.spacing.xs,
        },
        agendaSection: {
          gap: theme.custom.spacing.sm,
          marginTop: theme.custom.spacing.xs,
        },
        agendaHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          paddingHorizontal: theme.custom.spacing.xs,
        },
        agendaDate: {
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontFamily: theme.custom.typography.titleLarge.fontFamily,
          fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
          color: theme.colors.primary,
          letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
        },
        agendaMeta: {
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
          color: theme.colors.onSurfaceVariant,
        },
        agendaReleases: {
          gap: theme.custom.spacing.sm,
        },
        agendaCard: {
          borderRadius: 16,
          overflow: "hidden",
        },
        emptyWrapper: {
          paddingVertical: theme.custom.spacing.xl,
        },
        advancedFiltersChip: {
          alignSelf: "flex-start",
        },
        drawerContainer: {
          paddingHorizontal: theme.custom.spacing.lg,
          gap: theme.custom.spacing.lg,
        },
        drawerSection: {
          gap: theme.custom.spacing.sm,
        },
        drawerSectionTitle: {
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
          color: theme.colors.onSurface,
        },
        drawerChips: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.custom.spacing.sm,
        },
        dateRow: {
          flexDirection: "row",
          gap: theme.custom.spacing.sm,
        },
        dateField: {
          flex: 1,
          borderRadius: 16,
          paddingVertical: theme.custom.spacing.md,
          paddingHorizontal: theme.custom.spacing.md,
          backgroundColor: theme.colors.surfaceVariant,
          borderWidth: 1,
          borderColor: "transparent",
        },
        dateFieldActive: {
          borderColor: theme.colors.primary,
        },
        dateFieldLabel: {
          fontSize: theme.custom.typography.labelSmall.fontSize,
          fontFamily: theme.custom.typography.labelSmall.fontFamily,
          fontWeight: theme.custom.typography.labelSmall.fontWeight as any,
          color: theme.colors.onSurfaceVariant,
          marginBottom: theme.custom.spacing.xs,
        },
        drawerActions: {
          gap: theme.custom.spacing.sm,
        },
      }),
    [theme],
  );

  const handleReleasePress = useCallback(
    (releaseId: string) => {
      const release = releases.find((r) => r.id === releaseId);
      if (!release) {
        void logger.warn("calendar.releaseNotFound", { releaseId });
        return;
      }

      switch (release.type) {
        case "episode":
          if (release.serviceId && release.seriesId) {
            router.push(
              `/sonarr/${release.serviceId}/series/${release.seriesId}`,
            );
          }
          break;
        case "movie":
          if (release.serviceId && release.tmdbId) {
            router.push(
              `/radarr/${release.serviceId}/movies/${release.tmdbId}`,
            );
          }
          break;
        case "series":
          if (release.serviceId && release.seriesId) {
            router.push(
              `/sonarr/${release.serviceId}/series/${release.seriesId}`,
            );
          }
          break;
        default:
          break;
      }
    },
    [releases, router],
  );

  const handleRetry = useCallback(() => {
    goToToday();
  }, [goToToday]);

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchText(text);
      const trimmed = text.trim();
      setFilters({ searchQuery: trimmed.length > 0 ? trimmed : undefined });
    },
    [setFilters],
  );

  const handleDateSelect = useCallback(
    (date: string) => {
      setSelectedDate(date);
      setCurrentDate(date);
      setView("day");
    },
    [setCurrentDate, setSelectedDate, setView],
  );

  const handleQuickRangeSelect = useCallback(
    (days: number) => {
      const today = new Date();
      const start = format(today, "yyyy-MM-dd");
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + (days - 1));
      const end = format(endDate, "yyyy-MM-dd");
      setFilters({
        dateRange: {
          start,
          end,
        },
      });
      setCurrentDate(start);
      setSelectedDate(start);
      setView("custom");
    },
    [setFilters, setCurrentDate, setSelectedDate, setView],
  );

  const openFilters = useCallback(() => {
    setIsFilterDrawerVisible(true);
  }, []);

  const toggleSearch = useCallback(() => {
    setIsSearchVisible((prev) => {
      if (prev) {
        // Closing search, clear query
        setSearchText("");
        setFilters({ searchQuery: undefined });
      }
      return !prev;
    });
  }, [setFilters]);

  const releasesForView = useMemo(() => {
    if (!calendarData) {
      return [] as MediaRelease[];
    }

    if (state.view === "day" && "date" in calendarData) {
      return [...(calendarData as CalendarDay).releases];
    }

    if (state.view === "week" && "days" in calendarData) {
      return [
        ...(calendarData as CalendarWeek).days.flatMap((day) => day.releases),
      ];
    }

    if (state.view === "month" && "weeks" in calendarData) {
      const monthData = calendarData as CalendarMonth;
      return monthData.weeks
        .flatMap((week) => week.days)
        .filter((day) => day.isCurrentMonth)
        .flatMap((day) => day.releases);
    }

    if (state.view === "custom" && "startDate" in calendarData) {
      const rangeData = calendarData as CalendarRange;
      return [...rangeData.releases];
    }

    if (state.view === "custom") {
      return [...releases];
    }

    if ("releases" in calendarData && calendarData.releases) {
      return [...calendarData.releases];
    }

    return [] as MediaRelease[];
  }, [calendarData, releases, state.view]);

  const subheadingLabel = useMemo(() => {
    if (releasesForView.length === 0) {
      return "No releases";
    }
    return `${releasesForView.length} release${
      releasesForView.length === 1 ? "" : "s"
    }`;
  }, [releasesForView.length]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (state.filters.mediaTypes.length !== ALL_MEDIA_TYPES.length) count++;

    const defaultStatuses = new Set(DEFAULT_STATUSES);
    const sameAsDefault =
      state.filters.statuses.length === DEFAULT_STATUSES.length &&
      state.filters.statuses.every((status) => defaultStatuses.has(status));
    if (!sameAsDefault) count++;

    if (state.filters.serviceTypes.length) count++;
    if (state.filters.services.length) count++;
    if (state.filters.monitoredStatus !== "all") count++;
    if (state.filters.dateRange) count++;
    if (state.filters.searchQuery) count++;
    return count;
  }, [state.filters]);

  const filterSummaryItems = useMemo(() => {
    const items: {
      key: string;
      label: string;
      icon: string;
      selected: boolean;
    }[] = [];

    const statusesActive =
      state.filters.statuses.length !== ALL_STATUSES.length;
    const statusLabel = statusesActive
      ? `Status • ${state.filters.statuses
          .map((status) => STATUS_LABELS[status])
          .join(", ")}`
      : "Status • All";
    items.push({
      key: "statuses",
      label: statusLabel,
      icon: "flag-variant",
      selected: statusesActive,
    });

    const mediaActive =
      state.filters.mediaTypes.length !== ALL_MEDIA_TYPES.length;
    const mediaLabel = mediaActive
      ? `Media • ${state.filters.mediaTypes
          .map((type) => MEDIA_TYPE_LABELS[type])
          .join(", ")}`
      : "Media • All";
    items.push({
      key: "media",
      label: mediaLabel,
      icon: "movie-open",
      selected: mediaActive,
    });

    const serviceTypeActive = state.filters.serviceTypes.length > 0;
    const serviceTypeLabel = serviceTypeActive
      ? `Sources • ${state.filters.serviceTypes
          .map((type) => SERVICE_TYPE_LABELS[type])
          .join(", ")}`
      : "Sources • Any";
    items.push({
      key: "serviceTypes",
      label: serviceTypeLabel,
      icon: "database",
      selected: serviceTypeActive,
    });

    const servicesActive = state.filters.services.length > 0;
    const selectedServices = state.filters.services
      .map((id) => serviceOptions.find((service) => service.id === id)?.name)
      .filter(Boolean) as string[];
    let servicesLabel = "Services • All";
    if (servicesActive) {
      const preview = selectedServices.slice(0, 2).join(", ");
      const remainder = selectedServices.length - 2;
      servicesLabel =
        remainder > 0
          ? `Services • ${preview} +${remainder}`
          : `Services • ${preview}`;
    }
    items.push({
      key: "services",
      label: servicesLabel,
      icon: "server",
      selected: servicesActive,
    });

    const monitoredActive = state.filters.monitoredStatus !== "all";
    const monitoredLabel = monitoredActive
      ? state.filters.monitoredStatus === "monitored"
        ? "Monitoring • Monitored"
        : "Monitoring • Unmonitored"
      : "Monitoring • Any";
    items.push({
      key: "monitored",
      label: monitoredLabel,
      icon: "eye",
      selected: monitoredActive,
    });

    const rangeActive = Boolean(state.filters.dateRange);
    const rangeLabel =
      rangeActive && state.filters.dateRange
        ? (() => {
            const { start, end } = state.filters.dateRange;
            const formattedStart = format(parseISO(start), "MMM d");
            const formattedEnd = format(parseISO(end), "MMM d");
            return `Range • ${formattedStart} → ${formattedEnd}`;
          })()
        : "Range • Any";
    items.push({
      key: "range",
      label: rangeLabel,
      icon: "calendar-range",
      selected: rangeActive,
    });

    return items;
  }, [serviceOptions, state.filters]);

  const agendaSections = useMemo<AgendaSection[]>(() => {
    const map = new Map<string, MediaRelease[]>();
    releasesForView.forEach((release) => {
      const existing = map.get(release.releaseDate) ?? [];
      existing.push(release);
      map.set(release.releaseDate, existing);
    });

    const sortedDates = Array.from(map.keys()).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );

    return sortedDates.map((date) => ({
      date,
      releases: (map.get(date) ?? [])
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title)),
    }));
  }, [releasesForView]);

  const renderCalendarSurface = useMemo(() => {
    if (!calendarData) return null;

    if (state.view === "day" && "date" in calendarData) {
      return (
        <CalendarDayView
          data={calendarData as CalendarDay}
          onReleasePress={handleReleasePress}
        />
      );
    }

    if (state.view === "week" && "days" in calendarData) {
      return (
        <CalendarWeekView
          data={calendarData as CalendarWeek}
          selectedDate={state.selectedDate}
          onDateSelect={handleDateSelect}
          onReleasePress={handleReleasePress}
        />
      );
    }

    if (state.view === "custom" && "startDate" in calendarData) {
      // For custom range view, use agenda-style rendering (handled by FlashList below)
      return null;
    }

    if ("weeks" in calendarData) {
      return (
        <CalendarMonthView
          data={calendarData as CalendarMonth}
          selectedDate={state.selectedDate}
          onDateSelect={handleDateSelect}
          onReleasePress={handleReleasePress}
        />
      );
    }

    return null;
  }, [
    calendarData,
    state.view,
    state.selectedDate,
    handleDateSelect,
    handleReleasePress,
  ]);

  const renderAgendaSection = useCallback(
    ({ item, index }: ListRenderItemInfo<AgendaSection>) => {
      const dateObj = parseISO(item.date);
      const formattedDate = format(dateObj, "EEEE, MMM d");
      const relative = formatRelative(dateObj, new Date());
      const countLabel = `${item.releases.length} release${
        item.releases.length === 1 ? "" : "s"
      }`;

      return (
        <AnimatedSection style={styles.agendaSection} delay={index * 30}>
          <View style={styles.agendaHeader}>
            <Text style={styles.agendaDate}>{formattedDate}</Text>
            <Text style={styles.agendaMeta}>
              {relative} • {countLabel}
            </Text>
          </View>

          <View style={styles.agendaReleases}>
            {item.releases.map((release, releaseIndex) => (
              <Animated.View
                key={release.id}
                entering={FadeIn.duration(220)
                  .withInitialValues({
                    opacity: 0,
                    transform: [{ scale: 0.94 }],
                  })
                  .delay(releaseIndex * 30)}
                exiting={FadeOut.duration(160)}
                layout={LinearTransition.springify().stiffness(320).damping(28)}
                style={styles.agendaCard}
              >
                <MediaReleaseCard
                  release={release}
                  onPress={() => handleReleasePress(release.id)}
                  compact
                  animated={false}
                />
              </Animated.View>
            ))}
          </View>
        </AnimatedSection>
      );
    },
    [handleReleasePress, styles],
  );

  const listHeader = useMemo(
    () => (
      <AnimatedView
        entering={FadeIn.duration(220)}
        style={styles.headerContainer}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.headingText}>Calendar</Text>
            <Text style={styles.subheadingText}>{subheadingLabel}</Text>
          </View>
          <View style={styles.topBarActions}>
            <IconButton
              icon={isSearchVisible ? "magnify-minus" : "magnify"}
              onPress={toggleSearch}
              iconColor={
                isSearchVisible
                  ? theme.colors.primary
                  : theme.colors.onSurfaceVariant
              }
            />
            <IconButton
              icon="filter-variant"
              onPress={openFilters}
              iconColor={
                activeFilterCount > 0
                  ? theme.colors.primary
                  : theme.colors.onSurfaceVariant
              }
            />
          </View>
        </View>

        {isSearchVisible && (
          <Animated.View
            entering={SlideInDown.duration(200)}
            exiting={SlideOutUp.duration(200)}
            style={styles.searchContainer}
          >
            <Searchbar
              value={searchText}
              onChangeText={handleSearchChange}
              placeholder="Search releases..."
              inputStyle={{
                fontSize: theme.custom.typography.bodyMedium.fontSize,
              }}
              iconColor={theme.colors.onSurfaceVariant}
              elevation={0}
              style={{ backgroundColor: theme.colors.surfaceVariant }}
            />
          </Animated.View>
        )}

        <EnhancedCalendarHeader
          navigation={navigation}
          view={state.view}
          currentDate={state.currentDate}
          onViewChange={setView}
          style={{
            backgroundColor: "transparent",
            elevation: 0,
            shadowOpacity: 0,
            marginBottom: theme.custom.spacing.xs,
            paddingHorizontal: theme.custom.spacing.none,
            paddingVertical: theme.custom.spacing.none,
          }}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryScrollContent}
        >
          {QUICK_RANGES.map((option) => (
            <Chip
              key={option.days}
              compact
              selected={activeQuickRange === option.days}
              onPress={() => handleQuickRangeSelect(option.days)}
              style={[styles.summaryChip, styles.summaryChipSpacing]}
            >
              {option.label}
            </Chip>
          ))}
          {filterSummaryItems.map((item) => (
            <Chip
              key={item.key}
              compact
              icon={item.icon}
              selected={item.selected}
              onPress={openFilters}
              style={[styles.summaryChip, styles.summaryChipSpacing]}
            >
              {item.label}
            </Chip>
          ))}
        </ScrollView>

        <CalendarStats stats={stats} shouldAnimateLayout={!state.isLoading} />

        <Animated.View
          layout={LinearTransition.springify().stiffness(340).damping(30)}
          style={styles.calendarCardWrapper}
        >
          {renderCalendarSurface}
        </Animated.View>
      </AnimatedView>
    ),
    [
      activeFilterCount,
      activeQuickRange,
      filterSummaryItems,
      handleQuickRangeSelect,
      handleSearchChange,
      isSearchVisible,
      navigation,
      openFilters,
      renderCalendarSurface,
      searchText,
      setView,
      state.currentDate,
      state.isLoading,
      state.view,
      stats,
      styles,
      subheadingLabel,
      theme.colors.onSurfaceVariant,
      theme.colors.primary,
      theme.colors.surfaceVariant,
      theme.custom.spacing.none,
      theme.custom.spacing.xs,
      theme.custom.typography.bodyMedium.fontSize,
      toggleSearch,
    ],
  );

  const listEmptyComponent = useMemo(() => {
    if (state.isLoading) {
      return (
        <View style={styles.emptyWrapper}>
          <LoadingState message="Loading calendar..." />
        </View>
      );
    }

    if (state.error) {
      return (
        <View style={styles.emptyWrapper}>
          <EmptyState
            title="Unable to load calendar"
            description={state.error}
            actionLabel="Retry"
            onActionPress={handleRetry}
          />
        </View>
      );
    }

    return (
      <View style={styles.emptyWrapper}>
        <EmptyState
          title="No releases found"
          description="Try adjusting your filters or check back later."
          actionLabel="Reset filters"
          onActionPress={() => {
            clearFilters();
            setSelectedDate(undefined);
          }}
        />
      </View>
    );
  }, [
    state.isLoading,
    state.error,
    styles.emptyWrapper,
    handleRetry,
    clearFilters,
    setSelectedDate,
  ]);

  const closeFilters = useCallback(() => {
    setIsFilterDrawerVisible(false);
    setActiveDateField(null);
  }, []);

  const handleDateFieldPress = useCallback((field: DateField) => {
    setActiveDateField(field);
  }, []);

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (event.type === "dismissed") {
        setActiveDateField(null);
        return;
      }

      if (selectedDate && activeDateField) {
        const iso = format(selectedDate, "yyyy-MM-dd");
        setPendingFilters((prev) => {
          const currentRange = prev.dateRange ?? {
            start: iso,
            end: iso,
          };

          const nextRange =
            activeDateField === "start"
              ? { start: iso, end: currentRange.end ?? iso }
              : { start: currentRange.start ?? iso, end: iso };

          return {
            ...prev,
            dateRange: nextRange,
          };
        });
      }

      setActiveDateField(null);
    },
    [activeDateField],
  );

  const formatDateFieldValue = useCallback((value?: string) => {
    if (!value) return "Select date";
    return format(parseISO(value), "MM/dd/yyyy");
  }, []);

  const applyFilters = useCallback(() => {
    const normalized: CalendarFilters = {
      ...pendingFilters,
      dateRange: pendingFilters.dateRange
        ? (() => {
            const { start, end } = pendingFilters.dateRange;
            if (start && end) {
              const startDate = parseISO(start);
              const endDate = parseISO(end);
              if (isAfter(startDate, endDate)) {
                return { start: end, end: start };
              }
            }
            return pendingFilters.dateRange;
          })()
        : undefined,
    };

    setFilters(normalized);
    if (normalized.dateRange?.start) {
      setCurrentDate(normalized.dateRange.start);
      setSelectedDate(normalized.dateRange.start);
      setView("custom");
    }
    closeFilters();
  }, [
    pendingFilters,
    setFilters,
    setCurrentDate,
    setSelectedDate,
    setView,
    closeFilters,
  ]);

  const resetFilters = useCallback(() => {
    clearFilters();
    setPendingFilters((prev) => ({
      ...prev,
      mediaTypes: [...ALL_MEDIA_TYPES],
      statuses: [...DEFAULT_STATUSES],
      services: [],
      serviceTypes: [],
      monitoredStatus: "all",
      dateRange: undefined,
      searchQuery: undefined,
    }));
    setSelectedDate(undefined);
    setView("month");
    closeFilters();
  }, [clearFilters, closeFilters, setSelectedDate, setView]);

  return (
    <SafeAreaView style={styles.container}>
      <ErrorBoundary>
        <FlashList<AgendaSection>
          data={agendaSections}
          renderItem={renderAgendaSection}
          keyExtractor={(item: AgendaSection) => item.date}
          estimatedItemSize={200}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={listEmptyComponent}
          showsVerticalScrollIndicator={false}
        />
      </ErrorBoundary>

      <BottomDrawer
        visible={isFilterDrawerVisible}
        onDismiss={closeFilters}
        title="Filter & Sort"
        maxHeight="80%"
      >
        <View style={styles.drawerContainer}>
          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionTitle}>Service Type</Text>
            <View style={styles.drawerChips}>
              {SERVICE_TYPES.map((type) => (
                <Chip
                  key={type}
                  compact
                  selected={pendingFilters.serviceTypes.includes(type)}
                  onPress={() =>
                    setPendingFilters((prev) => {
                      const existing = new Set(prev.serviceTypes);
                      if (existing.has(type)) {
                        existing.delete(type);
                      } else {
                        existing.add(type);
                      }
                      return {
                        ...prev,
                        serviceTypes: Array.from(existing),
                      };
                    })
                  }
                >
                  {SERVICE_TYPE_LABELS[type]}
                </Chip>
              ))}
            </View>
          </View>

          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionTitle}>Media Type</Text>
            <View style={styles.drawerChips}>
              {ALL_MEDIA_TYPES.map((type) => (
                <Chip
                  key={type}
                  compact
                  selected={pendingFilters.mediaTypes.includes(type)}
                  onPress={() =>
                    setPendingFilters((prev) => ({
                      ...prev,
                      mediaTypes: prev.mediaTypes.includes(type)
                        ? prev.mediaTypes.filter((t) => t !== type)
                        : [...prev.mediaTypes, type],
                    }))
                  }
                >
                  {MEDIA_TYPE_LABELS[type]}
                </Chip>
              ))}
            </View>
          </View>

          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionTitle}>Release Status</Text>
            <View style={styles.drawerChips}>
              {ALL_STATUSES.map((status) => (
                <Chip
                  key={status}
                  compact
                  selected={pendingFilters.statuses.includes(status)}
                  onPress={() =>
                    setPendingFilters((prev) => ({
                      ...prev,
                      statuses: prev.statuses.includes(status)
                        ? prev.statuses.filter((s) => s !== status)
                        : [...prev.statuses, status],
                    }))
                  }
                >
                  {STATUS_LABELS[status]}
                </Chip>
              ))}
            </View>
          </View>

          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionTitle}>Services</Text>
            <View style={styles.drawerChips}>
              {serviceOptions.map((service) => (
                <Chip
                  key={service.id}
                  compact
                  selected={pendingFilters.services.includes(service.id)}
                  onPress={() =>
                    setPendingFilters((prev) => ({
                      ...prev,
                      services: prev.services.includes(service.id)
                        ? prev.services.filter((id) => id !== service.id)
                        : [...prev.services, service.id],
                    }))
                  }
                >
                  {service.name}
                </Chip>
              ))}
            </View>
          </View>

          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionTitle}>Monitored</Text>
            <View style={styles.drawerChips}>
              {(["all", "monitored", "unmonitored"] as const).map((value) => (
                <Chip
                  key={value}
                  compact
                  selected={pendingFilters.monitoredStatus === value}
                  onPress={() =>
                    setPendingFilters((prev) => ({
                      ...prev,
                      monitoredStatus: value,
                    }))
                  }
                >
                  {value === "all"
                    ? "Any"
                    : value === "monitored"
                      ? "Monitored"
                      : "Unmonitored"}
                </Chip>
              ))}
            </View>
          </View>

          <View style={styles.drawerSection}>
            <Text style={styles.drawerSectionTitle}>Date Range</Text>
            <View style={styles.dateRow}>
              <View
                style={[
                  styles.dateField,
                  activeDateField === "start" && styles.dateFieldActive,
                ]}
              >
                <Text style={styles.dateFieldLabel}>Start</Text>
                <Chip
                  compact
                  onPress={() => handleDateFieldPress("start")}
                  icon="calendar"
                >
                  {formatDateFieldValue(pendingFilters.dateRange?.start)}
                </Chip>
              </View>
              <View
                style={[
                  styles.dateField,
                  activeDateField === "end" && styles.dateFieldActive,
                ]}
              >
                <Text style={styles.dateFieldLabel}>End</Text>
                <Chip
                  compact
                  onPress={() => handleDateFieldPress("end")}
                  icon="calendar"
                >
                  {formatDateFieldValue(pendingFilters.dateRange?.end)}
                </Chip>
              </View>
            </View>
          </View>

          <View style={styles.drawerActions}>
            <Button mode="contained" onPress={applyFilters}>
              Apply filters
            </Button>
            <Button mode="text" onPress={resetFilters}>
              Clear all
            </Button>
          </View>
        </View>
      </BottomDrawer>

      {activeDateField ? (
        <DateTimePicker
          value={(() => {
            const current = pendingFilters.dateRange?.[activeDateField];
            if (!current) {
              return new Date();
            }
            const parsed = parseISO(current);
            return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
          })()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
        />
      ) : null}
    </SafeAreaView>
  );
};

export default CalendarScreen;
