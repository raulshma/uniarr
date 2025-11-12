import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import {
  Card,
  Text,
  Button,
  Chip,
  ProgressBar,
  Divider,
} from "react-native-paper";
import { useTheme } from "@/hooks/useTheme";
import { AIKeyManager } from "@/services/ai/core/AIKeyManager";
import { AIProviderManager } from "@/services/ai/core/AIProviderManager";
import { AIProviderType, AI_PROVIDERS } from "@/types/ai/AIProvider";
import { alert } from "@/services/dialogService";

interface ProviderListItem {
  keyId: string;
  provider: AIProviderType;
  createdAt: number;
  lastUsed?: number;
  isDefault?: boolean;
  isHealthy?: boolean;
  responseTime?: number;
  modelName?: string;
}

interface AIProviderListProps {
  onProviderRemoved?: () => void;
  onProviderSelected?: (provider: AIProviderType) => void;
}

/**
 * Component for displaying and managing stored AI provider keys
 */
export function AIProviderList({
  onProviderRemoved,
  onProviderSelected,
}: AIProviderListProps) {
  const { colors } = useTheme();
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState<AIProviderType | null>(
    null,
  );
  const [healthStatus, setHealthStatus] = useState<
    Record<string, { isHealthy: boolean; responseTime?: number }>
  >({});
  const [checkingHealth, setCheckingHealth] = useState<Record<string, boolean>>(
    {},
  );
  const [editingProvider, setEditingProvider] = useState<AIProviderType | null>(
    null,
  );
  const [updatingProvider, setUpdatingProvider] =
    useState<AIProviderType | null>(null);

  const keyManager = AIKeyManager.getInstance();
  const providerManager = AIProviderManager.getInstance();

  const loadProviders = useCallback(async () => {
    try {
      setIsLoading(true);
      const keys = await keyManager.listKeys();
      const active = providerManager.getActiveProvider();

      const providerItems: ProviderListItem[] = keys.map((key) => ({
        keyId: key.keyId,
        provider: key.provider as AIProviderType,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed,
        isDefault: active?.provider === key.provider,
        modelName: key.modelName,
      }));

      setProviders(providerItems);
      setActiveProvider(active?.provider ?? null);
    } catch (error) {
      console.error("Failed to load providers:", error);
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
      } catch (error) {
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
    async (provider: AIProviderType) => {
      try {
        providerManager.setActiveProvider(provider);
        setActiveProvider(provider);
        onProviderSelected?.(provider);
        alert(
          "Success",
          `${AI_PROVIDERS[provider].name} is now your default provider`,
        );
      } catch (error) {
        alert("Error", "Failed to set default provider");
      }
    },
    [providerManager, onProviderSelected],
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
                setEditingProvider(null);
                onProviderRemoved?.();
                alert(
                  "Success",
                  `${AI_PROVIDERS[provider].name} has been removed. You can now add a new key with updated credentials.`,
                );
              } catch (error) {
                const errorMsg =
                  error instanceof Error
                    ? error.message
                    : "Failed to update provider";
                alert("Error", errorMsg);
              }
            },
          },
        ],
      );
    },
    [providerManager, keyManager, onProviderRemoved],
  );

  const handleDeleteProvider = useCallback(
    (provider: AIProviderType) => {
      alert(
        "Delete Provider",
        `Are you sure you want to remove ${AI_PROVIDERS[provider].name}?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            onPress: async () => {
              try {
                await providerManager.removeProvider(provider);
                await loadProviders();
                onProviderRemoved?.();
                alert(
                  "Success",
                  `${AI_PROVIDERS[provider].name} has been removed`,
                );
              } catch (error) {
                const errorMsg =
                  error instanceof Error
                    ? error.message
                    : "Failed to remove provider";
                alert("Error", errorMsg);
              }
            },
            style: "destructive",
          },
        ],
      );
    },
    [keyManager, providerManager, onProviderRemoved],
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
          </View>

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
                onPress={() => handleSetDefault(item.provider)}
                style={styles.actionButton}
              >
                Set Default
              </Button>
            )}
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
              onPress={() => handleDeleteProvider(item.provider)}
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
