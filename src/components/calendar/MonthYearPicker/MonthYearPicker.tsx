import React, { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn } from "react-native-reanimated";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Portal, Text, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";

const normalizeDate = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const createInitialDate = (year: number, month: number): Date =>
  new Date(year, month, 1);

export type MonthYearPickerProps = {
  visible: boolean;
  currentMonth: number;
  currentYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onClose: () => void;
  onToday?: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const [internalDate, setInternalDate] = useState(
    createInitialDate(currentYear, currentMonth),
  );

  useEffect(() => {
    if (visible) {
      setInternalDate(createInitialDate(currentYear, currentMonth));
    }
  }, [visible, currentMonth, currentYear]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleToday = useCallback(() => {
    const today = normalizeDate(new Date());
    setInternalDate(today);
    onMonthChange(today.getMonth());
    onYearChange(today.getFullYear());
    onToday?.();
    onClose();
  }, [onClose, onMonthChange, onYearChange, onToday]);

  const applySelection = useCallback(
    (date: Date) => {
      const normalized = normalizeDate(date);
      setInternalDate(normalized);
      onMonthChange(normalized.getMonth());
      onYearChange(normalized.getFullYear());
    },
    [onMonthChange, onYearChange],
  );

  const handleAndroidChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (event.type === "neutralButtonPressed" && onToday) {
        handleToday();
        return;
      }

      if (event.type === "set" && date) {
        applySelection(date);
      }

      onClose();
    },
    [applySelection, handleToday, onClose, onToday],
  );

  const handleIOSChange = useCallback((_: DateTimePickerEvent, date?: Date) => {
    if (date) {
      setInternalDate(normalizeDate(date));
    }
  }, []);

  const handleApply = useCallback(() => {
    applySelection(internalDate);
    onClose();
  }, [applySelection, internalDate, onClose]);

  if (!visible) return null;

  const themeVariant = theme.dark ? "dark" : "light";

  if (Platform.OS === "android") {
    return (
      <Portal>
        <DateTimePicker
          value={internalDate}
          mode="date"
          display="calendar"
          onChange={handleAndroidChange}
          neutralButtonLabel={onToday ? "Today" : undefined}
        />
      </Portal>
    );
  }

  return (
    <Portal>
      <View style={styles.overlay}>
        <AnimatedPressable
          style={styles.backdrop}
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss picker"
          entering={FadeIn.duration(300)}
        />

        <Animated.View
          style={[styles.container, { backgroundColor: theme.colors.surface }]}
          entering={FadeIn.duration(300).easing(Easing.in(Easing.quad))}
        >
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Select Month & Year
          </Text>

          <View style={styles.pickerWrapper}>
            <DateTimePicker
              value={internalDate}
              mode="date"
              display="spinner"
              themeVariant={themeVariant}
              onChange={handleIOSChange}
              style={styles.iosPicker}
            />
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
              onPress={handleCancel}
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
    </Portal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  container: {
    width: "85%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  pickerWrapper: {
    marginBottom: 16,
  },
  iosPicker: {
    width: "100%",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
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
