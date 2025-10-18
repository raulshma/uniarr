import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { Text, IconButton, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import type { CalendarView, CalendarNavigation } from "@/models/calendar.types";

export type CalendarHeaderProps = {
  navigation: CalendarNavigation;
  view: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  style?: StyleProp<ViewStyle>;
};

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  navigation,
  view,
  onViewChange,
  style,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.custom.spacing.md,
      paddingVertical: theme.custom.spacing.sm,
      backgroundColor: theme.colors.surface,
    },
    leftSection: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    centerSection: {
      flex: 2,
      alignItems: "center",
    },
    rightSection: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      justifyContent: "flex-end",
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
    viewToggle: {
      marginLeft: theme.custom.spacing.sm,
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

  const handleViewToggle = () => {
    const nextView = getNextView(view);
    onViewChange?.(nextView);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftSection}>
        <IconButton
          icon="chevron-left"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={navigation.goToPrevious}
          disabled={!navigation.canGoBack}
          accessibilityLabel="Previous period"
        />
        <IconButton
          icon="chevron-right"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={navigation.goToNext}
          disabled={!navigation.canGoForward}
          accessibilityLabel="Next period"
        />
      </View>

      <View style={styles.centerSection}>
        <Text style={styles.title}>{navigation.currentPeriod}</Text>
      </View>

      <View style={styles.rightSection}>
        <IconButton
          icon="today"
          size={24}
          iconColor={theme.colors.primary}
          onPress={navigation.goToToday}
          accessibilityLabel="Go to today"
        />
        <IconButton
          icon={getViewIcon(view)}
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={handleViewToggle}
          style={styles.viewToggle}
          accessibilityLabel={`Switch to ${getNextView(view)} view`}
        />
      </View>
    </View>
  );
};

export default CalendarHeader;
