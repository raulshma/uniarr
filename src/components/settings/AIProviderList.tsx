import { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { Card, Text, Button, Divider, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { AIKeyManager } from "@/services/ai/core/AIKeyManager";
import { AIProviderManager } from "@/services/ai/core/AIProviderManager";
import { AIProviderType, AI_PROVIDERS } from "@/types/ai/AIProvider";
import { alert } from "@/services/dialogService";
import {
  useConversationalAIConfigStore,
  selectConversationalAIProvider,
  selectConversationalAIModel,
} from "@/store/conversationalAIConfigStore";

interface ProviderListItem {
  keyId: string;
  provider: AIProviderType;
  createdAt: number;
  lastUsed?: number;
  isDefault?: boolean;
  isHealthy?: boolean;
  responseTime?: number;
  modelName?: string;
  isCurrent?: boolean; // Currently active key for rotation
}

interface AIProviderListProps {
  onProviderRemoved?: () => void;
  onProviderSelected?: (provider: AIProviderType) => void;
  onOpenModelSelection?: (provider: AIProviderType, keyId: string) => void;
}

/**
 * Component for displaying and managing stored AI provider keys
 */
export function AIProviderList({
  onProviderRemoved,
  onProviderSelected,
  onOpenModelSelection,
}: AIProviderListProps) {
  const theme = useTheme();
  const router = useRouter();
  const { colors } = theme;
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<
    Record<string, { isHealthy: boolean; responseTime?: number }>
  >({});
  const [checkingHealth, setCheckingHealth] = useState<Record<string, boolean>>(
    {},
  );
  const [keyStats, setKeyStats] = useState<
    Record<
      string,
      {
        totalKeys: number;
        activeKey: string;
        usedKeys: number;
        availableKeys: number;
      }
    >
  >({});
  const conversationalProvider = useConversationalAIConfigStore(
    selectConversationalAIProvider,
  );
  const conversationalModel = useConversationalAIConfigStore(
    selectConversationalAIModel,
  );
  const conversationalKeyId = useConversationalAIConfigStore(
    (s) => s.selectedKeyId,
  );

  const keyManager = AIKeyManager.getInstance();
  const providerManager = AIProviderManager.getInstance();

  const loadProviders = useCallback(async () => {
    try {
      setIsLoading(true);
      const keys = await keyManager.listKeys();

      const providerItems: ProviderListItem[] = keys.map((key) => {
        const currentKeyId = providerManager.getRotationState(
          key.provider as AIProviderType,
        )?.currentKeyId;
        return {
          keyId: key.keyId,
          provider: key.provider as AIProviderType,
          createdAt: key.createdAt,
          lastUsed: key.lastUsed,
          isDefault: key.isDefault || false, // Use actual isDefault from key data
          modelName: key.modelName,
          isCurrent: currentKeyId === key.keyId,
        };
      });

      setProviders(providerItems);

      // Update key statistics
      const stats: typeof keyStats = {};
      const providerTypes = new Set(
        keys.map((k) => k.provider as AIProviderType),
      );
      for (const provider of providerTypes) {
        const rotationState = providerManager.getRotationState(provider);
        if (rotationState) {
          stats[provider] = {
            totalKeys: providerManager.getProviderKeys(provider).length,
            activeKey: rotationState.currentKeyId,
            usedKeys: providerManager.getUsedKeyCount(provider),
            availableKeys: providerManager.getAvailableKeyCount(provider),
          };
        }
      }
      setKeyStats(stats);
    } catch (_error) {
      console.error("Failed to load providers:", _error);
    } finally {
      setIsLoading(false);
    }
  }, [keyManager, providerManager]);

  const performHealthCheck = useCallback(
    async (provider: AIProviderType) => {
      try {
        setCheckingHealth((prev) => ({ ...prev, [provider]: true }));
        const health = await providerManager.healthCheck(provider);
        setHealthStatus((prev) => ({
          ...prev,
          [provider]: {
            isHealthy: health.isHealthy,
            responseTime: health.responseTime,
          },
        }));
      } catch {
        setHealthStatus((prev) => ({
          ...prev,
          [provider]: {
            isHealthy: false,
          },
        }));
      } finally {
        setCheckingHealth((prev) => ({ ...prev, [provider]: false }));
      }
    },
    [providerManager],
  );

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleSetDefault = useCallback(
    async (keyId: string, provider: AIProviderType) => {
      try {
        await keyManager.setKeyAsDefault(keyId);
        providerManager.setActiveProvider(provider);
        onProviderSelected?.(provider);
        alert(
          "Success",
          `${AI_PROVIDERS[provider].name} is now your default provider`,
        );
        await loadProviders();
      } catch {
        alert("Error", "Failed to set default provider");
      }
    },
    [keyManager, providerManager, onProviderSelected, loadProviders],
  );

  const handleEditProvider = useCallback(
    async (provider: AIProviderType) => {
      alert(
        "Update Provider",
        `To update your ${AI_PROVIDERS[provider].name} API key, please remove this provider and add a new one with the updated credentials.`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Remove and Add New",
            onPress: async () => {
              try {
                await providerManager.removeProvider(provider);
                await loadProviders();
                onProviderRemoved?.();
                alert(
                  "Success",
                  `${AI_PROVIDERS[provider].name} has been removed. You can now add a new key with updated credentials.`,
                );
              } catch (_error) {
                const errorMsg =
                  _error instanceof Error
                    ? _error.message
                    : "Failed to update provider";
                alert("Error", errorMsg);
              }
            },
          },
        ],
      );
    },
    [providerManager, onProviderRemoved, loadProviders],
  );

  const handleDeleteProvider = useCallback(
    (keyId: string, provider: AIProviderType) => {
      alert(
        "Delete Provider",
        `Are you sure you want to remove this ${AI_PROVIDERS[provider].name} key?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            onPress: async () => {
              try {
                await providerManager.removeProviderKey(keyId);
                await loadProviders();
                onProviderRemoved?.();
                alert(
                  "Success",
                  `${AI_PROVIDERS[provider].name} key has been removed`,
                );
              } catch (_error) {
                const errorMsg =
                  _error instanceof Error
                    ? _error.message
                    : "Failed to remove provider key";
                alert("Error", errorMsg);
              }
            },
            style: "destructive",
          },
        ],
      );
    },
    [providerManager, onProviderRemoved, loadProviders],
  );

  const handleSetForConversationalAI = useCallback(
    (keyId: string, provider: AIProviderType) => {
      router.push({
        pathname: "/(auth)/+modal/select-provider-model",
        params: { target: "chat" },
      });
    },
    [router],
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderProvider = ({ item }: { item: ProviderListItem }) => {
    const providerInfo = AI_PROVIDERS[item.provider];
    const health = healthStatus[item.provider];
    const checking = checkingHealth[item.provider];
    const stats = keyStats[item.provider];
    const isConversationalAIProvider =
      conversationalProvider === item.provider &&
      item.keyId === conversationalKeyId;

    return (
      <Card
        style={[
          styles.providerCard,
          { backgroundColor: colors.elevation.level1 },
        ]}
      >
        <Card.Content>
          {/* Header with provider name and status */}
          <View style={styles.headerRow}>
            <View style={styles.titleSection}>
              <Text variant="titleMedium" style={styles.providerName}>
                {providerInfo.name}
              </Text>
              <Text variant="bodySmall" style={styles.added}>
                Added: {formatDate(item.createdAt)}
              </Text>
            </View>
            <View style={styles.statusChips}>
              {item.isDefault && (
                <View style={styles.defaultChip}>
                  <Text
                    variant="labelSmall"
                    style={{ color: colors.primary, fontWeight: "600" }}
                  >
                    Default
                  </Text>
                </View>
              )}
              {item.isCurrent && stats && (
                <View style={[styles.defaultChip, { marginLeft: 8 }]}>
                  <Text
                    variant="labelSmall"
                    style={{ color: "#4CAF50", fontWeight: "600" }}
                  >
                    Active
                  </Text>
                </View>
              )}
              {isConversationalAIProvider && (
                <View style={[styles.defaultChip, { marginLeft: 8 }]}>
                  <Text
                    variant="labelSmall"
                    style={{ color: "#FF9800", fontWeight: "600" }}
                  >
                    💬 Chat
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Multi-key rotation info */}
          {stats && stats.totalKeys > 1 && (
            <View
              style={[
                styles.rotationSection,
                { borderColor: "rgba(33, 150, 243, 0.2)" },
              ]}
            >
              <Text variant="labelSmall" style={{ fontWeight: "600" }}>
                🔄 Multiple Keys Configuration
              </Text>
              <View style={styles.rotationStats}>
                <Text variant="labelSmall">
                  Total Keys:{" "}
                  <Text style={{ fontWeight: "600" }}>{stats.totalKeys}</Text>
                </Text>
                <Text variant="labelSmall">
                  Active:{" "}
                  <Text style={{ fontWeight: "600" }}>
                    {stats.availableKeys}
                  </Text>
                </Text>
                {stats.usedKeys > 0 && (
                  <Text
                    variant="labelSmall"
                    style={{ color: colors.error, fontWeight: "500" }}
                  >
                    Exhausted:{" "}
                    <Text style={{ fontWeight: "600" }}>{stats.usedKeys}</Text>
                  </Text>
                )}
              </View>
              {stats.availableKeys === 0 && (
                <Text
                  variant="labelSmall"
                  style={{ color: colors.error, marginTop: 4 }}
                >
                  ⚠️ All keys exhausted by rate limits
                </Text>
              )}
            </View>
          )}

          {/* Health status */}
          {health && (
            <View style={styles.healthSection}>
              <View style={styles.healthRow}>
                <Text variant="labelSmall">Status: </Text>
                <Text
                  variant="labelSmall"
                  style={{
                    color: health.isHealthy ? "#4CAF50" : colors.error,
                  }}
                >
                  {health.isHealthy ? "✓ Connected" : "✗ Failed"}
                </Text>
              </View>
              {health.responseTime !== undefined && (
                <Text variant="labelSmall">
                  Response time: {health.responseTime}ms
                </Text>
              )}
            </View>
          )}

          {/* Last used */}
          {item.lastUsed && (
            <Text variant="labelSmall" style={styles.lastUsed}>
              Last used: {formatDate(item.lastUsed)}
            </Text>
          )}

          {/* Model name */}
          {item.modelName && (
            <Text variant="labelSmall" style={styles.modelInfo}>
              Model: {item.modelName}
            </Text>
          )}

          {/* Conversational AI configuration display */}
          {isConversationalAIProvider && conversationalModel && (
            <View
              style={[
                styles.conversationalAISection,
                {
                  borderColor: "#FF9800",
                  backgroundColor: "rgba(255, 152, 0, 0.1)",
                },
              ]}
            >
              <Text
                variant="labelSmall"
                style={{ color: "#FF9800", fontWeight: "600" }}
              >
                💬 Chat Configuration
              </Text>
              <Text variant="labelSmall" style={{ marginTop: 4 }}>
                Model: {conversationalModel}
              </Text>
            </View>
          )}

          {/* Provider info */}
          <View style={styles.infoSection}>
            <Text variant="bodySmall" numberOfLines={1}>
              {providerInfo.description}
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.actionButtons}>
            {!item.isDefault && (
              <Button
                mode="outlined"
                onPress={() => handleSetDefault(item.keyId, item.provider)}
                style={styles.actionButton}
              >
                Set Default
              </Button>
            )}
            <Button
              mode="outlined"
              textColor={
                isConversationalAIProvider ? "#FF9800" : colors.primary
              }
              onPress={() =>
                handleSetForConversationalAI(item.keyId, item.provider)
              }
              style={styles.actionButton}
            >
              {isConversationalAIProvider ? "✓ Chat" : "Set for Chat"}
            </Button>
            <Button
              mode="outlined"
              onPress={() => handleEditProvider(item.provider)}
              style={styles.actionButton}
            >
              Update
            </Button>
            <Button
              mode="outlined"
              loading={checking}
              disabled={checking}
              onPress={() => performHealthCheck(item.provider)}
              style={styles.actionButton}
            >
              Check Status
            </Button>
            <Button
              mode="outlined"
              textColor={colors.error}
              onPress={() => handleDeleteProvider(item.keyId, item.provider)}
              style={styles.actionButton}
            >
              Remove
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium">Loading providers...</Text>
      </View>
    );
  }

  if (providers.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="bodyLarge">No AI providers configured</Text>
        <Text variant="bodySmall" style={styles.emptyHelp}>
          Add an AI provider key to get started with intelligent search
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.listTitle}>
        Configured Providers
      </Text>
      <FlatList
        data={providers}
        renderItem={renderProvider}
        keyExtractor={(item) => item.keyId}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <Divider style={styles.divider} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyHelp: {
    marginTop: 8,
    opacity: 0.6,
  },
  listTitle: {
    marginBottom: 12,
    fontWeight: "600",
  },
  providerCard: {
    marginVertical: 8,
    borderRadius: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  titleSection: {
    flex: 1,
  },
  providerName: {
    fontWeight: "600",
    marginBottom: 4,
  },
  added: {
    opacity: 0.6,
  },
  defaultChip: {
    marginLeft: 8,
  },
  statusChips: {
    flexDirection: "row",
    alignItems: "center",
  },
  rotationSection: {
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(33, 150, 243, 0.3)",
  },
  rotationStats: {
    marginTop: 4,
    gap: 2,
  },
  healthSection: {
    marginBottom: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
  healthRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  lastUsed: {
    marginBottom: 8,
    opacity: 0.6,
  },
  modelInfo: {
    marginBottom: 8,
    opacity: 0.6,
  },
  conversationalAISection: {
    marginVertical: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderLeftWidth: 2,
    borderRadius: 4,
  },
  infoSection: {
    marginVertical: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.1)",
  },
  actionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
  },
  divider: {
    marginVertical: 0,
  },
});
