import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Button, TextInput, Text, ActivityIndicator } from "react-native-paper";
import { useTheme } from "@/hooks/useTheme";
import { AIProviderType, AI_PROVIDER_MODELS } from "@/types/ai/AIProvider";
import {
  OpenRouterModel,
  ModelFilters,
} from "@/services/ai/providers/OpenRouterService";
import { AIKeyManager } from "@/services/ai/core/AIKeyManager";
import { useOpenRouterModels } from "@/hooks/useOpenRouterModels";

interface AIModelSelectorProps {
  visible: boolean;
  onDismiss: () => void;
  onSelectModel: (modelId: string) => void;
  selectedModel?: string;
  provider: AIProviderType;
  keyId?: string;
}

type ModelListItem =
  | { type: "header"; title: string }
  | { type: "model"; model: OpenRouterModel; isFree: boolean };

/**
 * Reusable AI Model Selector with advanced filtering for OpenRouter
 * Supports both OpenRouter (with advanced filters) and other providers (simple list)
 */
export function AIModelSelector({
  visible,
  onDismiss,
  onSelectModel,
  selectedModel,
  provider,
  keyId,
}: AIModelSelectorProps) {
  const { colors } = useTheme();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ModelFilters>({});
  const [apiKey, setApiKey] = useState<string | undefined>(undefined);

  const keyManager = AIKeyManager.getInstance();

  // Fetch API key when keyId changes
  useEffect(() => {
    const fetchApiKey = async () => {
      if (keyId) {
        const key = await keyManager.getKey(keyId);
        setApiKey(key?.apiKey);
      } else {
        setApiKey(undefined);
      }
    };
    void fetchApiKey();
  }, [keyId, keyManager]);

  // Use the reusable OpenRouter models hook
  const {
    models: openRouterModels,
    loading: fetchingModels,
    availableModalities,
    availableInstructTypes,
    fetchModels: refetchModels,
  } = useOpenRouterModels({
    apiKey,
    autoFetch: visible && provider === "openrouter",
    filters,
  });

  // Get available models for the current provider
  const availableModels = React.useMemo(() => {
    if (
      provider === "openrouter" &&
      (openRouterModels.free.length > 0 || openRouterModels.paid.length > 0)
    ) {
      // Combine free and paid models, with free models first
      return [
        ...openRouterModels.free.map((m) => m.id),
        ...openRouterModels.paid.map((m) => m.id),
      ];
    }
    return AI_PROVIDER_MODELS[provider];
  }, [provider, openRouterModels]);

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  const handleModelSelect = (modelId: string) => {
    onSelectModel(modelId);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: colors.elevation.level1 },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text variant="titleSmall" style={styles.modalTitle}>
              Select a Model
            </Text>
            {provider === "openrouter" && (
              <View style={styles.filterButtonRow}>
                <Button
                  mode={showFilters ? "contained" : "outlined"}
                  onPress={() => setShowFilters(!showFilters)}
                  compact
                  icon={showFilters ? "filter-off" : "filter"}
                >
                  {showFilters ? "Hide Filters" : "Show Filters"}
                </Button>
                {hasActiveFilters && (
                  <Button
                    mode="text"
                    onPress={clearFilters}
                    compact
                    textColor={colors.error}
                  >
                    Clear
                  </Button>
                )}
              </View>
            )}
          </View>

          {/* Advanced Filters Panel */}
          {provider === "openrouter" && showFilters && (
            <View
              style={[
                styles.filtersPanel,
                { backgroundColor: colors.elevation.level2 },
              ]}
            >
              <ScrollView style={styles.filtersPanelScroll}>
                {/* Search Query */}
                <TextInput
                  mode="outlined"
                  label="Search models"
                  value={filters.searchQuery || ""}
                  onChangeText={(text) =>
                    setFilters({ ...filters, searchQuery: text })
                  }
                  placeholder="Search by name, ID, or description"
                  style={styles.filterInput}
                  dense
                />

                {/* Modality Filter */}
                {availableModalities.length > 0 && (
                  <View style={styles.filterSection}>
                    <Text variant="labelSmall" style={styles.filterLabel}>
                      Modality
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.chipScroll}
                    >
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          !filters.modality && styles.filterChipActive,
                        ]}
                        onPress={() =>
                          setFilters({
                            ...filters,
                            modality: undefined,
                          })
                        }
                      >
                        <Text
                          variant="bodySmall"
                          style={[
                            styles.filterChipText,
                            !filters.modality && styles.filterChipTextActive,
                          ]}
                        >
                          All
                        </Text>
                      </TouchableOpacity>
                      {availableModalities.map((modality) => (
                        <TouchableOpacity
                          key={modality}
                          style={[
                            styles.filterChip,
                            filters.modality === modality &&
                              styles.filterChipActive,
                          ]}
                          onPress={() => setFilters({ ...filters, modality })}
                        >
                          <Text
                            variant="bodySmall"
                            style={[
                              styles.filterChipText,
                              filters.modality === modality &&
                                styles.filterChipTextActive,
                            ]}
                          >
                            {modality}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Context Length Filter */}
                <View style={styles.filterSection}>
                  <Text variant="labelSmall" style={styles.filterLabel}>
                    Context Length
                  </Text>
                  <View style={styles.filterRow}>
                    <TextInput
                      mode="outlined"
                      label="Min"
                      value={filters.minContextLength?.toString() || ""}
                      onChangeText={(text) =>
                        setFilters({
                          ...filters,
                          minContextLength: text ? parseInt(text) : undefined,
                        })
                      }
                      keyboardType="numeric"
                      style={styles.filterInputHalf}
                      dense
                    />
                    <TextInput
                      mode="outlined"
                      label="Max"
                      value={filters.maxContextLength?.toString() || ""}
                      onChangeText={(text) =>
                        setFilters({
                          ...filters,
                          maxContextLength: text ? parseInt(text) : undefined,
                        })
                      }
                      keyboardType="numeric"
                      style={styles.filterInputHalf}
                      dense
                    />
                  </View>
                </View>

                {/* Pricing Filters */}
                <View style={styles.filterSection}>
                  <Text variant="labelSmall" style={styles.filterLabel}>
                    Max Pricing (per token)
                  </Text>
                  <View style={styles.filterRow}>
                    <TextInput
                      mode="outlined"
                      label="Prompt"
                      value={filters.maxPromptPrice?.toString() || ""}
                      onChangeText={(text) =>
                        setFilters({
                          ...filters,
                          maxPromptPrice: text ? parseFloat(text) : undefined,
                        })
                      }
                      keyboardType="decimal-pad"
                      style={styles.filterInputHalf}
                      dense
                    />
                    <TextInput
                      mode="outlined"
                      label="Completion"
                      value={filters.maxCompletionPrice?.toString() || ""}
                      onChangeText={(text) =>
                        setFilters({
                          ...filters,
                          maxCompletionPrice: text
                            ? parseFloat(text)
                            : undefined,
                        })
                      }
                      keyboardType="decimal-pad"
                      style={styles.filterInputHalf}
                      dense
                    />
                  </View>
                </View>

                {/* Instruct Type Filter */}
                {availableInstructTypes.length > 0 && (
                  <View style={styles.filterSection}>
                    <Text variant="labelSmall" style={styles.filterLabel}>
                      Instruct Type
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.chipScroll}
                    >
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          !filters.instructType && styles.filterChipActive,
                        ]}
                        onPress={() =>
                          setFilters({
                            ...filters,
                            instructType: undefined,
                          })
                        }
                      >
                        <Text
                          variant="bodySmall"
                          style={[
                            styles.filterChipText,
                            !filters.instructType &&
                              styles.filterChipTextActive,
                          ]}
                        >
                          All
                        </Text>
                      </TouchableOpacity>
                      {availableInstructTypes.map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.filterChip,
                            filters.instructType === type &&
                              styles.filterChipActive,
                          ]}
                          onPress={() =>
                            setFilters({
                              ...filters,
                              instructType: type,
                            })
                          }
                        >
                          <Text
                            variant="bodySmall"
                            style={[
                              styles.filterChipText,
                              filters.instructType === type &&
                                styles.filterChipTextActive,
                            ]}
                          >
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Moderation Filter */}
                <View style={styles.filterSection}>
                  <Text variant="labelSmall" style={styles.filterLabel}>
                    Moderation
                  </Text>
                  <View style={styles.filterRow}>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        filters.isModerated === undefined &&
                          styles.filterChipActive,
                      ]}
                      onPress={() =>
                        setFilters({
                          ...filters,
                          isModerated: undefined,
                        })
                      }
                    >
                      <Text
                        variant="bodySmall"
                        style={[
                          styles.filterChipText,
                          filters.isModerated === undefined &&
                            styles.filterChipTextActive,
                        ]}
                      >
                        All
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        filters.isModerated === true && styles.filterChipActive,
                      ]}
                      onPress={() =>
                        setFilters({ ...filters, isModerated: true })
                      }
                    >
                      <Text
                        variant="bodySmall"
                        style={[
                          styles.filterChipText,
                          filters.isModerated === true &&
                            styles.filterChipTextActive,
                        ]}
                      >
                        Moderated
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        filters.isModerated === false &&
                          styles.filterChipActive,
                      ]}
                      onPress={() =>
                        setFilters({ ...filters, isModerated: false })
                      }
                    >
                      <Text
                        variant="bodySmall"
                        style={[
                          styles.filterChipText,
                          filters.isModerated === false &&
                            styles.filterChipTextActive,
                        ]}
                      >
                        Unmoderated
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Button
                  mode="contained"
                  onPress={() => {
                    void refetchModels(filters);
                    setShowFilters(false);
                  }}
                  style={styles.applyFiltersButton}
                >
                  Apply Filters
                </Button>
              </ScrollView>
            </View>
          )}

          {fetchingModels ? (
            <View style={styles.modelListLoading}>
              <ActivityIndicator size="large" />
              <Text style={{ marginTop: 12 }}>Loading models...</Text>
            </View>
          ) : provider === "openrouter" &&
            (openRouterModels.free.length > 0 ||
              openRouterModels.paid.length > 0) ? (
            <View style={styles.modelListContainer}>
              <FlashList<ModelListItem>
                data={[
                  ...(openRouterModels.free.length > 0
                    ? [
                        {
                          type: "header" as const,
                          title: `🆓 Free Models (${openRouterModels.free.length})`,
                        },
                      ]
                    : []),
                  ...openRouterModels.free.map((model) => ({
                    type: "model" as const,
                    model,
                    isFree: true,
                  })),
                  ...(openRouterModels.paid.length > 0
                    ? [
                        {
                          type: "header" as const,
                          title: `💳 Paid Models (${openRouterModels.paid.length})`,
                        },
                      ]
                    : []),
                  ...openRouterModels.paid.map((model) => ({
                    type: "model" as const,
                    model,
                    isFree: false,
                  })),
                ]}
                renderItem={({ item }: { item: ModelListItem }) => {
                  if (item.type === "header") {
                    return (
                      <View style={styles.modelSectionHeader}>
                        <Text
                          variant="labelLarge"
                          style={styles.modelSectionTitle}
                        >
                          {item.title}
                        </Text>
                      </View>
                    );
                  }

                  const { model, isFree } = item;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.modelOption,
                        selectedModel === model.id &&
                          styles.modelOptionSelected,
                      ]}
                      onPress={() => handleModelSelect(model.id)}
                    >
                      <View style={styles.modelOptionContent}>
                        <Text
                          variant="bodyMedium"
                          style={[
                            styles.modelOptionText,
                            selectedModel === model.id &&
                              styles.modelOptionTextSelected,
                          ]}
                        >
                          {model.name}
                        </Text>
                        <Text variant="bodySmall" style={styles.modelOptionId}>
                          {model.id}
                        </Text>
                        <View style={styles.modelMetadata}>
                          <Text
                            variant="bodySmall"
                            style={styles.modelMetadataText}
                          >
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
                              • ${model.pricing.prompt}/$
                              {model.pricing.completion}
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                estimatedItemSize={80}
                getItemType={(item: ModelListItem) => item.type}
              />
            </View>
          ) : (
            <View style={styles.modelListContainer}>
              <FlashList<string>
                data={availableModels}
                keyExtractor={(item: string) => item}
                renderItem={({ item }: { item: string }) => (
                  <TouchableOpacity
                    style={[
                      styles.modelOption,
                      selectedModel === item && styles.modelOptionSelected,
                    ]}
                    onPress={() => handleModelSelect(item)}
                  >
                    <Text
                      variant="bodyMedium"
                      style={[
                        styles.modelOptionText,
                        selectedModel === item &&
                          styles.modelOptionTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
                estimatedItemSize={56}
              />
            </View>
          )}

          <View style={styles.modalFooter}>
            <Button
              mode="outlined"
              onPress={onDismiss}
              style={styles.modalCloseButton}
            >
              Close
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  modalTitle: {
    fontWeight: "600",
  },
  modelListContainer: {
    height: 400,
  },
  modelListLoading: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modelSectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0, 0, 0, 0.03)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  modelSectionTitle: {
    fontWeight: "600",
    color: "#333",
  },
  modelOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  modelOptionSelected: {
    backgroundColor: "rgba(33, 150, 243, 0.1)",
  },
  modelOptionText: {
    color: "#333",
  },
  modelOptionTextSelected: {
    fontWeight: "600",
    color: "#2196F3",
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.1)",
  },
  modalCloseButton: {
    marginTop: 8,
  },
  filterButtonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    alignItems: "center",
  },
  filtersPanel: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
    maxHeight: 300,
  },
  filtersPanelScroll: {
    padding: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    marginBottom: 8,
    fontWeight: "600",
    opacity: 0.7,
  },
  filterInput: {
    marginBottom: 8,
  },
  filterInputHalf: {
    flex: 1,
    marginHorizontal: 4,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  chipScroll: {
    flexDirection: "row",
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.2)",
    marginRight: 8,
    backgroundColor: "transparent",
  },
  filterChipActive: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  filterChipText: {
    color: "#333",
  },
  filterChipTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  applyFiltersButton: {
    marginTop: 8,
  },
  modelOptionContent: {
    flex: 1,
  },
  modelOptionId: {
    opacity: 0.6,
    marginTop: 2,
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
});
