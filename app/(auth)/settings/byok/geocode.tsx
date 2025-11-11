import React, { useState } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import {
  Text,
  useTheme,
  Button,
  TextInput,
  IconButton,
  HelperText,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import { useSettingsStore } from "@/store/settingsStore";
import {
  AnimatedListItem,
  AnimatedSection,
  SettingsGroup,
} from "@/components/common";
import { shouldAnimateLayout } from "@/utils/animations.utils";
import { logger } from "@/services/logger/LoggerService";
import { alert } from "@/services/dialogService";

const Geocode = () => {
  const theme = useTheme<AppTheme>();
  const { byokGeocodeMapsCoApiKey, setByokGeocodeMapsCoApiKey } =
    useSettingsStore();

  const [geocodeApiKey, setGeocodeApiKey] = useState(
    byokGeocodeMapsCoApiKey || "",
  );
  const [testingGeocodeKey, setTestingGeocodeKey] = useState(false);
  const [geocodeKeyStatus, setGeocodeKeyStatus] = useState<
    "idle" | "valid" | "invalid"
  >("idle");
  const [showGeocodeKey, setShowGeocodeKey] = useState(false);

  const animationsEnabled = shouldAnimateLayout(testingGeocodeKey, false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      paddingHorizontal: spacing.xs,
      paddingBottom: spacing.xxxxl,
    },
    section: {
      marginTop: spacing.md,
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
    sectionDescription: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      lineHeight: theme.custom.typography.bodySmall.lineHeight,
      letterSpacing: theme.custom.typography.bodySmall.letterSpacing,
      fontWeight: theme.custom.typography.bodySmall.fontWeight as any,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.elevation.level1,
      marginHorizontal: spacing.xs,
      marginVertical: spacing.xs / 2,
      borderRadius: borderRadius.xxl,
      padding: spacing.md,
    },
    inputLabel: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.labelLarge.fontSize,
      fontFamily: theme.custom.typography.labelLarge.fontFamily,
      lineHeight: theme.custom.typography.labelLarge.lineHeight,
      letterSpacing: theme.custom.typography.labelLarge.letterSpacing,
      fontWeight: theme.custom.typography.labelLarge.fontWeight as any,
      marginBottom: spacing.sm,
    },
    inputContainer: {
      marginBottom: spacing.md,
    },
    textInput: {
      backgroundColor: theme.colors.elevation.level0,
    },
    helperText: {
      marginTop: spacing.xs,
    },
    actionContainer: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.md,
      marginTop: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    statusValid: {
      backgroundColor: theme.colors.primaryContainer,
      borderColor: theme.colors.primary,
      borderWidth: 1,
    },
    statusInvalid: {
      backgroundColor: theme.colors.error + "20",
      borderColor: theme.colors.error,
      borderWidth: 1,
    },
    statusText: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      lineHeight: theme.custom.typography.labelSmall.lineHeight,
      letterSpacing: theme.custom.typography.labelSmall.letterSpacing,
      fontWeight: theme.custom.typography.labelSmall.fontWeight as any,
    },
  });

  const handleTestGeocodeKey = async () => {
    if (!geocodeApiKey.trim()) {
      alert("Invalid key", "Please enter an API key");
      return;
    }

    setTestingGeocodeKey(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `https://geocode.maps.co/reverse?lat=51.5074&lon=-0.1278&api_key=${geocodeApiKey.trim()}`,
        { signal: controller.signal },
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        setGeocodeKeyStatus("valid");
        alert(
          "API key valid",
          "Your geocode.maps.co API key is working correctly.",
        );
      } else if (response.status === 401 || response.status === 403) {
        setGeocodeKeyStatus("invalid");
        alert(
          "Invalid API key",
          "The API key is invalid or unauthorized. Please check your key.",
        );
      } else {
        setGeocodeKeyStatus("invalid");
        alert(
          "API error",
          `Unexpected response from API (${response.status}). Please try again.`,
        );
      }
    } catch (error) {
      setGeocodeKeyStatus("invalid");
      const message =
        error instanceof Error ? error.message : "Unable to test API key";
      alert("Connection error", message);
      void logger.warn("Failed to test geocode API key", { error: message });
    } finally {
      setTestingGeocodeKey(false);
    }
  };

  const handleSaveGeocodeKey = () => {
    const keyToSave = geocodeApiKey.trim() || undefined;
    setByokGeocodeMapsCoApiKey(keyToSave);
    setGeocodeKeyStatus("idle");
    alert(
      keyToSave ? "API key saved" : "API key removed",
      keyToSave
        ? "Your geocode.maps.co API key has been saved securely."
        : "Your geocode.maps.co API key has been removed.",
    );
  };

  const handleClearGeocodeKey = () => {
    setGeocodeApiKey("");
    setGeocodeKeyStatus("idle");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <AnimatedSection
          style={styles.section}
          delay={0}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Geocode.maps.co — API Key</Text>
          <Text style={styles.sectionDescription}>
            Add and test your geocode.maps.co API key used for reverse geocoding
            in the app. Keys are stored securely on your device.
          </Text>
        </AnimatedSection>

        {/* Geocode.maps.co Section */}
        <AnimatedSection
          style={styles.section}
          delay={50}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Geocode.maps.co</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={1}
              animated={animationsEnabled}
            >
              <View style={styles.card}>
                <View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      marginBottom: spacing.sm,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        color: theme.colors.onSurface,
                        fontSize: theme.custom.typography.titleSmall.fontSize,
                        fontFamily:
                          theme.custom.typography.titleSmall.fontFamily,
                        lineHeight:
                          theme.custom.typography.titleSmall.lineHeight,
                        letterSpacing:
                          theme.custom.typography.titleSmall.letterSpacing,
                        fontWeight: theme.custom.typography.titleSmall
                          .fontWeight as any,
                      }}
                    >
                      Geocode.maps.co
                    </Text>
                    {byokGeocodeMapsCoApiKey && (
                      <View style={[styles.statusBadge, styles.statusValid]}>
                        <Text
                          style={[
                            styles.statusText,
                            { color: theme.colors.primary },
                          ]}
                        >
                          Configured
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      fontSize: theme.custom.typography.bodySmall.fontSize,
                      fontFamily: theme.custom.typography.bodySmall.fontFamily,
                      lineHeight: theme.custom.typography.bodySmall.lineHeight,
                      letterSpacing:
                        theme.custom.typography.bodySmall.letterSpacing,
                      fontWeight: theme.custom.typography.bodySmall
                        .fontWeight as any,
                      marginBottom: spacing.md,
                    }}
                  >
                    Used for reverse geocoding when picking locations on maps
                    and searching by coordinates.
                  </Text>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>API Key</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <TextInput
                      mode="outlined"
                      placeholder="Enter your geocode.maps.co API key"
                      value={geocodeApiKey}
                      onChangeText={setGeocodeApiKey}
                      secureTextEntry={!showGeocodeKey}
                      editable={!testingGeocodeKey}
                      style={[styles.textInput, { flex: 1 }]}
                    />
                    <IconButton
                      icon={showGeocodeKey ? "eye-off" : "eye"}
                      size={20}
                      onPress={() => setShowGeocodeKey(!showGeocodeKey)}
                      disabled={testingGeocodeKey}
                    />
                  </View>
                  {geocodeKeyStatus === "valid" && (
                    <HelperText
                      type="info"
                      style={styles.helperText}
                      visible={geocodeKeyStatus === "valid"}
                    >
                      API key is valid
                    </HelperText>
                  )}
                  {geocodeKeyStatus === "invalid" && (
                    <HelperText
                      type="error"
                      style={styles.helperText}
                      visible={geocodeKeyStatus === "invalid"}
                    >
                      API key appears to be invalid
                    </HelperText>
                  )}
                </View>

                <View style={styles.actionContainer}>
                  <Button
                    mode="contained-tonal"
                    onPress={handleTestGeocodeKey}
                    loading={testingGeocodeKey}
                    disabled={!geocodeApiKey.trim() || testingGeocodeKey}
                  >
                    Test Key
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSaveGeocodeKey}
                    disabled={testingGeocodeKey}
                  >
                    Save
                  </Button>
                  {geocodeApiKey && (
                    <Button
                      mode="outlined"
                      onPress={handleClearGeocodeKey}
                      disabled={testingGeocodeKey}
                    >
                      Clear
                    </Button>
                  )}
                </View>

                <View
                  style={{
                    marginTop: spacing.md,
                    paddingTop: spacing.md,
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.outlineVariant,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      fontSize: theme.custom.typography.labelSmall.fontSize,
                      fontFamily: theme.custom.typography.labelSmall.fontFamily,
                      lineHeight: theme.custom.typography.labelSmall.lineHeight,
                      letterSpacing:
                        theme.custom.typography.labelSmall.letterSpacing,
                      fontWeight: theme.custom.typography.labelSmall
                        .fontWeight as any,
                    }}
                  >
                    Get a free API key at{" "}
                    <Text
                      style={{
                        color: theme.colors.primary,
                        fontWeight: "600",
                      }}
                    >
                      geocode.maps.co
                    </Text>
                  </Text>
                </View>
              </View>
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {/* (Info section removed to keep page focused on geocode.maps.co) */}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Geocode;
