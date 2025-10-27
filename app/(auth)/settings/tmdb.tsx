import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActivityIndicator,
  Button,
  HelperText,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useRouter } from "expo-router";

import { alert } from "@/services/dialogService";
import { useTmdbKey } from "@/hooks/useTmdbKey";
import { TmdbConnector } from "@/connectors/implementations/TmdbConnector";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useSettingsStore } from "@/store/settingsStore";
import { TabHeader } from "@/components/common/TabHeader";
import {
  AnimatedScrollView,
  AnimatedSection,
  SettingsGroup,
  SettingsListItem,
} from "@/components/common";
import { shouldAnimateLayout } from "@/utils/animations.utils";

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
  const router = useRouter();
  const animationsEnabled = shouldAnimateLayout(false, false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        scrollContainer: {
          paddingHorizontal: spacing.sm,
          paddingBottom: spacing.xxxxl,
        },
        section: {
          marginTop: spacing.md,
          paddingHorizontal: spacing.md,
        },
        sectionTitle: {
          color: theme.colors.onBackground,
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          lineHeight: theme.custom.typography.titleMedium.lineHeight,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.xs,
        },
        subtitle: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          lineHeight: theme.custom.typography.bodyMedium.lineHeight,
          letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.xs,
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
        inputCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.custom.spacing.xxl,
          overflow: "hidden" as const,
          elevation: 1,
          shadowColor: theme.colors.shadow || "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          padding: spacing.md,
          marginTop: spacing.md,
        },
        tipsCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.custom.spacing.xxl,
          overflow: "hidden" as const,
          elevation: 1,
          shadowColor: theme.colors.shadow || "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          padding: spacing.md,
          marginTop: spacing.lg,
          marginHorizontal: spacing.md,
        },
        tipsTitle: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.titleSmall.fontSize,
          fontFamily: theme.custom.typography.titleSmall.fontFamily,
          fontWeight: theme.custom.typography.titleSmall.fontWeight as any,
          letterSpacing: theme.custom.typography.titleSmall.letterSpacing,
          lineHeight: theme.custom.typography.titleSmall.lineHeight,
          marginBottom: spacing.sm,
        },
        tipText: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          lineHeight: theme.custom.typography.bodyMedium.lineHeight,
          letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
          marginBottom: spacing.xs,
        },
      }),
    [theme],
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

        // @ts-ignore
        if (typeof setInitialLoad === "function") setInitialLoad(false);
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
          result.message ?? "TMDB rejected the credential.",
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
      ],
    );
  };

  const handleToggleEnabled = (next: boolean) => {
    if (!apiKey && !watch("apiKey")) {
      alert(
        "Add a key first",
        "Provide a TMDB API key or token before enabling the integration.",
      );
      return;
    }
    setTmdbEnabled(next);
  };

  // Only show the full-page loader during initial key load. Avoid showing it
  // for transient changes (save/test/remove) which would cause the entire page
  // to flash when the hook updates.
  const showLoader =
    isKeyLoading &&
    initialLoad &&
    !apiKey &&
    !isSaving &&
    !isTesting &&
    !isRemoving;

  if (showLoader) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator animating size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AnimatedScrollView
        contentContainerStyle={styles.scrollContainer}
        animated={animationsEnabled}
      >
        <TabHeader
          title="TMDB Integration"
          showBackButton
          onBackPress={() => router.back()}
        />

        <View style={styles.section}>
          <Text style={styles.subtitle}>
            Store your TMDB credentials securely to unlock discover and search
            features powered by TMDB.
          </Text>
        </View>

        {/* Enable TMDB Discover Section */}
        <AnimatedSection
          style={styles.section}
          delay={50}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Integration Settings</Text>
          <SettingsGroup>
            <SettingsListItem
              title="Enable TMDB Discover"
              subtitle="When enabled, TMDB recommendations appear in Discover"
              left={{ iconName: "movie-open-play" }}
              trailing={
                <Switch
                  value={tmdbEnabled}
                  onValueChange={handleToggleEnabled}
                  disabled={isSaving || isRemoving}
                  color={theme.colors.primary}
                />
              }
              groupPosition="single"
            />
          </SettingsGroup>
        </AnimatedSection>

        {/* TMDB API Key Section */}
        <AnimatedSection
          style={styles.section}
          delay={100}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>API Credentials</Text>
          <SettingsGroup>
            <SettingsListItem
              title="TMDB API Key or V4 Token"
              subtitle="Keys are stored in encrypted secure storage"
              left={{ iconName: "key-variant" }}
              groupPosition="single"
            />
          </SettingsGroup>

          {/* API Key Input Card */}
          <View style={styles.inputCard}>
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
          </View>

          {/* Remove Key Section */}
          <SettingsGroup style={{ marginTop: spacing.md }}>
            <SettingsListItem
              title="Remove Credentials"
              subtitle="Delete stored TMDB credentials"
              left={{ iconName: "delete-outline" }}
              onPress={handleRemoveKey}
              trailing={
                isRemoving ? (
                  <ActivityIndicator animating />
                ) : (
                  <Button
                    mode="text"
                    disabled={isRemoving || (!apiKey && !watch("apiKey"))}
                    textColor={theme.colors.error}
                    compact
                  >
                    Remove
                  </Button>
                )
              }
              groupPosition="single"
            />
          </SettingsGroup>
        </AnimatedSection>

        {/* Tips Section */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Tips</Text>
          <Text style={styles.tipText}>
            • TMDB accepts either a v3 API key or a v4 access token.
          </Text>
          <Text style={styles.tipText}>
            • Keys never leave your device and are stored with
            expo-secure-store.
          </Text>
          <Text style={styles.tipText}>
            • You can find your credentials under TMDB settings → API.
          </Text>
        </View>
      </AnimatedScrollView>
    </SafeAreaView>
  );
};

export default TmdbSettingsScreen;
