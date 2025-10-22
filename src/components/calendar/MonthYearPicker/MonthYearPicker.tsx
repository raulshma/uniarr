import React, { useCallback, useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import type { AppTheme } from "@/constants/theme";

const { width: screenWidth } = Dimensions.get("window");
const ITEM_WIDTH = screenWidth * 0.3;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const generateYears = (currentYear: number): number[] => {
  const years: number[] = [];
  for (let i = currentYear - 50; i <= currentYear + 10; i++) {
    years.push(i);
  }
  return years;
};

export type MonthYearPickerProps = {
  visible: boolean;
  currentMonth: number;
  currentYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onClose: () => void;
  onToday?: () => void;
};

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  visible,
  currentMonth,
  currentYear,
  onMonthChange,
  onYearChange,
  onClose,
  onToday,
}) => {
  const theme = useTheme<AppTheme>();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const years = useMemo(() => generateYears(new Date().getFullYear()), []);

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 1 : 0, { duration: 200 }),
      transform: [
        {
          scale: withSpring(visible ? 1 : 0.8, { damping: 20, stiffness: 300 }),
        },
      ],
    };
  }, [visible]);

  const animatedBackdropStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 0.5 : 0, { duration: 200 }),
    };
  }, [visible]);

  const handleMonthSelect = useCallback(
    (monthIndex: number) => {
      setSelectedMonth(monthIndex);
      onMonthChange(monthIndex);
    },
    [onMonthChange],
  );

  const handleYearSelect = useCallback(
    (year: number) => {
      setSelectedYear(year);
      onYearChange(year);
    },
    [onYearChange],
  );

  const handleToday = useCallback(() => {
    const today = new Date();
    const month = today.getMonth();
    const year = today.getFullYear();
    setSelectedMonth(month);
    setSelectedYear(year);
    onMonthChange(month);
    onYearChange(year);
    onToday?.();
    onClose();
  }, [onMonthChange, onYearChange, onToday, onClose]);

  const handleApply = useCallback(() => {
    onMonthChange(selectedMonth);
    onYearChange(selectedYear);
    onClose();
  }, [onMonthChange, onYearChange, selectedMonth, selectedYear, onClose]);

  const getMonthItemStyle = useCallback(
    (monthIndex: number) => {
      const isSelected = monthIndex === selectedMonth;
      const isCurrent =
        monthIndex === currentMonth && selectedYear === currentYear;

      return [
        styles.monthItem,
        {
          backgroundColor: isSelected
            ? theme.colors.primary
            : isCurrent
              ? theme.colors.surfaceVariant
              : "transparent",
          borderWidth: isSelected ? 0 : 1,
          borderColor: isCurrent ? theme.colors.outline : "transparent",
        },
      ];
    },
    [selectedMonth, selectedYear, currentMonth, currentYear, theme],
  );

  const getYearItemStyle = useCallback(
    (year: number) => {
      const isSelected = year === selectedYear;
      const isCurrent = year === currentYear && selectedMonth === currentMonth;

      return [
        styles.yearItem,
        {
          backgroundColor: isSelected
            ? theme.colors.primary
            : isCurrent
              ? theme.colors.surfaceVariant
              : "transparent",
          borderWidth: isSelected ? 0 : 1,
          borderColor: isCurrent ? theme.colors.outline : "transparent",
        },
      ];
    },
    [selectedYear, selectedMonth, currentYear, currentMonth, theme],
  );

  const getMonthTextStyle = useCallback(
    (monthIndex: number) => {
      const isSelected = monthIndex === selectedMonth;
      const isCurrent =
        monthIndex === currentMonth && selectedYear === currentYear;

      return [
        styles.monthText,
        {
          color: isSelected
            ? theme.colors.onPrimary
            : isCurrent
              ? theme.colors.onSurfaceVariant
              : theme.colors.onSurface,
          fontWeight: isSelected ? ("600" as const) : ("400" as const),
        },
      ];
    },
    [selectedMonth, selectedYear, currentMonth, currentYear, theme],
  );

  const getYearTextStyle = useCallback(
    (year: number) => {
      const isSelected = year === selectedYear;
      const isCurrent = year === currentYear && selectedMonth === currentMonth;

      return [
        styles.yearText,
        {
          color: isSelected
            ? theme.colors.onPrimary
            : isCurrent
              ? theme.colors.onSurfaceVariant
              : theme.colors.onSurface,
          fontWeight: isSelected ? ("600" as const) : ("400" as const),
        },
      ];
    },
    [selectedYear, selectedMonth, currentYear, currentMonth, theme],
  );

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />

      <Animated.View
        style={[
          styles.container,
          animatedContainerStyle,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Select Month & Year
          </Text>
        </View>

        <View style={styles.content}>
          <View style={styles.column}>
            <Text
              style={[
                styles.columnTitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Month
            </Text>
            <View style={styles.monthGrid}>
              {MONTHS.map((month, index) => (
                <Pressable
                  key={month}
                  onPress={() => handleMonthSelect(index)}
                  style={getMonthItemStyle(index)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: index === selectedMonth }}
                  accessibilityLabel={`Select ${month}`}
                >
                  <Text style={getMonthTextStyle(index)}>
                    {month.slice(0, 3)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.column}>
            <Text
              style={[
                styles.columnTitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Year
            </Text>
            <View style={styles.yearList}>
              {years.map((year) => (
                <Pressable
                  key={year}
                  onPress={() => handleYearSelect(year)}
                  style={getYearItemStyle(year)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: year === selectedYear }}
                  accessibilityLabel={`Select year ${year}`}
                >
                  <Text style={getYearTextStyle(year)}>{year}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          {onToday && (
            <Pressable
              onPress={handleToday}
              style={[styles.actionButton, styles.todayButton]}
              accessibilityRole="button"
              accessibilityLabel="Go to today"
            >
              <Text
                style={[
                  styles.actionButtonText,
                  { color: theme.colors.primary },
                ]}
              >
                Today
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={onClose}
            style={[styles.actionButton, styles.cancelButton]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Cancel
            </Text>
          </Pressable>

          <Pressable
            onPress={handleApply}
            style={[
              styles.actionButton,
              styles.applyButton,
              { backgroundColor: theme.colors.primary },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Apply selection"
          >
            <Text
              style={[
                styles.actionButtonText,
                styles.applyButtonText,
                { color: theme.colors.onPrimary },
              ]}
            >
              Apply
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "black",
  },
  container: {
    width: screenWidth * 0.9,
    maxWidth: 400,
    maxHeight: "80%",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    marginBottom: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  content: {
    flexDirection: "row",
    marginBottom: 24,
  },
  column: {
    flex: 1,
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
    textAlign: "center",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginRight: 8,
  },
  monthItem: {
    width: ITEM_WIDTH * 0.8,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  monthText: {
    fontSize: 12,
    fontWeight: "400",
  },
  yearList: {
    maxHeight: 300,
    marginLeft: 8,
  },
  yearItem: {
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  yearText: {
    fontSize: 14,
    fontWeight: "400",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: "center",
  },
  todayButton: {
    backgroundColor: "transparent",
  },
  cancelButton: {
    backgroundColor: "transparent",
  },
  applyButton: {
    backgroundColor: "#2196F3",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  applyButtonText: {
    color: "white",
  },
});

export default MonthYearPicker;
