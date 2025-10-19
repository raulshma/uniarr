import React, { useCallback, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { Text, IconButton, useTheme } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import type { AppTheme } from "@/constants/theme";
import type { CalendarView, CalendarNavigation } from "@/models/calendar.types";
import { iconSizes, borderRadius } from "@/constants/sizes";
import { getComponentElevation } from "@/constants/elevation";
import { createFlexLayout } from "@/utils/style.utils";
import { spacing } from "@/theme/spacing";
import MonthYearPicker from "../MonthYearPicker/MonthYearPicker";

export type EnhancedCalendarHeaderProps = {
  navigation: CalendarNavigation;
  view: CalendarView;
  currentDate: string;
  onViewChange?: (view: CalendarView) => void;
  style?: StyleProp<ViewStyle>;
};

const EnhancedCalendarHeader: React.FC<EnhancedCalendarHeaderProps> = ({
  navigation,
  view,
  currentDate,
  onViewChange,
  style,
}) => {
  const theme = useTheme<AppTheme>();
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);

  // Animation values for buttons
  const prevButtonScale = useSharedValue(1);
  const nextButtonScale = useSharedValue(1);
  const todayButtonScale = useSharedValue(1);
  const viewButtonScale = useSharedValue(1);
  const titleScale = useSharedValue(1);

  const styles = StyleSheet.create({
    container: {
      ...createFlexLayout("row", "md", {
        justify: "space-between",
        align: "center",
      }),
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: theme.colors.surface,
      ...getComponentElevation("widgetHeader", theme),
    },
    leftSection: {
      ...createFlexLayout("row", "sm", { align: "center" }),
      flex: 1,
    },
    centerSection: {
      flex: 2,
      alignItems: "center",
    },
    rightSection: {
      ...createFlexLayout("row", "sm", {
        align: "center",
        justify: "flex-end",
      }),
      flex: 1,
    },
    title: {
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
      lineHeight: theme.custom.typography.titleLarge.lineHeight,
      letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
      color: theme.colors.onSurface,
      textAlign: "center",
    },
    titleButton: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.md, // 8 -> md
      minWidth: spacing.xxxl + spacing.xl, // 120 -> centralized
    },
    navigationButton: {
      marginHorizontal: spacing.xxs, // 2 -> xxs
    },
    actionButton: {
      marginHorizontal: spacing.xxs, // 2 -> xxs
    },
    viewToggle: {
      marginLeft: spacing.sm,
    },
  });

  const getViewIcon = (view: CalendarView): string => {
    switch (view) {
      case "month":
        return "calendar-month";
      case "week":
        return "calendar-week";
      case "day":
        return "calendar-today";
      case "list":
        return "format-list-bulleted";
      default:
        return "calendar-month";
    }
  };

  const getNextView = (currentView: CalendarView): CalendarView => {
    switch (currentView) {
      case "month":
        return "week";
      case "week":
        return "day";
      case "day":
        return "list";
      case "list":
        return "month";
      default:
        return "month";
    }
  };

  const handleViewToggle = useCallback(() => {
    // Animate the button
    viewButtonScale.value = withSpring(
      0.9,
      { damping: 15, stiffness: 300 },
      () => {
        viewButtonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      },
    );

    const nextView = getNextView(view);
    onViewChange?.(nextView);
  }, [view, onViewChange, viewButtonScale]);

  const handlePreviousPress = useCallback(() => {
    prevButtonScale.value = withSpring(
      0.85,
      { damping: 15, stiffness: 300 },
      () => {
        prevButtonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      },
    );
    navigation.goToPrevious();
  }, [navigation, prevButtonScale]);

  const handleNextPress = useCallback(() => {
    nextButtonScale.value = withSpring(
      0.85,
      { damping: 15, stiffness: 300 },
      () => {
        nextButtonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      },
    );
    navigation.goToNext();
  }, [navigation, nextButtonScale]);

  const handleTodayPress = useCallback(() => {
    todayButtonScale.value = withSpring(
      0.9,
      { damping: 15, stiffness: 300 },
      () => {
        todayButtonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      },
    );
    navigation.goToToday();
  }, [navigation, todayButtonScale]);

  const handleTitlePress = useCallback(() => {
    titleScale.value = withSpring(0.95, { damping: 15, stiffness: 300 }, () => {
      titleScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    });
    setShowMonthYearPicker(true);
  }, [titleScale]);

  const handleMonthChange = useCallback(
    (month: number) => {
      // Convert month index to date and navigate
      const date = new Date(currentDate);
      date.setMonth(month);
      const isoDate = date.toISOString().split("T")[0];
      if (isoDate) {
        navigation.goToDate(isoDate);
      }
    },
    [currentDate, navigation],
  );

  const handleYearChange = useCallback(
    (year: number) => {
      // Convert year to date and navigate
      const date = new Date(currentDate);
      date.setFullYear(year);
      const isoDate = date.toISOString().split("T")[0];
      if (isoDate) {
        navigation.goToDate(isoDate);
      }
    },
    [currentDate, navigation],
  );

  const handleTodayFromPicker = useCallback(() => {
    navigation.goToToday();
  }, [navigation]);

  // Animated styles for buttons
  const prevButtonStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: prevButtonScale.value }],
    }),
    [prevButtonScale],
  );

  const nextButtonStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: nextButtonScale.value }],
    }),
    [nextButtonScale],
  );

  const todayButtonStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: todayButtonScale.value }],
    }),
    [todayButtonScale],
  );

  const viewButtonStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: viewButtonScale.value }],
    }),
    [viewButtonScale],
  );

  const titleStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: titleScale.value }],
    }),
    [titleScale],
  );

  // Extract current month and year from the current date
  const getCurrentMonthYear = useCallback(() => {
    const date = new Date(currentDate);
    const monthIndex = date.getMonth();
    const year = date.getFullYear();

    return { month: monthIndex, year };
  }, [currentDate]);

  const { month, year } = getCurrentMonthYear();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftSection}>
        <Animated.View style={prevButtonStyle}>
          <IconButton
            icon="chevron-left"
            size={iconSizes.md} // 24 -> centralized
            iconColor={theme.colors.onSurface}
            onPress={handlePreviousPress}
            disabled={!navigation.canGoBack}
            accessibilityLabel="Previous period"
            style={styles.navigationButton}
          />
        </Animated.View>

        <Animated.View style={nextButtonStyle}>
          <IconButton
            icon="chevron-right"
            size={iconSizes.md} // 24 -> centralized
            iconColor={theme.colors.onSurface}
            onPress={handleNextPress}
            disabled={!navigation.canGoForward}
            accessibilityLabel="Next period"
            style={styles.navigationButton}
          />
        </Animated.View>
      </View>

      <View style={styles.centerSection}>
        <Animated.View style={[titleStyle, styles.titleButton]}>
          <Text
            style={styles.title}
            onPress={handleTitlePress}
            accessibilityRole="button"
            accessibilityLabel="Tap to select month and year"
          >
            {navigation.currentPeriod}
          </Text>
        </Animated.View>
      </View>

      <View style={styles.rightSection}>
        <Animated.View style={todayButtonStyle}>
          <IconButton
            icon="today"
            size={iconSizes.md} // 24 -> centralized
            iconColor={theme.colors.primary}
            onPress={handleTodayPress}
            accessibilityLabel="Go to today"
            style={styles.actionButton}
          />
        </Animated.View>

        <Animated.View style={viewButtonStyle}>
          <IconButton
            icon={getViewIcon(view)}
            size={iconSizes.md} // 24 -> centralized
            iconColor={theme.colors.onSurface}
            onPress={handleViewToggle}
            style={[styles.actionButton, styles.viewToggle]}
            accessibilityLabel={`Switch to ${getNextView(view)} view`}
          />
        </Animated.View>
      </View>

      <MonthYearPicker
        visible={showMonthYearPicker}
        currentMonth={month}
        currentYear={year}
        onMonthChange={handleMonthChange}
        onYearChange={handleYearChange}
        onClose={() => setShowMonthYearPicker(false)}
        onToday={handleTodayFromPicker}
      />
    </View>
  );
};

export default EnhancedCalendarHeader;
