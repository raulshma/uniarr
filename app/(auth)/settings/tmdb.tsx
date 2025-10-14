import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActivityIndicator,
  Button,
  Card,
  HelperText,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { alert } from "@/services/dialogService";
import { useTmdbKey } from "@/hooks/useTmdbKey";
import { TmdbConnector } from "@/connectors/implementations/TmdbConnector";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useSettingsStore } from "@/store/settingsStore";

const tmdbCredentialSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(1, "Enter a TMDB API key or V4 access token.")
    .max(512, "Key or token looks unexpectedly long."),
});

type FormValues = z.infer<typeof tmdbCredentialSchema>;

const TmdbSettingsScreen = () => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        content: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        },
        sectionHeader: {
          gap: spacing.xs,
        },
        switchRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: spacing.sm,
        },
        formActions: {
          flexDirection: "row",
          gap: spacing.sm,
          marginTop: spacing.lg,
        },
        inlineActions: {
          flexDirection: "row",
          gap: spacing.sm,
        },
      }),
    [theme]
  );

  const { apiKey, isLoading: isKeyLoading, saveKey, clearKey } = useTmdbKey();

  const tmdbEnabled = useSettingsStore((state) => state.tmdbEnabled);
  const setTmdbEnabled = useSettingsStore((state) => state.setTmdbEnabled);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(tmdbCredentialSchema),
    defaultValues: { apiKey: "" },
  });

  useEffect(() => {
    if (!isKeyLoading) {
      reset({ apiKey: apiKey ?? "" });
      // After the initial load completes, clear the initialLoad flag so
      // subsequent transient operations (save/test/remove) don't show the
      // full-screen loader.
      try {
        // setInitialLoad is defined below; guard in case of ordering during edits.
        // We'll check at runtime via typeof.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (typeof setInitialLoad === 'function') setInitialLoad(false);
      } catch {
        // noop
      }
    }
  }, [apiKey, isKeyLoading, reset]);

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const onSubmit = async (values: FormValues) => {
    const trimmed = values.apiKey.trim();
    setIsSaving(true);
    try {
      await saveKey(trimmed);
      setTmdbEnabled(true);
      alert("TMDB key saved", "TMDB Discover is now enabled.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save the TMDB credentials.";
      alert("Save failed", message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    const value = watch("apiKey").trim();
    if (!value) {
      setError("apiKey", {
        message: "Enter a TMDB credential before testing.",
      });
      return;
    }

    setIsTesting(true);
    try {
      const connector = new TmdbConnector(value);
      const result = await connector.validateApiKey();
      if (result.ok) {
        alert("Credentials valid", "TMDB accepted the provided credential.");
      } else {
        alert(
          "Validation failed",
          result.message ?? "TMDB rejected the credential."
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected TMDB error.";
      alert("Validation failed", message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleRemoveKey = () => {
    alert(
      "Remove TMDB credentials?",
      "This will disable TMDB-powered Discover features.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setIsRemoving(true);
            void (async () => {
              try {
                await clearKey();
                setTmdbEnabled(false);
                reset({ apiKey: "" });
              } finally {
                setIsRemoving(false);
              }
            })();
          },
        },
      ]
    );
  };

  const handleToggleEnabled = (next: boolean) => {
    if (!apiKey && !watch("apiKey")) {
      alert(
        "Add a key first",
        "Provide a TMDB API key or token before enabling the integration."
      );
      return;
    }
    setTmdbEnabled(next);
  };

  // Only show the full-page loader during initial key load. Avoid showing it
  // for transient changes (save/test/remove) which would cause the entire page
  // to flash when the hook updates.
  const showLoader = isKeyLoading && initialLoad && !apiKey && !isSaving && !isTesting && !isRemoving;

  return (
    <SafeAreaView style={styles.container}>
      {showLoader ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator animating size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.sectionHeader}>
            <Text variant="headlineMedium">TMDB Integration</Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Store your TMDB credentials securely to unlock discover and search
              features powered by TMDB.
            </Text>
          </View>

          <Card mode="elevated">
            <Card.Content>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium">Enable TMDB Discover</Text>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    When enabled, TMDB recommendations appear in Discover.
                  </Text>
                </View>
                <Switch
                  value={tmdbEnabled}
                  onValueChange={handleToggleEnabled}
                  disabled={isSaving || isRemoving}
                />
              </View>
            </Card.Content>
          </Card>

          <Card mode="elevated">
            <Card.Title
              title="TMDB API Key or V4 Token"
              subtitle="Keys are stored in encrypted secure storage."
            />
            <Card.Content>
              <Controller
                control={control}
                name="apiKey"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    label="API Key"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    right={<TextInput.Icon icon="key-variant" />}
                  />
                )}
              />
              <HelperText type="error" visible={Boolean(errors.apiKey)}>
                {errors.apiKey?.message}
              </HelperText>

              <View style={styles.formActions}>
                <Button
                  mode="contained"
                  onPress={handleSubmit(onSubmit)}
                  loading={isSaving}
                  disabled={isSaving}
                >
                  Save
                </Button>
                <Button
                  mode="outlined"
                  onPress={handleTest}
                  loading={isTesting}
                  disabled={isTesting}
                >
                  Test API Key
                </Button>
              </View>

              <View style={[styles.inlineActions, { marginTop: spacing.md }]}>
                <Button
                  mode="text"
                  onPress={handleRemoveKey}
                  disabled={isRemoving || (!apiKey && !watch("apiKey"))}
                  textColor={theme.colors.error}
                >
                  Remove Key
                </Button>
                {isRemoving ? <ActivityIndicator animating /> : null}
              </View>
            </Card.Content>
          </Card>

          <Card mode="outlined">
            <Card.Title title="Tips" />
            <Card.Content>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                • TMDB accepts either a v3 API key or a v4 access token.
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                • Keys never leave your device and are stored with
                expo-secure-store.
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                • You can find your credentials under TMDB settings → API.
              </Text>
            </Card.Content>
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default TmdbSettingsScreen;
