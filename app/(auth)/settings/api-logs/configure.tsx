import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  Portal,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { TabHeader } from "@/components/common/TabHeader";
import {
  AnimatedListItem,
  AnimatedSection,
  SettingsGroup,
  SettingsListItem,
} from "@/components/common";
import { spacing } from "@/theme/spacing";
import type { AppTheme } from "@/constants/theme";
import { shouldAnimateLayout } from "@/utils/animations.utils";
import { useSettingsStore } from "@/store/settingsStore";

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

const ApiLoggerConfigureScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const animationsEnabled = shouldAnimateLayout(false, false);

  const {
    apiLoggerEnabled,
    apiLoggerActivePreset,
    apiLoggerCustomCodes,
    apiLoggerRetentionDays,
    apiLoggerCaptureRequestBody,
    apiLoggerCaptureResponseBody,
    apiLoggerCaptureRequestHeaders,
    apiLoggerAiLoggingEnabled,
    apiLoggerAiCapturePrompt,
    apiLoggerAiCaptureResponse,
    apiLoggerAiCaptureMetadata,
    apiLoggerAiRetentionDays,
    setApiLoggerEnabled,
    setApiLoggerActivePreset,
    setApiLoggerCustomCodes,
    setApiLoggerRetentionDays,
    setApiLoggerCaptureRequestBody,
    setApiLoggerCaptureResponseBody,
    setApiLoggerCaptureRequestHeaders,
    setApiLoggerAiLoggingEnabled,
    setApiLoggerAiCapturePrompt,
    setApiLoggerAiCaptureResponse,
    setApiLoggerAiCaptureMetadata,
    setApiLoggerAiRetentionDays,
  } = useSettingsStore();

  const [presetDialogVisible, setPresetDialogVisible] = useState(false);
  const [retentionDialogVisible, setRetentionDialogVisible] = useState(false);
  const [aiRetentionDialogVisible, setAiRetentionDialogVisible] =
    useState(false);
  const [customCodeDialogVisible, setCustomCodeDialogVisible] = useState(false);
  const [customCodeInput, setCustomCodeInput] = useState("");

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
        apiLoggerActivePreset as keyof typeof ERROR_CODE_PRESETS
      ];
    return preset?.label || apiLoggerActivePreset;
  }, [apiLoggerActivePreset]);

  const presetDescription = useMemo(() => {
    const preset =
      ERROR_CODE_PRESETS[
        apiLoggerActivePreset as keyof typeof ERROR_CODE_PRESETS
      ];
    return preset?.description || "Custom error codes";
  }, [apiLoggerActivePreset]);

  const warningText = useMemo(() => {
    const captures = [] as string[];
    if (apiLoggerCaptureRequestBody) captures.push("request bodies");
    if (apiLoggerCaptureResponseBody) captures.push("response bodies");
    if (apiLoggerCaptureRequestHeaders) captures.push("headers");

    if (captures.length === 0) {
      return "Sensitive header filtering is enabled by default.";
    }

    return `⚠️ Capturing ${captures.join(", ")} - may contain sensitive data.`;
  }, [
    apiLoggerCaptureRequestBody,
    apiLoggerCaptureResponseBody,
    apiLoggerCaptureRequestHeaders,
  ]);

  const aiWarningText = useMemo(() => {
    const captures = [] as string[];
    if (apiLoggerAiCapturePrompt) captures.push("prompts");
    if (apiLoggerAiCaptureResponse) captures.push("responses");
    if (apiLoggerAiCaptureMetadata) captures.push("metadata");

    if (captures.length === 0) {
      return "Token usage summaries remain available even when capture is disabled.";
    }

    return `⚠️ Capturing ${captures.join(", ")} - ensure content is safe to persist.`;
  }, [
    apiLoggerAiCapturePrompt,
    apiLoggerAiCaptureResponse,
    apiLoggerAiCaptureMetadata,
  ]);

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom", "left", "right"]}
    >
      <TabHeader title="API Logger" showBackButton onBackPress={router.back} />

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <AnimatedSection
          style={styles.section}
          delay={40}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Status</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Enable Error Logging"
                subtitle="Capture failed HTTP calls"
                left={{ iconName: "bug-check" }}
                trailing={
                  <Switch
                    value={apiLoggerEnabled}
                    onValueChange={setApiLoggerEnabled}
                    color={theme.colors.primary}
                  />
                }
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={1}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="Enable AI Logging"
                subtitle="Track AI-assisted requests"
                left={{ iconName: "robot-excited-outline" }}
                trailing={
                  <Switch
                    value={apiLoggerAiLoggingEnabled}
                    onValueChange={setApiLoggerAiLoggingEnabled}
                    color={theme.colors.primary}
                  />
                }
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>

        {apiLoggerEnabled && (
          <>
            <AnimatedSection
              style={styles.section}
              delay={80}
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

              {apiLoggerActivePreset === "CUSTOM" && (
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
                    {apiLoggerCustomCodes.length > 0 ? (
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: spacing.xs,
                        }}
                      >
                        {apiLoggerCustomCodes.map((code) => (
                          <Chip
                            key={code}
                            onClose={() => {
                              setApiLoggerCustomCodes(
                                apiLoggerCustomCodes.filter((c) => c !== code),
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

            <AnimatedSection
              style={styles.section}
              delay={120}
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
                        value={apiLoggerCaptureRequestBody}
                        onValueChange={setApiLoggerCaptureRequestBody}
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
                        value={apiLoggerCaptureResponseBody}
                        onValueChange={setApiLoggerCaptureResponseBody}
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
                        value={apiLoggerCaptureRequestHeaders}
                        onValueChange={setApiLoggerCaptureRequestHeaders}
                        color={theme.colors.primary}
                      />
                    }
                    groupPosition="bottom"
                  />
                </AnimatedListItem>
              </SettingsGroup>

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

            <AnimatedSection
              style={styles.section}
              delay={160}
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
                    subtitle={`Keep logs for ${apiLoggerRetentionDays} day${apiLoggerRetentionDays !== 1 ? "s" : ""}`}
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
          </>
        )}

        {apiLoggerAiLoggingEnabled && (
          <>
            <AnimatedSection
              style={styles.section}
              delay={200}
              animated={animationsEnabled}
            >
              <Text style={styles.sectionTitle}>AI Capture Options</Text>
              <SettingsGroup>
                <AnimatedListItem
                  index={0}
                  totalItems={3}
                  animated={animationsEnabled}
                >
                  <SettingsListItem
                    title="Capture Prompts"
                    subtitle="Store user queries to AI"
                    left={{ iconName: "message-text-outline" }}
                    trailing={
                      <Switch
                        value={apiLoggerAiCapturePrompt}
                        onValueChange={setApiLoggerAiCapturePrompt}
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
                    title="Capture Responses"
                    subtitle="Persist AI outputs"
                    left={{ iconName: "message-reply-text-outline" }}
                    trailing={
                      <Switch
                        value={apiLoggerAiCaptureResponse}
                        onValueChange={setApiLoggerAiCaptureResponse}
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
                    title="Capture Metadata"
                    subtitle="Track token usage and timing"
                    left={{ iconName: "chart-box-outline" }}
                    trailing={
                      <Switch
                        value={apiLoggerAiCaptureMetadata}
                        onValueChange={setApiLoggerAiCaptureMetadata}
                        color={theme.colors.primary}
                      />
                    }
                    groupPosition="bottom"
                  />
                </AnimatedListItem>
              </SettingsGroup>

              <View
                style={{ paddingHorizontal: spacing.xs, marginTop: spacing.sm }}
              >
                <Text
                  style={{
                    ...styles.settingValue,
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  {aiWarningText}
                </Text>
              </View>
            </AnimatedSection>

            <AnimatedSection
              style={styles.section}
              delay={240}
              animated={animationsEnabled}
            >
              <Text style={styles.sectionTitle}>AI Retention</Text>
              <SettingsGroup>
                <AnimatedListItem
                  index={0}
                  totalItems={1}
                  animated={animationsEnabled}
                >
                  <SettingsListItem
                    title="Retention Period"
                    subtitle={`Keep logs for ${apiLoggerAiRetentionDays} day${apiLoggerAiRetentionDays !== 1 ? "s" : ""}`}
                    left={{ iconName: "calendar-clock" }}
                    trailing={
                      <Button
                        mode="contained-tonal"
                        onPress={() => setAiRetentionDialogVisible(true)}
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
          </>
        )}

        <AnimatedSection
          style={styles.section}
          delay={280}
          animated={animationsEnabled}
        >
          <Text style={styles.sectionTitle}>Shortcuts</Text>
          <SettingsGroup>
            <AnimatedListItem
              index={0}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="View API Logs"
                subtitle="Open log overview"
                left={{ iconName: "file-tree" }}
                trailing={null}
                onPress={() => router.push("/(auth)/settings/api-logs")}
                groupPosition="top"
              />
            </AnimatedListItem>
            <AnimatedListItem
              index={1}
              totalItems={2}
              animated={animationsEnabled}
            >
              <SettingsListItem
                title="View Error Logs"
                subtitle="Inspect captured failures"
                left={{ iconName: "alert-circle-outline" }}
                trailing={null}
                onPress={() => router.push("/(auth)/settings/api-logs/error")}
                groupPosition="bottom"
              />
            </AnimatedListItem>
          </SettingsGroup>
        </AnimatedSection>
      </ScrollView>

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
                    apiLoggerActivePreset === key ? "contained" : "outlined"
                  }
                  onPress={() => {
                    setApiLoggerActivePreset(key);
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
                    apiLoggerRetentionDays === days ? "contained" : "outlined"
                  }
                  onPress={() => {
                    setApiLoggerRetentionDays(days);
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

      <Portal>
        <Dialog
          visible={aiRetentionDialogVisible}
          onDismiss={() => setAiRetentionDialogVisible(false)}
          style={{
            borderRadius: 12,
            backgroundColor: theme.colors.elevation.level1,
          }}
        >
          <Dialog.Title style={styles.sectionTitle}>
            AI Log Retention
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ ...styles.settingValue, marginBottom: spacing.md }}>
              How many days should AI logs be kept?
            </Text>
            <View style={{ gap: spacing.xs }}>
              {[1, 3, 7, 14, 30, 60, 90, 180].map((days) => (
                <Button
                  key={days}
                  mode={
                    apiLoggerAiRetentionDays === days ? "contained" : "outlined"
                  }
                  onPress={() => {
                    setApiLoggerAiRetentionDays(days);
                    setAiRetentionDialogVisible(false);
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
              onPress={() => setAiRetentionDialogVisible(false)}
            >
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
                const trimmed = customCodeInput.trim();
                if (!trimmed) return;

                const code = /^\d+$/.test(trimmed)
                  ? parseInt(trimmed, 10)
                  : trimmed;

                if (!apiLoggerCustomCodes.includes(code)) {
                  setApiLoggerCustomCodes([...apiLoggerCustomCodes, code]);
                }

                setCustomCodeDialogVisible(false);
                setCustomCodeInput("");
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

export default ApiLoggerConfigureScreen;
