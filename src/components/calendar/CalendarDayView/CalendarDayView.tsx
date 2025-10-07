import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';
import type { CalendarDay } from '@/models/calendar.types';
import { MediaReleaseCard } from '../MediaReleaseCard';

export type CalendarDayViewProps = {
  data: CalendarDay;
  onReleasePress?: (releaseId: string) => void;
  style?: StyleProp<ViewStyle>;
};

const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  data,
  onReleasePress,
  style,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    header: {
      backgroundColor: theme.colors.surfaceVariant,
      padding: theme.custom.spacing.md,
      alignItems: 'center',
    },
    dateText: {
      fontSize: theme.custom.typography.headlineMedium.fontSize,
      fontFamily: theme.custom.typography.headlineMedium.fontFamily,
      fontWeight: theme.custom.typography.headlineMedium.fontWeight as any,
      lineHeight: theme.custom.typography.headlineMedium.lineHeight,
      letterSpacing: theme.custom.typography.headlineMedium.letterSpacing,
      color: theme.colors.onSurface,
    },
    weekdayText: {
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
      letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.custom.spacing.xs,
    },
    content: {
      flex: 1,
      padding: theme.custom.spacing.md,
    },
    section: {
      marginBottom: theme.custom.spacing.lg,
    },
    sectionTitle: {
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
      lineHeight: theme.custom.typography.titleLarge.lineHeight,
      letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
      color: theme.colors.onSurface,
      marginBottom: theme.custom.spacing.md,
    },
    releasesList: {
      gap: theme.custom.spacing.sm,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: theme.custom.spacing.xl,
    },
    emptyText: {
      fontSize: theme.custom.typography.bodyLarge.fontSize,
      fontFamily: theme.custom.typography.bodyLarge.fontFamily,
      fontWeight: theme.custom.typography.bodyLarge.fontWeight as any,
      lineHeight: theme.custom.typography.bodyLarge.lineHeight,
      letterSpacing: theme.custom.typography.bodyLarge.letterSpacing,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
  });

  const date = useMemo(() => {
    const dateObj = new Date(data.date);
    return {
      weekday: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
      month: dateObj.toLocaleDateString('en-US', { month: 'long' }),
      day: dateObj.getDate(),
      year: dateObj.getFullYear(),
    };
  }, [data.date]);

  const releasesByStatus = useMemo(() => {
    const upcoming = data.releases.filter(r => r.status === 'upcoming');
    const released = data.releases.filter(r => r.status === 'released');
    const delayed = data.releases.filter(r => r.status === 'delayed');
    const cancelled = data.releases.filter(r => r.status === 'cancelled');

    return { upcoming, released, delayed, cancelled };
  }, [data.releases]);

  const hasReleases = data.releases.length > 0;

  if (!hasReleases) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.header}>
          <Text style={styles.dateText}>
            {date.weekday}, {date.month} {date.day}, {date.year}
          </Text>
        </View>
        <View style={styles.content}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No releases scheduled for this day
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.dateText}>
          {date.weekday}, {date.month} {date.day}, {date.year}
        </Text>
        <Text style={styles.weekdayText}>
          {data.releases.length} release{data.releases.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {releasesByStatus.upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Releases</Text>
            <View style={styles.releasesList}>
              {releasesByStatus.upcoming.map((release) => (
                <MediaReleaseCard
                  key={release.id}
                  release={release}
                  onPress={() => onReleasePress?.(release.id)}
                />
              ))}
            </View>
          </View>
        )}

        {releasesByStatus.released.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Released Today</Text>
            <View style={styles.releasesList}>
              {releasesByStatus.released.map((release) => (
                <MediaReleaseCard
                  key={release.id}
                  release={release}
                  onPress={() => onReleasePress?.(release.id)}
                />
              ))}
            </View>
          </View>
        )}

        {releasesByStatus.delayed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delayed Releases</Text>
            <View style={styles.releasesList}>
              {releasesByStatus.delayed.map((release) => (
                <MediaReleaseCard
                  key={release.id}
                  release={release}
                  onPress={() => onReleasePress?.(release.id)}
                />
              ))}
            </View>
          </View>
        )}

        {releasesByStatus.cancelled.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cancelled Releases</Text>
            <View style={styles.releasesList}>
              {releasesByStatus.cancelled.map((release) => (
                <MediaReleaseCard
                  key={release.id}
                  release={release}
                  onPress={() => onReleasePress?.(release.id)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default CalendarDayView;