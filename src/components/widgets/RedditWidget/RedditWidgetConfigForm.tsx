import React, { useMemo, useState } from "react";
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

const SORT_OPTIONS = ["hot", "new", "rising", "top"] as const;
const RANGE_OPTIONS = ["hour", "day", "week", "month", "year", "all"] as const;

const schema = z.object({
  subreddits: z
    .array(z.object({ name: z.string().trim().optional() }))
    .min(1, "Add at least one subreddit"),
  sort: z.enum(SORT_OPTIONS),
  topTimeRange: z.enum(RANGE_OPTIONS),
  limit: z
    .string()
    .trim()
    .regex(/^[0-9]+$/, "Enter a number between 3 and 30")
    .refine((value) => {
      const parsed = Number(value);
      return parsed >= 3 && parsed <= 30;
    }, "Enter a number between 3 and 30"),
});

type FormValues = z.infer<typeof schema>;

type RedditWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const RedditWidgetConfigForm: React.FC<RedditWidgetConfigFormProps> = ({
  widget,
  onSaved,
}) => {
  const { onPress } = useHaptics();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const defaultValues = useMemo<FormValues>(() => {
    const subreddits = Array.isArray(widget.config?.subreddits)
      ? widget.config?.subreddits
      : [];

    return {
      subreddits:
        subreddits.length > 0
          ? subreddits.map((name: string) => ({ name }))
          : [{ name: "" }],
      sort:
        widget.config?.sort && SORT_OPTIONS.includes(widget.config.sort)
          ? widget.config.sort
          : "hot",
      topTimeRange:
        widget.config?.topTimeRange &&
        RANGE_OPTIONS.includes(widget.config.topTimeRange)
          ? widget.config.topTimeRange
          : "day",
      limit: String(
        typeof widget.config?.limit === "number" ? widget.config.limit : 10,
      ),
    };
  }, [widget.config]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "subreddits",
  });

  const selectedSort = watch("sort");

  const onSubmit = async (values: FormValues) => {
    const cleaned = values.subreddits
      .map((entry) => entry.name?.trim().replace(/^r\//i, ""))
      .filter((name): name is string => Boolean(name && name.length > 0));

    if (cleaned.length === 0) {
      setSubmitError("Enter at least one subreddit");
      return;
    }

    setSubmitError(null);
    const limitValue = Number(values.limit);

    try {
      setSaving(true);
      await widgetService.updateWidget(widget.id, {
        config: {
          ...widget.config,
          subreddits: cleaned,
          sort: values.sort,
          topTimeRange: values.topTimeRange,
          limit: limitValue,
        },
      });
      await widgetService.clearWidgetData(widget.id);
      onSaved();
    } catch {
      setSubmitError("Failed to save Reddit configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Subreddits
      </Text>
      <Text variant="bodyMedium" style={styles.sectionDescription}>
        Add the communities to follow. We pull the freshest posts per subreddit.
      </Text>

      {fields.map((field, index) => (
        <View key={field.id} style={styles.row}>
          <Controller
            control={control}
            name={`subreddits.${index}.name`}
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                mode="outlined"
                label={`Subreddit ${index + 1}`}
                value={value ?? ""}
                onChangeText={onChange}
                onBlur={onBlur}
                style={styles.flex}
                autoCapitalize="none"
                placeholder="e.g. jellyfin"
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
          append({ name: "" });
        }}
      >
        Add Subreddit
      </Button>

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Sort order
        </Text>
        <Controller
          control={control}
          name="sort"
          render={({ field: { value, onChange } }) => (
            <SegmentedButtons
              style={styles.segmented}
              value={value}
              onValueChange={(next) => {
                onPress();
                onChange(next);
              }}
              buttons={SORT_OPTIONS.map((option) => ({
                value: option,
                label: option.charAt(0).toUpperCase() + option.slice(1),
              }))}
            />
          )}
        />
      </View>

      {selectedSort === "top" && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Time range
          </Text>
          <Controller
            control={control}
            name="topTimeRange"
            render={({ field: { value, onChange } }) => (
              <SegmentedButtons
                style={styles.segmented}
                value={value}
                onValueChange={(next) => {
                  onPress();
                  onChange(next);
                }}
                buttons={RANGE_OPTIONS.map((option) => ({
                  value: option,
                  label: option.charAt(0).toUpperCase() + option.slice(1),
                }))}
              />
            )}
          />
        </View>
      )}

      <View style={styles.limitRow}>
        <Controller
          control={control}
          name="limit"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              mode="outlined"
              label="Items to show"
              value={value}
              onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
              onBlur={onBlur}
              keyboardType="number-pad"
              style={styles.limitInput}
            />
          )}
        />
        <Text variant="bodySmall" style={styles.limitHint}>
          Shared across all subreddits
        </Text>
      </View>

      {errors.limit && (
        <HelperText type="error">{errors.limit.message}</HelperText>
      )}
      {errors.subreddits && (
        <HelperText type="error">{errors.subreddits.message}</HelperText>
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
  sectionTitle: {
    fontWeight: "600",
  },
  sectionDescription: {
    opacity: 0.7,
  },
  segmented: {
    marginTop: 4,
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

export default RedditWidgetConfigForm;
