import React, { useCallback } from "react";
import { StyleSheet, View, Pressable, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Divider, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { AppTheme } from "@/constants/theme";
import {
  AIProviderType,
  AI_PROVIDERS,
  AI_PROVIDER_MODELS,
} from "@/types/ai/AIProvider";
import { useConversationalAIConfigStore } from "@/store/conversationalAIConfigStore";
import { alert } from "@/services/dialogService";

const SelectChatModelSheet: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const { provider: providerParam, keyId } = useLocalSearchParams<{
    provider?: string;
    keyId?: string;
  }>();

  const provider = providerParam as AIProviderType | undefined;

  const handleSelectModel = useCallback(
    (model: string) => {
      if (provider && keyId) {
        useConversationalAIConfigStore
          .getState()
          .setConversationalAIConfig(provider, model, keyId);
        alert(
          "Success",
          `${AI_PROVIDERS[provider].name} with model ${model} is now set for conversational AI`,
        );
        router.back();
      }
    },
    [provider, keyId, router],
  );

  const models =
    provider && AI_PROVIDER_MODELS[provider]
      ? AI_PROVIDER_MODELS[provider]
      : [];

  const renderModel = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <>
        <Pressable
          onPress={() => handleSelectModel(item)}
          style={({ pressed }) => [
            styles.modelItem,
            {
              backgroundColor: pressed
                ? theme.colors.surfaceVariant
                : theme.colors.surface,
            },
          ]}
        >
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurface, fontWeight: "500" }}
          >
            {item}
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>
        {index < models.length - 1 && <Divider />}
      </>
    ),
    [theme, handleSelectModel, models.length],
  );

  if (!provider || !AI_PROVIDER_MODELS[provider]) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.title}>
            Select Model
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
          <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
            Invalid provider
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>
          Select Model for{" "}
          <Text style={{ color: theme.colors.primary }}>
            {provider ? AI_PROVIDERS[provider].name : "Chat"}
          </Text>
        </Text>
        <Pressable onPress={() => router.back()}>
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={theme.colors.onSurface}
          />
        </Pressable>
      </View>

      <Text
        variant="bodySmall"
        style={{
          color: theme.colors.onSurfaceVariant,
          paddingHorizontal: 16,
          marginBottom: 8,
        }}
      >
        Choose a model to use for chat:
      </Text>

      <FlatList
        data={models}
        renderItem={renderModel}
        keyExtractor={(item) => item}
        scrollEnabled
        keyboardShouldPersistTaps="handled"
        style={styles.modelsList}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontWeight: "600",
    flex: 1,
  },
  modelsList: {
    flex: 1,
  },
  modelItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    paddingVertical: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
});

export default SelectChatModelSheet;
