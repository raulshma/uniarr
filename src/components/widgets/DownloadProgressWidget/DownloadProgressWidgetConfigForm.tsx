import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  HelperText,
  Switch,
  Text,
  TextInput,
} from "react-native-paper";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useHaptics } from "@/hooks/useHaptics";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { downloadProgressWidgetConfigSchema } from "@/utils/validation.utils";
import type { DownloadProgressWidgetConfig } from "@/utils/validation.utils";
import ServiceSelectionDialog from "../ServiceSelectionDialog";

type FormValues = DownloadProgressWidgetConfig;

type DownloadProgressWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const DownloadProgressWidgetConfigForm: React.FC<
  DownloadProgressWidgetConfigFormProps
> = ({ widget, onSaved }) => {
  const { onPress } = useHaptics();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);

  const defaultValues = useMemo<FormValues>(() => {
    const config = widget.config || {};
    return {
      includeServiceIds: config.includeServiceIds ?? [],
      includeCompleted: config.includeCompleted ?? false,
      maxItems: config.maxItems ?? 6,
    };
  }, [widget.config]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(downloadProgressWidgetConfigSchema),
    defaultValues,
    mode: "onBlur",
  });

  const selectedServiceIds = watch("includeServiceIds");

  const handleServiceSelectionChange = (ids: string[]) => {
    setValue("includeServiceIds", ids, { shouldDirty: true });
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);

    try {
      setSaving(true);
      await widgetService.updateWidget(widget.id, {
        config: {
          ...widget.config,
          includeServiceIds: values.includeServiceIds,
          includeCompleted: values.includeCompleted,
          maxItems: values.maxItems,
        },
      });
      await widgetService.clearWidgetData(widget.id);
      onSaved();
    } catch {
      setSubmitError(
        "Failed to save download configuration. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Download Tracking
      </Text>
      <Text variant="bodyMedium" style={styles.sectionDescription}>
        Configure which downloads are displayed in the widget.
      </Text>

      <View style={styles.section}>
        <Button
          mode="outlined"
          onPress={() => {
            onPress();
            setDialogVisible(true);
          }}
          style={styles.selectButton}
        >
          Filter by Service ({selectedServiceIds.length})
        </Button>
        <Text variant="bodySmall" style={styles.helperText}>
          Leave empty to show all services
        </Text>
      </View>

      <View style={styles.section}>
        <Controller
          control={control}
          name="includeCompleted"
          render={({ field: { value, onChange } }) => (
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text variant="bodyMedium">Show Completed Downloads</Text>
                <Text variant="bodySmall" style={styles.helperTextSecondary}>
                  Include finished downloads in the list
                </Text>
              </View>
              <Switch
                value={value}
                onValueChange={(newValue) => {
                  onPress();
                  onChange(newValue);
                }}
              />
            </View>
          )}
        />
      </View>

      <View style={styles.section}>
        <Text variant="labelLarge" style={styles.label}>
          Maximum Items
        </Text>
        <Controller
          control={control}
          name="maxItems"
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
        {errors.maxItems && (
          <HelperText type="error">{errors.maxItems.message}</HelperText>
        )}
        <Text variant="bodySmall" style={styles.helperText}>
          Display between 1 and 20 downloads
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

      <ServiceSelectionDialog
        visible={dialogVisible}
        selectedIds={selectedServiceIds}
        onSelectionChange={handleServiceSelectionChange}
        onClose={() => setDialogVisible(false)}
        title="Filter Downloads by Service"
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
  selectButton: {
    marginVertical: 4,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  switchLabel: {
    flex: 1,
    gap: 4,
  },
  helperText: {
    opacity: 0.7,
    paddingHorizontal: 4,
  },
  helperTextSecondary: {
    opacity: 0.7,
  },
  input: {
    marginBottom: 4,
  },
  saveButton: {
    marginTop: 8,
  },
});

export default DownloadProgressWidgetConfigForm;
