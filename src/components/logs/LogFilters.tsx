import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, Modal, Platform } from "react-native";
import {
  Text,
  useTheme,
  IconButton,
  Chip,
  Button,
  Divider,
} from "react-native-paper";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import type { AppTheme } from "@/constants/theme";
import type { ServiceLogLevel } from "@/models/logger.types";
import type { LogFilters as LogFiltersType } from "./LogViewer";

export interface LogFiltersProps {
  /**
   * Current filter values
   */
  filters: LogFiltersType;

  /**
   * Callback when filters change
   */
  onFiltersChange: (filters: LogFiltersType) => void;

  /**
   * Callback when filter panel is closed
   */
  onClose: () => void;

  /**
   * Available services for filtering
   */
  availableServices?: { id: string; name: string }[];
}

const LOG_LEVELS: ServiceLogLevel[] = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
];

/**
 * LogFilters component provides UI for service, severity, and time range filters
 *
 * Features:
 * - Service filter with multi-select
 * - Severity level filter with multi-select
 * - Time range filter with date pickers
 * - Show active filter count
 * - Support clear all filters action
 *
 * @example
 * ```tsx
 * <LogFilters
 *   filters={filters}
 *   onFiltersChange={handleFiltersChange}
 *   onClose={() => setShowFilters(false)}
 *   availableServices={services}
 * />
 * ```
 */
