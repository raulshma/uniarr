import React, { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import type { AIProviderType } from "@/types/ai/AIProvider";

type ProviderModelDisplayProps = {
  provider: AIProviderType | null;
  model: string | null;
};

const ProviderModelDisplayComponent: React.FC<ProviderModelDisplayProps> = ({
  provider,
  model,
}) => {
  const theme = useTheme();

  const providerIcon = useMemo(() => {
    switch (provider) {
      case "openai":
        return "robot";
      case "anthropic":
        return "brain";
      case "google":
        return "google";
      case "openrouter":
        return "router-wireless";
      default:
        return "robot-outline";
    }
  }, [provider]);

  const providerLabel = useMemo(() => {
    switch (provider) {
      case "openai":
        return "OpenAI";
      case "anthropic":
        return "Anthropic";
      case "google":
        return "Google";
      case "openrouter":
        return "OpenRouter";
      default:
        return "Unknown";
    }
  }, [provider]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingHorizontal: 2,
          paddingVertical: 4,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 12,
          marginHorizontal: 16,
          marginBottom: 4,
        },
        iconContainer: {
          width: 24,
          height: 24,
          alignItems: "center",
          justifyContent: "center",
        },
        textContainer: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        },
        providerText: {
          fontSize: 13,
          fontWeight: "600",
          color: theme.colors.onSurfaceVariant,
        },
        separator: {
          fontSize: 13,
          color: theme.colors.onSurfaceVariant,
          opacity: 0.5,
        },
        modelText: {
          fontSize: 13,
          fontWeight: "400",
          color: theme.colors.onSurfaceVariant,
        },
      }),
    [theme],
  );

  if (!provider || !model) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name={providerIcon}
          size={16}
          color={theme.colors.onSurfaceVariant}
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.providerText}>{providerLabel}</Text>
        <Text style={styles.separator}>·</Text>
        <Text style={styles.modelText} numberOfLines={1}>
          {model}
        </Text>
      </View>
    </View>
  );
};

export const ProviderModelDisplay = memo(ProviderModelDisplayComponent);
