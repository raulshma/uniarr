import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
} from "react-native";
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

interface AIKeyInputFormProps {
  onSuccess?: (config: AIKeyConfig) => void;
  onError?: (error: string) => void;
  isLoading?: boolean;
}

/**
 * Component for adding or updating AI API keys
 * Handles validation and secure storage
 */
export function AIKeyInputForm({
  onSuccess,
  onError,
  isLoading: parentLoading = false,
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

  const keyManager = AIKeyManager.getInstance();
  const providerManager = AIProviderManager.getInstance();

  const providerInfo = AI_PROVIDERS[provider];

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
        isDefault,
        createdAt: Date.now(),
      };

      await keyManager.storeKey(config);

      // Register with provider manager
      await providerManager.registerProvider(config);

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
              }}
              buttons={[
                { value: "google", label: "Google Gemini" },
                { value: "openai", label: "OpenAI" },
                { value: "anthropic", label: "Anthropic" },
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
            <Text variant="labelMedium" style={styles.label}>
              Model Name
            </Text>
            <TouchableOpacity
              style={[
                styles.modelSelectButton,
                { borderColor: colors.outline },
              ]}
              onPress={() => setModelMenuVisible(true)}
              disabled={isLoading || parentLoading}
            >
              <Text
                style={[
                  styles.modelSelectText,
                  !modelName && styles.modelSelectPlaceholder,
                ]}
              >
                {modelName ||
                  `Select a model (e.g., ${AI_PROVIDER_MODELS[provider][0]})`}
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
                  </View>

                  <FlatList
                    data={AI_PROVIDER_MODELS[provider]}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
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
                    scrollEnabled={true}
                    style={styles.modelList}
                  />

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
              }}
              disabled={isLoading || parentLoading}
              style={styles.button}
            >
              Clear
            </Button>
          </View>
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
});
