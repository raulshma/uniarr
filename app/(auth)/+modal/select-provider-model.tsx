import React, { useCallback, useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  FlatList,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Text,
  Divider,
  useTheme,
  Button,
  ActivityIndicator,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import type { AppTheme } from "@/constants/theme";
import {
  AIProviderType,
  AI_PROVIDERS,
  AI_PROVIDER_MODELS,
} from "@/types/ai/AIProvider";
import { AIKeyManager } from "@/services/ai/core/AIKeyManager";
import { useConversationalAIConfigStore } from "@/store/conversationalAIConfigStore";
import { alert } from "@/services/dialogService";
import { useOpenRouterModels } from "@/hooks/useOpenRouterModels";
import type { OpenRouterModel } from "@/services/ai/providers/OpenRouterService";

interface ProviderWithKey {
  provider: AIProviderType;
  keyId: string;
  modelName?: string;
  createdAt?: number;
}

const SelectProviderAndModelSheet: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderWithKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<ProviderWithKey | null>(null);
  const [apiKey, setApiKey] = useState<string | undefined>(undefined);
  const { target } = useLocalSearchParams<{ target?: string }>();

  const keyManager = AIKeyManager.getInstance();

  // Use the reusable OpenRouter models hook
  const { models: openRouterModels, loading: loadingOpenRouterModels } =
    useOpenRouterModels({
      apiKey,
      autoFetch: selectedKey?.provider === "openrouter",
    });

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const keys = await keyManager.listKeys();
        // Keep each key as a separate selectable entry. This allows
        // selecting between multiple keys from the same provider.
        const items: ProviderWithKey[] = keys.map((k) => ({
          provider: k.provider as AIProviderType,
          keyId: k.keyId,
          modelName: k.modelName,
          createdAt: k.createdAt,
        }));

        setProviders(items);
      } catch (error) {
        console.error("Failed to load providers:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadProviders();
  }, [keyManager]);

  // Fetch API key when selected provider changes
  useEffect(() => {
    const fetchApiKey = async () => {
      if (selectedKey?.keyId) {
        const key = await keyManager.getKey(selectedKey.keyId);
        setApiKey(key?.apiKey);
      } else {
        setApiKey(undefined);
      }
    };
    void fetchApiKey();
  }, [selectedKey?.keyId, keyManager]);

  const handleSelectModel = useCallback(
    (model: string) => {
      if (!selectedKey) return;

      const store = useConversationalAIConfigStore.getState();
      const isTitleTarget = String(target || "chat").toLowerCase() === "title";

      if (isTitleTarget) {
        store.setTitleSummaryConfig(
          selectedKey.provider,
          model,
          selectedKey.keyId,
        );
        alert(
          "Success",
          `${AI_PROVIDERS[selectedKey.provider].name} with model ${model} is now set for conversation title summaries`,
        );
      } else {
        store.setConversationalAIConfig(
          selectedKey.provider,
          model,
          selectedKey.keyId,
        );
        alert(
          "Success",
          `${AI_PROVIDERS[selectedKey.provider].name} with model ${model} is now set for conversational AI`,
        );
      }

      router.back();
    },
    [selectedKey, router, target],
  );

  const handleSelectProvider = useCallback((item: ProviderWithKey) => {
    setSelectedKey(item);
  }, []);

  const renderProviderItem = useCallback(
    ({ item }: { item: ProviderWithKey }) => (
      <Pressable
        onPress={() => handleSelectProvider(item)}
        style={({ pressed }) => [
          styles.providerItem,
          {
            backgroundColor:
              selectedKey?.keyId === item.keyId
                ? theme.colors.primaryContainer
                : pressed
                  ? theme.colors.surfaceVariant
                  : theme.colors.surface,
          },
        ]}
      >
        <View style={styles.providerItemContent}>
          <Text
            variant="bodyLarge"
            style={{
              color: theme.colors.onSurface,
              fontWeight: selectedKey?.keyId === item.keyId ? "600" : "500",
            }}
          >
            {AI_PROVIDERS[item.provider].name}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
          >
            {AI_PROVIDERS[item.provider].description}
            {item.createdAt
              ? ` • Added ${new Date(item.createdAt).toLocaleDateString()}`
              : ""}
          </Text>
        </View>
        {selectedKey?.keyId === item.keyId && (
          <MaterialCommunityIcons
            name="check-circle"
            size={24}
            color={theme.colors.primary}
          />
        )}
      </Pressable>
    ),
    [theme, selectedKey, handleSelectProvider],
  );

  // Get available models based on provider
  const availableModels = useMemo(() => {
    if (!selectedKey) return [];

    if (
      selectedKey.provider === "openrouter" &&
      (openRouterModels.free.length > 0 || openRouterModels.paid.length > 0)
    ) {
      return [
        ...openRouterModels.free.map((m) => ({
          id: m.id,
          model: m,
          isFree: true,
        })),
        ...openRouterModels.paid.map((m) => ({
          id: m.id,
          model: m,
          isFree: false,
        })),
      ];
    }

    // For other providers, use static list
    return AI_PROVIDER_MODELS[selectedKey.provider].map((id) => ({
      id,
      model: null,
      isFree: false,
    }));
  }, [selectedKey, openRouterModels]);

  const renderModelItem = useCallback(
    ({
      item,
      index,
    }: {
      item: { id: string; model: OpenRouterModel | null; isFree: boolean };
      index: number;
    }) => {
      const { id, model, isFree } = item;

      return (
        <>
          <Pressable
            onPress={() => handleSelectModel(id)}
            style={({ pressed }) => [
              styles.modelItem,
              {
                backgroundColor: pressed
                  ? theme.colors.surfaceVariant
                  : theme.colors.surface,
              },
            ]}
          >
            <View style={styles.modelItemContent}>
              <View style={styles.modelItemHeader}>
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.onSurface, fontWeight: "500" }}
                >
                  {model?.name || id}
                </Text>
                {isFree && (
                  <View style={styles.freeBadge}>
                    <Text variant="labelSmall" style={styles.freeBadgeText}>
                      FREE
                    </Text>
                  </View>
                )}
              </View>
              {model && (
                <>
                  <Text
                    variant="bodySmall"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      marginTop: 2,
                    }}
                  >
                    {model.id}
                  </Text>
                  <View style={styles.modelMetadata}>
                    <Text variant="bodySmall" style={styles.modelMetadataText}>
                      {model.context_length.toLocaleString()} tokens
                    </Text>
                    {model.architecture?.modality && (
                      <Text
                        variant="bodySmall"
                        style={styles.modelMetadataText}
                      >
                        • {model.architecture.modality}
                      </Text>
                    )}
                    {!isFree && (
                      <Text
                        variant="bodySmall"
                        style={styles.modelMetadataText}
                      >
                        • ${model.pricing.prompt}/${model.pricing.completion}
                      </Text>
                    )}
                  </View>
                </>
              )}
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
          </Pressable>
          {index < availableModels.length - 1 && <Divider />}
        </>
      );
    },
    [theme, handleSelectModel, availableModels.length],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.title}>
            Select Provider & Model
          </Text>
          <Pressable onPress={() => router.back()}>
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={theme.colors.onSurface}
            />
          </Pressable>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="bodyMedium" style={{ marginTop: 16 }}>
            Loading providers...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (providers.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.title}>
            Select Provider & Model
          </Text>
          <Pressable onPress={() => router.back()}>
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={theme.colors.onSurface}
            />
          </Pressable>
        </View>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={48}
            color={theme.colors.error}
          />
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.error, marginTop: 16 }}
          >
            No AI providers configured
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              router.push("/(auth)/settings/byok/ai-settings");
            }}
            style={{ marginTop: 16 }}
          >
            Configure Providers
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>
          Select Provider & Model
        </Text>
        <Pressable onPress={() => router.back()}>
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={theme.colors.onSurface}
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Providers Section */}
        <View style={styles.section}>
          <Text
            variant="titleSmall"
            style={{
              color: theme.colors.onSurface,
              fontWeight: "600",
              paddingHorizontal: 16,
              marginBottom: 12,
            }}
          >
            1. Choose Provider
          </Text>
          <FlatList
            data={providers}
            renderItem={renderProviderItem}
            keyExtractor={(item) => item.keyId}
            scrollEnabled={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 0 }}
            ItemSeparatorComponent={() => <Divider />}
          />
        </View>

        {/* Models Section */}
        {selectedKey && (
          <View style={styles.section}>
            <Text
              variant="titleSmall"
              style={{
                color: theme.colors.onSurface,
                fontWeight: "600",
                paddingHorizontal: 16,
                marginBottom: 12,
              }}
            >
              2. Choose Model
            </Text>
            {loadingOpenRouterModels &&
            selectedKey.provider === "openrouter" ? (
              <View style={styles.loadingModels}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text
                  variant="bodySmall"
                  style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}
                >
                  Loading models...
                </Text>
              </View>
            ) : availableModels.length > 0 ? (
              <FlatList
                data={availableModels}
                renderItem={renderModelItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 0 }}
              />
            ) : (
              <View style={styles.emptyModels}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  No models available for this provider
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontWeight: "600",
    flex: 1,
  },
  content: {
    flex: 1,
    paddingVertical: 12,
  },
  section: {
    marginBottom: 24,
  },
  providerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 80,
  },
  providerItemContent: {
    flex: 1,
    marginRight: 12,
  },
  modelItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 60,
  },
  modelItemContent: {
    flex: 1,
    marginRight: 12,
  },
  modelItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  freeBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  freeBadgeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 10,
  },
  modelMetadata: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    gap: 4,
  },
  modelMetadataText: {
    opacity: 0.5,
    fontSize: 11,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingModels: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyModels: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#999",
    textAlign: "center",
  },
});

export default SelectProviderAndModelSheet;
