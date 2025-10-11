import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';
import type { CalendarDay } from '@/models/calendar.types';
import { MediaReleaseCard } from '../MediaReleaseCard';

export type CalendarDayCellProps = {
  day: CalendarDay;
  isSelected?: boolean;
  isExpanded?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onReleasePress?: (releaseId: string) => void;
  style?: StyleProp<ViewStyle>;
};

const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  day,
  isSelected = false,
  isExpanded = false,
  onPress,
  onLongPress,
  onReleasePress,
  style,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      minHeight: 120,
      borderRightWidth: 1,
      borderRightColor: theme.colors.outlineVariant,
      padding: theme.custom.spacing.xs,
    },
    containerLast: {
      borderRightWidth: 0,
    },
    pressable: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    dateContainer: {
      alignItems: 'center',
      marginBottom: theme.custom.spacing.xs,
    },
    dateText: {
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
      lineHeight: theme.custom.typography.bodyMedium.lineHeight,
      letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
      color: theme.colors.onSurface,
    },
    dateTextToday: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    dateTextOtherMonth: {
      color: theme.colors.onSurfaceVariant,
      opacity: 0.5,
    },
    dateTextSelected: {
      color: theme.colors.onPrimary,
    },
    selectedIndicator: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
    },
    releasesContainer: {
      flex: 1,
    },
    releaseItem: {
      marginBottom: theme.custom.spacing.xxs,
    },
    releaseItemLast: {
      marginBottom: 0,
    },
    moreIndicator: {
      alignItems: 'center',
      paddingVertical: theme.custom.spacing.xxs,
    },
    moreText: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      fontWeight: theme.custom.typography.labelSmall.fontWeight as any,
      lineHeight: theme.custom.typography.labelSmall.lineHeight,
      letterSpacing: theme.custom.typography.labelSmall.letterSpacing,
      color: theme.colors.primary,
    },
  });

  const dateNumber = useMemo(() => {
    return new Date(day.date).getDate();
  }, [day.date]);

  const isToday = day.isToday;
  const isOtherMonth = !day.isCurrentMonth;
  const hasReleases = day.releases.length > 0;
  const maxVisibleReleases = isExpanded ? day.releases.length : 3;
  const visibleReleases = day.releases.slice(0, maxVisibleReleases);
  const hasMoreReleases = day.releases.length > maxVisibleReleases;
  const moreCount = day.releases.length - maxVisibleReleases;

  const getDateTextStyle = () => {
    if (isSelected) return styles.dateTextSelected;
    if (isToday) return styles.dateTextToday;
    if (isOtherMonth) return styles.dateTextOtherMonth;
    return styles.dateText;
  };

  const getContainerStyle = () => {
    const baseStyle: any[] = [styles.container];
    if (isSelected) {
      baseStyle.push({ backgroundColor: theme.colors.primaryContainer });
    }
    return baseStyle;
  };

  const getPressableStyle = ({ pressed }: { pressed: boolean }) => {
    return [
      styles.pressable,
      pressed && {
        opacity: 0.7,
        transform: [{ scale: 0.95 }],
      },
    ];
  };

  return (
    <View style={[getContainerStyle(), style]}>
      <Pressable
        style={getPressableStyle}
        onPress={onPress}
        onLongPress={onLongPress}
        android_ripple={{
          color: theme.colors.onSurfaceVariant,
          borderless: false,
        }}
        accessibilityRole="button"
        accessibilityLabel={`${day.date}${hasReleases ? `, ${day.releases.length} releases` : ''}`}
        accessibilityState={{ selected: isSelected }}
      >
        <View style={styles.content}>
          <View style={styles.dateContainer}>
            <Text style={[styles.dateText, getDateTextStyle()]}>
              {dateNumber}
            </Text>
            {hasReleases && !isSelected && (
              <View style={styles.selectedIndicator} />
            )}
          </View>

          <View style={styles.releasesContainer}>
            {visibleReleases.map((release, index) => (
              <View
                key={release.id}
                style={[
                  styles.releaseItem,
                  index === visibleReleases.length - 1 && styles.releaseItemLast,
                ]}
              >
                <MediaReleaseCard
                  release={release}
                  compact
                  onPress={() => onReleasePress?.(release.id)}
                />
              </View>
            ))}

            {hasMoreReleases && (
              <View style={styles.moreIndicator}>
                <Text style={styles.moreText}>
                  +{moreCount} more
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
};

export default CalendarDayCell;