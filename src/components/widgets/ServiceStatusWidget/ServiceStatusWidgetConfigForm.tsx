import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, HelperText, Switch, Text, useTheme } from "react-native-paper";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useHaptics } from "@/hooks/useHaptics";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { serviceStatusWidgetConfigSchema } from "@/utils/validation.utils";
import type { AppTheme } from "@/constants/theme";
import ServiceSelectionDialog from "../ServiceSelectionDialog";

import type { ServiceStatusWidgetConfig } from "@/utils/validation.utils";

type FormValues = ServiceStatusWidgetConfig;

type ServiceStatusWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const ServiceStatusWidgetConfigForm: React.FC<
  ServiceStatusWidgetConfigFormProps
> = ({ widget, onSaved }) => {
  const { onPress } = useHaptics();
  const theme = useTheme<AppTheme>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);

  const defaultValues = useMemo<FormValues>(() => {
    const config = widget.config || {};
    return {
      sourceMode: config.sourceMode ?? "global",
      serviceIds: config.serviceIds ?? [],
      showOfflineOnly: config.showOfflineOnly ?? false,
    };
  }, [widget.config]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(serviceStatusWidgetConfigSchema),
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
          sourceMode: values.sourceMode,
          serviceIds: values.serviceIds,
          showOfflineOnly: values.showOfflineOnly,
        },
      });
      await widgetService.clearWidgetData(widget.id);
      onSaved();
    } catch {
      setSubmitError(
        "Failed to save service status configuration. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Service Monitoring
      </Text>
      <Text variant="bodyMedium" style={styles.sectionDescription}>
        Monitor the status of your connected services.
      </Text>

      <View style={styles.section}>
        <Text variant="labelLarge" style={styles.label}>
          Source Mode
        </Text>
        <Controller
          control={control}
          name="sourceMode"
          render={({ field: { value, onChange } }) => (
            <View style={styles.sourceModeRow}>
              <Text
                variant="bodyMedium"
                style={[
                  styles.sourceModeLabel,
                  {
                    color:
                      value === "global"
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                All Services
              </Text>
              <Switch
                value={value === "custom"}
                onValueChange={(enabled) => {
                  onPress();
                  onChange(enabled ? "custom" : "global");
                }}
              />
              <Text
                variant="bodyMedium"
                style={[
                  styles.sourceModeLabel,
                  {
                    color:
                      value === "custom"
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                Custom Selection
              </Text>
            </View>
          )}
        />
        <Text
          variant="bodySmall"
          style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}
        >
          {sourceMode === "global"
            ? "Monitor all configured services"
            : "Select specific services to monitor"}
        </Text>
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

      <View style={styles.section}>
        <Controller
          control={control}
          name="showOfflineOnly"
          render={({ field: { value, onChange } }) => (
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text variant="bodyMedium">Show Offline Services Only</Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Hide services that are currently online
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
        title="Select Services to Monitor"
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
    paddingHorizontal: 4,
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
  saveButton: {
    marginTop: 8,
  },
});

export default ServiceStatusWidgetConfigForm;
