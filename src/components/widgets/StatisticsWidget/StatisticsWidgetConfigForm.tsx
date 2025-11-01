import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  HelperText,
  SegmentedButtons,
  Switch,
  Text,
} from "react-native-paper";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useHaptics } from "@/hooks/useHaptics";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { statisticsWidgetConfigSchema } from "@/utils/validation.utils";
import type { StatisticsWidgetConfig } from "@/utils/validation.utils";
import ServiceSelectionDialog from "../ServiceSelectionDialog";

const FILTER_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "recent", label: "Recent (7 days)" },
  { value: "month", label: "This Month" },
] as const;

type FormValues = StatisticsWidgetConfig;

type StatisticsWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const StatisticsWidgetConfigForm: React.FC<StatisticsWidgetConfigFormProps> = ({
  widget,
  onSaved,
}) => {
  const { onPress } = useHaptics();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);

  const defaultValues = useMemo<FormValues>(() => {
    const config = widget.config || {};
    return {
      filter: (config.filter as any) ?? "all",
      sourceMode: config.sourceMode ?? "global",
      serviceIds: config.serviceIds ?? [],
    };
  }, [widget.config]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(statisticsWidgetConfigSchema),
    defaultValues,
    mode: "onBlur",
  });

  const sourceMode = watch("sourceMode");
  const selectedServiceIds = watch("serviceIds");

  const handleServiceSelectionChange = (ids: string[]) => {
    setValue("serviceIds", ids, { shouldDirty: true });
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);

    try {
      setSaving(true);
      await widgetService.updateWidget(widget.id, {
        config: {
          ...widget.config,
          filter: values.filter,
          sourceMode: values.sourceMode,
          serviceIds: values.serviceIds,
        },
      });
      await widgetService.clearWidgetData(widget.id);
      onSaved();
    } catch {
      setSubmitError(
        "Failed to save statistics configuration. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Statistics Display
      </Text>
      <Text variant="bodyMedium" style={styles.sectionDescription}>
        Configure how your library statistics are calculated and displayed.
      </Text>

      <View style={styles.section}>
        <Text variant="labelLarge" style={styles.label}>
          Time Filter
        </Text>
        <Controller
          control={control}
          name="filter"
          render={({ field: { value, onChange } }) => (
            <SegmentedButtons
              value={value}
              onValueChange={(next) => {
                onPress();
                onChange(next);
              }}
              buttons={FILTER_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          )}
        />
        <Text variant="bodySmall" style={styles.helperText}>
          Calculate statistics based on the selected time period
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="labelLarge" style={styles.label}>
          Source Mode
        </Text>
        <Controller
          control={control}
          name="sourceMode"
          render={({ field: { value, onChange } }) => (
            <View style={styles.sourceModeRow}>
              <Text variant="bodyMedium" style={styles.sourceModeLabel}>
                All Services
              </Text>
              <Switch
                value={value === "custom"}
                onValueChange={(enabled) => {
                  onPress();
                  onChange(enabled ? "custom" : "global");
                }}
              />
              <Text variant="bodyMedium" style={styles.sourceModeLabel}>
                Custom Selection
              </Text>
            </View>
          )}
        />
      </View>

      {sourceMode === "custom" && (
        <View style={styles.section}>
          <Button
            mode="outlined"
            onPress={() => {
              onPress();
              setDialogVisible(true);
            }}
            style={styles.selectButton}
          >
            Select Services ({selectedServiceIds.length})
          </Button>
          {errors.serviceIds && (
            <HelperText type="error">{errors.serviceIds.message}</HelperText>
          )}
        </View>
      )}

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

      <ServiceSelectionDialog
        visible={dialogVisible}
        selectedIds={selectedServiceIds}
        onSelectionChange={handleServiceSelectionChange}
        onClose={() => setDialogVisible(false)}
        title="Select Services for Statistics"
      />
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
  sourceModeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  sourceModeLabel: {
    flex: 1,
  },
  helperText: {
    opacity: 0.7,
    paddingHorizontal: 4,
  },
  selectButton: {
    marginVertical: 4,
  },
  saveButton: {
    marginTop: 8,
  },
});

export default StatisticsWidgetConfigForm;
