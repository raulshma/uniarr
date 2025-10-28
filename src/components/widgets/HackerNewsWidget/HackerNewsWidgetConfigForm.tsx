import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, HelperText, Menu, Text, TextInput } from "react-native-paper";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useHaptics } from "@/hooks/useHaptics";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import type { HackerNewsFeedType } from "@/services/widgets/dataProviders";

const schema = z.object({
  feedType: z.enum(["topstories", "beststories", "newstories"]),
  limit: z
    .string()
    .trim()
    .regex(/^[0-9]+$/, "Enter a number between 1 and 50")
    .refine((value) => {
      const parsed = Number(value);
      return parsed >= 1 && parsed <= 50;
    }, "Enter a number between 1 and 50"),
});

type FormValues = z.infer<typeof schema>;

type HackerNewsWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const FEED_TYPE_OPTIONS: { value: HackerNewsFeedType; label: string }[] = [
  { value: "topstories", label: "Top Stories" },
  { value: "beststories", label: "Best Stories" },
  { value: "newstories", label: "New Stories" },
];

const HackerNewsWidgetConfigForm: React.FC<HackerNewsWidgetConfigFormProps> = ({
  widget,
  onSaved,
}) => {
  const { onPress } = useHaptics();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const defaultValues = useMemo<FormValues>(
    () => ({
      feedType: (widget.config?.feedType as HackerNewsFeedType) ?? "topstories",
      limit: String(
        typeof widget.config?.limit === "number" ? widget.config.limit : 10,
      ),
    }),
    [widget.config],
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
  });

  const selectedFeedType = watch("feedType");

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);

    const limitValue = Number(values.limit);

    try {
      setSaving(true);
      await widgetService.updateWidget(widget.id, {
        config: {
          ...widget.config,
          feedType: values.feedType,
          limit: limitValue,
        },
      });
      await widgetService.clearWidgetData(widget.id);
      onSaved();
    } catch {
      setSubmitError(
        "Failed to save Hacker News configuration. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedFeedLabel =
    FEED_TYPE_OPTIONS.find((option) => option.value === selectedFeedType)
      ?.label ?? "Top Stories";

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Feed Type
      </Text>
      <Text variant="bodyMedium" style={styles.sectionDescription}>
        Choose which Hacker News feed to display.
      </Text>

      <Controller
        control={control}
        name="feedType"
        render={({ field: { onChange, value } }) => (
          <Menu
            key={`feed-type-menu-${menuVisible}-${selectedFeedType}`}
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <TextInput
                mode="outlined"
                label="Feed Type"
                value={selectedFeedLabel}
                onPressIn={() => {
                  onPress();
                  setMenuVisible(true);
                }}
                editable={false}
                right={
                  <TextInput.Icon
                    icon={menuVisible ? "menu-up" : "menu-down"}
                    onPress={() => {
                      onPress();
                      setMenuVisible(!menuVisible);
                    }}
                  />
                }
              />
            }
          >
            {FEED_TYPE_OPTIONS.map((option) => (
              <Menu.Item
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setMenuVisible(false);
                }}
                title={option.label}
              />
            ))}
          </Menu>
        )}
      />

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Display Limit
      </Text>
      <Text variant="bodyMedium" style={styles.sectionDescription}>
        Maximum number of stories to fetch and display.
      </Text>

      <Controller
        control={control}
        name="limit"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            mode="outlined"
            label="Number of items"
            value={String(value ?? "")}
            onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
            onBlur={onBlur}
            keyboardType="number-pad"
            style={styles.limitInput}
          />
        )}
      />

      {errors.feedType && (
        <HelperText type="error">{errors.feedType.message}</HelperText>
      )}
      {errors.limit && (
        <HelperText type="error">{errors.limit.message}</HelperText>
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
  limitInput: {
    maxWidth: 180,
  },
  saveButton: {
    marginTop: 8,
  },
});

export default HackerNewsWidgetConfigForm;
