import React, { useEffect, useMemo, useState } from "react";
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
import { widgetCredentialService } from "@/services/widgets/WidgetCredentialService";

const schema = z.object({
  clientId: z.string().trim().min(1, "Client ID is required"),
  clientSecret: z.string().trim().min(1, "Client secret is required"),
  channelLogins: z
    .array(z.object({ value: z.string().trim().optional() }))
    .min(1, "Add at least one channel"),
  offlineMessage: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

type TwitchWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const TwitchWidgetConfigForm: React.FC<TwitchWidgetConfigFormProps> = ({
  widget,
  onSaved,
}) => {
  const { onPress } = useHaptics();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const defaultValues = useMemo<FormValues>(() => {
    const logins = Array.isArray(widget.config?.channelLogins)
      ? widget.config.channelLogins
      : [];

    return {
      clientId: "",
      clientSecret: "",
      channelLogins:
        logins.length > 0
          ? logins.map((value: string) => ({ value }))
          : [{ value: "" }],
      offlineMessage:
        typeof widget.config?.offlineMessage === "string"
          ? widget.config.offlineMessage
          : "No channels are live right now.",
    };
  }, [widget.config]);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "channelLogins",
  });

  useEffect(() => {
    const loadCredentials = async () => {
      const credentials = await widgetCredentialService.getCredentials(
        widget.id,
      );
      if (credentials?.clientId) {
        setValue("clientId", credentials.clientId, { shouldDirty: false });
      }
      if (credentials?.clientSecret) {
        setValue("clientSecret", credentials.clientSecret, {
          shouldDirty: false,
        });
      }
    };

    void loadCredentials();
  }, [setValue, widget.id]);

  const onSubmit = async (values: FormValues) => {
    const logins = values.channelLogins
      .map((entry) => entry.value?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value && value.length > 0));

    if (logins.length === 0) {
      setSubmitError("Enter at least one Twitch channel login");
      return;
    }

    setSubmitError(null);

    try {
      setSaving(true);
      await widgetCredentialService.setCredentials(widget.id, {
        clientId: values.clientId.trim(),
        clientSecret: values.clientSecret.trim(),
      });

      await widgetService.updateWidget(widget.id, {
        config: {
          ...widget.config,
          channelLogins: logins,
          offlineMessage: values.offlineMessage?.trim(),
        },
      });

      await widgetService.clearWidgetData(widget.id);
      onSaved();
    } catch {
      setSubmitError("Failed to save Twitch settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Twitch credentials
      </Text>
      <Controller
        control={control}
        name="clientId"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            mode="outlined"
            label="Client ID"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
      />
      {errors.clientId && (
        <HelperText type="error">{errors.clientId.message}</HelperText>
      )}

      <Controller
        control={control}
        name="clientSecret"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            mode="outlined"
            label="Client Secret"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        )}
      />
      {errors.clientSecret && (
        <HelperText type="error">{errors.clientSecret.message}</HelperText>
      )}

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Channels
      </Text>
      <Text variant="bodyMedium" style={styles.sectionDescription}>
        Add Twitch channel logins (the text after twitch.tv/).
      </Text>

      {fields.map((field, index) => (
        <View key={field.id} style={styles.row}>
          <Controller
            control={control}
            name={`channelLogins.${index}.value`}
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                mode="outlined"
                label={`Channel ${index + 1}`}
                value={value ?? ""}
                onChangeText={onChange}
                onBlur={onBlur}
                style={styles.flex}
                autoCapitalize="none"
                placeholder="lirik"
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
          Offline message
        </Text>
        <Controller
          control={control}
          name="offlineMessage"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              mode="outlined"
              label="Offline message"
              value={value ?? ""}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
              numberOfLines={3}
            />
          )}
        />
      </View>

      {errors.channelLogins && (
        <HelperText type="error">{errors.channelLogins.message}</HelperText>
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
  saveButton: {
    marginTop: 8,
  },
});

export default TwitchWidgetConfigForm;
