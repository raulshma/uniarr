import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  HelperText,
  IconButton,
  Text,
  TextInput,
} from "react-native-paper";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useHaptics } from "@/hooks/useHaptics";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";

const schema = z.object({
  feeds: z
    .array(z.object({ url: z.string().trim().optional() }))
    .min(1, "Add at least one feed"),
  limit: z
    .string()
    .trim()
    .regex(/^[0-9]+$/, "Enter a number between 1 and 25")
    .refine((value) => {
      const parsed = Number(value);
      return parsed >= 1 && parsed <= 25;
    }, "Enter a number between 1 and 25"),
});

type FormValues = z.infer<typeof schema>;

type RssWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const RssWidgetConfigForm: React.FC<RssWidgetConfigFormProps> = ({
  widget,
  onSaved,
}) => {
  const { onPress } = useHaptics();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const defaultValues = useMemo<FormValues>(() => {
    const feeds = Array.isArray(widget.config?.feeds)
      ? widget.config?.feeds
      : [];

    return {
      feeds:
        feeds.length > 0
          ? feeds.map((url: string) => ({ url }))
          : [{ url: "" }],
      limit: String(
        typeof widget.config?.limit === "number" ? widget.config.limit : 8,
      ),
    };
  }, [widget.config]);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({ control, name: "feeds" });

  const onSubmit = async (values: FormValues) => {
    const normalizedFeeds = values.feeds
      .map((entry) => entry.url?.trim())
      .filter((url): url is string => Boolean(url && url.length > 0));

    if (normalizedFeeds.length === 0) {
      setSubmitError("Enter at least one RSS or Atom feed URL");
      return;
    }

    setSubmitError(null);

    const limitValue = Number(values.limit);

    try {
      setSaving(true);
      await widgetService.updateWidget(widget.id, {
        config: {
          ...widget.config,
          feeds: normalizedFeeds,
          limit: limitValue,
        },
      });
      await widgetService.clearWidgetData(widget.id);
      onSaved();
    } catch {
      setSubmitError("Failed to save RSS configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Feeds
      </Text>
      <Text variant="bodyMedium" style={styles.sectionDescription}>
        Add RSS or Atom feed URLs. Headlines are pulled in the order listed.
      </Text>

      {fields.map((field, index) => (
        <View key={field.id} style={styles.row}>
          <Controller
            control={control}
            name={`feeds.${index}.url`}
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                mode="outlined"
                label={`Feed ${index + 1}`}
                value={value ?? ""}
                onChangeText={onChange}
                onBlur={onBlur}
                style={styles.flex}
                autoCapitalize="none"
                keyboardType="url"
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
          append({ url: "" });
        }}
      >
        Add Feed
      </Button>

      <View style={styles.limitRow}>
        <Controller
          control={control}
          name="limit"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              mode="outlined"
              label="Items to show"
              value={String(value ?? "")}
              onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
              onBlur={onBlur}
              keyboardType="number-pad"
              style={styles.limitInput}
            />
          )}
        />
        <Text variant="bodySmall" style={styles.limitHint}>
          Maximum 25 items across feeds
        </Text>
      </View>

      {errors.limit && (
        <HelperText type="error">{errors.limit.message}</HelperText>
      )}
      {errors.feeds && (
        <HelperText type="error">{errors.feeds.message}</HelperText>
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

export default RssWidgetConfigForm;
