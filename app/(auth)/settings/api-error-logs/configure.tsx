import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View, ScrollView } from "react-native";
import {
  Text,
  useTheme,
  Button,
  Switch,
  Dialog,
  Portal,
  TextInput,
  Chip,
} from "react-native-paper";
import { useState, useMemo } from "react";

import { TabHeader } from "@/components/common/TabHeader";
import {
  AnimatedListItem,
  AnimatedSection,
  SettingsListItem,
  SettingsGroup,
} from "@/components/common";
import { useSettingsStore } from "@/store/settingsStore";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { shouldAnimateLayout } from "@/utils/animations.utils";

const ERROR_CODE_PRESETS = {
  CRITICAL: {
    label: "Critical",
    description: "5xx, network errors, timeouts",
    codes: [500, 502, 503, 504, "ETIMEDOUT", "ECONNABORTED"],
  },
  SERVER: {
    label: "Server Errors",
    description: "5xx errors only",
    codes: [500, 502, 503, 504],
  },
  RATE_LIMIT: {
    label: "Rate Limits",
    description: "429 Too Many Requests",
    codes: [429],
  },
  CLIENT_ERRORS: {
    label: "Client Errors",
    description: "4xx errors (excluding 401/403/404)",
    codes: [400, 408, 409, 422],
  },
  STRICT: {
    label: "Strict",
    description: "All 4xx and 5xx errors",
    codes: [400, 408, 409, 422, 500, 502, 503, 504],
  },
  CUSTOM: {
    label: "Custom",
    description: "User-defined error codes",
    codes: [],
  },
};

const ApiErrorLoggerConfigureScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const animationsEnabled = shouldAnimateLayout(false, false);

  const {
    apiErrorLoggerEnabled,
    apiErrorLoggerActivePreset,
    apiErrorLoggerRetentionDays,
    apiErrorLoggerCaptureRequestBody,
    apiErrorLoggerCaptureResponseBody,
    apiErrorLoggerCaptureRequestHeaders,
    setApiErrorLoggerEnabled,
    setApiErrorLoggerActivePreset,
    setApiErrorLoggerRetentionDays,
    setApiErrorLoggerCaptureRequestBody,
    setApiErrorLoggerCaptureResponseBody,
    setApiErrorLoggerCaptureRequestHeaders,
  } = useSettingsStore();

  const [presetDialogVisible, setPresetDialogVisible] = useState(false);
  const [retentionDialogVisible, setRetentionDialogVisible] = useState(false);
  const [customCodeDialogVisible, setCustomCodeDialogVisible] = useState(false);
  const [customCodeInput, setCustomCodeInput] = useState("");
  const { apiErrorLoggerCustomCodes, setApiErrorLoggerCustomCodes } =
    useSettingsStore();

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
    settingValue: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      lineHeight: theme.custom.typography.labelSmall.lineHeight,
      letterSpacing: theme.custom.typography.labelSmall.letterSpacing,
      fontWeight: theme.custom.typography.labelSmall.fontWeight as any,
    },
  });

  const presetLabel = useMemo(() => {
    const preset =
      ERROR_CODE_PRESETS[
        apiErrorLoggerActivePreset as keyof typeof ERROR_CODE_PRESETS
      ];
    return preset?.label || apiErrorLoggerActivePreset;
  }, [apiErrorLoggerActivePreset]);

  const presetDescription = useMemo(() => {
    const preset =
      ERROR_CODE_PRESETS[
        apiErrorLoggerActivePreset as keyof typeof ERROR_CODE_PRESETS
      ];
    return preset?.description || "Custom error codes";
  }, [apiErrorLoggerActivePreset]);

  const warningText = useMemo(() => {
    const captures = [];
    if (apiErrorLoggerCaptureRequestBody) captures.push("request bodies");
    if (apiErrorLoggerCaptureResponseBody) captures.push("response bodies");
    if (apiErrorLoggerCaptureRequestHeaders) captures.push("headers");

    if (captures.length === 0) {
      return "Sensitive header filtering is enabled by default.";
    }

    return `⚠️ Capturing ${captures.join(", ")} - may contain sensitive data.`;
  }, [
    apiErrorLoggerCaptureRequestBody,
    apiErrorLoggerCaptureResponseBody,
    apiErrorLoggerCaptureRequestHeaders,
  ]);

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom", "left", "right"]}
    >
      <TabHeader
        title="API Error Logger"
        showBackButton
        onBackPress={router.back}
      />

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Enable/Disable Section */}
        <AnimatedSection
          style={styles.section}
          delay={50}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Status</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={1}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Enable Error Logging"
                subtitle="Automatically capture API errors"
                left={{ iconName: "bug-check" }}
                trailing={
                  <Switch
                    value={apiErrorLoggerEnabled}
                    onValueChange={setApiErrorLoggerEnabled}
                    color={theme.colors.primary}
                  />
                }
                groupPosition="single"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {apiErrorLoggerEnabled && (
          <>
            {/* Error Filter Section */}
            <AnimatedSection
              style={styles.section}
              delay={100}
              animated={animationsEnabled}
            >
              <Text style={styles.sectionTitle}>Error Filter</Text>
              <SettingsGroup>
                <AnimatedListItem
                  index={0}
                  totalItems={1}
                  animated={animationsEnabled}
                >
                  <SettingsListItem
                    title="Error Preset"
                    subtitle={presetDescription}
                    left={{ iconName: "filter-variant" }}
                    trailing={
                      <Button
                        mode="contained-tonal"
                        onPress={() => setPresetDialogVisible(true)}
                        style={{ height: 36 }}
                      >
                        {presetLabel}
                      </Button>
                    }
                    groupPosition="single"
                  />
                </AnimatedListItem>
              </SettingsGroup>

              {/* Custom Codes Section - show only when CUSTOM preset is selected */}
              {apiErrorLoggerActivePreset === "CUSTOM" && (
                <View style={{ marginTop: spacing.md }}>
                  <Text
                    style={{
                      ...styles.sectionTitle,
                      marginBottom: spacing.sm,
                    }}
                  >
                    Custom Error Codes
                  </Text>
                  <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
                    {apiErrorLoggerCustomCodes.length > 0 ? (
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: spacing.xs,
                        }}
                      >
                        {apiErrorLoggerCustomCodes.map((code) => (
                          <Chip
                            key={code}
                            onClose={() => {
                              setApiErrorLoggerCustomCodes(
                                apiErrorLoggerCustomCodes.filter(
                                  (c) => c !== code,
                                ),
                              );
                            }}
                            style={{
                              backgroundColor: theme.colors.primaryContainer,
                            }}
                          >
                            {String(code)}
                          </Chip>
                        ))}
                      </View>
                    ) : (
                      <Text
                        style={{
                          ...styles.settingValue,
                          color: theme.colors.onSurfaceVariant,
                          fontStyle: "italic",
                        }}
                      >
                        No custom codes added yet
                      </Text>
                    )}
                  </View>
                  <Button
                    mode="contained-tonal"
                    onPress={() => {
                      setCustomCodeInput("");
                      setCustomCodeDialogVisible(true);
                    }}
                    icon="plus"
                  >
                    Add Error Code
                  </Button>
                </View>
              )}
            </AnimatedSection>

            {/* Capture Options Section */}
            <AnimatedSection
              style={styles.section}
              delay={150}
              animated={animationsEnabled}
            >
              <Text style={styles.sectionTitle}>Capture Options</Text>
              <SettingsGroup>
                <AnimatedListItem
                  index={0}
                  totalItems={3}
                  animated={animationsEnabled}
                >
                  <SettingsListItem
                    title="Capture Request Body"
                    subtitle="Include request payload in logs"
                    left={{ iconName: "arrow-up-box" }}
                    trailing={
                      <Switch
                        value={apiErrorLoggerCaptureRequestBody}
                        onValueChange={setApiErrorLoggerCaptureRequestBody}
                        color={theme.colors.primary}
                      />
                    }
                    groupPosition="top"
                  />
                </AnimatedListItem>

                <AnimatedListItem
                  index={1}
                  totalItems={3}
                  animated={animationsEnabled}
                >
                  <SettingsListItem
                    title="Capture Response Body"
                    subtitle="Include response payload in logs"
                    left={{ iconName: "arrow-down-box" }}
                    trailing={
                      <Switch
                        value={apiErrorLoggerCaptureResponseBody}
                        onValueChange={setApiErrorLoggerCaptureResponseBody}
                        color={theme.colors.primary}
                      />
                    }
                    groupPosition="middle"
                  />
                </AnimatedListItem>

                <AnimatedListItem
                  index={2}
                  totalItems={3}
                  animated={animationsEnabled}
                >
                  <SettingsListItem
                    title="Capture Request Headers"
                    subtitle="Include request headers (filtered)"
                    left={{ iconName: "text-box-multiple" }}
                    trailing={
                      <Switch
                        value={apiErrorLoggerCaptureRequestHeaders}
                        onValueChange={setApiErrorLoggerCaptureRequestHeaders}
                        color={theme.colors.primary}
                      />
                    }
                    groupPosition="bottom"
                  />
                </AnimatedListItem>
              </SettingsGroup>

              {/* Warning text */}
              <View
                style={{ paddingHorizontal: spacing.xs, marginTop: spacing.sm }}
              >
                <Text
                  style={{
                    ...styles.settingValue,
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  {warningText}
                </Text>
              </View>
            </AnimatedSection>

            {/* Retention Section */}
            <AnimatedSection
              style={styles.section}
              delay={200}
              animated={animationsEnabled}
            >
              <Text style={styles.sectionTitle}>Retention</Text>
              <SettingsGroup>
                <AnimatedListItem
                  index={0}
                  totalItems={1}
                  animated={animationsEnabled}
                >
                  <SettingsListItem
                    title="Retention Period"
                    subtitle={`Keep logs for ${apiErrorLoggerRetentionDays} day${
                      apiErrorLoggerRetentionDays !== 1 ? "s" : ""
                    }`}
                    left={{ iconName: "calendar-outline" }}
                    trailing={
                      <Button
                        mode="contained-tonal"
                        onPress={() => setRetentionDialogVisible(true)}
                        style={{ height: 36 }}
                      >
                        Set
                      </Button>
                    }
                    groupPosition="single"
                  />
                </AnimatedListItem>
              </SettingsGroup>
            </AnimatedSection>

            {/* Info Section */}
            <AnimatedSection
              style={styles.section}
              delay={250}
              animated={animationsEnabled}
            >
              <Text style={styles.sectionTitle}>Information</Text>
              <SettingsGroup>
                <AnimatedListItem
                  index={0}
                  totalItems={1}
                  animated={animationsEnabled}
                >
                  <SettingsListItem
                    title="View Error Logs"
                    subtitle="See all captured errors"
                    left={{ iconName: "file-document-outline" }}
                    trailing={null}
                    onPress={() =>
                      router.push("/(auth)/settings/api-error-logs")
                    }
                    groupPosition="single"
                  />
                </AnimatedListItem>
              </SettingsGroup>
            </AnimatedSection>
          </>
        )}
      </ScrollView>

      {/* Preset Selection Dialog */}
      <Portal>
        <Dialog
          visible={presetDialogVisible}
          onDismiss={() => setPresetDialogVisible(false)}
          style={{
            borderRadius: 12,
            backgroundColor: theme.colors.elevation.level1,
          }}
        >
          <Dialog.Title style={styles.sectionTitle}>
            Select Error Preset
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ ...styles.settingValue, marginBottom: spacing.md }}>
              Choose which errors to capture:
            </Text>
            <View style={{ gap: spacing.xs }}>
              {Object.entries(ERROR_CODE_PRESETS).map(([key, preset]) => (
                <Button
                  key={key}
                  mode={
                    apiErrorLoggerActivePreset === key
                      ? "contained"
                      : "outlined"
                  }
                  onPress={() => {
                    setApiErrorLoggerActivePreset(key);
                    setPresetDialogVisible(false);
                  }}
                  style={{ marginVertical: 0 }}
                >
                  {preset.label}
                </Button>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              mode="outlined"
              onPress={() => setPresetDialogVisible(false)}
            >
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Retention Selection Dialog */}
      <Portal>
        <Dialog
          visible={retentionDialogVisible}
          onDismiss={() => setRetentionDialogVisible(false)}
          style={{
            borderRadius: 12,
            backgroundColor: theme.colors.elevation.level1,
          }}
        >
          <Dialog.Title style={styles.sectionTitle}>
            Retention Period
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ ...styles.settingValue, marginBottom: spacing.md }}>
              How many days should error logs be kept?
            </Text>
            <View style={{ gap: spacing.xs }}>
              {[1, 3, 7, 14, 30, 60, 90, 365].map((days) => (
                <Button
                  key={days}
                  mode={
                    apiErrorLoggerRetentionDays === days
                      ? "contained"
                      : "outlined"
                  }
                  onPress={() => {
                    setApiErrorLoggerRetentionDays(days);
                    setRetentionDialogVisible(false);
                  }}
                  style={{ marginVertical: 0 }}
                >
                  {days} day{days !== 1 ? "s" : ""}
                </Button>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              mode="outlined"
              onPress={() => setRetentionDialogVisible(false)}
            >
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Custom Error Code Dialog */}
      <Portal>
        <Dialog
          visible={customCodeDialogVisible}
          onDismiss={() => setCustomCodeDialogVisible(false)}
          style={{
            borderRadius: 12,
            backgroundColor: theme.colors.elevation.level1,
          }}
        >
          <Dialog.Title style={styles.sectionTitle}>
            Add Custom Error Code
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ ...styles.settingValue, marginBottom: spacing.md }}>
              Enter an HTTP status code (number) or network error code (text).
              Examples: 429, ECONNREFUSED
            </Text>
            <TextInput
              label="Error Code"
              value={customCodeInput}
              onChangeText={setCustomCodeInput}
              placeholder="e.g., 429 or ECONNREFUSED"
              mode="outlined"
              keyboardType="default"
              style={{ marginBottom: spacing.md }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              mode="outlined"
              onPress={() => setCustomCodeDialogVisible(false)}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                if (customCodeInput.trim()) {
                  // Try to parse as number, otherwise use as string
                  const code = /^\d+$/.test(customCodeInput)
                    ? parseInt(customCodeInput, 10)
                    : customCodeInput.trim();

                  if (
                    !apiErrorLoggerCustomCodes.includes(code) &&
                    typeof code === "number" &&
                    code > 0
                  ) {
                    setApiErrorLoggerCustomCodes([
                      ...apiErrorLoggerCustomCodes,
                      code,
                    ]);
                  } else if (
                    !apiErrorLoggerCustomCodes.includes(code) &&
                    typeof code === "string"
                  ) {
                    setApiErrorLoggerCustomCodes([
                      ...apiErrorLoggerCustomCodes,
                      code,
                    ]);
                  }
                  setCustomCodeDialogVisible(false);
                  setCustomCodeInput("");
                }
              }}
            >
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default ApiErrorLoggerConfigureScreen;
