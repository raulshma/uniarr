import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { logger } from "@/services/logger/LoggerService";
import { storageAdapter } from "@/services/storage/StorageAdapter";
import type { AIProviderType } from "@/types/ai/AIProvider";

const STORE_KEY = "conversational-ai-config-store";

/**
 * Configuration specific to conversational AI model selection.
 * This is separate from other features (like AI Search or AI Recommendations)
 * to allow users to select a preferred provider/model just for chat.
 */
export interface ConversationalAIConfigState {
  // The provider and model selected for conversational AI
  selectedProvider: AIProviderType | null;
  selectedModel: string | null;
  selectedKeyId: string | null; // Reference to the API key being used

  // Actions to update configuration
  setSelectedProvider: (provider: AIProviderType | null) => void;
  setSelectedModel: (model: string | null) => void;
  setSelectedKeyId: (keyId: string | null) => void;

  // Convenience action to set provider, model, and key all at once
  setConversationalAIConfig: (
    provider: AIProviderType | null,
    model: string | null,
    keyId: string | null,
  ) => void;

  // Get current configuration as object
  getConfig: () => {
    provider: AIProviderType | null;
    model: string | null;
    keyId: string | null;
  };

  // Clear configuration
  clearConfig: () => void;

  // Check if a valid configuration is selected
  hasValidConfig: () => boolean;
}

const defaultConfig = {
  selectedProvider: null as AIProviderType | null,
  selectedModel: null as string | null,
  selectedKeyId: null as string | null,
};

export const useConversationalAIConfigStore =
  create<ConversationalAIConfigState>()(
    persist(
      (set, get) => ({
        ...defaultConfig,

        setSelectedProvider: (provider) => {
          set({ selectedProvider: provider });
          logger.debug(
            `[ConversationalAIConfig] Provider set to: ${provider || "null"}`,
          );
        },

        setSelectedModel: (model) => {
          set({ selectedModel: model });
          logger.debug(
            `[ConversationalAIConfig] Model set to: ${model || "null"}`,
          );
        },

        setSelectedKeyId: (keyId) => {
          set({ selectedKeyId: keyId });
          logger.debug(
            `[ConversationalAIConfig] Key ID set to: ${keyId || "null"}`,
          );
        },

        setConversationalAIConfig: (provider, model, keyId) => {
          set({
            selectedProvider: provider,
            selectedModel: model,
            selectedKeyId: keyId,
          });
          logger.debug(
            `[ConversationalAIConfig] Config updated - Provider: ${provider}, Model: ${model}, KeyId: ${keyId}`,
          );
        },

        getConfig: () => {
          const state = get();
          return {
            provider: state.selectedProvider,
            model: state.selectedModel,
            keyId: state.selectedKeyId,
          };
        },

        clearConfig: () => {
          set({
            selectedProvider: null,
            selectedModel: null,
            selectedKeyId: null,
          });
          logger.debug("[ConversationalAIConfig] Configuration cleared");
        },

        hasValidConfig: () => {
          const state = get();
          return (
            state.selectedProvider !== null &&
            state.selectedModel !== null &&
            state.selectedKeyId !== null
          );
        },
      }),
      {
        name: STORE_KEY,
        storage: createJSONStorage(() => storageAdapter),
        partialize: (state) => ({
          selectedProvider: state.selectedProvider,
          selectedModel: state.selectedModel,
          selectedKeyId: state.selectedKeyId,
        }),
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            logger.error(`[ConversationalAIConfig] Failed to rehydrate store`, {
              error,
            });
          } else if (state) {
            logger.debug(`[ConversationalAIConfig] Store rehydrated`, {
              provider: state.selectedProvider,
              model: state.selectedModel,
              keyId: state.selectedKeyId,
            });
          }
        },
      },
    ),
  );

/**
 * Selector hooks to prevent unnecessary re-renders
 * Follow the pattern from conversationalAISelectors.ts
 */
export const selectConversationalAIProvider = (
  state: ConversationalAIConfigState,
) => state.selectedProvider;
export const selectConversationalAIModel = (
  state: ConversationalAIConfigState,
) => state.selectedModel;
export const selectConversationalAIKeyId = (
  state: ConversationalAIConfigState,
) => state.selectedKeyId;
export const selectConversationalAIConfig = (
  state: ConversationalAIConfigState,
) => state.getConfig();
export const selectConversationalAIHasValidConfig = (
  state: ConversationalAIConfigState,
) => state.hasValidConfig();
