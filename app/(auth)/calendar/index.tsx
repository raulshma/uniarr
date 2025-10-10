import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Button, Icon, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { FlashList } from "@shopify/flash-list";
import {
  format,
  isAfter,
  isSameMonth,
  isSameWeek,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
} from "date-fns";

import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import BottomDrawer from "@/components/common/BottomDrawer";
import { TabHeader } from "@/components/common/TabHeader";
import { MediaReleaseCard } from "@/components/calendar";
import { useCalendar } from "@/hooks/useCalendar";
import type { AppTheme } from "@/constants/theme";
import type {
  CalendarDay,
  CalendarFilters,
  CalendarMonth,
  CalendarServiceType,
  CalendarView,
  CalendarWeek,
  MediaRelease,
  MediaType,
  ReleaseStatus,
} from "@/models/calendar.types";

const ALL_MEDIA_TYPES: MediaType[] = ["movie", "series", "episode"];
const DEFAULT_STATUSES: ReleaseStatus[] = ["upcoming", "released"];
const SERVICE_TYPES: CalendarServiceType[] = ["sonarr", "radarr"];

type DateField = "start" | "end";

const cloneFilters = (filters: CalendarFilters): CalendarFilters => ({
  ...filters,
  mediaTypes: [...filters.mediaTypes],
  statuses: [...filters.statuses],
  services: [...filters.services],
  serviceTypes: [...(filters.serviceTypes ?? [])],
  dateRange: filters.dateRange ? { ...filters.dateRange } : undefined,
});