export const LogFilters: React.FC<LogFiltersProps> = ({
  filters,
  onFiltersChange,
  onClose,
  availableServices = [],
}) => {
  const theme = useTheme<AppTheme>();

  // Local state for date pickers
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Toggle service filter
  const toggleService = useCallback(
    (serviceId: string) => {
      const currentServices = filters.serviceIds || [];
      const newServices = currentServices.includes(serviceId)
        ? currentServices.filter((id) => id !== serviceId)
        : [...currentServices, serviceId];

      onFiltersChange({
        ...filters,
        serviceIds: newServices.length > 0 ? newServices : undefined,
      });
    },
    [filters, onFiltersChange],
  );

  // Toggle level filter
  const toggleLevel = useCallback(
    (level: ServiceLogLevel) => {
      const currentLevels = filters.levels || [];
      const newLevels = currentLevels.includes(level)
        ? currentLevels.filter((l) => l !== level)
        : [...currentLevels, level];

      onFiltersChange({
        ...filters,
        levels: newLevels.length > 0 ? newLevels : undefined,
      });
    },
    [filters, onFiltersChange],
  );

  // Handle start date change
  const handleStartDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      setShowStartDatePicker(Platform.OS === "ios");

      if (event.type === "set" && selectedDate) {
        onFiltersChange({
          ...filters,
          timeRange: {
            start: selectedDate,
            end: filters.timeRange?.end || new Date(),
          },
        });
      }
    },
    [filters, onFiltersChange],
  );

  // Handle end date change
  const handleEndDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      setShowEndDatePicker(Platform.OS === "ios");

      if (event.type === "set" && selectedDate) {
        onFiltersChange({
          ...filters,
          timeRange: {
            start:
              filters.timeRange?.start ||
              new Date(Date.now() - 24 * 60 * 60 * 1000),
            end: selectedDate,
          },
        });
      }
    },
    [filters, onFiltersChange],
  );

  // Clear time range
  const clearTimeRange = useCallback(() => {
    onFiltersChange({
      ...filters,
      timeRange: undefined,
    });
  }, [filters, onFiltersChange]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.serviceIds && filters.serviceIds.length > 0) count++;
    if (filters.levels && filters.levels.length > 0) count++;
    if (filters.timeRange) count++;
    return count;
  }, [filters]);

  // Quick time range presets
  const applyTimeRangePreset = useCallback(
    (hours: number) => {
      const end = new Date();
      const start = new Date(end.getTime() - hours * 60 * 60 * 1000);

      onFiltersChange({
        ...filters,
        timeRange: { start, end },
      });
    },
    [filters, onFiltersChange],
  );

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={[styles.modalOverlay, { backgroundColor: "rgba(0, 0, 0, 0.5)" }]}
      >
        <View
          style={[
            styles.modalContent,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text
                variant="titleLarge"
                style={{ color: theme.colors.onSurface }}
              >
                Filters
              </Text>
              {activeFilterCount > 0 && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.badgeText,
                      { color: theme.colors.onPrimary },
                    ]}
                  >
                    {activeFilterCount}
                  </Text>
                </View>
              )}
            </View>
            <IconButton
              icon="close"
              size={24}
              onPress={onClose}
              accessibilityLabel="Close filters"
            />
          </View>

          <Divider />

          {/* Filter content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Service filter */}
            {availableServices.length > 0 && (
              <View style={styles.section}>
                <Text
                  variant="titleMedium"
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Services
                </Text>
                <View style={styles.chipContainer}>
                  {availableServices.map((service) => {
                    const isSelected =
                      filters.serviceIds?.includes(service.id) || false;
                    return (
                      <Chip
                        key={service.id}
                        selected={isSelected}
                        onPress={() => toggleService(service.id)}
                        style={styles.chip}
                        showSelectedCheck
                        accessible
                        accessibilityLabel={`${service.name} service filter`}
                        accessibilityHint={
                          isSelected
                            ? "Double tap to remove filter"
                            : "Double tap to filter by this service"
                        }
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                      >
                        {service.name}
                      </Chip>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Level filter */}
            <View style={styles.section}>
              <Text
                variant="titleMedium"
                style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
              >
                Severity Levels
              </Text>
              <View style={styles.chipContainer}>
                {LOG_LEVELS.map((level) => {
                  const isSelected = filters.levels?.includes(level) || false;
                  return (
                    <Chip
                      key={level}
                      selected={isSelected}
                      onPress={() => toggleLevel(level)}
                      style={styles.chip}
                      showSelectedCheck
                      accessible
                      accessibilityLabel={`${level} severity level filter`}
                      accessibilityHint={
                        isSelected
                          ? "Double tap to remove filter"
                          : "Double tap to filter by this severity level"
                      }
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                    >
                      {level.toUpperCase()}
                    </Chip>
                  );
                })}
              </View>
            </View>

            {/* Time range filter */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text
                  variant="titleMedium"
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Time Range
                </Text>
                {filters.timeRange && (
                  <Button mode="text" onPress={clearTimeRange} compact>
                    Clear
                  </Button>
                )}
              </View>

              {/* Quick presets */}
              <View style={styles.chipContainer}>
                <Chip
                  onPress={() => applyTimeRangePreset(1)}
                  style={styles.chip}
                  accessible
                  accessibilityLabel="Filter logs from last hour"
                  accessibilityRole="button"
                >
                  Last Hour
                </Chip>
                <Chip
                  onPress={() => applyTimeRangePreset(24)}
                  style={styles.chip}
                  accessible
                  accessibilityLabel="Filter logs from last 24 hours"
                  accessibilityRole="button"
                >
                  Last 24h
                </Chip>
                <Chip
                  onPress={() => applyTimeRangePreset(168)}
                  style={styles.chip}
                  accessible
                  accessibilityLabel="Filter logs from last 7 days"
                  accessibilityRole="button"
                >
                  Last 7d
                </Chip>
              </View>

              {/* Custom date range */}
              <View style={styles.dateRangeContainer}>
                <View style={styles.datePickerRow}>
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.dateLabel,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    From:
                  </Text>
                  <Button
                    mode="outlined"
                    onPress={() => setShowStartDatePicker(true)}
                    style={styles.dateButton}
                    accessible
                    accessibilityLabel={`Start date: ${filters.timeRange?.start ? new Date(filters.timeRange.start).toLocaleDateString() : "not set"}`}
                    accessibilityHint="Double tap to select start date"
                    accessibilityRole="button"
                  >
                    {filters.timeRange?.start
                      ? new Date(filters.timeRange.start).toLocaleDateString()
                      : "Select date"}
                  </Button>
                </View>

                <View style={styles.datePickerRow}>
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.dateLabel,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    To:
                  </Text>
                  <Button
                    mode="outlined"
                    onPress={() => setShowEndDatePicker(true)}
                    style={styles.dateButton}
                    accessible
                    accessibilityLabel={`End date: ${filters.timeRange?.end ? new Date(filters.timeRange.end).toLocaleDateString() : "not set"}`}
                    accessibilityHint="Double tap to select end date"
                    accessibilityRole="button"
                  >
                    {filters.timeRange?.end
                      ? new Date(filters.timeRange.end).toLocaleDateString()
                      : "Select date"}
                  </Button>
                </View>
              </View>
            </View>
          </ScrollView>

          <Divider />

          {/* Footer */}
          <View style={styles.footer}>
            <Button
              mode="outlined"
              onPress={clearAllFilters}
              disabled={activeFilterCount === 0}
              style={styles.footerButton}
              accessible
              accessibilityLabel="Clear all filters"
              accessibilityHint={
                activeFilterCount > 0
                  ? `Removes all ${activeFilterCount} active filters`
                  : "No filters to clear"
              }
              accessibilityRole="button"
            >
              Clear All
            </Button>
            <Button
              mode="contained"
              onPress={onClose}
              style={styles.footerButton}
              accessible
              accessibilityLabel="Apply filters and close"
              accessibilityHint="Applies selected filters to log view"
              accessibilityRole="button"
            >
              Apply
            </Button>
          </View>

          {/* Date pickers */}
          {showStartDatePicker && (
            <DateTimePicker
              value={filters.timeRange?.start || new Date()}
              mode="date"
              display="default"
              onChange={handleStartDateChange}
              maximumDate={filters.timeRange?.end || new Date()}
            />
          )}

          {showEndDatePicker && (
            <DateTimePicker
              value={filters.timeRange?.end || new Date()}
              mode="date"
              display="default"
              onChange={handleEndDateChange}
              minimumDate={filters.timeRange?.start}
              maximumDate={new Date()}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    minHeight: "70%",
    maxHeight: "90%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingRight: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  badgeText: {
    fontWeight: "600",
    fontSize: 12,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 8,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: "600",
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    marginRight: 0,
  },
  dateRangeContainer: {
    marginTop: 16,
    gap: 12,
  },
  datePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dateLabel: {
    width: 50,
    fontWeight: "500",
  },
  dateButton: {
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    padding: 20,
    gap: 16,
  },
  footerButton: {
    flex: 1,
  },
});
