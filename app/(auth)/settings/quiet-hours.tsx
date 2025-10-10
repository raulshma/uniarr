import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  IconButton,
  Portal,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/common/Card";
import { TabHeader } from "@/components/common/TabHeader";
import type { AppTheme } from "@/constants/theme";
import type {
  NotificationCategory,
  QuietHoursDay,
  QuietHoursPreset,
} from "@/models/notification.types";
import { useSettingsStore } from "@/store/settingsStore";
import {
  QUIET_HOURS_DAY_LABELS,
  QUIET_HOURS_DAYS,
  formatQuietHoursRange,
  getCategoryFriendlyName,
  getPresetDays,
} from "@/utils/quietHours.utils";
import { spacing } from "@/theme/spacing";

const presetOptions: { value: QuietHoursPreset; label: string }[] = [
  { value: "weeknights", label: "Weeknights" },
  { value: "weekends", label: "Weekends" },
  { value: "everyday", label: "Every day" },
  { value: "custom", label: "Custom" },
];

const categoryCards: {
  id: NotificationCategory;
  icon: string;
  subtitle: string;
}[] = [
  { id: "downloads", icon: "download", subtitle: "Completed downloads" },
  {
    id: "failures",
    icon: "alert-circle-outline",
    subtitle: "Failed downloads",
  },
  { id: "requests", icon: "account-plus", subtitle: "New requests" },
  {
    id: "serviceHealth",
    icon: "server-network",
    subtitle: "Service health events",
  },
];

type TimeField = "start" | "end";

