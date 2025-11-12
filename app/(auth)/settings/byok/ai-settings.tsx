import React, { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Card, Switch, Divider, useTheme } from "react-native-paper";
import { AIKeyInputForm } from "@/components/settings/AIKeyInputForm";
import { AIProviderList } from "@/components/settings/AIProviderList";
import { AIProviderManager } from "@/services/ai/core/AIProviderManager";
import { useSettingsStore } from "@/store/settingsStore";
import { spacing } from "@/theme/spacing";

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

  // Use settings store for toggles persistence
  const enableAISearch = useSettingsStore((s) => s.enableAISearch);
  const setEnableAISearchSetting = useSettingsStore((s) => s.setEnableAISearch);
  const enableAIRecommendations = useSettingsStore(
    (s) => s.enableAIRecommendations,
  );
  const setEnableAIRecommendationsSetting = useSettingsStore(
    (s) => s.setEnableAIRecommendations,
  );

  const providerManager = AIProviderManager.getInstance();

  // Check if AI is configured
  useEffect(() => {
    const checkConfiguration = async () => {
      const activeProvider = providerManager.getActiveProvider();
      setIsAIConfigured(!!activeProvider);
    };
    checkConfiguration();
  }, [refreshKey, providerManager]);

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
        ) : (
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
                  Sign up for free on{" "}
                  <Text style={{ fontWeight: "600" }}>ai.google.dev</Text> and
                  create an API key for Google Gemini.
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
