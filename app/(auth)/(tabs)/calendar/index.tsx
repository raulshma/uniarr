import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabHeader } from '@/components/common/TabHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import {
  CalendarHeader,
  CalendarMonthView,
  CalendarWeekView,
  CalendarDayView,
  CalendarListView,
  CalendarStats,
  CalendarFilters as CalendarFiltersComponent,
} from '@/components/calendar';
import { useCalendar } from '@/hooks/useCalendar';
import type { AppTheme } from '@/constants/theme';
import type { CalendarView, CalendarMonth, CalendarWeek, CalendarDay } from '@/models/calendar.types';
import type { CalendarFilters } from '@/models/calendar.types';

const CalendarScreen = () => {
  const theme = useTheme<AppTheme>();
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 100, // Account for tab bar
    },
  });

  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
  }, [setSelectedDate]);

  const handleReleasePress = useCallback((releaseId: string) => {
    // TODO: Navigate to release details
    console.log('Release pressed:', releaseId);
  }, []);

  const handleRetry = useCallback(() => {
    // Force refetch of calendar data
    window.location.reload();
  }, []);

  const handleViewChange = useCallback((view: CalendarView) => {
    setView(view);
  }, [setView]);

  const handleFiltersChange = useCallback((filters: Partial<CalendarFilters>) => {
    setFilters(filters);
  }, [setFilters]);

  const handleClearFilters = useCallback(() => {
    clearFilters();
  }, [clearFilters]);

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

    const hasReleases = 'totalReleases' in calendarData 
      ? calendarData.totalReleases > 0 
      : 'releases' in calendarData && calendarData.releases?.length > 0;

    if (!hasReleases) {
      return (
        <EmptyState
          title="No releases found"
          description="Try adjusting your filters or check back later for new releases."
          actionLabel="Clear Filters"
          onActionPress={handleClearFilters}
        />
      );
    }

    switch (state.view) {
      case 'month':
        return (
          <CalendarMonthView
            data={calendarData as CalendarMonth}
            selectedDate={state.selectedDate}
            onDateSelect={handleDateSelect}
            onReleasePress={handleReleasePress}
          />
        );
      case 'week':
        return (
          <CalendarWeekView
            data={calendarData as CalendarWeek}
            selectedDate={state.selectedDate}
            onDateSelect={handleDateSelect}
            onReleasePress={handleReleasePress}
          />
        );
      case 'day':
        return (
          <CalendarDayView
            data={calendarData as CalendarDay}
            onReleasePress={handleReleasePress}
          />
        );
      case 'list':
        return (
          <CalendarListView
            releases={'releases' in calendarData ? calendarData.releases : []}
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
        title="Calendar"
        rightAction={{
          icon: "filter",
          onPress: () => {
            // TODO: Toggle filters visibility
            console.log('Toggle filters');
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
            onClearFilters={handleClearFilters}
          />

          <ErrorBoundary>
            {renderCalendarContent()}
          </ErrorBoundary>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default CalendarScreen;