const buildTimeOptions = (): string[] => {
  const options: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const label = `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
    options.push(label);
  }
  return options;
};

const QuietHoursScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const quietHours = useSettingsStore((state) => state.quietHours);
  const updateQuietHoursConfig = useSettingsStore(
    (state) => state.updateQuietHoursConfig
  );
  const criticalBypass = useSettingsStore(
    (state) => state.criticalHealthAlertsBypassQuietHours
  );
  const setCriticalBypass = useSettingsStore(
    (state) => state.setCriticalHealthAlertsBypassQuietHours
  );

  const [timeDialog, setTimeDialog] = useState<{
    category: NotificationCategory;
    field: TimeField;
  } | null>(null);

  const timeOptions = useMemo(buildTimeOptions, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      paddingBottom: spacing.xxxxl,
    },
    section: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
    },
    card: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: 12,
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    title: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
      letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
    },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodyMedium.fontSize,
      fontFamily: theme.custom.typography.bodyMedium.fontFamily,
      lineHeight: theme.custom.typography.bodyMedium.lineHeight,
      letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
      marginBottom: spacing.sm,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    timeRow: {
      flexDirection: "row",
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    timeButton: {
      flex: 1,
      borderRadius: 8,
    },
    timeButtonLabel: {
      fontSize: theme.custom.typography.titleSmall.fontSize,
    },
    presetRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    presetChip: {
      borderRadius: 16,
    },
    footerCard: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: 12,
      marginHorizontal: spacing.md,
      marginTop: spacing.lg,
      padding: spacing.md,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    footerText: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.bodyLarge.fontSize,
      fontFamily: theme.custom.typography.bodyLarge.fontFamily,
      lineHeight: theme.custom.typography.bodyLarge.lineHeight,
    },
    footerDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      lineHeight: theme.custom.typography.bodySmall.lineHeight,
      marginTop: spacing.xxs,
    },
    dialogContent: {
      maxHeight: 320,
    },
    dialogButton: {
      marginVertical: spacing.xxs,
      borderRadius: 8,
    },
  });

  const handleDayToggle = (
    category: NotificationCategory,
    day: QuietHoursDay
  ) => {
    const config = quietHours[category];
    const nextDays = config.days.includes(day)
      ? config.days.filter((existing) => existing !== day)
      : [...config.days, day];

    updateQuietHoursConfig(category, {
      days: nextDays,
      preset: "custom",
    });
  };

  const handlePresetSelect = (
    category: NotificationCategory,
    preset: QuietHoursPreset
  ) => {
    updateQuietHoursConfig(category, {
      preset,
      days:
        preset === "custom" ? quietHours[category].days : getPresetDays(preset),
    });
  };

  const openTimeDialog = (category: NotificationCategory, field: TimeField) => {
    setTimeDialog({ category, field });
  };

  const handleTimeSelect = (time: string) => {
    if (!timeDialog) {
      return;
    }

    updateQuietHoursConfig(timeDialog.category, {
      [timeDialog.field]: time,
      preset: quietHours[timeDialog.category].preset,
    });
    setTimeDialog(null);
  };

  const currentDialogValue = timeDialog
    ? quietHours[timeDialog.category][timeDialog.field]
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <TabHeader
          showTitle
          title="Quiet hours"
          showBackButton
          onBackPress={() => router.back()}
        />

        <View style={styles.section}>
          <Text style={styles.subtitle}>
            Configure quiet hours per notification type. Notifications that
            arrive during quiet hours are bundled into a summary once the window
            ends.
          </Text>
        </View>

        <View style={styles.section}>
          {categoryCards.map(({ id, icon, subtitle }) => {
            const config = quietHours[id];
            const rangeLabel = formatQuietHoursRange(config);

            return (
              <Card key={id} variant="custom" style={styles.card}>
                <View style={styles.headerRow}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <IconButton
                      icon={icon}
                      size={24}
                      iconColor={theme.colors.primary}
                    />
                    <View>
                      <Text style={styles.title}>
                        {getCategoryFriendlyName(id)}
                      </Text>
                      <Text style={styles.subtitle}>{subtitle}</Text>
                    </View>
                  </View>
                  <Switch
                    value={config.enabled}
                    onValueChange={(value) =>
                      updateQuietHoursConfig(id, { enabled: value })
                    }
                    color={theme.colors.primary}
                  />
                </View>

                <View style={styles.timeRow}>
                  <Button
                    mode="outlined"
                    icon="clock-outline"
                    style={styles.timeButton}
                    textColor={theme.colors.onSurface}
                    onPress={() => openTimeDialog(id, "start")}
                  >
                    {`Start • ${config.start}`}
                  </Button>
                  <Button
                    mode="outlined"
                    icon="clock-outline"
                    style={styles.timeButton}
                    textColor={theme.colors.onSurface}
                    onPress={() => openTimeDialog(id, "end")}
                  >
                    {`End • ${config.end}`}
                  </Button>
                </View>

                <Text style={styles.subtitle}>Active days</Text>
                <View style={styles.chipRow}>
                  {QUIET_HOURS_DAYS.map((day) => {
                    const isSelected = config.days.includes(day);
                    return (
                      <Chip
                        key={day}
                        selected={isSelected}
                        onPress={() => handleDayToggle(id, day)}
                        mode={isSelected ? "flat" : "outlined"}
                        style={styles.presetChip}
                      >
                        {QUIET_HOURS_DAY_LABELS[day]}
                      </Chip>
                    );
                  })}
                </View>

                <Text style={styles.subtitle}>Presets</Text>
                <View style={styles.presetRow}>
                  {presetOptions.map((preset) => (
                    <Chip
                      key={preset.value}
                      selected={config.preset === preset.value}
                      onPress={() => handlePresetSelect(id, preset.value)}
                      mode={
                        config.preset === preset.value ? "flat" : "outlined"
                      }
                      style={styles.presetChip}
                    >
                      {preset.label}
                    </Chip>
                  ))}
                </View>

                <Text
                  style={styles.subtitle}
                >{`Current window • ${rangeLabel}`}</Text>
              </Card>
            );
          })}
        </View>

        <View style={styles.footerCard}>
          <View style={styles.footerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.footerText}>
                Allow critical health alerts
              </Text>
              <Text style={styles.footerDescription}>
                Offline service alerts bypass quiet hours so you can react
                quickly.
              </Text>
            </View>
            <Switch
              value={criticalBypass}
              onValueChange={setCriticalBypass}
              color={theme.colors.primary}
            />
          </View>
        </View>
      </ScrollView>

      <Portal>
        <Dialog
          visible={Boolean(timeDialog)}
          onDismiss={() => setTimeDialog(null)}
          style={{
            borderRadius: 12,
            backgroundColor: theme.colors.elevation.level1,
          }}
        >
          <Dialog.Title>Select time</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={styles.dialogContent}>
              {timeOptions.map((time) => (
                <Button
                  key={time}
                  mode={currentDialogValue === time ? "contained" : "outlined"}
                  onPress={() => handleTimeSelect(time)}
                  style={styles.dialogButton}
                >
                  {time}
                </Button>
              ))}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTimeDialog(null)} mode="outlined">
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default QuietHoursScreen;
