import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  HelperText,
  IconButton,
  SegmentedButtons,
  Text,
  TextInput,
} from "react-native-paper";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useHaptics } from "@/hooks/useHaptics";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { widgetCredentialService } from "@/services/widgets/WidgetCredentialService";
import { alert as showDialog } from "@/services/dialogService";
import {
  testYouTubeApiKey,
  getYouTubeTroubleshootingHint,
} from "@/utils/youtube.utils";

const ITEMS_OPTIONS = ["2", "3"] as const;

const schema = z.object({
  apiKey: z.string().trim().min(1, "YouTube Data API key is required"),
  channelIds: z
    .array(z.object({ value: z.string().trim().optional() }))
    .min(1, "Add at least one channel ID"),
  itemsPerChannel: z.enum(ITEMS_OPTIONS),
  limit: z
    .string()
    .trim()
    .regex(/^[0-9]+$/, "Enter a number between 3 and 24")
    .refine((value) => {
      const parsed = Number(value);
      return parsed >= 3 && parsed <= 24;
    }, "Enter a number between 3 and 24"),
});

type FormValues = z.infer<typeof schema>;

type YouTubeWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const YouTubeWidgetConfigForm: React.FC<YouTubeWidgetConfigFormProps> = ({
  widget,
  onSaved,
}) => {
  const { onPress } = useHaptics();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const defaultValues = useMemo<FormValues>(() => {
    const channelIds = Array.isArray(widget.config?.channelIds)
      ? widget.config.channelIds
      : [];

    return {
      apiKey: "",
      channelIds:
        channelIds.length > 0
          ? channelIds.map((value: string) => ({ value }))
          : [{ value: "" }],
      itemsPerChannel: (widget.config?.itemsPerChannel === 2 ? "2" : "3") as
        | "2"
        | "3",
      limit: String(
        typeof widget.config?.limit === "number" ? widget.config.limit : 6,
      ),
    };
  }, [widget.config]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "channelIds",
  });

  const itemsPerChannel = watch("itemsPerChannel");

  useEffect(() => {
    const loadCredentials = async () => {
      const credentials = await widgetCredentialService.getCredentials(
        widget.id,
      );
      if (credentials?.apiKey) {
        setValue("apiKey", credentials.apiKey, { shouldDirty: false });
      }
    };

    void loadCredentials();
  }, [setValue, widget.id]);

  const handleTestConnection = async () => {
    const apiKeyValue = watch("apiKey").trim();
    const channelIdFields = watch("channelIds");
    const firstChannelId = channelIdFields?.[0]?.value?.trim();

    if (!apiKeyValue) {
      showDialog("Test Failed", "Please enter an API key first.");
      return;
    }

    if (!firstChannelId) {
      showDialog("Test Failed", "Please enter at least one channel ID.");
      return;
    }

    setTestingConnection(true);
    onPress();

    try {
      const result = await testYouTubeApiKey(apiKeyValue, firstChannelId);

      if (result.success) {
        showDialog("✓ Success", result.message);
      } else {
        const troubleshootingHint = getYouTubeTroubleshootingHint(
          result.details?.statusCode,
        );
        const errorMessage = `${result.message}\n\nTroubleshooting: ${troubleshootingHint}`;
        showDialog("Connection Failed", errorMessage);
      }
    } catch {
      showDialog(
        "Test Error",
        "An unexpected error occurred while testing the connection.",
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    const sanitizedChannels = values.channelIds
      .map((entry) => entry.value?.trim())
      .filter((value): value is string => Boolean(value && value.length > 0));

    if (sanitizedChannels.length === 0) {
      setSubmitError("Enter at least one channel ID");
      return;
    }

    setSubmitError(null);

    const limitValue = Number(values.limit);
    const itemsValue = Number(values.itemsPerChannel) as 2 | 3;

    try {
      setSaving(true);
      await widgetCredentialService.setCredentials(widget.id, {
        apiKey: values.apiKey.trim(),
      });

      await widgetService.updateWidget(widget.id, {
        config: {
          ...widget.config,
          channelIds: sanitizedChannels,
          itemsPerChannel: itemsValue,
          limit: limitValue,
        },
      });

      await widgetService.clearWidgetData(widget.id);
      onSaved();
    } catch {
      setSubmitError("Failed to save YouTube settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        YouTube Data API key
      </Text>
      <Controller
        control={control}
        name="apiKey"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            mode="outlined"
            label="API key"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        )}
      />
      {errors.apiKey && (
        <HelperText type="error">{errors.apiKey.message}</HelperText>
      )}

      <Button
        mode="outlined"
        icon="lan-check"
        onPress={handleTestConnection}
        loading={testingConnection}
        disabled={testingConnection || saving}
      >
        Test Connection
      </Button>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Channels
      </Text>
      <Text variant="bodyMedium" style={styles.sectionDescription}>
        Add channel IDs or handle URLs.
        {"\n"}
        We monitor the latest uploads for each entry.
      </Text>

      {fields.map((field, index) => (
        <View key={field.id} style={styles.row}>
          <Controller
            control={control}
            name={`channelIds.${index}.value`}
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                mode="outlined"
                label={`Channel ${index + 1}`}
                value={value ?? ""}
                onChangeText={onChange}
                onBlur={onBlur}
                style={styles.flex}
                autoCapitalize="none"
                placeholder="UCxxxxxxxx"
              />
            )}
          />
          {fields.length > 1 && (
            <IconButton
              icon="delete"
              onPress={() => {
                onPress();
                remove(index);
              }}
            />
          )}
        </View>
      ))}

      <Button
        mode="outlined"
        icon="plus"
        onPress={() => {
          onPress();
          append({ value: "" });
        }}
      >
        Add Channel
      </Button>

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Items per channel
        </Text>
        <Controller
          control={control}
          name="itemsPerChannel"
          render={({ field: { value, onChange } }) => (
            <SegmentedButtons
              value={value}
              onValueChange={(next) => {
                onPress();
                onChange(next);
              }}
              buttons={ITEMS_OPTIONS.map((option) => ({
                value: option,
                label: `${option} per channel`,
              }))}
            />
          )}
        />
      </View>

      <View style={styles.limitRow}>
        <Controller
          control={control}
          name="limit"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              mode="outlined"
              label="Overall limit"
              value={value}
              onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
              onBlur={onBlur}
              keyboardType="number-pad"
              style={styles.limitInput}
            />
          )}
        />
        <Text variant="bodySmall" style={styles.limitHint}>
          Total items. Minimum {Number(itemsPerChannel) * 1} per channel.
        </Text>
      </View>

      {errors.limit && (
        <HelperText type="error">{errors.limit.message}</HelperText>
      )}
      {errors.channelIds && (
        <HelperText type="error">{errors.channelIds.message}</HelperText>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  sectionDescription: {
    opacity: 0.7,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  section: {
    gap: 12,
  },
  limitRow: {
    gap: 8,
  },
  limitInput: {
    maxWidth: 180,
  },
  limitHint: {
    opacity: 0.7,
  },
  saveButton: {
    marginTop: 8,
  },
});

export default YouTubeWidgetConfigForm;
