import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  Button,
  TextInput,
  SegmentedButtons,
  HelperText,
  Card,
  Text,
  ActivityIndicator,
} from "react-native-paper";
import { useTheme } from "@/hooks/useTheme";
import { AIKeyManager, AIKeyConfig } from "@/services/ai/core/AIKeyManager";
import { AIProviderManager } from "@/services/ai/core/AIProviderManager";
import {
  AIProviderType,
  AI_PROVIDERS,
  AI_PROVIDER_MODELS,
} from "@/types/ai/AIProvider";
import { alert } from "@/services/dialogService";
import {
  OpenRouterService,
  OpenRouterModel,
  ModelFilters,
} from "@/services/ai/providers/OpenRouterService";

interface AIKeyInputFormProps {
  onSuccess?: (config: AIKeyConfig) => void;
  onError?: (error: string) => void;
  isLoading?: boolean;
  showMultiKeyInfo?: boolean;
  onAddAnother?: () => void;
}

type ModelListItem =
  | { type: "header"; title: string }
  | { type: "model"; model: OpenRouterModel; isFree: boolean };

/**
 * Component for adding or updating AI API keys
 * Handles validation and secure storage
 */
export function AIKeyInputForm({
  onSuccess,
  onError,
  isLoading: parentLoading = false,
  showMultiKeyInfo = true,
  onAddAnother,
}: AIKeyInputFormProps) {
  const { colors } = useTheme();
  const [provider, setProvider] = useState<AIProviderType>("google");
  const [modelName, setModelName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelMenuVisible, setModelMenuVisible] = useState(false);
  const [validationStatus, setValidationStatus] = useState<
    "idle" | "validating" | "valid" | "invalid"
  >("idle");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastAddedProvider, setLastAddedProvider] =
    useState<AIProviderType | null>(null);
  const [openRouterModels, setOpenRouterModels] = useState<{
    free: OpenRouterModel[];
    paid: OpenRouterModel[];
  }>({ free: [], paid: [] });
  const [fetchingModels, setFetchingModels] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ModelFilters>({});
  const [availableModalities, setAvailableModalities] = useState<string[]>([]);
  const [availableInstructTypes, setAvailableInstructTypes] = useState<
    string[]
  >([]);

  const keyManager = AIKeyManager.getInstance();
  const providerManager = AIProviderManager.getInstance();
  const openRouterService = OpenRouterService.getInstance();

  const providerInfo = AI_PROVIDERS[provider];

  // Fetch OpenRouter models when provider is selected or API key changes
  const fetchOpenRouterModels = useCallback(async () => {
    if (provider !== "openrouter") {
      return;
    }

    setFetchingModels(true);
    try {
      const grouped = await openRouterService.getFilteredGroupedModels(
        filters,
        apiKey.trim() || undefined,
      );
      setOpenRouterModels(grouped);

      // Fetch all models to get available filter options
      const allModels = await openRouterService.fetchModels(
        apiKey.trim() || undefined,
      );
      setAvailableModalities(
        openRouterService.getAvailableModalities(allModels),
      );
      setAvailableInstructTypes(
        openRouterService.getAvailableInstructTypes(allModels),
      );
    } catch {
      // If fetch fails, use default models (all as paid)
      setOpenRouterModels({
        free: [],
        paid: AI_PROVIDER_MODELS.openrouter.map((id) => ({
          id,
          name: id,
          context_length: 0,
          pricing: { prompt: "0", completion: "0" },
        })),
      });
    } finally {
      setFetchingModels(false);
    }
  }, [provider, apiKey, filters, openRouterService]);

  // Fetch models when provider changes to OpenRouter
  React.useEffect(() => {
    if (provider === "openrouter") {
      void fetchOpenRouterModels();
    }
  }, [provider, fetchOpenRouterModels]);

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

  const handleValidate = useCallback(async () => {
    if (!apiKey.trim()) {
      setError("API key cannot be empty");
      setValidationStatus("invalid");
      return false;
    }

    setValidationStatus("validating");
    setError(null);

    try {
      // Check health with provider manager
      const tempConfig: AIKeyConfig = {
        provider,
        apiKey,
        createdAt: Date.now(),
      };

      await providerManager.registerProvider(tempConfig);
      const health = await providerManager.healthCheck(provider);

      if (!health.isHealthy) {
        setError(
          `Provider validation failed: ${health.error || "Unknown error"}`,
        );
        setValidationStatus("invalid");
        return false;
      }

      setValidationStatus("valid");
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Validation failed: ${errorMsg}`);
      setValidationStatus("invalid");
      return false;
    }
  }, [apiKey, provider, providerManager]);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate model selection
      if (!modelName.trim()) {
        setError("Please select a model");
        setIsLoading(false);
        return;
      }

      // Validate first
      const isValid = await handleValidate();
      if (!isValid) {
        setIsLoading(false);
        return;
      }

      const config: AIKeyConfig = {
        provider,
        apiKey,
        modelName,
        isDefault: false, // Always store as false initially
        createdAt: Date.now(),
      };

      await keyManager.storeKey(config);

      // If user selected this as default, set it as default for the provider
      if (isDefault) {
        // Get the keyId that was just created
        const allKeys = await keyManager.listKeysForProvider(provider);
        const newKey = allKeys.find(
          (k) => k.createdAt === config.createdAt && k.provider === provider,
        );
        if (newKey) {
          await keyManager.setKeyAsDefault(newKey.keyId);
        }
      }

      // Register with provider manager
      await providerManager.registerProvider(config);

      setLastAddedProvider(provider);
      setSuccessMessage(
        `${AI_PROVIDERS[provider].name} API key has been saved successfully`,
      );
      setApiKey("");
      setModelName("");
      setIsDefault(false);
      setValidationStatus("idle");
      setError(null);

      alert(
        "Success",
        `${AI_PROVIDERS[provider].name} API key has been saved successfully`,
      );
      onSuccess?.(config);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Failed to save: ${errorMsg}`);
      alert("Error", `Failed to save: ${errorMsg}`);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = parentLoading || isLoading || !apiKey.trim();

  return (
    <View style={styles.container}>
      <Card style={[styles.card, { backgroundColor: colors.elevation.level1 }]}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.title}>
            Add AI Provider Key
          </Text>

          {/* Multi-key info */}
          {showMultiKeyInfo && (
            <View
              style={[
                styles.infoBox,
                { backgroundColor: "rgba(33, 150, 243, 0.1)" },
              ]}
            >
              <Text variant="bodySmall">
                💡 <Text style={{ fontWeight: "600" }}>Multiple keys:</Text> You
                can add multiple API keys for the same provider. If one key hits
                the rate limit (429), the system will automatically rotate to
                the next available key.
              </Text>
            </View>
          )}

          {/* Provider Selection */}
          <View style={styles.section}>
            <Text variant="labelMedium" style={styles.label}>
              AI Provider
            </Text>
            <SegmentedButtons
              value={provider}
              onValueChange={(value) => {
                setProvider(value as AIProviderType);
                setValidationStatus("idle");
                setError(null);
                setModelName(""); // Clear model when switching providers
              }}
              buttons={[
                { value: "google", label: "Gemini" },
                { value: "openai", label: "OpenAI" },
                { value: "anthropic", label: "Claude" },
                { value: "openrouter", label: "OpenRouter" },
              ]}
              style={styles.segmented}
            />
          </View>

          {/* Provider Info */}
          {providerInfo && (
            <View style={styles.infoBox}>
              <Text variant="bodySmall">
                <Text style={{ fontWeight: "600" }}>Name:</Text>{" "}
                {providerInfo.name}
              </Text>
              <Text variant="bodySmall">
                <Text style={{ fontWeight: "600" }}>Website:</Text>{" "}
                {providerInfo.website}
              </Text>
              <Text variant="bodySmall">
                <Text style={{ fontWeight: "600" }}>Max tokens:</Text>{" "}
                {providerInfo.maxTokensPerRequest}
              </Text>
            </View>
          )}

          {/* API Key Input */}
          <View style={styles.section}>
            <Text variant="labelMedium" style={styles.label}>
              API Key
            </Text>
            <TextInput
              mode="outlined"
              label="Enter your API key"
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showApiKey}
              right={
                <TextInput.Icon
                  icon={showApiKey ? "eye-off" : "eye"}
                  onPress={() => setShowApiKey(!showApiKey)}
                />
              }
              placeholder={`Enter ${provider} API key`}
              style={styles.input}
              editable={!isLoading && !parentLoading}
            />
            <HelperText type="info" visible={true}>
              Your API key is stored securely and never shared
            </HelperText>
          </View>

          {/* Model Selection */}
          <View style={styles.section}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text variant="labelMedium" style={styles.label}>
                Model Name
              </Text>
              {provider === "openrouter" && (
                <Button
                  mode="text"
                  onPress={fetchOpenRouterModels}
                  loading={fetchingModels}
                  disabled={isLoading || parentLoading || fetchingModels}
                  compact
                >
                  Refresh Models
                </Button>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.modelSelectButton,
                { borderColor: colors.outline },
              ]}
              onPress={() => setModelMenuVisible(true)}
              disabled={isLoading || parentLoading || fetchingModels}
            >
              <Text
                style={[
                  styles.modelSelectText,
                  !modelName && styles.modelSelectPlaceholder,
                ]}
              >
                {fetchingModels
                  ? "Loading models..."
                  : modelName ||
                    `Select a model (e.g., ${availableModels[0] || "model-name"})`}
              </Text>
            </TouchableOpacity>

            <Modal
              visible={modelMenuVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setModelMenuVisible(false)}
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
                            <Text
                              variant="labelSmall"
                              style={styles.filterLabel}
                            >
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
                                    !filters.modality &&
                                      styles.filterChipTextActive,
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
                                  onPress={() =>
                                    setFilters({ ...filters, modality })
                                  }
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
                                  minContextLength: text
                                    ? parseInt(text)
                                    : undefined,
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
                                  maxContextLength: text
                                    ? parseInt(text)
                                    : undefined,
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
                                  maxPromptPrice: text
                                    ? parseFloat(text)
                                    : undefined,
                                })
                              }
                              keyboardType="decimal-pad"
                              style={styles.filterInputHalf}
                              dense
                            />
                            <TextInput
                              mode="outlined"
                              label="Completion"
                              value={
                                filters.maxCompletionPrice?.toString() || ""
                              }
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
                            <Text
                              variant="labelSmall"
                              style={styles.filterLabel}
                            >
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
                                  !filters.instructType &&
                                    styles.filterChipActive,
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
                                filters.isModerated === true &&
                                  styles.filterChipActive,
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
                            void fetchOpenRouterModels();
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
                                modelName === model.id &&
                                  styles.modelOptionSelected,
                              ]}
                              onPress={() => {
                                setModelName(model.id);
                                setModelMenuVisible(false);
                              }}
                            >
                              <View style={styles.modelOptionContent}>
                                <Text
                                  variant="bodyMedium"
                                  style={[
                                    styles.modelOptionText,
                                    modelName === model.id &&
                                      styles.modelOptionTextSelected,
                                  ]}
                                >
                                  {model.name}
                                </Text>
                                <Text
                                  variant="bodySmall"
                                  style={styles.modelOptionId}
                                >
                                  {model.id}
                                </Text>
                                <View style={styles.modelMetadata}>
                                  <Text
                                    variant="bodySmall"
                                    style={styles.modelMetadataText}
                                  >
                                    {model.context_length.toLocaleString()}{" "}
                                    tokens
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
                              modelName === item && styles.modelOptionSelected,
                            ]}
                            onPress={() => {
                              setModelName(item);
                              setModelMenuVisible(false);
                            }}
                          >
                            <Text
                              variant="bodyMedium"
                              style={[
                                styles.modelOptionText,
                                modelName === item &&
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
                      onPress={() => setModelMenuVisible(false)}
                      style={styles.modalCloseButton}
                    >
                      Close
                    </Button>
                  </View>
                </View>
              </View>
            </Modal>

            <HelperText type="info" visible={true}>
              Select a model from the list or enter custom name below
            </HelperText>

            <TextInput
              mode="outlined"
              label="Or enter custom model name"
              value={modelName}
              onChangeText={setModelName}
              placeholder="e.g., my-custom-model"
              style={[styles.input, styles.customModelInput]}
              editable={!isLoading && !parentLoading}
            />
          </View>

          {/* Validation Status */}
          {validationStatus !== "idle" && (
            <View style={styles.validationStatus}>
              {validationStatus === "validating" && (
                <View style={styles.validatingBox}>
                  <ActivityIndicator size="small" />
                  <Text style={styles.validatingText}>Validating...</Text>
                </View>
              )}
              {validationStatus === "valid" && (
                <HelperText
                  type="info"
                  visible={true}
                  style={{ color: "#4CAF50" }}
                >
                  ✓ API key is valid
                </HelperText>
              )}
              {validationStatus === "invalid" && error && (
                <HelperText type="error" visible={true}>
                  {error}
                </HelperText>
              )}
            </View>
          )}

          {error && validationStatus === "idle" && (
            <HelperText type="error" visible={true}>
              {error}
            </HelperText>
          )}

          {/* Default Provider Checkbox */}
          <View style={styles.checkboxRow}>
            <Button
              mode={isDefault ? "contained" : "outlined"}
              onPress={() => setIsDefault(!isDefault)}
              style={styles.checkbox}
            >
              {isDefault ? "Default" : "Set as Default"}
            </Button>
            <Text
              variant="bodySmall"
              style={{ marginTop: 8, marginLeft: 4, opacity: 0.6 }}
            >
              (Only the default key is used; additional keys are for rotation)
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonGroup}>
            <Button
              mode="contained"
              onPress={handleSave}
              loading={isLoading}
              disabled={isDisabled}
              style={styles.button}
            >
              Save Key
            </Button>
            <Button
              mode="outlined"
              onPress={() => {
                setApiKey("");
                setModelName("");
                setIsDefault(false);
                setValidationStatus("idle");
                setError(null);
                setSuccessMessage(null);
                setLastAddedProvider(null);
              }}
              disabled={isLoading || parentLoading}
              style={styles.button}
            >
              Clear
            </Button>
          </View>

          {/* Success state with "Add Another Key" option */}
          {successMessage && lastAddedProvider && (
            <View style={styles.successSection}>
              <View
                style={[
                  styles.successBox,
                  { backgroundColor: "rgba(76, 175, 80, 0.1)" },
                ]}
              >
                <Text
                  variant="bodySmall"
                  style={{ color: "#4CAF50", fontWeight: "600" }}
                >
                  ✓ {successMessage}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: "#4CAF50", marginTop: 8, opacity: 0.8 }}
                >
                  You can add more keys for this or other providers. Additional
                  keys provide automatic fallback when a key hits rate limits.
                </Text>
              </View>

              <View style={styles.successButtonGroup}>
                <Button
                  mode="contained"
                  onPress={() => {
                    setSuccessMessage(null);
                    setLastAddedProvider(null);
                    onAddAnother?.();
                  }}
                  style={styles.button}
                >
                  Add Another Key
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setSuccessMessage(null);
                    setLastAddedProvider(null);
                  }}
                  style={styles.button}
                >
                  Done
                </Button>
              </View>
            </View>
          )}
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
  },
  title: {
    marginBottom: 16,
    fontWeight: "600",
  },
  section: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
  },
  segmented: {
    marginBottom: 8,
  },
  input: {
    marginBottom: 4,
  },
  customModelInput: {
    marginTop: 12,
  },
  modelInputContainer: {
    position: "relative",
  },
  modelSelectButton: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
    justifyContent: "center",
    minHeight: 56,
  },
  modelSelectText: {
    fontSize: 16,
    color: "#000",
  },
  modelSelectPlaceholder: {
    opacity: 0.6,
    color: "#666",
  },
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
  modelList: {
    maxHeight: 400,
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
  infoBox: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 4,
  },
  validationStatus: {
    marginBottom: 16,
  },
  validatingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  validatingText: {
    fontSize: 14,
  },
  checkboxRow: {
    marginBottom: 16,
  },
  checkbox: {
    alignSelf: "flex-start",
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
  },
  successSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.1)",
  },
  successBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#4CAF50",
  },
  successButtonGroup: {
    flexDirection: "row",
    gap: 12,
  },
});
