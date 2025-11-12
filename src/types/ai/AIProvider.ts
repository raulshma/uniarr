/**
 * Supported AI providers
 */
export type AIProviderType = "google" | "openai" | "anthropic";

/**
 * Available models for each provider
 */
export const AI_PROVIDER_MODELS: Record<AIProviderType, string[]> = {
  google: [
    // Gemini 2.5 Models (Latest)
    "gemini-2.5-pro",
    "gemini-2.5-pro-preview-tts",
    "gemini-2.5-flash",
    "gemini-2.5-flash-preview-09-2025",
    "gemini-2.5-flash-image",
    "gemini-2.5-flash-image-preview",
    "gemini-2.5-flash-native-audio-preview-09-2025",
    "gemini-live-2.5-flash-preview",
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash-lite-preview-09-2025",
    // Gemini 2.0 Models
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash-preview-image-generation",
    "gemini-2.0-flash-live-001",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash-lite-001",
    // Gemini 1.5 Models (Legacy)
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-pro",
    "gemini-pro-vision",
  ],
  openai: ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "gpt-3.5-turbo-16k"],
  anthropic: [
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
  ],
};

/**
 * AI provider configuration
 */
export interface AIProviderConfig {
  type: AIProviderType;
  apiKey: string;
  modelName?: string;
  isDefault?: boolean;
}

/**
 * AI provider health check result
 */
export interface AIProviderHealthCheck {
  isHealthy: boolean;
  error?: string;
  responseTime?: number;
}

/**
 * AI provider information
 */
export interface AIProviderInfo {
  type: AIProviderType;
  name: string;
  description: string;
  website: string;
  maxTokensPerRequest: number;
  costPerMillion?: {
    input: number;
    output: number;
  };
}

/**
 * Provider information registry
 */
export const AI_PROVIDERS: Record<AIProviderType, AIProviderInfo> = {
  google: {
    type: "google",
    name: "Google Gemini",
    description: "Google's Gemini AI model",
    website: "https://ai.google.dev",
    maxTokensPerRequest: 128000,
    costPerMillion: {
      input: 0.075,
      output: 0.3,
    },
  },
  openai: {
    type: "openai",
    name: "OpenAI",
    description: "OpenAI's GPT models",
    website: "https://platform.openai.com",
    maxTokensPerRequest: 128000,
    costPerMillion: {
      input: 30,
      output: 60,
    },
  },
  anthropic: {
    type: "anthropic",
    name: "Anthropic Claude",
    description: "Anthropic's Claude models",
    website: "https://www.anthropic.com",
    maxTokensPerRequest: 200000,
    costPerMillion: {
      input: 3,
      output: 15,
    },
  },
};
