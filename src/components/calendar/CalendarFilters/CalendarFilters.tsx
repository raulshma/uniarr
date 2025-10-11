import React, { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Chip, Button, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';
import type { CalendarFilters as CalendarFiltersType, MediaType, ReleaseStatus } from '@/models/calendar.types';
import { Card } from '@/components/common/Card';

export type CalendarFiltersProps = {
  filters: CalendarFiltersType;
  onFiltersChange: (filters: Partial<CalendarFiltersType>) => void;
  onClearFilters: () => void;
  style?: StyleProp<ViewStyle>;
};

const CalendarFilters: React.FC<CalendarFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  style,
}) => {
  const theme = useTheme<AppTheme>();
  const [isExpanded, setIsExpanded] = useState(false);

  const styles = StyleSheet.create({
    container: {
      marginHorizontal: theme.custom.spacing.md,
      marginVertical: theme.custom.spacing.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.custom.spacing.sm,
    },
    title: {
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
      letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
      color: theme.colors.onSurface,
    },
    toggleButton: {
      marginLeft: theme.custom.spacing.sm,
    },
    content: {
      display: isExpanded ? 'flex' : 'none',
    },
    section: {
      marginBottom: theme.custom.spacing.md,
    },
    sectionTitle: {
      fontSize: theme.custom.typography.titleSmall.fontSize,
      fontFamily: theme.custom.typography.titleSmall.fontFamily,
      fontWeight: theme.custom.typography.titleSmall.fontWeight as any,
      lineHeight: theme.custom.typography.titleSmall.lineHeight,
      letterSpacing: theme.custom.typography.titleSmall.letterSpacing,
      color: theme.colors.onSurface,
      marginBottom: theme.custom.spacing.xs,
    },
    chipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    chip: {
      marginRight: theme.custom.spacing.xs,
      marginBottom: theme.custom.spacing.xs,
    },
    activeChip: {
      backgroundColor: theme.colors.primaryContainer,
    },
    inactiveChip: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    activeChipText: {
      color: theme.colors.onPrimaryContainer,
    },
    inactiveChipText: {
      color: theme.colors.onSurfaceVariant,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: theme.custom.spacing.sm,
    },
    clearButton: {
      marginRight: theme.custom.spacing.sm,
    },
  });

  const mediaTypes: { value: MediaType; label: string }[] = [
    { value: 'movie', label: 'Movies' },
    { value: 'series', label: 'Series' },
    { value: 'episode', label: 'Episodes' },
  ];

  const statuses: { value: ReleaseStatus; label: string }[] = [
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'released', label: 'Released' },
    { value: 'delayed', label: 'Delayed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const handleMediaTypeToggle = (type: MediaType) => {
    const newTypes = filters.mediaTypes.includes(type)
      ? filters.mediaTypes.filter(t => t !== type)
      : [...filters.mediaTypes, type];
    
    onFiltersChange({ mediaTypes: newTypes });
  };

  const handleStatusToggle = (status: ReleaseStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    
    onFiltersChange({ statuses: newStatuses });
  };

  const hasActiveFilters = () => {
    return (
      filters.mediaTypes.length < mediaTypes.length ||
      filters.statuses.length < statuses.length ||
      filters.searchQuery ||
      filters.services.length > 0
    );
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.mediaTypes.length < mediaTypes.length) count++;
    if (filters.statuses.length < statuses.length) count++;
    if (filters.searchQuery) count++;
    if (filters.services.length > 0) count++;
    return count;
  };

  return (
    <Card style={[styles.container, style]} contentPadding="md">
      <View style={styles.header}>
        <Text style={styles.title}>
          Filters {hasActiveFilters() && `(${getActiveFilterCount()})`}
        </Text>
        <Button
          mode="text"
          onPress={() => setIsExpanded(!isExpanded)}
          style={styles.toggleButton}
        >
          {isExpanded ? 'Hide' : 'Show'}
        </Button>
      </View>

      {isExpanded && (
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Media Types</Text>
            <View style={styles.chipsContainer}>
              {mediaTypes.map(({ value, label }) => {
                const isActive = filters.mediaTypes.includes(value);
                return (
                  <Chip
                    key={value}
                    mode="flat"
                    selected={isActive}
                    onPress={() => handleMediaTypeToggle(value)}
                    style={[
                      styles.chip,
                      isActive ? styles.activeChip : styles.inactiveChip,
                    ]}
                    textStyle={
                      isActive ? styles.activeChipText : styles.inactiveChipText
                    }
                  >
                    {label}
                  </Chip>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.chipsContainer}>
              {statuses.map(({ value, label }) => {
                const isActive = filters.statuses.includes(value);
                return (
                  <Chip
                    key={value}
                    mode="flat"
                    selected={isActive}
                    onPress={() => handleStatusToggle(value)}
                    style={[
                      styles.chip,
                      isActive ? styles.activeChip : styles.inactiveChip,
                    ]}
                    textStyle={
                      isActive ? styles.activeChipText : styles.inactiveChipText
                    }
                  >
                    {label}
                  </Chip>
                );
              })}
            </View>
          </View>

          {hasActiveFilters() && (
            <View style={styles.actions}>
              <Button
                mode="outlined"
                onPress={onClearFilters}
                style={styles.clearButton}
              >
                Clear All
              </Button>
            </View>
          )}
        </View>
      )}
    </Card>
  );
};

export default CalendarFilters;