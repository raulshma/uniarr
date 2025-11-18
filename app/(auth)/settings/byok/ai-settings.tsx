import { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Text,
  Card,
  Switch,
  Divider,
  useTheme,
  Portal,
  Dialog,
  Button,
  RadioButton,
} from "react-native-paper";
import { AIKeyInputForm } from "@/components/settings/AIKeyInputForm";
import { AIProviderList } from "@/components/settings/AIProviderList";
import { AIModelSelector } from "@/components/settings/AIModelSelector";
import { AIProviderManager } from "@/services/ai/core/AIProviderManager";
import { AIKeyManager } from "@/services/ai/core/AIKeyManager";
import { useSettingsStore } from "@/store/settingsStore";
import {
  useConversationalAIConfigStore,
  selectConversationalAIProvider,
  selectConversationalAIModel,
  selectConversationalAIKeyId,
  selectTitleSummaryProvider,
  selectTitleSummaryModel,
  selectTitleSummaryKeyId,
} from "@/store/conversationalAIConfigStore";
import { spacing } from "@/theme/spacing";
import { AI_PROVIDERS } from "@/types/ai/AIProvider";
import type { AIProviderType } from "@/types/ai/AIProvider";

/**
 * AI Settings Screen for managing BYOK (Bring Your Own Key) configuration
 * Allows users to:
 * - Add/manage AI provider API keys
 * - Select default provider
 * - Configure AI search preferences (only if AI is configured)
 */
