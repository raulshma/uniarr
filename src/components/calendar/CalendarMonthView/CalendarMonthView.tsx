import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';
import type { CalendarMonth, CalendarDay } from '@/models/calendar.types';
import { CalendarDayCell } from '../CalendarDayCell';

export type CalendarMonthViewProps = {
  data: CalendarMonth;
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
  onReleasePress?: (releaseId: string) => void;
  style?: StyleProp<ViewStyle>;
};

const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  data,
  selectedDate,
  onDateSelect,
  onReleasePress,
  style,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
    },
    header: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceVariant,
      paddingVertical: theme.custom.spacing.sm,
    },
    headerCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: theme.custom.spacing.xs,
    },
    headerText: {
      fontSize: theme.custom.typography.labelMedium.fontSize,
      fontFamily: theme.custom.typography.labelMedium.fontFamily,
      fontWeight: theme.custom.typography.labelMedium.fontWeight as any,
      lineHeight: theme.custom.typography.labelMedium.lineHeight,
      letterSpacing: theme.custom.typography.labelMedium.letterSpacing,
      color: theme.colors.onSurfaceVariant,
      textTransform: 'uppercase',
    },
    week: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
    },
    weekLast: {
      borderBottomWidth: 0,
    },
  });

  const dayHeaders = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(day => (
      <View key={day} style={styles.headerCell}>
        <Text style={styles.headerText}>{day}</Text>
      </View>
    ));
  }, [styles.headerCell, styles.headerText]);

  const handleDatePress = (date: string) => {
    onDateSelect?.(date);
  };

  const renderWeek = (week: typeof data.weeks[0], weekIndex: number) => {
    const isLastWeek = weekIndex === data.weeks.length - 1;
    
    return (
      <View key={`week-${week.weekNumber}`} style={[styles.week, isLastWeek && styles.weekLast]}>
        {week.days.map((day) => (
          <CalendarDayCell
            key={day.date}
            day={day}
            isSelected={selectedDate === day.date}
            onPress={() => handleDatePress(day.date)}
            onReleasePress={onReleasePress}
            style={{ flex: 1 }}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        {dayHeaders}
      </View>
      {data.weeks.map(renderWeek)}
    </View>
  );
};

export default CalendarMonthView;