const CalendarScreen = () => {
  const theme = useTheme<AppTheme>();
  const {
    state,
    calendarData,
    navigation,
    releases,
    setView,
    setCurrentDate,
    setFilters,
    clearFilters,
    goToToday,
  } = useCalendar();

  const VIEW_SEGMENTS: Array<{ label: string; value: Extract<CalendarView, "day" | "week" | "month" | "custom"> }> = useMemo(() => [
    { label: "Day", value: "day" },
    { label: "Week", value: "week" },
    { label: "Month", value: "month" },
    ...(state.filters.dateRange ? [{ label: "Custom", value: "custom" as const }] : []),
  ], [state.filters.dateRange]);

  const [isFilterDrawerVisible, setIsFilterDrawerVisible] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<CalendarFilters>(() =>
    cloneFilters(state.filters)
  );
  const [activeDateField, setActiveDateField] = useState<DateField | null>(null);

  useEffect(() => {
    if (isFilterDrawerVisible) {
      setPendingFilters(cloneFilters(state.filters));
    }
  }, [isFilterDrawerVisible, state.filters]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContent: {
      paddingHorizontal: theme.custom.spacing.md,
      paddingBottom: theme.custom.spacing.md,
      gap: theme.custom.spacing.md,
    },
    segmentsRow: {
      flexDirection: "row",
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 28,
      padding: 4,
      gap: 4,
      alignSelf: "center",
      width: "90%",
    },
    segmentButton: {
      flex: 1,
      borderRadius: 24,
      paddingVertical: theme.custom.spacing.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentActive: {
      backgroundColor: theme.colors.primary,
    },
    segmentLabel: {
      fontSize: theme.custom.typography.labelLarge.fontSize,
      fontFamily: theme.custom.typography.labelLarge.fontFamily,
      fontWeight: theme.custom.typography.labelLarge.fontWeight as any,
      color: theme.colors.onSurfaceVariant,
      letterSpacing: theme.custom.typography.labelLarge.letterSpacing,
    },
    segmentLabelActive: {
      color: theme.colors.onPrimary,
    },
    sectionHeader: {
      paddingHorizontal: theme.custom.spacing.md,
    },
    headingText: {
      fontSize: theme.custom.typography.headlineSmall.fontSize,
      fontFamily: theme.custom.typography.headlineSmall.fontFamily,
      fontWeight: theme.custom.typography.headlineSmall.fontWeight as any,
      color: theme.colors.onBackground,
      letterSpacing: theme.custom.typography.headlineSmall.letterSpacing,
    },
    subheadingText: {
      marginTop: theme.custom.spacing.xs,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
      color: theme.colors.onSurfaceVariant,
      letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
    },
    filtersRow: {
      paddingHorizontal: theme.custom.spacing.md,
      marginTop: theme.custom.spacing.sm,
    },
    filtersButton: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: theme.custom.spacing.xs,
      paddingHorizontal: theme.custom.spacing.md,
      paddingVertical: theme.custom.spacing.sm,
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceVariant,
    },
    filtersButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    filtersButtonLabel: {
      fontSize: theme.custom.typography.labelLarge.fontSize,
      fontFamily: theme.custom.typography.labelLarge.fontFamily,
      fontWeight: theme.custom.typography.labelLarge.fontWeight as any,
      color: theme.colors.onSurfaceVariant,
    },
    filtersButtonLabelActive: {
      color: theme.colors.onPrimary,
    },
    listContent: {
      padding: theme.custom.spacing.md,
      paddingBottom: theme.custom.spacing.xl * 2,
      gap: theme.custom.spacing.sm,
    },
    emptyWrapper: {
      paddingHorizontal: theme.custom.spacing.md,
      paddingTop: theme.custom.spacing.lg,
    },
    drawerSection: {
      marginBottom: theme.custom.spacing.lg,
      gap: theme.custom.spacing.sm,
    },
    drawerSectionTitle: {
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      color: theme.colors.onSurface,
      letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
    },
    pillGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.custom.spacing.sm,
    },
    pill: {
      paddingHorizontal: theme.custom.spacing.md,
      paddingVertical: theme.custom.spacing.sm,
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceVariant,
    },
    pillActive: {
      backgroundColor: theme.colors.primary,
    },
    pillLabel: {
      fontSize: theme.custom.typography.labelLarge.fontSize,
      fontFamily: theme.custom.typography.labelLarge.fontFamily,
      fontWeight: theme.custom.typography.labelLarge.fontWeight as any,
      color: theme.colors.onSurfaceVariant,
    },
    pillLabelActive: {
      color: theme.colors.onPrimary,
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.custom.spacing.sm,
    },
    dateField: {
      flex: 1,
      borderRadius: 14,
      paddingHorizontal: theme.custom.spacing.md,
      paddingVertical: theme.custom.spacing.md,
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
    dateFieldValue: {
      fontSize: theme.custom.typography.bodyLarge.fontSize,
      fontFamily: theme.custom.typography.bodyLarge.fontFamily,
      fontWeight: theme.custom.typography.bodyLarge.fontWeight as any,
      color: theme.colors.onSurface,
    },
    drawerActions: {
      gap: theme.custom.spacing.sm,
    },
    clearButton: {
      alignSelf: "center",
    },
  });

  const handleReleasePress = useCallback((releaseId: string) => {
    console.log("Release pressed:", releaseId);
  }, []);

  const handleRetry = useCallback(() => {
    goToToday();
  }, [goToToday]);

  const sortByDateThenTitle = useCallback(
    (a: MediaRelease, b: MediaRelease) => {
      const aDate = parseISO(a.releaseDate);
      const bDate = parseISO(b.releaseDate);
      if (aDate.getTime() !== bDate.getTime()) {
        return bDate.getTime() - aDate.getTime();
      }
      return a.title.localeCompare(b.title);
    },
    []
  );

  const releasesForView = useMemo(() => {
    if (!calendarData) {
      return [] as MediaRelease[];
    }

    if (state.view === "day" && "date" in calendarData) {
      const dayData = calendarData as CalendarDay;
      return [...dayData.releases].sort(sortByDateThenTitle);
    }

    if (state.view === "week" && "days" in calendarData) {
      const weekData = calendarData as CalendarWeek;
      return [...weekData.days.flatMap((day) => day.releases)].sort(
        sortByDateThenTitle
      );
    }

    if (state.view === "month" && "weeks" in calendarData) {
      const monthData = calendarData as CalendarMonth;
      const flattened = monthData.weeks
        .flatMap((week) => week.days)
        .filter((day) => day.isCurrentMonth)
        .flatMap((day) => day.releases);
      return [...flattened].sort(sortByDateThenTitle);
    }

    if (state.view === "custom") {
      // For custom view, show all releases in the dateRange, which are already filtered
      return [...releases].sort(sortByDateThenTitle);
    }

    if ("releases" in calendarData && calendarData.releases) {
      return [...calendarData.releases].sort(sortByDateThenTitle);
    }

    return [] as MediaRelease[];
  }, [calendarData, sortByDateThenTitle, state.view, releases]);

  const headingLabel = useMemo(() => {
    if (!calendarData) return "";

    if (state.view === "day" && "date" in calendarData) {
      const date = parseISO(calendarData.date);
      if (isToday(date)) return "Today";
      if (isTomorrow(date)) return "Tomorrow";
      if (isYesterday(date)) return "Yesterday";
      return format(date, "EEEE, MMM d");
    }

    if (state.view === "week" && "days" in calendarData) {
      const weekData = calendarData as CalendarWeek;
      const first = parseISO(weekData.days[0]?.date ?? state.currentDate);
      const last = parseISO(
        weekData.days[weekData.days.length - 1]?.date ?? state.currentDate
      );
      if (isSameWeek(first, new Date())) {
        return "This Week";
      }
      return `${format(first, "MMM d")} – ${format(last, "MMM d")}`;
    }

    if (state.view === "month" && "weeks" in calendarData) {
      const monthData = calendarData as CalendarMonth;
      const monthDate = new Date(monthData.year, monthData.month - 1, 1);
      if (isSameMonth(monthDate, new Date())) {
        return "This Month";
      }
      return format(monthDate, "MMMM yyyy");
    }

    if (state.view === "custom" && state.filters.dateRange) {
      const start = format(parseISO(state.filters.dateRange.start), "MMM d, yyyy");
      const end = format(parseISO(state.filters.dateRange.end), "MMM d, yyyy");
      return `Custom: ${start} - ${end}`;
    }

    return navigation.currentPeriod;
  }, [calendarData, navigation.currentPeriod, state.currentDate, state.view, state.filters.dateRange]);

  const subheadingLabel = useMemo(() => {
    if (releasesForView.length === 0) {
      return "No scheduled releases";
    }
    return `${releasesForView.length} release${
      releasesForView.length === 1 ? "" : "s"
    }`;
  }, [releasesForView.length]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (state.filters.mediaTypes.length !== ALL_MEDIA_TYPES.length) count++;
    if (state.filters.serviceTypes?.length) count++;
    if (state.filters.monitoredStatus !== "all") count++;
    if (state.filters.dateRange) count++;
    if (state.filters.services.length) count++;
    if (state.filters.searchQuery) count++;
    if (state.filters.statuses.length !== DEFAULT_STATUSES.length) count++;
    return count;
  }, [state.filters]);

  const formatDateFieldValue = useCallback((value?: string) => {
    if (!value) return "Select date";
    return format(parseISO(value), "MM/dd/yyyy");
  }, []);

  const handleSelectSegment = useCallback(
    (view: CalendarView) => {
      if (view === state.view) return;
      setView(view);
    },
    [setView, state.view]
  );

  const openFilters = useCallback(() => {
    setIsFilterDrawerVisible(true);
  }, []);

  const closeFilters = useCallback(() => {
    setIsFilterDrawerVisible(false);
    setActiveDateField(null);
  }, []);

  const handleServiceTypeSelect = useCallback(
    (serviceType: CalendarServiceType | "all") => {
      if (serviceType === "all") {
        setPendingFilters((prev) => ({
          ...prev,
          serviceTypes: [],
        }));
        return;
      }
      setPendingFilters((prev) => ({
        ...prev,
        serviceTypes: [serviceType],
      }));
    },
    []
  );

  const handleMediaTypeSelect = useCallback((option: "all" | "tv" | "movies") => {
    switch (option) {
      case "all":
        setPendingFilters((prev) => ({
          ...prev,
          mediaTypes: [...ALL_MEDIA_TYPES],
        }));
        break;
      case "tv":
        setPendingFilters((prev) => ({
          ...prev,
          mediaTypes: ["series", "episode"],
        }));
        break;
      case "movies":
        setPendingFilters((prev) => ({
          ...prev,
          mediaTypes: ["movie"],
        }));
        break;
    }
  }, []);

  const handleMonitoredSelect = useCallback(
    (option: CalendarFilters["monitoredStatus"]) => {
      setPendingFilters((prev) => ({
        ...prev,
        monitoredStatus: option,
      }));
    },
    []
  );

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
          const nextRange = {
            start: prev.dateRange?.start ?? iso,
            end: prev.dateRange?.end ?? iso,
          };

          if (activeDateField === "start") {
            nextRange.start = iso;
            if (!prev.dateRange?.end) {
              nextRange.end = iso;
            }
          } else {
            nextRange.end = iso;
            if (!prev.dateRange?.start) {
              nextRange.start = iso;
            }
          }

          return {
            ...prev,
            dateRange: nextRange,
          };
        });
      }

      setActiveDateField(null);
    },
    [activeDateField]
  );

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
      setView('custom');
    }
    closeFilters();
  }, [pendingFilters, setFilters, setCurrentDate, setView, closeFilters]);

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
    if (state.view === 'custom') {
      setView('month');
    }
  }, [clearFilters, state.view, setView]);

  const renderContent = () => {
    if (state.isLoading) {
      return <LoadingState message="Loading calendar..." />;
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

    if (releasesForView.length === 0) {
      return (
        <View style={styles.emptyWrapper}>
          <EmptyState
            title="No releases found"
            description="Try adjusting your filters or check back later for new releases."
            actionLabel="Clear Filters"
            onActionPress={resetFilters}
          />
        </View>
      );
    }

    return (
      <FlashList
        data={releasesForView}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <MediaReleaseCard release={item} onPress={() => handleReleasePress(item.id)} />
        )}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderPill = (
    label: string,
    isActive: boolean,
    onPress: () => void,
    testID?: string
  ) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={[styles.pill, isActive && styles.pillActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      testID={testID}
    >
      <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TabHeader
        title="Release Calendar"
        showTitle
        showBackButton={false}
        rightAction={{
          icon: "cog",
          onPress: openFilters,
          accessibilityLabel: "Open filters",
        }}
      />

      <View style={styles.headerContent}>
        <View style={styles.segmentsRow}>
          {VIEW_SEGMENTS.map((segment) => {
            const isActive = state.view === segment.value;
            return (
              <Pressable
                key={segment.value}
                onPress={() => handleSelectSegment(segment.value)}
                style={[styles.segmentButton, isActive && styles.segmentActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[styles.segmentLabel, isActive && styles.segmentLabelActive]}
                >
                  {segment.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.headingText}>{headingLabel}</Text>
          <Text style={styles.subheadingText}>{subheadingLabel}</Text>
        </View>

        <View style={styles.filtersRow}>
          <Pressable
            onPress={openFilters}
            style={[styles.filtersButton, activeFilterCount > 0 && styles.filtersButtonActive]}
            accessibilityRole="button"
          >
            <Icon
              source="tune-variant"
              size={18}
              color={
                activeFilterCount > 0
                  ? theme.colors.onPrimary
                  : theme.colors.onSurfaceVariant
              }
            />
            <Text
              style={[
                styles.filtersButtonLabel,
                activeFilterCount > 0 && styles.filtersButtonLabelActive,
              ]}
            >
              {activeFilterCount > 0
                ? `Filters • ${activeFilterCount}`
                : "Filters"}
            </Text>
          </Pressable>
        </View>
      </View>

      <ErrorBoundary>{renderContent()}</ErrorBoundary>

      <BottomDrawer
        visible={isFilterDrawerVisible}
        onDismiss={closeFilters}
        title="Filter & Sort"
        maxHeight="80%"
      >
        <View style={styles.drawerSection}>
          <Text style={styles.drawerSectionTitle}>Service Type</Text>
          <View style={styles.pillGrid}>
            {renderPill(
              "All",
              pendingFilters.serviceTypes.length === 0,
              () => handleServiceTypeSelect("all"),
              "filter-service-all"
            )}
            {SERVICE_TYPES.map((service) =>
              renderPill(
                service === "sonarr" ? "Sonarr" : "Radarr",
                pendingFilters.serviceTypes.includes(service),
                () => handleServiceTypeSelect(service),
                `filter-service-${service}`
              )
            )}
          </View>
        </View>

        <View style={styles.drawerSection}>
          <Text style={styles.drawerSectionTitle}>Media Type</Text>
          <View style={styles.pillGrid}>
            {renderPill(
              "All",
              pendingFilters.mediaTypes.length === ALL_MEDIA_TYPES.length,
              () => handleMediaTypeSelect("all"),
              "filter-media-all"
            )}
            {renderPill(
              "TV Shows",
              pendingFilters.mediaTypes.length === 2 &&
                pendingFilters.mediaTypes.includes("series") &&
                pendingFilters.mediaTypes.includes("episode"),
              () => handleMediaTypeSelect("tv"),
              "filter-media-tv"
            )}
            {renderPill(
              "Movies",
              pendingFilters.mediaTypes.length === 1 &&
                pendingFilters.mediaTypes.includes("movie"),
              () => handleMediaTypeSelect("movies"),
              "filter-media-movies"
            )}
          </View>
        </View>

        <View style={styles.drawerSection}>
          <Text style={styles.drawerSectionTitle}>Monitored Status</Text>
          <View style={styles.pillGrid}>
            {renderPill(
              "All",
              pendingFilters.monitoredStatus === "all",
              () => handleMonitoredSelect("all"),
              "filter-monitored-all"
            )}
            {renderPill(
              "Monitored",
              pendingFilters.monitoredStatus === "monitored",
              () => handleMonitoredSelect("monitored"),
              "filter-monitored-monitored"
            )}
            {renderPill(
              "Unmonitored",
              pendingFilters.monitoredStatus === "unmonitored",
              () => handleMonitoredSelect("unmonitored"),
              "filter-monitored-unmonitored"
            )}
          </View>
        </View>

        <View style={styles.drawerSection}>
          <Text style={styles.drawerSectionTitle}>Date Range</Text>
          <View style={styles.dateRow}>
            <Pressable
              onPress={() => handleDateFieldPress("start")}
              style={[
                styles.dateField,
                activeDateField === "start" && styles.dateFieldActive,
              ]}
            >
              <Text style={styles.dateFieldLabel}>Start Date</Text>
              <Text style={styles.dateFieldValue}>
                {formatDateFieldValue(pendingFilters.dateRange?.start)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleDateFieldPress("end")}
              style={[
                styles.dateField,
                activeDateField === "end" && styles.dateFieldActive,
              ]}
            >
              <Text style={styles.dateFieldLabel}>End Date</Text>
              <Text style={styles.dateFieldValue}>
                {formatDateFieldValue(pendingFilters.dateRange?.end)}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.drawerActions}>
          <Button mode="contained" onPress={applyFilters}>
            Apply Filters
          </Button>
          <Button mode="text" onPress={resetFilters} style={styles.clearButton}>
            Clear Filters
          </Button>
        </View>
      </BottomDrawer>

      {activeDateField ? (
        <DateTimePicker
          value={(() => {
            if (!activeDateField) return new Date();
            const current = pendingFilters.dateRange?.[activeDateField];
            return current ? parseISO(current) : new Date();
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