export default function AISettingsScreen() {
  const theme = useTheme();
  const [isAIConfigured, setIsAIConfigured] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [providerDialogVisible, setProviderDialogVisible] = useState(false);
  const [modelDialogVisible, setModelDialogVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<"recommendation" | "title">(
    "recommendation",
  );
  const [providerKeys, setProviderKeys] = useState<
    {
      keyId: string;
      provider: AIProviderType;
      apiKeyPreview: string;
      modelName?: string;
    }[]
  >([]);

  // Use settings store for toggles persistence
  const enableAISearch = useSettingsStore((s) => s.enableAISearch);
  const setEnableAISearchSetting = useSettingsStore((s) => s.setEnableAISearch);
  const enableAIRecommendations = useSettingsStore(
    (s) => s.enableAIRecommendations,
  );
  const setEnableAIRecommendationsSetting = useSettingsStore(
    (s) => s.setEnableAIRecommendations,
  );

  // Recommendation provider/model settings
  const recommendationProvider = useConversationalAIConfigStore(
    selectConversationalAIProvider,
  );
  const recommendationModel = useConversationalAIConfigStore(
    selectConversationalAIModel,
  );
  const recommendationKeyId = useConversationalAIConfigStore(
    selectConversationalAIKeyId,
  );
  const setRecommendationProvider = useConversationalAIConfigStore(
    (s) => s.setSelectedProvider,
  );
  const setRecommendationModel = useConversationalAIConfigStore(
    (s) => s.setSelectedModel,
  );
  const setRecommendationKeyId = useConversationalAIConfigStore(
    (s) => s.setSelectedKeyId,
  );

  // Title summary provider/model settings
  const titleSummaryProvider = useConversationalAIConfigStore(
    selectTitleSummaryProvider,
  );
  const titleSummaryModel = useConversationalAIConfigStore(
    selectTitleSummaryModel,
  );
  const titleSummaryKeyId = useConversationalAIConfigStore(
    selectTitleSummaryKeyId,
  );
  const setTitleSummaryProvider = useConversationalAIConfigStore(
    (s) => s.setSelectedTitleProvider,
  );
  const setTitleSummaryModel = useConversationalAIConfigStore(
    (s) => s.setSelectedTitleModel,
  );
  const setTitleSummaryKeyId = useConversationalAIConfigStore(
    (s) => s.setSelectedTitleKeyId,
  );

  const providerManager = AIProviderManager.getInstance();
  const keyManager = AIKeyManager.getInstance();

  // Check if AI is configured and get provider keys
  useEffect(() => {
    const checkConfiguration = async () => {
      const activeProvider = providerManager.getActiveProvider();
      setIsAIConfigured(!!activeProvider);

      // Get all keys with their details
      const allKeys = await keyManager.listKeys();
      const keysWithPreview = await Promise.all(
        allKeys.map(async (key) => {
          const fullKey = await keyManager.getKey(key.keyId);
          return {
            keyId: key.keyId,
            provider: key.provider,
            apiKeyPreview: fullKey?.apiKey
              ? `...${fullKey.apiKey.slice(-4)}`
              : "****",
            modelName: key.modelName,
          };
        }),
      );
      setProviderKeys(keysWithPreview);
    };
    checkConfiguration();
  }, [refreshKey, providerManager, keyManager]);

  const handleProviderAdded = () => {
    // Refresh the provider list and check configuration
    setRefreshKey((prev) => prev + 1);
    const activeProvider = providerManager.getActiveProvider();
    setIsAIConfigured(!!activeProvider);
  };

  const handleAddAnother = () => {
    // Just keep the form visible, user will add another key
    // No need to clear or reset - form already cleared after save
  };

  const handleProviderRemoved = () => {
    // Refresh the provider list and check configuration
    setRefreshKey((prev) => prev + 1);
    const activeProvider = providerManager.getActiveProvider();
    setIsAIConfigured(!!activeProvider);
  };

  const handleProviderSelect = async (keyId: string) => {
    const key = providerKeys.find((k) => k.keyId === keyId);
    if (!key) return;

    if (editingGroup === "recommendation") {
      setRecommendationProvider(key.provider);
      setRecommendationKeyId(keyId);

      // Set default model if not already set
      if (!recommendationModel && key.modelName) {
        setRecommendationModel(key.modelName);
      }
    } else {
      setTitleSummaryProvider(key.provider);
      setTitleSummaryKeyId(keyId);

      // Set default model if not already set
      if (!titleSummaryModel && key.modelName) {
        setTitleSummaryModel(key.modelName);
      }
    }

    setProviderDialogVisible(false);
  };

  const handleModelSelect = (model: string) => {
    if (editingGroup === "recommendation") {
      setRecommendationModel(model);
    } else {
      setTitleSummaryModel(model);
    }
  };

  const getProviderKeyLabel = (key: {
    keyId: string;
    provider: AIProviderType;
    apiKeyPreview: string;
    modelName?: string;
  }) => {
    const providerName = AI_PROVIDERS[key.provider]?.name || key.provider;
    return `${providerName} ${key.apiKeyPreview}${key.modelName ? ` (${key.modelName})` : ""}`;
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text variant="headlineMedium" style={styles.title}>
            AI Search & Recommendations
          </Text>
          <Text variant="bodyMedium" style={styles.description}>
            Configure your AI provider for intelligent search
          </Text>
        </View>

        {/* Feature toggles - Only show if AI is configured */}
        {isAIConfigured ? (
          <Card
            style={[
              styles.card,
              { backgroundColor: theme.colors.elevation.level1 },
            ]}
          >
            <Card.Content>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Features
              </Text>

              <View style={styles.toggleRow}>
                <View style={styles.toggleLabel}>
                  <Text variant="bodyMedium">AI Search</Text>
                  <Text variant="bodySmall" style={styles.toggleDescription}>
                    Enable natural language search
                  </Text>
                </View>
                <Switch
                  value={enableAISearch}
                  onValueChange={setEnableAISearchSetting}
                />
              </View>

              <Divider style={styles.divider} />

              <View style={styles.toggleRow}>
                <View style={styles.toggleLabel}>
                  <Text variant="bodyMedium">AI Recommendations</Text>
                  <Text variant="bodySmall" style={styles.toggleDescription}>
                    Get personalized suggestions
                  </Text>
                </View>
                <Switch
                  value={enableAIRecommendations}
                  onValueChange={setEnableAIRecommendationsSetting}
                />
              </View>

              <Divider style={styles.divider} />

              <View style={styles.infoBox}>
                <Text variant="labelSmall">
                  🔒 <Text style={{ fontWeight: "600" }}>Privacy First:</Text>{" "}
                  Your API keys are stored securely on your device and never
                  shared with UniArr servers.
                </Text>
              </View>
            </Card.Content>
          </Card>
        ) : null}

        {/* Recommendation Engine Configuration - Show if AI is configured */}
        {isAIConfigured && (
          <Card
            style={[
              styles.card,
              { backgroundColor: theme.colors.elevation.level1 },
            ]}
          >
            <Card.Content>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Recommendation Engine
              </Text>
              <Text variant="bodySmall" style={styles.toggleDescription}>
                Select which AI provider and model to use for content
                recommendations
              </Text>

              <Divider style={styles.divider} />

              <View style={styles.configRow}>
                <View style={styles.configLabel}>
                  <Text variant="bodyMedium">Provider & API Key</Text>
                  <Text variant="bodySmall" style={styles.configValue}>
                    {recommendationProvider && recommendationKeyId
                      ? getProviderKeyLabel(
                          providerKeys.find(
                            (k) => k.keyId === recommendationKeyId,
                          ) || {
                            keyId: recommendationKeyId,
                            provider: recommendationProvider as AIProviderType,
                            apiKeyPreview: "****",
                          },
                        )
                      : "Not configured"}
                  </Text>
                </View>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setEditingGroup("recommendation");
                    setProviderDialogVisible(true);
                  }}
                  disabled={providerKeys.length === 0}
                >
                  Select
                </Button>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.configRow}>
                <View style={styles.configLabel}>
                  <Text variant="bodyMedium">Model</Text>
                  <Text variant="bodySmall" style={styles.configValue}>
                    {recommendationModel || "Not configured"}
                  </Text>
                </View>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setEditingGroup("recommendation");
                    setModelDialogVisible(true);
                  }}
                  disabled={!recommendationProvider}
                >
                  Select
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Conversational AI Title Summary Configuration - Show if AI is configured */}
        {isAIConfigured && (
          <Card
            style={[
              styles.card,
              { backgroundColor: theme.colors.elevation.level1 },
            ]}
          >
            <Card.Content>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Conversational AI Title Summary
              </Text>
              <Text variant="bodySmall" style={styles.toggleDescription}>
                Select which AI provider and model to use for generating chat
                titles
              </Text>

              <Divider style={styles.divider} />

              <View style={styles.configRow}>
                <View style={styles.configLabel}>
                  <Text variant="bodyMedium">Provider & API Key</Text>
                  <Text variant="bodySmall" style={styles.configValue}>
                    {titleSummaryProvider && titleSummaryKeyId
                      ? getProviderKeyLabel(
                          providerKeys.find(
                            (k) => k.keyId === titleSummaryKeyId,
                          ) || {
                            keyId: titleSummaryKeyId,
                            provider: titleSummaryProvider as AIProviderType,
                            apiKeyPreview: "****",
                          },
                        )
                      : "Not configured"}
                  </Text>
                </View>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setEditingGroup("title");
                    setProviderDialogVisible(true);
                  }}
                  disabled={providerKeys.length === 0}
                >
                  Select
                </Button>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.configRow}>
                <View style={styles.configLabel}>
                  <Text variant="bodyMedium">Model</Text>
                  <Text variant="bodySmall" style={styles.configValue}>
                    {titleSummaryModel || "Not configured"}
                  </Text>
                </View>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setEditingGroup("title");
                    setModelDialogVisible(true);
                  }}
                  disabled={!titleSummaryProvider}
                >
                  Select
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {!isAIConfigured && (
          <Card
            style={[
              styles.card,
              { backgroundColor: theme.colors.elevation.level1 },
            ]}
          >
            <Card.Content>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                AI Features
              </Text>
              <View style={styles.disabledBox}>
                <Text variant="labelSmall">
                  ⚙️ <Text style={{ fontWeight: "600" }}>Not Configured:</Text>{" "}
                  Add an AI provider key below to enable intelligent search and
                  recommendations.
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Add new provider */}
        <View style={styles.sectionContainer}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Add AI Provider
          </Text>
          <AIKeyInputForm
            onSuccess={handleProviderAdded}
            onAddAnother={handleAddAnother}
          />
        </View>

        {/* List providers */}
        <View key={refreshKey} style={styles.sectionContainer}>
          <AIProviderList onProviderRemoved={handleProviderRemoved} />
        </View>

        {/* Help section */}
        <Card
          style={[
            styles.card,
            { backgroundColor: theme.colors.elevation.level1 },
          ]}
        >
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Getting Started
            </Text>

            <View style={styles.helpItem}>
              <Text variant="labelSmall" style={styles.helpNumber}>
                1
              </Text>
              <View style={styles.helpContent}>
                <Text variant="labelSmall" style={{ fontWeight: "600" }}>
                  Get an API Key
                </Text>
                <Text variant="bodySmall">
                  Sign up for{" "}
                  <Text style={{ fontWeight: "600" }}>Google Gemini</Text> at
                  ai.google.dev,{" "}
                  <Text style={{ fontWeight: "600" }}>OpenRouter</Text> at
                  openrouter.ai, or other supported providers.
                </Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.helpItem}>
              <Text variant="labelSmall" style={styles.helpNumber}>
                2
              </Text>
              <View style={styles.helpContent}>
                <Text variant="labelSmall" style={{ fontWeight: "600" }}>
                  Add Your Key
                </Text>
                <Text variant="bodySmall">
                  Paste your API key in the form above and select it as your
                  default provider.
                </Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.helpItem}>
              <Text variant="labelSmall" style={styles.helpNumber}>
                3
              </Text>
              <View style={styles.helpContent}>
                <Text variant="labelSmall" style={{ fontWeight: "600" }}>
                  Start Searching
                </Text>
                <Text variant="bodySmall">
                  Use natural language in the search tab to find content using
                  AI interpretation.
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Spacing */}
        <View style={styles.spacer} />
      </ScrollView>

      {/* Provider & Key Selection Dialog */}
      <Portal>
        <Dialog
          visible={providerDialogVisible}
          onDismiss={() => setProviderDialogVisible(false)}
        >
          <Dialog.Title>Select Provider & API Key</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView>
              <RadioButton.Group
                onValueChange={handleProviderSelect}
                value={
                  editingGroup === "recommendation"
                    ? recommendationKeyId || ""
                    : titleSummaryKeyId || ""
                }
              >
                {providerKeys.map((key) => (
                  <RadioButton.Item
                    key={key.keyId}
                    label={getProviderKeyLabel(key)}
                    value={key.keyId}
                  />
                ))}
              </RadioButton.Group>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setProviderDialogVisible(false)}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Model Selection Dialog - Using AIModelSelector */}
      {(recommendationProvider || titleSummaryProvider) && (
        <AIModelSelector
          visible={modelDialogVisible}
          onDismiss={() => setModelDialogVisible(false)}
          onSelectModel={handleModelSelect}
          selectedModel={
            editingGroup === "recommendation"
              ? recommendationModel ?? undefined
              : titleSummaryModel ?? undefined
          }
          provider={
            (editingGroup === "recommendation"
              ? recommendationProvider
              : titleSummaryProvider) as AIProviderType
          }
          keyId={
            editingGroup === "recommendation"
              ? recommendationKeyId ?? undefined
              : titleSummaryKeyId ?? undefined
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  title: {
    fontWeight: "600",
    marginBottom: 4,
  },
  description: {
    opacity: 0.6,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
  },
  sectionContainer: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
    marginHorizontal: spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleLabel: {
    flex: 1,
  },
  toggleDescription: {
    opacity: 0.6,
    marginTop: 4,
  },
  divider: {
    marginVertical: 8,
  },
  configRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  configLabel: {
    flex: 1,
  },
  configValue: {
    opacity: 0.6,
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: "rgba(25, 103, 210, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#1967D2",
  },
  disabledBox: {
    backgroundColor: "rgba(158, 158, 158, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#9E9E9E",
  },
  helpItem: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
  },
  helpNumber: {
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
    paddingTop: 2,
  },
  helpContent: {
    flex: 1,
  },
  spacer: {
    height: 24,
  },
});
