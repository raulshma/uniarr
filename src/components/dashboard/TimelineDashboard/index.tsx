import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { Text, Surface } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";
import { useHaptics } from "@/hooks/useHaptics";
import { useTimelineEvents } from "@/hooks/useTimelineEvents";
import type { TimelineFilter } from "@/models/timeline.types";

import TimelineSidebar from "./TimelineSidebar";
import TimelineEventCard from "./TimelineEventCard";

const headerMinHeight = 56;

const TimelineDashboard = memo(() => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { onPress } = useHaptics();
  const [activeFilter, setActiveFilter] = useState("all");
  const scrollY = useRef(new Animated.Value(0)).current;
  const [refreshing, setRefreshing] = useState(false);

  const timelineFilter: TimelineFilter | undefined = useMemo(() => {
    if (activeFilter === "all") return undefined;
    return {
      categories: [activeFilter as TimelineFilter["categories"][number]],
      serviceIds: [],
    };
  }, [activeFilter]);

  const { days, stats, isLoading, isFetching, refetch } =
    useTimelineEvents(timelineFilter);

  const onRefresh = useCallback(async () => {
    onPress();
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 800);
  }, [onPress, refetch]);

  const handleFilterChange = useCallback((filter: string) => {
    setActiveFilter(filter);
  }, []);

  const screenHeight = Dimensions.get("window").height;
  const headerMaxHeight = screenHeight * 0.18;

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, headerMaxHeight - headerMinHeight],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const stickyBgOpacity = scrollY.interpolate({
    inputRange: [0, headerMaxHeight - headerMinHeight],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const totalEvents = useMemo(
    () => days.reduce((sum, d) => sum + d.events.length, 0),
    [days],
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    layout: {
      flex: 1,
      flexDirection: "row",
    },
    headerContainer: {
      position: "absolute",
      top: 0,
      left: 72,
      right: 0,
      zIndex: 10,
    },
    headerContent: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: theme.custom.spacing.lg,
      paddingTop: insets.top,
    },
    headerTitle: {
      fontSize: theme.custom.typography.headlineSmall.fontSize,
      fontWeight: "800",
      color: theme.colors.onBackground,
      letterSpacing: theme.custom.typography.headlineSmall.letterSpacing,
    },
    headerSubtitle: {
      fontSize: theme.custom.typography.bodySmall.fontSize,
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
    stickyHeader: {
      position: "absolute",
      top: 0,
      left: 72,
      right: 0,
      zIndex: 11,
      paddingHorizontal: theme.custom.spacing.lg,
      paddingTop: insets.top,
      height: headerMinHeight,
      justifyContent: "center",
    },
    stickyTitle: {
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontWeight: "700",
      color: theme.colors.onBackground,
    },
    timelineArea: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: headerMaxHeight,
      paddingBottom: 100,
    },
    statsRow: {
      flexDirection: "row",
      gap: theme.custom.spacing.xs,
      paddingHorizontal: theme.custom.spacing.md,
      paddingVertical: theme.custom.spacing.sm,
    },
    statChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: theme.custom.spacing.sm,
      paddingVertical: theme.custom.spacing.xxs,
      borderRadius: theme.custom.sizes.borderRadius.xl,
      backgroundColor: theme.colors.elevation.level1,
    },
    statChipText: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontWeight: "600",
      color: theme.colors.onSurfaceVariant,
    },
    statChipValue: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontWeight: "700",
    },
    daySection: {
      marginBottom: theme.custom.spacing.md,
    },
    dayHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.custom.spacing.sm,
      paddingHorizontal: theme.custom.spacing.md,
      paddingVertical: theme.custom.spacing.sm,
    },
    dayLabel: {
      fontSize: theme.custom.typography.titleSmall.fontSize,
      fontWeight: "700",
      color: theme.colors.onBackground,
    },
    dayCount: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      color: theme.colors.onSurfaceVariant,
    },
    dayLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.outlineVariant,
      opacity: 0.3,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: screenHeight * 0.2,
      paddingHorizontal: theme.custom.spacing.xl,
    },
    emptyIcon: {
      marginBottom: theme.custom.spacing.md,
    },
    emptyTitle: {
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontWeight: "600",
      color: theme.colors.onSurface,
      textAlign: "center",
      marginBottom: theme.custom.spacing.xs,
    },
    emptySubtitle: {
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
    },
    loadingContainer: {
      paddingVertical: theme.custom.spacing.xl,
      alignItems: "center",
    },
    loadingText: {
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      color: theme.colors.onSurfaceVariant,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.layout}>
        <TimelineSidebar
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          stats={stats}
        />

        <View style={styles.timelineArea}>
          <Animated.View
            style={[
              styles.headerContainer,
              { height: headerMaxHeight, opacity: headerOpacity },
            ]}
          >
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Timeline</Text>
              <Text style={styles.headerSubtitle}>
                {totalEvents} events across your services
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.stickyHeader,
              {
                backgroundColor: theme.colors.background,
                opacity: stickyBgOpacity,
              },
            ]}
          >
            <Text style={styles.stickyTitle}>Timeline</Text>
          </Animated.View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false },
            )}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
              />
            }
          >
            {stats.downloading > 0 ||
            stats.queued > 0 ||
            stats.upcoming > 0 ||
            stats.failed > 0 ||
            stats.pendingRequests > 0 ||
            stats.subtitles > 0 ||
            stats.lowDisk > 0 ? (
              <View style={styles.statsRow}>
                {stats.downloading > 0 && (
                  <View style={styles.statChip}>
                    <MaterialCommunityIcons
                      name="download"
                      size={14}
                      color="#4FC3F7"
                    />
                    <Text style={[styles.statChipValue, { color: "#4FC3F7" }]}>
                      {stats.downloading}
                    </Text>
                    <Text style={styles.statChipText}>active</Text>
                  </View>
                )}
                {stats.queued > 0 && (
                  <View style={styles.statChip}>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={14}
                      color="#78909C"
                    />
                    <Text style={[styles.statChipValue, { color: "#78909C" }]}>
                      {stats.queued}
                    </Text>
                    <Text style={styles.statChipText}>queued</Text>
                  </View>
                )}
                {stats.upcoming > 0 && (
                  <View style={styles.statChip}>
                    <MaterialCommunityIcons
                      name="calendar-clock"
                      size={14}
                      color="#5C6BC0"
                    />
                    <Text style={[styles.statChipValue, { color: "#5C6BC0" }]}>
                      {stats.upcoming}
                    </Text>
                    <Text style={styles.statChipText}>upcoming</Text>
                  </View>
                )}
                {stats.failed > 0 && (
                  <View style={styles.statChip}>
                    <MaterialCommunityIcons
                      name="alert-circle"
                      size={14}
                      color="#EF5350"
                    />
                    <Text style={[styles.statChipValue, { color: "#EF5350" }]}>
                      {stats.failed}
                    </Text>
                    <Text style={styles.statChipText}>failed</Text>
                  </View>
                )}
                {stats.pendingRequests > 0 && (
                  <View style={styles.statChip}>
                    <MaterialCommunityIcons
                      name="clock-plus-outline"
                      size={14}
                      color="#FFA726"
                    />
                    <Text style={[styles.statChipValue, { color: "#FFA726" }]}>
                      {stats.pendingRequests}
                    </Text>
                    <Text style={styles.statChipText}>requests</Text>
                  </View>
                )}
                {stats.subtitles > 0 && (
                  <View style={styles.statChip}>
                    <MaterialCommunityIcons
                      name="subtitles"
                      size={14}
                      color="#26C6DA"
                    />
                    <Text style={[styles.statChipValue, { color: "#26C6DA" }]}>
                      {stats.subtitles}
                    </Text>
                    <Text style={styles.statChipText}>subtitles</Text>
                  </View>
                )}
                {stats.lowDisk > 0 && (
                  <View style={styles.statChip}>
                    <MaterialCommunityIcons
                      name="alert"
                      size={14}
                      color="#EF5350"
                    />
                    <Text style={[styles.statChipValue, { color: "#EF5350" }]}>
                      {stats.lowDisk}
                    </Text>
                    <Text style={styles.statChipText}>low disk</Text>
                  </View>
                )}
                {stats.queued > 0 && (
                  <View style={styles.statChip}>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={14}
                      color="#78909C"
                    />
                    <Text style={[styles.statChipValue, { color: "#78909C" }]}>
                      {stats.queued}
                    </Text>
                    <Text style={styles.statChipText}>queued</Text>
                  </View>
                )}
                {stats.upcoming > 0 && (
                  <View style={styles.statChip}>
                    <MaterialCommunityIcons
                      name="calendar-clock"
                      size={14}
                      color="#5C6BC0"
                    />
                    <Text style={[styles.statChipValue, { color: "#5C6BC0" }]}>
                      {stats.upcoming}
                    </Text>
                    <Text style={styles.statChipText}>upcoming</Text>
                  </View>
                )}
                {stats.failed > 0 && (
                  <View style={styles.statChip}>
                    <MaterialCommunityIcons
                      name="alert-circle"
                      size={14}
                      color="#EF5350"
                    />
                    <Text style={[styles.statChipValue, { color: "#EF5350" }]}>
                      {stats.failed}
                    </Text>
                    <Text style={styles.statChipText}>failed</Text>
                  </View>
                )}
              </View>
            ) : null}

            {isLoading && days.length === 0 ? (
              <View style={styles.loadingContainer}>
                <MaterialCommunityIcons
                  name="timeline-clock-outline"
                  size={48}
                  color={theme.colors.onSurfaceVariant}
                  style={styles.emptyIcon}
                />
                <Text style={styles.loadingText}>
                  Loading timeline events...
                </Text>
              </View>
            ) : days.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="timeline-clock-outline"
                  size={64}
                  color={theme.colors.onSurfaceVariant}
                  style={styles.emptyIcon}
                />
                <Text style={styles.emptyTitle}>No Events Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Events from your services will appear here as they happen
                </Text>
              </View>
            ) : (
              days.map((day) => (
                <View key={day.date} style={styles.daySection}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayLabel}>{day.label}</Text>
                    <Text style={styles.dayCount}>
                      {day.events.length} event
                      {day.events.length !== 1 ? "s" : ""}
                    </Text>
                    <View style={styles.dayLine} />
                  </View>
                  {day.events.map((event) => (
                    <TimelineEventCard
                      key={event.id}
                      event={event}
                      showConnector
                    />
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
});

TimelineDashboard.displayName = "TimelineDashboard";

export default TimelineDashboard;
