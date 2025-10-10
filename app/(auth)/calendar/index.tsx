import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import BottomDrawer from "@/components/common/BottomDrawer";
import { TabHeader } from "@/components/common/TabHeader";
import {
  CalendarHeader,
  CalendarMonthView,
  CalendarWeekView,
  CalendarDayView,
  CalendarListView,
  CalendarStats,
  CalendarFilters as CalendarFiltersComponent,
  MediaReleaseCard,
} from "@/components/calendar";
import { useCalendar } from "@/hooks/useCalendar";
import type { AppTheme } from "@/constants/theme";
import type {
  CalendarView,
  CalendarMonth,
  CalendarWeek,
  CalendarDay,
} from "@/models/calendar.types";
import type { CalendarFilters } from "@/models/calendar.types";

const CalendarScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const {
    state,
    calendarData,
    stats,
    navigation,
    setView,
    setSelectedDate,
    setFilters,
    clearFilters,
  } = useCalendar();

  const [expandedDay, setExpandedDay] = useState<string | undefined>(undefined);
  const [detailsDay, setDetailsDay] = useState<string | undefined>(undefined);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 20, // Account for safe area
    },
  });

  const handleDateSelect = useCallback(
    (date: string) => {
      setSelectedDate(date);
      setExpandedDay(expandedDay === date ? undefined : date); // Toggle expansion
    },
    [setSelectedDate, expandedDay]
  );

  const handleReleasePress = useCallback((releaseId: string) => {
    // TODO: Navigate to release details
    console.log("Release pressed:", releaseId);
  }, []);

  const handleDayLongPress = useCallback((date: string) => {
    setDetailsDay(date);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailsDay(undefined);
  }, []);

  const handleRetry = useCallback(() => {
    // Force refetch of calendar data
    window.location.reload();
  }, []);

  const handleViewChange = useCallback(
    (view: CalendarView) => {
      setView(view);
    },
    [setView]
  );

  const handleFiltersChange = useCallback(
    (filters: Partial<CalendarFilters>) => {
      setFilters(filters);
    },
    [setFilters]
  );

  const detailsReleases = useMemo(() => {
    if (!detailsDay || !calendarData) return [];
    // Find the day in calendarData
    if ("weeks" in calendarData) {
      for (const week of calendarData.weeks) {
        const day = week.days.find((d) => d.date === detailsDay);
        if (day) return day.releases;
      }
    }
    return [];
  }, [detailsDay, calendarData]);

  const detailsTitle = useMemo(() => {
    if (!detailsDay) return "";
    const date = new Date(detailsDay);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [detailsDay]);

  const renderCalendarContent = () => {
    if (state.isLoading) {
      return <LoadingState message="Loading calendar..." />;
    }

    if (state.error) {
      return (
        <EmptyState
          title="Unable to load calendar"
          description={state.error}
          actionLabel="Retry"
          onActionPress={handleRetry}
        />
      );
    }

    if (!calendarData) {
      return (
        <EmptyState
          title="No calendar data"
          description="Unable to load calendar data."
          actionLabel="Retry"
          onActionPress={handleRetry}
        />
      );
    }

    const hasReleases =
      "totalReleases" in calendarData
        ? calendarData.totalReleases > 0
        : "releases" in calendarData && calendarData.releases?.length > 0;

    if (!hasReleases) {
      return (
        <EmptyState
          title="No releases found"
          description="Try adjusting your filters or check back later for new releases."
          actionLabel="Clear Filters"
          onActionPress={clearFilters}
        />
      );
    }

    switch (state.view) {
      case "month":
        return (
          <CalendarMonthView
            data={calendarData as CalendarMonth}
            selectedDate={state.selectedDate}
            expandedDay={expandedDay}
            onDateSelect={handleDateSelect}
            onDayLongPress={handleDayLongPress}
            onReleasePress={handleReleasePress}
          />
        );
      case "week":
        return (
          <CalendarWeekView
            data={calendarData as CalendarWeek}
            selectedDate={state.selectedDate}
            onDateSelect={handleDateSelect}
            onReleasePress={handleReleasePress}
          />
        );
      case "day":
        return (
          <CalendarDayView
            data={calendarData as CalendarDay}
            onReleasePress={handleReleasePress}
          />
        );
      case "list":
        return (
          <CalendarListView
            releases={"releases" in calendarData ? calendarData.releases : []}
            onReleasePress={handleReleasePress}
          />
        );
      default:
        return (
          <CalendarMonthView
            data={calendarData as CalendarMonth}
            selectedDate={state.selectedDate}
            onDateSelect={handleDateSelect}
            onReleasePress={handleReleasePress}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TabHeader
        title="Release Calendar"
        showTitle={true}
        showBackButton={true}
        onBackPress={() => router.back()}
        rightAction={{
          icon: "filter",
          onPress: () => {
            // TODO: Toggle filters visibility
            console.log("Toggle filters");
          },
          accessibilityLabel: "Toggle filters",
        }}
      />

      <View style={styles.content}>
        <CalendarHeader
          navigation={navigation}
          view={state.view}
          onViewChange={handleViewChange}
        />

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <CalendarStats stats={stats} />

          <CalendarFiltersComponent
            filters={state.filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={clearFilters}
          />

          <ErrorBoundary>{renderCalendarContent()}</ErrorBoundary>
        </ScrollView>
      </View>

      <BottomDrawer
        visible={!!detailsDay}
        onDismiss={handleCloseDetails}
        title={detailsTitle}
        maxHeight="70%"
      >
        <View style={{ gap: theme.custom.spacing.sm }}>
          {detailsReleases.map((release) => (
            <MediaReleaseCard
              key={release.id}
              release={release}
              onPress={() => handleReleasePress(release.id)}
            />
          ))}
        </View>
      </BottomDrawer>
    </SafeAreaView>
  );
};

export default CalendarScreen;
