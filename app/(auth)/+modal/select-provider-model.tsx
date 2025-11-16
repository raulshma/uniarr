import React, { useCallback, useState, useEffect } from "react";
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
import { AIProviderType, AI_PROVIDERS } from "@/types/ai/AIProvider";
import { AIKeyManager } from "@/services/ai/core/AIKeyManager";
import { useConversationalAIConfigStore } from "@/store/conversationalAIConfigStore";
import { alert } from "@/services/dialogService";
import { AIModelSelector } from "@/components/settings/AIModelSelector";

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
  const [modelSelectorVisible, setModelSelectorVisible] = useState(false);
  const { target } = useLocalSearchParams<{ target?: string }>();

  const keyManager = AIKeyManager.getInstance();

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
    setModelSelectorVisible(true);
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
            Choose Provider & API Key
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
      </ScrollView>

      {/* AI Model Selector Modal */}
      {selectedKey && (
        <AIModelSelector
          visible={modelSelectorVisible}
          onDismiss={() => setModelSelectorVisible(false)}
          onSelectModel={handleSelectModel}
          selectedModel={undefined}
          provider={selectedKey.provider}
          keyId={selectedKey.keyId}
        />
      )}
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
});

export default SelectProviderAndModelSheet;
