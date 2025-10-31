import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Checkbox,
  HelperText,
  Text,
  TextInput,
} from "react-native-paper";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useHaptics } from "@/hooks/useHaptics";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { calendarPreviewWidgetConfigSchema } from "@/utils/validation.utils";
import type { CalendarPreviewWidgetConfig } from "@/utils/validation.utils";

type FormValues = CalendarPreviewWidgetConfig;

type CalendarPreviewWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const CalendarPreviewWidgetConfigForm: React.FC<
  CalendarPreviewWidgetConfigFormProps
> = ({ widget, onSaved }) => {
  const { onPress } = useHaptics();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const defaultValues = useMemo<FormValues>(() => {
    const config = widget.config || {};
    return {
      daysAhead: config.daysAhead ?? 30,
      limit: config.limit ?? 8,
      serviceTypes: config.serviceTypes ?? ["sonarr", "radarr"],
    };
  }, [widget.config]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(calendarPreviewWidgetConfigSchema),
    defaultValues,
    mode: "onBlur",
  });

  const selectedServiceTypes = watch("serviceTypes");

  const handleToggleServiceType = (type: "sonarr" | "radarr") => {
    const current = new Set(selectedServiceTypes);
    if (current.has(type)) {
      current.delete(type);
    } else {
      current.add(type);
    }
    setValue("serviceTypes", Array.from(current), { shouldDirty: true });
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);

    try {
      setSaving(true);
      await widgetService.updateWidget(widget.id, {
        config: {
          ...widget.config,
          daysAhead: values.daysAhead,
          limit: values.limit,
          serviceTypes: values.serviceTypes,
        },
      });
      await widgetService.clearWidgetData(widget.id);
      onSaved();
    } catch {
      setSubmitError(
        "Failed to save calendar configuration. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Upcoming Releases
      </Text>
      <Text variant="bodyMedium" style={styles.sectionDescription}>
        Configure how upcoming releases are displayed and filtered.
      </Text>

      <View style={styles.section}>
        <Text variant="labelLarge" style={styles.label}>
          Look Ahead Period
        </Text>
        <Controller
          control={control}
          name="daysAhead"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              mode="outlined"
              label="Days ahead"
              value={String(value ?? "")}
              onChangeText={(text) =>
                onChange(Math.max(1, parseInt(text, 10) || 1))
              }
              onBlur={onBlur}
              keyboardType="number-pad"
              style={styles.input}
            />
          )}
        />
        {errors.daysAhead && (
          <HelperText type="error">{errors.daysAhead.message}</HelperText>
        )}
        <Text variant="bodySmall" style={styles.helperText}>
          Show releases up to this many days in the future (1-365 days)
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="labelLarge" style={styles.label}>
          Maximum Items
        </Text>
        <Controller
          control={control}
          name="limit"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              mode="outlined"
              label="Items to show"
              value={String(value ?? "")}
              onChangeText={(text) =>
                onChange(Math.max(1, parseInt(text, 10) || 1))
              }
              onBlur={onBlur}
              keyboardType="number-pad"
              style={styles.input}
            />
          )}
        />
        {errors.limit && (
          <HelperText type="error">{errors.limit.message}</HelperText>
        )}
        <Text variant="bodySmall" style={styles.helperText}>
          Display between 1 and 50 upcoming releases
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="labelLarge" style={styles.label}>
          Source Services
        </Text>
        <View style={styles.checkboxGroup}>
          <View style={styles.checkboxRow}>
            <Checkbox
              status={
                selectedServiceTypes.includes("sonarr")
                  ? "checked"
                  : "unchecked"
              }
              onPress={() => {
                onPress();
                handleToggleServiceType("sonarr");
              }}
            />
            <Text variant="bodyMedium" style={styles.checkboxLabel}>
              Sonarr
            </Text>
          </View>
          <View style={styles.checkboxRow}>
            <Checkbox
              status={
                selectedServiceTypes.includes("radarr")
                  ? "checked"
                  : "unchecked"
              }
              onPress={() => {
                onPress();
                handleToggleServiceType("radarr");
              }}
            />
            <Text variant="bodyMedium" style={styles.checkboxLabel}>
              Radarr
            </Text>
          </View>
        </View>
        <Text variant="bodySmall" style={styles.helperText}>
          Select which services to include in the upcoming releases list
        </Text>
      </View>

      {submitError && <HelperText type="error">{submitError}</HelperText>}

      <Button
        mode="contained"
        onPress={handleSubmit(onSubmit)}
        loading={saving}
        disabled={saving || (!isDirty && !submitError)}
        style={styles.saveButton}
      >
        Save Changes
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  sectionDescription: {
    opacity: 0.7,
  },
  section: {
    gap: 8,
  },
  label: {
    fontWeight: "500",
  },
  input: {
    marginBottom: 4,
  },
  helperText: {
    opacity: 0.7,
    paddingHorizontal: 4,
  },
  checkboxGroup: {
    gap: 12,
    paddingHorizontal: 8,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkboxLabel: {
    flex: 1,
  },
  saveButton: {
    marginTop: 8,
  },
});

export default CalendarPreviewWidgetConfigForm;
