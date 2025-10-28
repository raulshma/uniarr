import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View, ScrollView } from "react-native";
import { Text, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import type { CalendarWeek } from "@/models/calendar.types";
import { CalendarDayCell } from "../CalendarDayCell";
import { AnimatedSection } from "@/components/common/AnimatedComponents";

export type CalendarWeekViewProps = {
  data: CalendarWeek;
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
  onReleasePress?: (releaseId: string) => void;
  style?: StyleProp<ViewStyle>;
};

const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
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
      flexDirection: "row",
      backgroundColor: theme.colors.surfaceVariant,
      paddingVertical: theme.custom.spacing.sm,
    },
    headerCell: {
      flex: 1,
      alignItems: "center",
      paddingVertical: theme.custom.spacing.xs,
    },
    headerText: {
      fontSize: theme.custom.typography.labelMedium.fontSize,
      fontFamily: theme.custom.typography.labelMedium.fontFamily,
      fontWeight: theme.custom.typography.labelMedium.fontWeight as any,
      lineHeight: theme.custom.typography.labelMedium.lineHeight,
      letterSpacing: theme.custom.typography.labelMedium.letterSpacing,
      color: theme.colors.onSurfaceVariant,
      textTransform: "uppercase",
    },
    week: {
      flexDirection: "row",
      minHeight: 200,
    },
    timeColumn: {
      width: 60,
      backgroundColor: theme.colors.surfaceVariant,
      paddingVertical: theme.custom.spacing.sm,
    },
    timeSlot: {
      height: 40,
      justifyContent: "center",
      paddingHorizontal: theme.custom.spacing.xs,
    },
    timeText: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      fontWeight: theme.custom.typography.labelSmall.fontWeight as any,
      lineHeight: theme.custom.typography.labelSmall.lineHeight,
      letterSpacing: theme.custom.typography.labelSmall.letterSpacing,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
    },
    dayColumn: {
      flex: 1,
      borderRightWidth: 1,
      borderRightColor: theme.colors.outlineVariant,
    },
    dayColumnLast: {
      borderRightWidth: 0,
    },
  });

  const dayHeaders = data.days.map((day) => {
    const date = new Date(day.date);
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const dayNumber = date.getDate();

    return (
      <View key={day.date} style={styles.headerCell}>
        <Text style={styles.headerText}>{dayName}</Text>
        <Text style={[styles.headerText, { fontSize: 16, marginTop: 2 }]}>
          {dayNumber}
        </Text>
      </View>
    );
  });

  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i;
    const timeString =
      hour === 0
        ? "12 AM"
        : hour < 12
          ? `${hour} AM`
          : hour === 12
            ? "12 PM"
            : `${hour - 12} PM`;

    return (
      <View key={hour} style={styles.timeSlot}>
        <Text style={styles.timeText}>{timeString}</Text>
      </View>
    );
  });

  const handleDatePress = (date: string) => {
    onDateSelect?.(date);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={[styles.headerCell, { width: 60 }]}>
          <Text style={styles.headerText}>Time</Text>
        </View>
        {dayHeaders}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.week}>
          <View style={styles.timeColumn}>{timeSlots}</View>

          {data.days.map((day, index) => (
            <AnimatedSection
              key={day.date}
              style={[
                styles.dayColumn,
                index === data.days.length - 1 && styles.dayColumnLast,
              ]}
              delay={index * 50}
            >
              <CalendarDayCell
                day={day}
                isSelected={selectedDate === day.date}
                onPress={() => handleDatePress(day.date)}
                onReleasePress={onReleasePress}
                style={{ borderRightWidth: 0, minHeight: 960 }} // 24 hours * 40px per hour
                animationIndex={index}
              />
            </AnimatedSection>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default CalendarWeekView;
