import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Directory } from "expo-file-system";
import * as FileSystemLegacy from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as Crypto from "expo-crypto";

import { logger } from "@/services/logger/LoggerService";
import { base64Encode, base64Decode } from "@/utils/base64";
import { secureStorage } from "@/services/storage/SecureStorage";
import { useSettingsStore } from "@/store/settingsStore";
import { type ServiceConfig, type ServiceType } from "@/models/service.types";
import {
  getStoredTmdbKey,
  setStoredTmdbKey,
} from "@/services/tmdb/TmdbCredentialService";
import type { AssistantConfig } from "@/models/chat.types";
import { useConversationalAIStore } from "@/store/conversationalAIStore";
import { useConversationalAIConfigStore } from "@/store/conversationalAIConfigStore";
import type {
  FilterMetadata,
  LibraryFilters,
} from "@/store/libraryFilterStore";

type LibraryFiltersBackupPayload = Record<
  string,
  {
    filters: LibraryFilters;
    metadata?: FilterMetadata;
  }
>;

export interface BackupExportOptions {
  includeSettings: boolean;
  includeServiceConfigs: boolean;
  includeServiceCredentials: boolean;
  includeTmdbCredentials: boolean;
  includeNetworkHistory: boolean;
  includeRecentIPs: boolean;
  includeDownloadConfig: boolean;
  includeServicesViewState: boolean;
  includeLibraryFilters: boolean;
  includeWidgetsConfig: boolean;
  includeWidgetConfigCredentials: boolean;
  includeWidgetSecureCredentials: boolean;
  includeWidgetProfiles: boolean;
  includeWidgetProfileCredentials: boolean;
  includeVoiceAssistantConfig: boolean;
  includeBookmarkHealthChecks: boolean;
  includeByokConfig: boolean;
  includeAiConfig: boolean;
  includeApiLoggingConfig: boolean;
  includeConversationalAISettings: boolean;
  includeConversationalAIProviderConfig: boolean;
  encryptSensitive: boolean;
  password?: string;
}

export interface BackupSelectionConfig {
  settings: {
    enabled: boolean;
    sensitive: boolean;
  };
  serviceConfigs: {
    enabled: boolean;
    sensitive: boolean;
    includeCredentials: boolean;
  };
  tmdbCredentials: {
    enabled: boolean;
    sensitive: boolean;
  };
  networkHistory: {
    enabled: boolean;
    sensitive: boolean;
  };
  recentIPs: {
    enabled: boolean;
    sensitive: boolean;
  };
  downloadConfig: {
    enabled: boolean;
    sensitive: boolean;
  };
  servicesViewState: {
    enabled: boolean;
    sensitive: boolean;
  };
  libraryFilters: {
    enabled: boolean;
    sensitive: boolean;
  };
  voiceAssistantConfig: {
    enabled: boolean;
    sensitive: boolean;
  };
  bookmarkHealthChecks: {
    enabled: boolean;
    sensitive: boolean;
  };
  widgetsConfig: {
    enabled: boolean;
    sensitive: boolean;
    includeCredentials: boolean;
  };
  widgetProfiles: {
    enabled: boolean;
    sensitive: boolean;
    includeCredentials: boolean;
  };
  byokConfig: {
    enabled: boolean;
    sensitive: boolean;
  };
  aiConfig: {
    enabled: boolean;
    sensitive: boolean;
  };
  apiLoggingConfig: {
    enabled: boolean;
    sensitive: boolean;
  };
  conversationalAISettings: {
    enabled: boolean;
    sensitive: boolean;
  };
  conversationalAIProviderConfig: {
    enabled: boolean;
    sensitive: boolean;
  };
}

export interface EncryptedBackupData {
  version: "1.2";
  timestamp: string;
  encrypted: true;
  encryptionInfo: {
    algorithm: "XOR-PBKDF2";
    salt: string;
    iv: string;
  };
  appData: {
    settings?: Record<string, unknown>;
    serviceConfigs?: {
      id: string;
      type: ServiceType;
      name: string;
      url: string;
      apiKey?: string;
      username?: string;
      password?: string;
      proxyUrl?: string;
      timeout?: number;
      enabled: boolean;
      createdAt: string;
      updatedAt: string;
    }[];
    encryptedData?: string; // Contains sensitive data (credentials, API keys, etc.)
    networkScanHistory?: {
      id: string;
      timestamp: string;
      duration: number;
      scannedHosts: number;
      servicesFound: number;
      subnet: string;
      customIp?: string;
      services: {
        type: string;
        name: string;
        url: string;
        port: number;
        version?: string;
        requiresAuth?: boolean;
      }[];
    }[];
    recentIPs?: {
      ip: string;
      timestamp: string;
      subnet?: string;
      servicesFound?: number;
    }[];
    tmdbCredentials?: {
      apiKey?: string;
    };
    downloadConfig?: {
      maxConcurrentDownloads: number;
      allowMobileData: boolean;
      allowBackgroundDownloads: boolean;
      defaultDownloadDirectory: string;
      maxStorageUsage: number;
    };
    servicesViewState?: {
      viewMode: "grid" | "list";
      sortKey: "name" | "status" | "type";
      sortDirection: "asc" | "desc";
    };
    libraryFilters?: LibraryFiltersBackupPayload;
    voiceAssistantConfig?: any;
    bookmarkHealthChecks?: Record<string, any>[];
    widgetsConfig?: any[];
    widgetsCredentials?: Record<string, any>;
    widgetSecureCredentials?: Record<string, any>;
    widgetProfiles?: any[];
    byokConfig?: {
      byokGeocodeMapsCoApiKey?: string;
    };
    aiConfig?: {
      enableAISearch: boolean;
      enableAIRecommendations: boolean;
    };
    apiLoggingConfig?: {
      apiLoggerEnabled: boolean;
      apiLoggerActivePreset: string;
      apiLoggerCustomCodes: (number | string)[];
      apiLoggerRetentionDays: number;
      apiLoggerCaptureRequestBody: boolean;
      apiLoggerCaptureResponseBody: boolean;
      apiLoggerCaptureRequestHeaders: boolean;
      apiLoggerAiLoggingEnabled: boolean;
      apiLoggerAiCapturePrompt: boolean;
      apiLoggerAiCaptureResponse: boolean;
      apiLoggerAiCaptureMetadata: boolean;
      apiLoggerAiRetentionDays: number;
    };
    conversationalAISettings?: {
      config: AssistantConfig;
    };
    conversationalAIProviderConfig?: {
      selectedProvider: any;
      selectedModel: string | null;
      selectedKeyId: string | null;
      selectedTitleProvider: any;
      selectedTitleModel: string | null;
      selectedTitleKeyId: string | null;
    };
  };
}

export interface BackupData {
  version: "1.1" | "1.2";
  timestamp: string;
  encrypted?: boolean;
  encryptionInfo?: {
    algorithm: "XOR-PBKDF2";
    salt: string;
    iv: string;
  };
  appData: {
    settings?: Record<string, unknown>;
    serviceConfigs?: {
      id: string;
      type: ServiceType;
      name: string;
      url: string;
      apiKey?: string;
      username?: string;
      password?: string;
      proxyUrl?: string;
      timeout?: number;
      enabled: boolean;
      createdAt: string;
      updatedAt: string;
    }[];
    encryptedData?: string; // For encrypted sensitive data
    networkScanHistory?: {
      id: string;
      timestamp: string;
      duration: number;
      scannedHosts: number;
      servicesFound: number;
      subnet: string;
      customIp?: string;
      services: {
        type: string;
        name: string;
        url: string;
        port: number;
        version?: string;
        requiresAuth?: boolean;
      }[];
    }[];
    recentIPs?: {
      ip: string;
      timestamp: string;
      subnet?: string;
      servicesFound?: number;
    }[];
    tmdbCredentials?: {
      apiKey?: string;
    };
    downloadConfig?: {
      maxConcurrentDownloads: number;
      allowMobileData: boolean;
      allowBackgroundDownloads: boolean;
      defaultDownloadDirectory: string;
      maxStorageUsage: number;
    };
    servicesViewState?: {
      viewMode: "grid" | "list";
      sortKey: "name" | "status" | "type";
      sortDirection: "asc" | "desc";
    };
    libraryFilters?: LibraryFiltersBackupPayload;
    voiceAssistantConfig?: any;
    bookmarkHealthChecks?: Record<string, any>[];
    widgetsConfig?: any[];
    widgetsCredentials?: Record<string, any>;
    widgetSecureCredentials?: Record<string, any>;
    widgetProfiles?: any[];
    byokConfig?: {
      byokGeocodeMapsCoApiKey?: string;
    };
    aiConfig?: {
      enableAISearch: boolean;
      enableAIRecommendations: boolean;
    };
    apiLoggingConfig?: {
      apiLoggerEnabled: boolean;
      apiLoggerActivePreset: string;
      apiLoggerCustomCodes: (number | string)[];
      apiLoggerRetentionDays: number;
      apiLoggerCaptureRequestBody: boolean;
      apiLoggerCaptureResponseBody: boolean;
      apiLoggerCaptureRequestHeaders: boolean;
      apiLoggerAiLoggingEnabled: boolean;
      apiLoggerAiCapturePrompt: boolean;
      apiLoggerAiCaptureResponse: boolean;
      apiLoggerAiCaptureMetadata: boolean;
      apiLoggerAiRetentionDays: number;
    };
    conversationalAISettings?: {
      config: AssistantConfig;
    };
    conversationalAIProviderConfig?: {
      selectedProvider: any;
      selectedModel: string | null;
      selectedKeyId: string | null;
      selectedTitleProvider: any;
      selectedTitleModel: string | null;
      selectedTitleKeyId: string | null;
    };
  };
}

export type AnyBackupData = BackupData | EncryptedBackupData;

class BackupRestoreService {
  private static instance: BackupRestoreService | null = null;

  static getInstance(): BackupRestoreService {
    if (!BackupRestoreService.instance) {
      BackupRestoreService.instance = new BackupRestoreService();
    }
    return BackupRestoreService.instance;
  }

  /**
   * Generate secure random hex string
   */
  private async generateSecureRandomHex(length: number): Promise<string> {
    try {
      const randomBytes = await Crypto.getRandomBytesAsync(length);
      return Array.from(randomBytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      // Fallback to a simpler random generator
      const chars = "0123456789abcdef";
      let result = "";
      for (let i = 0; i < length * 2; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }
  }

  /**
   * Derive encryption key from password and salt using simple hash
   */
  private deriveKey(password: string, salt: string): string {
    // Simple key derivation using multiple rounds of hashing
    let key = password + salt;
    for (let i = 0; i < 10000; i++) {
      key = this.simpleHash(key + i.toString());
    }
    return key;
  }

  /**
   * Simple hash function for key derivation
   * Returns a fixed-length hex string (8 chars) to ensure consistent key derivation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Pad to 8 characters to ensure consistent length
    return Math.abs(hash).toString(16).padStart(8, "0");
  }

  /**
   * React Native compatible base64 encoding
   */
  private base64Encode(str: string): string {
    return base64Encode(str);
  }

  /**
   * React Native compatible base64 decoding
   */
  private base64Decode(str: string): string {
    return base64Decode(str);
  }

  /**
   * Simple XOR encryption for React Native compatibility
   */
  private xorEncrypt(text: string, key: string): string {
    let result = "";
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode ^ keyChar);
    }
    return this.base64Encode(result); // Base64 encode for safe JSON storage
  }

  /**
   * Simple XOR decryption
   */
  private xorDecrypt(encryptedText: string, key: string): string {
    const text = this.base64Decode(encryptedText); // Base64 decode
    let result = "";
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode ^ keyChar);
    }
    return result;
  }

  /**
   * Encrypt sensitive data using simple XOR encryption with password
   */
  private async encryptSensitiveData(
    data: any,
    password: string,
  ): Promise<{
    encryptedData: string;
    salt: string;
    iv: string;
  }> {
    try {
      // Generate salt using secure random values
      const salt = await this.generateSecureRandomHex(32);
      const iv = await this.generateSecureRandomHex(16); // IV for future AES compatibility

      // Derive encryption key
      const key = this.deriveKey(password, salt);

      // Encrypt the data
      const jsonString = JSON.stringify(data);
      const encryptedData = this.xorEncrypt(jsonString, key);

      return {
        encryptedData,
        salt,
        iv,
      };
    } catch (error) {
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Decrypt sensitive data using password
   */
  async decryptSensitiveData(
    encryptedData: string,
    password: string,
    salt: string,
    iv: string,
  ): Promise<any> {
    try {
      await logger.info("Starting sensitive data decryption", {
        location: "BackupRestoreService.decryptSensitiveData",
        encryptedDataLength: encryptedData.length,
        saltLength: salt.length,
        ivLength: iv.length,
      });

      // Derive the same key used for encryption
      const key = this.deriveKey(password, salt);

      // Decrypt the data
      let decryptedText = this.xorDecrypt(encryptedData, key);

      if (!decryptedText) {
        throw new Error(
          "Decryption produced empty result - possibly wrong password",
        );
      }

      await logger.info("Data decrypted successfully, parsing JSON", {
        location: "BackupRestoreService.decryptSensitiveData",
        decryptedTextLength: decryptedText.length,
        decryptedTextPreview: decryptedText.substring(0, 50),
      });

      try {
        // Clean the decrypted text before parsing
        let cleanedText = decryptedText.trim();

        // Remove potential BOM or other invisible characters
        cleanedText = cleanedText.replace(/^\uFEFF/, ""); // Remove BOM
        // Only remove truly invalid control characters (not tabs, newlines in JSON strings)
        cleanedText = cleanedText.replace(
          /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g,
          "",
        );

        // Log character codes for debugging
        const charCodes = cleanedText
          .substring(0, 10)
          .split("")
          .map((c) => c.charCodeAt(0));
        await logger.info("JSON parsing attempt", {
          location: "BackupRestoreService.decryptSensitiveData",
          first10Chars: cleanedText.substring(0, 10),
          charCodes: charCodes,
          textLength: cleanedText.length,
        });

        // Check if it looks like valid JSON before parsing
        if (!cleanedText.startsWith("{") && !cleanedText.startsWith("[")) {
          throw new Error(
            `Invalid JSON structure - decrypted data doesn't start with { or [ (starts with "${cleanedText.substring(0, 1)}", code: ${cleanedText.charCodeAt(0)}). This likely indicates an incorrect password or corrupted backup.`,
          );
        }

        const parsed = JSON.parse(cleanedText);
        await logger.info("JSON parsed successfully", {
          location: "BackupRestoreService.decryptSensitiveData",
          parsedKeys: Object.keys(parsed),
        });
        return parsed;
      } catch (parseError) {
        await logger.error("JSON parse failed during decryption", {
          location: "BackupRestoreService.decryptSensitiveData",
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
          decryptedTextFirstChars: decryptedText.substring(0, 20),
          textLength: decryptedText.length,
          charCodes: decryptedText
            .substring(0, 10)
            .split("")
            .map((c) => c.charCodeAt(0)),
        });
        throw new Error(
          `JSON Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Provide more helpful error message
      let helpfulMessage = errorMessage;
      if (
        errorMessage.includes("Unexpected character") ||
        errorMessage.includes("wrong password") ||
        errorMessage.includes("Invalid JSON structure")
      ) {
        helpfulMessage = `${errorMessage} Please verify your backup password is correct.`;
      }

      await logger.error("Decryption failed", {
        location: "BackupRestoreService.decryptSensitiveData",
        error: helpfulMessage,
      });
      throw new Error(`Decryption failed: ${helpfulMessage}`);
    }
  }

  /**
   * Create a selective backup based on user options
   */
  async createSelectiveBackup(options: BackupExportOptions): Promise<string> {
    try {
      await logger.info("Starting selective backup creation", {
        location: "BackupRestoreService.createSelectiveBackup",
        options: {
          includeSettings: options.includeSettings,
          includeServiceConfigs: options.includeServiceConfigs,
          includeServiceCredentials: options.includeServiceCredentials,
          includeTmdbCredentials: options.includeTmdbCredentials,
          includeNetworkHistory: options.includeNetworkHistory,
          includeRecentIPs: options.includeRecentIPs,
          includeDownloadConfig: options.includeDownloadConfig,
          includeServicesViewState: options.includeServicesViewState,
          includeLibraryFilters: options.includeLibraryFilters,
          includeVoiceAssistantConfig: options.includeVoiceAssistantConfig,
          includeBookmarkHealthChecks: options.includeBookmarkHealthChecks,
          encryptSensitive: options.encryptSensitive,
        },
      });

      const backupData: any = {
        version: options.encryptSensitive ? "1.2" : "1.1",
        timestamp: new Date().toISOString(),
        appData: {},
      };

      // Add encryption metadata if needed
      if (options.encryptSensitive) {
        backupData.encrypted = true;
        backupData.encryptionInfo = {
          algorithm: "XOR-PBKDF2",
          salt: "", // Will be filled during encryption
          iv: "", // Will be filled during encryption
        };
      }

      const sensitiveData: any = {};

      // Collect settings
      if (options.includeSettings) {
        const settingsKey = "SettingsStore:v1";
        const settingsData = await AsyncStorage.getItem(settingsKey);
        if (settingsData) {
          const settings = JSON.parse(settingsData);
          if (options.encryptSensitive) {
            sensitiveData.settings = settings;
          } else {
            backupData.appData.settings = settings;
          }
        }
      }

      // Collect service configs
      if (options.includeServiceConfigs) {
        const serviceConfigs = await secureStorage.getServiceConfigs();

        const nonSensitiveConfigs = serviceConfigs.map((config) => ({
          id: config.id,
          type: config.type,
          name: config.name,
          url: config.url,
          enabled: config.enabled,
          createdAt: config.createdAt.toISOString(),
          updatedAt: config.updatedAt.toISOString(),
        }));

        const sensitiveConfigs = serviceConfigs.map((config) => ({
          id: config.id,
          type: config.type,
          name: config.name,
          url: config.url,
          apiKey: config.apiKey,
          username: config.username,
          password: config.password,
          proxyUrl: config.proxyUrl,
          timeout: config.timeout,
          enabled: config.enabled,
          createdAt: config.createdAt.toISOString(),
          updatedAt: config.updatedAt.toISOString(),
        }));

        if (options.encryptSensitive && options.includeServiceCredentials) {
          sensitiveData.serviceConfigs = sensitiveConfigs;
          backupData.appData.serviceConfigs = nonSensitiveConfigs;
        } else if (options.includeServiceCredentials) {
          backupData.appData.serviceConfigs = sensitiveConfigs;
        } else {
          backupData.appData.serviceConfigs = nonSensitiveConfigs;
        }
      }

      // Collect TMDB credentials
      if (options.includeTmdbCredentials) {
        const tmdbApiKey = await getStoredTmdbKey();
        if (tmdbApiKey) {
          if (options.encryptSensitive) {
            sensitiveData.tmdbCredentials = { apiKey: tmdbApiKey };
          } else {
            backupData.appData.tmdbCredentials = { apiKey: tmdbApiKey };
          }
        }
      }

      // Collect network history
      if (options.includeNetworkHistory) {
        const networkScanHistory = await secureStorage.getNetworkScanHistory();
        if (networkScanHistory.length > 0) {
          backupData.appData.networkScanHistory = networkScanHistory;
        }
      }

      // Collect recent IPs
      if (options.includeRecentIPs) {
        const recentIPs = await secureStorage.getRecentIPs();
        if (recentIPs.length > 0) {
          backupData.appData.recentIPs = recentIPs;
        }
      }

      // Collect download configuration
      if (options.includeDownloadConfig) {
        const downloadConfigKey = "download-store";
        const downloadStoreData = await AsyncStorage.getItem(downloadConfigKey);
        if (downloadStoreData) {
          try {
            const parsedData = JSON.parse(downloadStoreData);
            // Extract the state if it's wrapped in a state object
            const state = parsedData.state || parsedData;
            if (state.config) {
              backupData.appData.downloadConfig = state.config;
            }
          } catch (parseError) {
            await logger.warn("Failed to parse download store data", {
              location: "BackupRestoreService.createSelectiveBackup",
              error:
                parseError instanceof Error
                  ? parseError.message
                  : String(parseError),
            });
          }
        }
      }

      // Collect services view state (viewMode, sort preferences)
      if (options.includeServicesViewState) {
        const servicesStoreKey = "ServicesStore:v1";
        const servicesStoreData = await AsyncStorage.getItem(servicesStoreKey);
        if (servicesStoreData) {
          try {
            const parsedData = JSON.parse(servicesStoreData);
            // Extract the state if it's wrapped in a state object
            const state = parsedData.state || parsedData;
            if (state.viewMode || state.sortKey) {
              backupData.appData.servicesViewState = {
                viewMode: state.viewMode || "grid",
                sortKey: state.sortKey || "name",
                sortDirection: state.sortDirection || "asc",
              };
            }
          } catch (parseError) {
            await logger.warn("Failed to parse services store data", {
              location: "BackupRestoreService.createSelectiveBackup",
              error:
                parseError instanceof Error
                  ? parseError.message
                  : String(parseError),
            });
          }
        }
      }

      // Collect library filters
      if (options.includeLibraryFilters) {
        const libraryFiltersKey = "LibraryFilterStore:v1";
        const libraryFiltersData =
          await AsyncStorage.getItem(libraryFiltersKey);
        if (libraryFiltersData) {
          try {
            const parsedData = JSON.parse(libraryFiltersData);
            const state = parsedData.state || parsedData;
            if (state.serviceFilters) {
              backupData.appData.libraryFilters =
                state.serviceFilters as LibraryFiltersBackupPayload;
            }
          } catch (parseError) {
            await logger.warn("Failed to parse library filter store data", {
              location: "BackupRestoreService.createSelectiveBackup",
              error:
                parseError instanceof Error
                  ? parseError.message
                  : String(parseError),
            });
          }
        }
      }

      // Collect voice assistant configuration
      if (options.includeVoiceAssistantConfig) {
        try {
          const voiceConfig = await AsyncStorage.getItem(
            "voice_assistant_config",
          );
          const voiceShortcuts = await AsyncStorage.getItem("voice_shortcuts");
          if (voiceConfig) {
            backupData.appData.voiceAssistantConfig = {
              config: JSON.parse(voiceConfig),
              shortcuts: voiceShortcuts ? JSON.parse(voiceShortcuts) : [],
            };
          }
        } catch (parseError) {
          await logger.warn("Failed to collect voice assistant config", {
            location: "BackupRestoreService.createSelectiveBackup",
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
          });
        }
      }

      // Collect bookmark health checks
      if (options.includeBookmarkHealthChecks) {
        try {
          const healthCheckData = await AsyncStorage.getItem(
            "BookmarkHealthCheck:health",
          );
          if (healthCheckData) {
            backupData.appData.bookmarkHealthChecks =
              JSON.parse(healthCheckData);
          }
        } catch (parseError) {
          await logger.warn("Failed to collect bookmark health checks", {
            location: "BackupRestoreService.createSelectiveBackup",
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
          });
        }
      }

      // Collect BYOK configuration
      if (options.includeByokConfig) {
        const settings = useSettingsStore.getState();
        if (settings.byokGeocodeMapsCoApiKey) {
          const byokConfigToBackup = {
            byokGeocodeMapsCoApiKey: settings.byokGeocodeMapsCoApiKey,
          };

          if (options.encryptSensitive) {
            sensitiveData.byokConfig = byokConfigToBackup;
          } else {
            backupData.appData.byokConfig = byokConfigToBackup;
          }

          await logger.info("BYOK configuration collected for backup", {
            location: "BackupRestoreService.createSelectiveBackup",
            hasGeocodeMapsCoApiKey: !!settings.byokGeocodeMapsCoApiKey,
          });
        }
      }

      // Collect AI configuration
      if (options.includeAiConfig) {
        const settings = useSettingsStore.getState();
        const aiConfig = {
          enableAISearch: settings.enableAISearch,
          enableAIRecommendations: settings.enableAIRecommendations,
        };

        backupData.appData.aiConfig = aiConfig;

        await logger.info("AI configuration collected for backup", {
          location: "BackupRestoreService.createSelectiveBackup",
          enableAISearch: settings.enableAISearch,
          enableAIRecommendations: settings.enableAIRecommendations,
        });
      }

      // Collect API logging configuration
      if (options.includeApiLoggingConfig) {
        const settings = useSettingsStore.getState();
        const apiLoggingConfig = {
          apiLoggerEnabled: settings.apiLoggerEnabled,
          apiLoggerActivePreset: settings.apiLoggerActivePreset,
          apiLoggerCustomCodes: settings.apiLoggerCustomCodes,
          apiLoggerRetentionDays: settings.apiLoggerRetentionDays,
          apiLoggerCaptureRequestBody: settings.apiLoggerCaptureRequestBody,
          apiLoggerCaptureResponseBody: settings.apiLoggerCaptureResponseBody,
          apiLoggerCaptureRequestHeaders:
            settings.apiLoggerCaptureRequestHeaders,
          apiLoggerAiLoggingEnabled: settings.apiLoggerAiLoggingEnabled,
          apiLoggerAiCapturePrompt: settings.apiLoggerAiCapturePrompt,
          apiLoggerAiCaptureResponse: settings.apiLoggerAiCaptureResponse,
          apiLoggerAiCaptureMetadata: settings.apiLoggerAiCaptureMetadata,
          apiLoggerAiRetentionDays: settings.apiLoggerAiRetentionDays,
        };

        backupData.appData.apiLoggingConfig = apiLoggingConfig;

        await logger.info("API logging configuration collected for backup", {
          location: "BackupRestoreService.createSelectiveBackup",
          apiLoggerEnabled: settings.apiLoggerEnabled,
          apiLoggerAiLoggingEnabled: settings.apiLoggerAiLoggingEnabled,
        });
      }

      if (options.includeConversationalAISettings) {
        const convAIKey = "conversational-ai-store";
        const convAIData = await AsyncStorage.getItem(convAIKey);
        if (convAIData) {
          try {
            const parsed = JSON.parse(convAIData);
            const state = parsed.state || parsed;
            if (state.config) {
              backupData.appData.conversationalAISettings = {
                config: state.config,
              };
            }
          } catch (err) {
            await logger.warn("Failed to parse conversational AI store", {
              location: "BackupRestoreService.createSelectiveBackup",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      if (options.includeConversationalAIProviderConfig) {
        const convAIConfigKey = "conversational-ai-config-store";
        const convAIConfigData = await AsyncStorage.getItem(convAIConfigKey);
        if (convAIConfigData) {
          try {
            const parsed = JSON.parse(convAIConfigData);
            const state = parsed.state || parsed;
            backupData.appData.conversationalAIProviderConfig = {
              selectedProvider: state.selectedProvider ?? null,
              selectedModel: state.selectedModel ?? null,
              selectedKeyId: state.selectedKeyId ?? null,
              selectedTitleProvider: state.selectedTitleProvider ?? null,
              selectedTitleModel: state.selectedTitleModel ?? null,
              selectedTitleKeyId: state.selectedTitleKeyId ?? null,
            };
          } catch (err) {
            await logger.warn(
              "Failed to parse conversational AI config store",
              {
                location: "BackupRestoreService.createSelectiveBackup",
                error: err instanceof Error ? err.message : String(err),
              },
            );
          }
        }
      }

      // Collect widgets configuration
      if (options.includeWidgetsConfig) {
        const widgetsStorageKey = "WidgetService:widgets";
        const widgetsData = await AsyncStorage.getItem(widgetsStorageKey);
        if (widgetsData) {
          try {
            backupData.appData.widgetsConfig = JSON.parse(widgetsData);
          } catch (parseError) {
            await logger.warn("Failed to parse widgets configuration", {
              location: "BackupRestoreService.createSelectiveBackup",
              error:
                parseError instanceof Error
                  ? parseError.message
                  : String(parseError),
            });
          }
        }
      }

      // Collect widget profiles
      if (options.includeWidgetProfiles) {
        try {
          const widgetProfiles = await this.exportWidgetProfilesToBackup();
          if (widgetProfiles.length > 0) {
            backupData.appData.widgetProfiles = widgetProfiles;
          }
        } catch (profileError) {
          await logger.warn("Failed to collect widget profiles", {
            location: "BackupRestoreService.createSelectiveBackup",
            error:
              profileError instanceof Error
                ? profileError.message
                : String(profileError),
          });
        }
      }

      // Collect widget credentials if requested
      if (
        options.includeWidgetConfigCredentials ||
        options.includeWidgetProfileCredentials
      ) {
        try {
          const widgetsCredentials: Record<string, any> = {};

          // Extract credentials from widgets config
          if (options.includeWidgetConfigCredentials) {
            const widgetsStorageKey = "WidgetService:widgets";
            const widgetsData = await AsyncStorage.getItem(widgetsStorageKey);
            if (widgetsData) {
              const widgets = JSON.parse(widgetsData) as {
                id: string;
                config?: Record<string, any>;
              }[];
              for (const widget of widgets) {
                if (widget.config) {
                  widgetsCredentials[widget.id] = {
                    ...widget.config,
                  };
                }
              }
            }
          }

          // Extract credentials from widget profiles
          if (options.includeWidgetProfileCredentials) {
            try {
              const profiles = await this.exportWidgetProfilesToBackup();
              for (const profile of profiles) {
                if (!widgetsCredentials[profile.id]) {
                  widgetsCredentials[profile.id] = {};
                }
                widgetsCredentials[`${profile.id}:profile`] = {
                  profileId: profile.id,
                  name: profile.name,
                };
              }
            } catch (error) {
              await logger.warn("Failed to extract profile credentials", {
                location: "BackupRestoreService.createSelectiveBackup",
                error,
              });
            }
          }

          if (Object.keys(widgetsCredentials).length > 0) {
            if (options.encryptSensitive) {
              sensitiveData.widgetsCredentials = widgetsCredentials;
            } else {
              backupData.appData.widgetsCredentials = widgetsCredentials;
            }

            await logger.info("Widget credentials collected for backup", {
              location: "BackupRestoreService.createSelectiveBackup",
              credentialCount: Object.keys(widgetsCredentials).length,
            });
          }
        } catch (credentialError) {
          await logger.warn("Failed to collect widget credentials", {
            location: "BackupRestoreService.createSelectiveBackup",
            error:
              credentialError instanceof Error
                ? credentialError.message
                : String(credentialError),
          });
        }
      }

      // Collect widget secure credentials if requested
      if (options.includeWidgetSecureCredentials) {
        try {
          const { widgetCredentialService } = await import(
            "@/services/widgets/WidgetCredentialService"
          );

          const widgetSecureCredentials =
            await widgetCredentialService.getAllCredentials();

          if (Object.keys(widgetSecureCredentials).length > 0) {
            if (options.encryptSensitive) {
              sensitiveData.widgetSecureCredentials = widgetSecureCredentials;
            } else {
              backupData.appData.widgetSecureCredentials =
                widgetSecureCredentials;
            }

            await logger.info(
              "Widget secure credentials collected for backup",
              {
                location: "BackupRestoreService.createSelectiveBackup",
                credentialCount: Object.keys(widgetSecureCredentials).length,
              },
            );
          }
        } catch (secureCredentialError) {
          await logger.warn("Failed to collect widget secure credentials", {
            location: "BackupRestoreService.createSelectiveBackup",
            error:
              secureCredentialError instanceof Error
                ? secureCredentialError.message
                : String(secureCredentialError),
          });
        }
      }

      // Encrypt sensitive data if needed
      if (
        options.encryptSensitive &&
        (options.includeServiceCredentials ||
          options.includeTmdbCredentials ||
          options.includeSettings ||
          options.includeWidgetSecureCredentials)
      ) {
        if (!options.password) {
          throw new Error("Password is required for encrypted backup");
        }

        const { encryptedData, salt, iv } = await this.encryptSensitiveData(
          sensitiveData,
          options.password,
        );
        backupData.appData.encryptedData = encryptedData;
        backupData.encryptionInfo!.salt = salt;
        backupData.encryptionInfo!.iv = iv;

        await logger.info("Sensitive data encrypted for backup", {
          location: "BackupRestoreService.createSelectiveBackup",
          hasServiceCredentials: !!sensitiveData.serviceConfigs,
          hasTmdbCredentials: !!sensitiveData.tmdbCredentials,
          hasSettings: !!sensitiveData.settings,
          encryptionMethod: "XOR encryption with PBKDF2 key derivation",
        });
      }

      // Create backup file
      const fileName = `uniarr-backup-${new Date().toISOString().split("T")[0]}${options.encryptSensitive ? "-encrypted" : ""}.json`;
      const filePath = `${FileSystemLegacy.documentDirectory}${fileName}`;

      await FileSystemLegacy.writeAsStringAsync(
        filePath,
        JSON.stringify(backupData, null, 2),
      );

      await logger.info("Selective backup file created", {
        location: "BackupRestoreService.createSelectiveBackup",
        fileName,
        encrypted: options.encryptSensitive,
        version: backupData.version,
      });

      return filePath;
    } catch (error) {
      await logger.error("Failed to create selective backup", {
        location: "BackupRestoreService.createSelectiveBackup",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create a complete backup of app data including settings and service configurations
   * Returns the backup file URI
   */
  async createBackup(): Promise<string> {
    try {
      await logger.info("Starting backup creation", {
        location: "BackupRestoreService.createBackup",
      });

      // Fetch settings from AsyncStorage
      const settingsKey = "SettingsStore:v1";
      const settingsData = await AsyncStorage.getItem(settingsKey);
      const settings = settingsData ? JSON.parse(settingsData) : {};

      // Fetch service configs
      const serviceConfigs = await secureStorage.getServiceConfigs();

      // Fetch additional data from secure storage
      const networkScanHistory = await secureStorage.getNetworkScanHistory();
      const recentIPs = await secureStorage.getRecentIPs();
      const tmdbApiKey = await getStoredTmdbKey();

      // Fetch download configuration
      let downloadConfig = undefined;
      const downloadConfigKey = "download-store";
      const downloadStoreData = await AsyncStorage.getItem(downloadConfigKey);
      if (downloadStoreData) {
        try {
          const parsedData = JSON.parse(downloadStoreData);
          const state = parsedData.state || parsedData;
          if (state.config) {
            downloadConfig = state.config;
          }
        } catch (parseError) {
          await logger.warn("Failed to parse download store data", {
            location: "BackupRestoreService.createBackup",
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
          });
        }
      }

      // Fetch services view state
      let servicesViewState = undefined;
      const servicesStoreKey = "ServicesStore:v1";
      const servicesStoreData = await AsyncStorage.getItem(servicesStoreKey);
      if (servicesStoreData) {
        try {
          const parsedData = JSON.parse(servicesStoreData);
          const state = parsedData.state || parsedData;
          if (state.viewMode || state.sortKey) {
            servicesViewState = {
              viewMode: state.viewMode || "grid",
              sortKey: state.sortKey || "name",
              sortDirection: state.sortDirection || "asc",
            };
          }
        } catch (parseError) {
          await logger.warn("Failed to parse services store data", {
            location: "BackupRestoreService.createBackup",
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
          });
        }
      }

      // Fetch library filter state
      let libraryFilters: LibraryFiltersBackupPayload | undefined;

      const libraryFiltersKey = "LibraryFilterStore:v1";
      const libraryFiltersData = await AsyncStorage.getItem(libraryFiltersKey);
      if (libraryFiltersData) {
        try {
          const parsedData = JSON.parse(libraryFiltersData);
          const state = parsedData.state || parsedData;
          if (state.serviceFilters) {
            libraryFilters =
              state.serviceFilters as LibraryFiltersBackupPayload;
          }
        } catch (parseError) {
          await logger.warn("Failed to parse library filter store data", {
            location: "BackupRestoreService.createBackup",
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
          });
        }
      }

      // Fetch voice assistant configuration
      let voiceAssistantConfig: any = undefined;
      try {
        const voiceConfig = await AsyncStorage.getItem(
          "voice_assistant_config",
        );
        const voiceShortcuts = await AsyncStorage.getItem("voice_shortcuts");
        if (voiceConfig) {
          voiceAssistantConfig = {
            config: JSON.parse(voiceConfig),
            shortcuts: voiceShortcuts ? JSON.parse(voiceShortcuts) : [],
          };
        }
      } catch (parseError) {
        await logger.warn("Failed to fetch voice assistant config", {
          location: "BackupRestoreService.createBackup",
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        });
      }

      // Fetch bookmark health checks
      let bookmarkHealthChecks: Record<string, any>[] | undefined;
      try {
        const healthCheckData = await AsyncStorage.getItem(
          "BookmarkHealthCheck:health",
        );
        if (healthCheckData) {
          bookmarkHealthChecks = JSON.parse(healthCheckData);
        }
      } catch (parseError) {
        await logger.warn("Failed to fetch bookmark health checks", {
          location: "BackupRestoreService.createBackup",
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        });
      }

      // Fetch widgets configuration
      let widgetsConfig = undefined;
      const widgetsStorageKey = "WidgetService:widgets";
      const widgetsData = await AsyncStorage.getItem(widgetsStorageKey);
      if (widgetsData) {
        try {
          widgetsConfig = JSON.parse(widgetsData);
        } catch (parseError) {
          await logger.warn("Failed to parse widgets configuration", {
            location: "BackupRestoreService.createBackup",
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
          });
        }
      }

      // Fetch BYOK configuration
      const settingsStore = useSettingsStore.getState();
      const byokConfig = settingsStore.byokGeocodeMapsCoApiKey
        ? { byokGeocodeMapsCoApiKey: settingsStore.byokGeocodeMapsCoApiKey }
        : undefined;

      // Fetch AI configuration
      const aiConfig = {
        enableAISearch: settingsStore.enableAISearch,
        enableAIRecommendations: settingsStore.enableAIRecommendations,
      };

      // Fetch API logging configuration
      const settingsForLogging = useSettingsStore.getState();
      const apiLoggingConfig = {
        apiLoggerEnabled: settingsForLogging.apiLoggerEnabled,
        apiLoggerActivePreset: settingsForLogging.apiLoggerActivePreset,
        apiLoggerCustomCodes: settingsForLogging.apiLoggerCustomCodes,
        apiLoggerRetentionDays: settingsForLogging.apiLoggerRetentionDays,
        apiLoggerCaptureRequestBody:
          settingsForLogging.apiLoggerCaptureRequestBody,
        apiLoggerCaptureResponseBody:
          settingsForLogging.apiLoggerCaptureResponseBody,
        apiLoggerCaptureRequestHeaders:
          settingsForLogging.apiLoggerCaptureRequestHeaders,
        apiLoggerAiLoggingEnabled: settingsForLogging.apiLoggerAiLoggingEnabled,
        apiLoggerAiCapturePrompt: settingsForLogging.apiLoggerAiCapturePrompt,
        apiLoggerAiCaptureResponse:
          settingsForLogging.apiLoggerAiCaptureResponse,
        apiLoggerAiCaptureMetadata:
          settingsForLogging.apiLoggerAiCaptureMetadata,
        apiLoggerAiRetentionDays: settingsForLogging.apiLoggerAiRetentionDays,
      };

      // Prepare backup data structure
      const backupData: BackupData = {
        version: "1.1",
        timestamp: new Date().toISOString(),
        appData: {
          settings,
          serviceConfigs: serviceConfigs.map((config) => ({
            id: config.id,
            type: config.type,
            name: config.name,
            url: config.url,
            apiKey: config.apiKey,
            username: config.username,
            password: config.password,
            proxyUrl: config.proxyUrl,
            timeout: config.timeout,
            enabled: config.enabled,
            createdAt:
              config.createdAt instanceof Date
                ? config.createdAt.toISOString()
                : String(config.createdAt),
            updatedAt:
              config.updatedAt instanceof Date
                ? config.updatedAt.toISOString()
                : String(config.updatedAt),
          })),
          networkScanHistory,
          recentIPs,
          tmdbCredentials: {
            apiKey: tmdbApiKey || undefined,
          },
          ...(downloadConfig && { downloadConfig }),
          ...(servicesViewState && { servicesViewState }),
          ...(libraryFilters && { libraryFilters }),
          ...(voiceAssistantConfig && { voiceAssistantConfig }),
          ...(bookmarkHealthChecks && { bookmarkHealthChecks }),
          ...(widgetsConfig && { widgetsConfig }),
          ...(byokConfig && { byokConfig }),
          ...(aiConfig && { aiConfig }),
          ...(apiLoggingConfig && { apiLoggingConfig }),
          ...(await (async () => {
            const convAIKey = "conversational-ai-store";
            const data = await AsyncStorage.getItem(convAIKey);
            if (data) {
              try {
                const parsed = JSON.parse(data);
                const state = parsed.state || parsed;
                if (state.config) {
                  return {
                    conversationalAISettings: {
                      config: state.config as AssistantConfig,
                    },
                  };
                }
              } catch {}
            }
            return {} as Record<string, unknown>;
          })()),
          ...(await (async () => {
            const convAIConfigKey = "conversational-ai-config-store";
            const data = await AsyncStorage.getItem(convAIConfigKey);
            if (data) {
              try {
                const parsed = JSON.parse(data);
                const state = parsed.state || parsed;
                return {
                  conversationalAIProviderConfig: {
                    selectedProvider: state.selectedProvider ?? null,
                    selectedModel: state.selectedModel ?? null,
                    selectedKeyId: state.selectedKeyId ?? null,
                    selectedTitleProvider: state.selectedTitleProvider ?? null,
                    selectedTitleModel: state.selectedTitleModel ?? null,
                    selectedTitleKeyId: state.selectedTitleKeyId ?? null,
                  },
                } as Record<string, unknown>;
              } catch {}
            }
            return {} as Record<string, unknown>;
          })()),
        },
      };

      // Create backup file
      const fileName = `uniarr-backup-${new Date().toISOString().split("T")[0]}.json`;
      const filePath = `${FileSystemLegacy.documentDirectory}${fileName}`;

      await FileSystemLegacy.writeAsStringAsync(
        filePath,
        JSON.stringify(backupData, null, 2),
      );

      await logger.info("Backup file created", {
        location: "BackupRestoreService.createBackup",
        fileName,
        configCount: serviceConfigs.length,
        hasNetworkHistory: networkScanHistory.length > 0,
        hasRecentIPs: recentIPs.length > 0,
        hasTmdbCredentials: !!tmdbApiKey,
        hasDownloadConfig: !!downloadConfig,
        hasServicesViewState: !!servicesViewState,
        hasLibraryFilters: !!libraryFilters,
        hasVoiceAssistantConfig: !!voiceAssistantConfig,
        hasBookmarkHealthChecks: !!bookmarkHealthChecks,
        hasWidgetsConfig: !!widgetsConfig,
        hasByokConfig: !!byokConfig,
        hasAiConfig: !!aiConfig,
        hasApiLoggingConfig: !!apiLoggingConfig,
      });

      return filePath;
    } catch (error) {
      await logger.error("Failed to create backup", {
        location: "BackupRestoreService.createBackup",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Share the backup file using native share functionality
   */
  async shareBackup(backupFilePath: string): Promise<void> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error("Sharing is not available on this device");
      }

      await Sharing.shareAsync(backupFilePath, {
        mimeType: "application/json",
        UTI: "public.json",
      });

      await logger.info("Backup shared successfully", {
        location: "BackupRestoreService.shareBackup",
      });
    } catch (error) {
      await logger.error("Failed to share backup", {
        location: "BackupRestoreService.shareBackup",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Select and restore from a backup file
   */
  async selectAndRestoreBackup(): Promise<AnyBackupData> {
    try {
      await logger.info("Starting backup restore selection", {
        location: "BackupRestoreService.selectAndRestoreBackup",
      });

      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*", // Allow all file types, will validate later
        copyToCacheDirectory: true,
        multiple: false,
      });

      await logger.info("DocumentPicker result received", {
        location: "BackupRestoreService.selectAndRestoreBackup",
        canceled: result.canceled,
        hasAssets: result.assets && result.assets.length > 0,
        assetCount: result.assets?.length || 0,
      });

      if (result.canceled) {
        await logger.info("Backup restore cancelled by user", {
          location: "BackupRestoreService.selectAndRestoreBackup",
        });
        throw new Error("Restore cancelled");
      }

      const fileUri = result.assets[0]?.uri;
      const fileName = result.assets[0]?.name;
      if (!fileUri) {
        throw new Error("No file selected");
      }

      // Validate file extension
      if (fileName && !fileName.toLowerCase().endsWith(".json")) {
        throw new Error(
          "Selected file is not a JSON file. Please select a valid backup file with .json extension.",
        );
      }

      // Read the file
      const fileContent = await FileSystemLegacy.readAsStringAsync(fileUri);

      // Validate that the file content is valid JSON
      let backupData: AnyBackupData;
      try {
        backupData = JSON.parse(fileContent);
      } catch {
        throw new Error(
          "Selected file is not a valid JSON file. The file may be corrupted or not in the correct format.",
        );
      }

      // Validate backup structure
      if (!backupData.version || !backupData.timestamp || !backupData.appData) {
        throw new Error("Invalid backup file format");
      }

      // Validate service configs array if it exists (older versions require it)
      if (
        backupData.appData.serviceConfigs &&
        !Array.isArray(backupData.appData.serviceConfigs)
      ) {
        throw new Error(
          "Invalid backup file format: serviceConfigs must be an array",
        );
      }

      // Check version compatibility
      const supportedVersions = ["1.0", "1.1", "1.2"];
      if (!supportedVersions.includes(backupData.version)) {
        throw new Error(`Unsupported backup version: ${backupData.version}`);
      }

      await logger.info("Backup file loaded and validated", {
        location: "BackupRestoreService.selectAndRestoreBackup",
        fileName,
        version: backupData.version,
        encrypted: backupData.encrypted || false,
        configCount: backupData.appData.serviceConfigs?.length || 0,
      });

      return backupData;
    } catch (error) {
      await logger.error("Failed to load backup file", {
        location: "BackupRestoreService.selectAndRestoreBackup",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Restore app data from a backup
   * Pass skipSettings=true to restore only service configs
   * Pass skipServices=true to restore only settings
   */
  async restoreBackup(
    backupData: AnyBackupData,
    options?: {
      skipSettings?: boolean;
      skipServices?: boolean;
    },
  ): Promise<void> {
    const { skipSettings = false, skipServices = false } = options ?? {};

    try {
      await logger.info("Starting backup restore", {
        location: "BackupRestoreService.restoreBackup",
        skipSettings,
        skipServices,
      });

      // Restore settings
      if (!skipSettings && backupData.appData.settings) {
        const settingsKey = "SettingsStore:v1";
        await AsyncStorage.setItem(
          settingsKey,
          JSON.stringify(backupData.appData.settings),
        );

        await logger.info("Settings restored", {
          location: "BackupRestoreService.restoreBackup",
        });
      }

      // Restore service configurations
      if (!skipServices && Array.isArray(backupData.appData.serviceConfigs)) {
        // Clear existing service configs
        await secureStorage.clearAll();

        // Restore each config with credentials
        for (const configData of backupData.appData.serviceConfigs) {
          const fullConfig: ServiceConfig = {
            id: configData.id,
            type: configData.type,
            name: configData.name,
            url: configData.url,
            apiKey: configData.apiKey,
            username: configData.username,
            password: configData.password,
            proxyUrl: configData.proxyUrl,
            timeout: configData.timeout,
            enabled: configData.enabled,
            createdAt: new Date(configData.createdAt),
            updatedAt: new Date(configData.updatedAt),
          };

          await secureStorage.saveServiceConfig(fullConfig);

          await logger.info("Service config restored", {
            location: "BackupRestoreService.restoreBackup",
            serviceType: configData.type,
            serviceName: configData.name,
            hasCredentials: !!(configData.apiKey || configData.username),
          });
        }
      }

      // Restore network scan history if available
      if (
        backupData.appData.networkScanHistory &&
        Array.isArray(backupData.appData.networkScanHistory)
      ) {
        // Clear existing history first
        await secureStorage.clearNetworkScanHistory();

        // The saveNetworkScanHistory method expects individual entries, but it's designed to save one at a time
        // and manage the list internally. We need to add each entry but the current implementation
        // overwrites the entire history. Let's add them in reverse order to maintain the original order.
        const reversedHistory = [
          ...backupData.appData.networkScanHistory,
        ].reverse();
        for (const historyEntry of reversedHistory) {
          await secureStorage.saveNetworkScanHistory(historyEntry);
        }

        await logger.info("Network scan history restored", {
          location: "BackupRestoreService.restoreBackup",
          entryCount: backupData.appData.networkScanHistory.length,
        });
      }

      // Restore recent IPs if available
      if (
        backupData.appData.recentIPs &&
        Array.isArray(backupData.appData.recentIPs)
      ) {
        // Clear existing recent IPs first
        await secureStorage.clearRecentIPs();

        // Add each recent IP
        for (const recentIP of backupData.appData.recentIPs) {
          await secureStorage.addRecentIP(
            recentIP.ip,
            recentIP.subnet,
            recentIP.servicesFound,
          );
        }

        await logger.info("Recent IPs restored", {
          location: "BackupRestoreService.restoreBackup",
          ipCount: backupData.appData.recentIPs.length,
        });
      }

      // Restore TMDB credentials if available
      if (backupData.appData.tmdbCredentials?.apiKey) {
        await setStoredTmdbKey(backupData.appData.tmdbCredentials.apiKey);

        await logger.info("TMDB credentials restored", {
          location: "BackupRestoreService.restoreBackup",
          hasApiKey: !!backupData.appData.tmdbCredentials.apiKey,
        });
      }

      // Restore download configuration if available
      if (backupData.appData.downloadConfig) {
        const downloadConfigKey = "download-store";
        const stateToStore = {
          state: {
            config: backupData.appData.downloadConfig,
          },
        };
        await AsyncStorage.setItem(
          downloadConfigKey,
          JSON.stringify(stateToStore),
        );

        await logger.info("Download configuration restored", {
          location: "BackupRestoreService.restoreBackup",
          maxConcurrentDownloads:
            backupData.appData.downloadConfig.maxConcurrentDownloads,
          maxStorageUsage: backupData.appData.downloadConfig.maxStorageUsage,
        });
      }

      // Restore services view state if available
      if (backupData.appData.servicesViewState) {
        const servicesStoreKey = "ServicesStore:v1";
        const stateToStore = {
          state: {
            viewMode: backupData.appData.servicesViewState.viewMode,
            sortKey: backupData.appData.servicesViewState.sortKey,
            sortDirection: backupData.appData.servicesViewState.sortDirection,
          },
        };
        await AsyncStorage.setItem(
          servicesStoreKey,
          JSON.stringify(stateToStore),
        );

        await logger.info("Services view state restored", {
          location: "BackupRestoreService.restoreBackup",
          viewMode: backupData.appData.servicesViewState.viewMode,
          sortKey: backupData.appData.servicesViewState.sortKey,
          sortDirection: backupData.appData.servicesViewState.sortDirection,
        });
      }

      if (backupData.appData.conversationalAISettings) {
        try {
          const store = useConversationalAIStore.getState();
          store.updateConfig(
            backupData.appData.conversationalAISettings.config,
          );
          await logger.info("Conversational AI settings restored", {
            location: "BackupRestoreService.restoreBackup",
          });
        } catch (err) {
          await logger.warn("Failed to restore conversational AI settings", {
            location: "BackupRestoreService.restoreBackup",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (backupData.appData.conversationalAIProviderConfig) {
        try {
          const cfg = backupData.appData.conversationalAIProviderConfig;
          const configStore = useConversationalAIConfigStore.getState();
          configStore.setConversationalAIConfig(
            cfg.selectedProvider ?? null,
            cfg.selectedModel ?? null,
            cfg.selectedKeyId ?? null,
          );
          configStore.setTitleSummaryConfig(
            cfg.selectedTitleProvider ?? null,
            cfg.selectedTitleModel ?? null,
            cfg.selectedTitleKeyId ?? null,
          );
          await logger.info("Conversational AI provider config restored", {
            location: "BackupRestoreService.restoreBackup",
          });
        } catch (err) {
          await logger.warn(
            "Failed to restore conversational AI provider config",
            {
              location: "BackupRestoreService.restoreBackup",
              error: err instanceof Error ? err.message : String(err),
            },
          );
        }
      }

      // Restore library filters if available
      if (backupData.appData.libraryFilters) {
        const libraryFiltersKey = "LibraryFilterStore:v1";
        const stateToStore = {
          state: {
            serviceFilters: backupData.appData
              .libraryFilters as LibraryFiltersBackupPayload,
          },
          version: 1,
        };
        await AsyncStorage.setItem(
          libraryFiltersKey,
          JSON.stringify(stateToStore),
        );

        await logger.info("Library filters restored", {
          location: "BackupRestoreService.restoreBackup",
          serviceCount: Object.keys(backupData.appData.libraryFilters).length,
        });
      }

      // Restore voice assistant configuration if available
      if (backupData.appData.voiceAssistantConfig) {
        try {
          const voiceConfig = backupData.appData.voiceAssistantConfig.config;
          const voiceShortcuts =
            backupData.appData.voiceAssistantConfig.shortcuts;

          if (voiceConfig) {
            await AsyncStorage.setItem(
              "voice_assistant_config",
              JSON.stringify(voiceConfig),
            );
          }

          if (voiceShortcuts && Array.isArray(voiceShortcuts)) {
            await AsyncStorage.setItem(
              "voice_shortcuts",
              JSON.stringify(voiceShortcuts),
            );
          }

          await logger.info("Voice assistant configuration restored", {
            location: "BackupRestoreService.restoreBackup",
            hasConfig: !!voiceConfig,
            shortcutCount: voiceShortcuts?.length || 0,
          });
        } catch (voiceError) {
          await logger.warn("Failed to restore voice assistant config", {
            location: "BackupRestoreService.restoreBackup",
            error:
              voiceError instanceof Error
                ? voiceError.message
                : String(voiceError),
          });
        }
      }

      // Restore bookmark health checks if available
      if (
        backupData.appData.bookmarkHealthChecks &&
        Array.isArray(backupData.appData.bookmarkHealthChecks)
      ) {
        try {
          await AsyncStorage.setItem(
            "BookmarkHealthCheck:health",
            JSON.stringify(backupData.appData.bookmarkHealthChecks),
          );

          await logger.info("Bookmark health checks restored", {
            location: "BackupRestoreService.restoreBackup",
            healthCheckCount: backupData.appData.bookmarkHealthChecks.length,
          });
        } catch (healthError) {
          await logger.warn("Failed to restore bookmark health checks", {
            location: "BackupRestoreService.restoreBackup",
            error:
              healthError instanceof Error
                ? healthError.message
                : String(healthError),
          });
        }
      }

      // Restore BYOK configuration if available
      if (backupData.appData.byokConfig) {
        try {
          const settingsStore = useSettingsStore.getState();
          if (backupData.appData.byokConfig.byokGeocodeMapsCoApiKey) {
            settingsStore.setByokGeocodeMapsCoApiKey(
              backupData.appData.byokConfig.byokGeocodeMapsCoApiKey,
            );
          }

          await logger.info("BYOK configuration restored", {
            location: "BackupRestoreService.restoreBackup",
            hasGeocodeMapsCoApiKey:
              !!backupData.appData.byokConfig.byokGeocodeMapsCoApiKey,
          });
        } catch (byokError) {
          await logger.warn("Failed to restore BYOK configuration", {
            location: "BackupRestoreService.restoreBackup",
            error:
              byokError instanceof Error
                ? byokError.message
                : String(byokError),
          });
        }
      }

      // Restore AI configuration if available
      if (backupData.appData.aiConfig) {
        try {
          const settingsStore = useSettingsStore.getState();
          settingsStore.setEnableAISearch(
            backupData.appData.aiConfig.enableAISearch,
          );
          settingsStore.setEnableAIRecommendations(
            backupData.appData.aiConfig.enableAIRecommendations,
          );

          await logger.info("AI configuration restored", {
            location: "BackupRestoreService.restoreBackup",
            enableAISearch: backupData.appData.aiConfig.enableAISearch,
            enableAIRecommendations:
              backupData.appData.aiConfig.enableAIRecommendations,
          });
        } catch (aiError) {
          await logger.warn("Failed to restore AI configuration", {
            location: "BackupRestoreService.restoreBackup",
            error: aiError instanceof Error ? aiError.message : String(aiError),
          });
        }
      }

      // Restore API logging configuration if available
      if (backupData.appData.apiLoggingConfig) {
        try {
          const settingsStore = useSettingsStore.getState();
          const config = backupData.appData.apiLoggingConfig;

          settingsStore.setApiLoggerEnabled(config.apiLoggerEnabled);
          settingsStore.setApiLoggerActivePreset(config.apiLoggerActivePreset);
          settingsStore.setApiLoggerCustomCodes(config.apiLoggerCustomCodes);
          settingsStore.setApiLoggerRetentionDays(
            config.apiLoggerRetentionDays,
          );
          settingsStore.setApiLoggerCaptureRequestBody(
            config.apiLoggerCaptureRequestBody,
          );
          settingsStore.setApiLoggerCaptureResponseBody(
            config.apiLoggerCaptureResponseBody,
          );
          settingsStore.setApiLoggerCaptureRequestHeaders(
            config.apiLoggerCaptureRequestHeaders,
          );
          settingsStore.setApiLoggerAiLoggingEnabled(
            config.apiLoggerAiLoggingEnabled,
          );
          settingsStore.setApiLoggerAiCapturePrompt(
            config.apiLoggerAiCapturePrompt,
          );
          settingsStore.setApiLoggerAiCaptureResponse(
            config.apiLoggerAiCaptureResponse,
          );
          settingsStore.setApiLoggerAiCaptureMetadata(
            config.apiLoggerAiCaptureMetadata,
          );
          settingsStore.setApiLoggerAiRetentionDays(
            config.apiLoggerAiRetentionDays,
          );

          await logger.info("API logging configuration restored", {
            location: "BackupRestoreService.restoreBackup",
            apiLoggerEnabled: config.apiLoggerEnabled,
            apiLoggerAiLoggingEnabled: config.apiLoggerAiLoggingEnabled,
            activePreset: config.apiLoggerActivePreset,
          });
        } catch (apiLoggingError) {
          await logger.warn("Failed to restore API logging configuration", {
            location: "BackupRestoreService.restoreBackup",
            error:
              apiLoggingError instanceof Error
                ? apiLoggingError.message
                : String(apiLoggingError),
          });
        }
      }

      // Restore widgets configuration if available
      if (
        backupData.appData.widgetsConfig &&
        Array.isArray(backupData.appData.widgetsConfig)
      ) {
        // Import WidgetService dynamically to avoid circular dependencies
        const { widgetService } = await import(
          "@/services/widgets/WidgetService"
        );

        // Use restoreWidgets which clears cache and rebuilds state
        await widgetService.restoreWidgets(backupData.appData.widgetsConfig);

        await logger.info("Widgets configuration restored", {
          location: "BackupRestoreService.restoreBackup",
          widgetCount: backupData.appData.widgetsConfig.length,
        });
      }

      // Restore widget profiles if available
      if (
        backupData.appData.widgetProfiles &&
        Array.isArray(backupData.appData.widgetProfiles)
      ) {
        try {
          await this.restoreWidgetProfiles(backupData.appData.widgetProfiles);

          await logger.info("Widget profiles restored", {
            location: "BackupRestoreService.restoreBackup",
            profileCount: backupData.appData.widgetProfiles.length,
          });
        } catch (profileError) {
          await logger.warn("Failed to restore widget profiles", {
            location: "BackupRestoreService.restoreBackup",
            error:
              profileError instanceof Error
                ? profileError.message
                : String(profileError),
          });
        }
      }

      // Restore widget credentials if available
      if (
        backupData.appData.widgetsCredentials &&
        typeof backupData.appData.widgetsCredentials === "object"
      ) {
        try {
          const widgetCredentials = backupData.appData.widgetsCredentials;
          const widgetsStorageKey = "WidgetService:widgets";
          const widgetsData = await AsyncStorage.getItem(widgetsStorageKey);

          if (widgetsData) {
            const widgets = JSON.parse(widgetsData) as {
              id: string;
              config?: Record<string, any>;
            }[];

            // Restore credentials to widgets
            for (const widget of widgets) {
              if (
                widgetCredentials[widget.id] &&
                typeof widgetCredentials[widget.id] === "object"
              ) {
                widget.config = {
                  ...widget.config,
                  ...widgetCredentials[widget.id],
                };
              }
            }

            // Save updated widgets back to storage
            await AsyncStorage.setItem(
              widgetsStorageKey,
              JSON.stringify(widgets),
            );
          }

          await logger.info("Widget credentials restored", {
            location: "BackupRestoreService.restoreBackup",
            credentialCount: Object.keys(widgetCredentials).length,
          });
        } catch (credentialError) {
          await logger.warn("Failed to restore widget credentials", {
            location: "BackupRestoreService.restoreBackup",
            error:
              credentialError instanceof Error
                ? credentialError.message
                : String(credentialError),
          });
        }
      }

      // Restore widget secure credentials if available
      if (
        backupData.appData.widgetSecureCredentials &&
        typeof backupData.appData.widgetSecureCredentials === "object"
      ) {
        try {
          const { widgetCredentialService } = await import(
            "@/services/widgets/WidgetCredentialService"
          );

          const widgetSecureCredentials =
            backupData.appData.widgetSecureCredentials;

          // Restore each set of credentials to SecureStore
          for (const [widgetId, credentials] of Object.entries(
            widgetSecureCredentials,
          )) {
            if (
              credentials &&
              typeof credentials === "object" &&
              Object.keys(credentials).length > 0
            ) {
              await widgetCredentialService.setCredentials(
                widgetId,
                credentials as Record<string, string>,
              );
            }
          }

          await logger.info("Widget secure credentials restored", {
            location: "BackupRestoreService.restoreBackup",
            credentialCount: Object.keys(widgetSecureCredentials).length,
          });
        } catch (secureCredentialError) {
          await logger.warn("Failed to restore widget secure credentials", {
            location: "BackupRestoreService.restoreBackup",
            error:
              secureCredentialError instanceof Error
                ? secureCredentialError.message
                : String(secureCredentialError),
          });
        }
      }

      await logger.info("Backup restore completed successfully", {
        location: "BackupRestoreService.restoreBackup",
      });
    } catch (error) {
      await logger.error("Failed to restore backup", {
        location: "BackupRestoreService.restoreBackup",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Select and restore from an encrypted backup file with password
   */
  async selectAndRestoreEncryptedBackup(
    password: string,
  ): Promise<AnyBackupData> {
    try {
      await logger.info("Starting encrypted backup restore selection", {
        location: "BackupRestoreService.selectAndRestoreEncryptedBackup",
      });

      const backupData = await this.selectAndRestoreBackup();

      if (
        !backupData.encrypted ||
        !backupData.encryptionInfo ||
        !backupData.appData.encryptedData
      ) {
        throw new Error("Selected backup is not encrypted");
      }

      // Decrypt sensitive data
      const decryptedData = await this.decryptSensitiveData(
        backupData.appData.encryptedData,
        password,
        backupData.encryptionInfo.salt,
        backupData.encryptionInfo.iv,
      );

      // Merge decrypted data with backup data
      const restoredBackup = {
        ...backupData,
        appData: {
          ...backupData.appData,
          ...decryptedData,
          // Keep non-encrypted data as is
          serviceConfigs:
            decryptedData.serviceConfigs || backupData.appData.serviceConfigs,
          networkScanHistory: backupData.appData.networkScanHistory,
          recentIPs: backupData.appData.recentIPs,
        },
      };

      // Remove encrypted data after decryption
      delete restoredBackup.appData.encryptedData;

      await logger.info("Encrypted backup decrypted successfully", {
        location: "BackupRestoreService.selectAndRestoreEncryptedBackup",
        hasServiceCredentials: !!decryptedData.serviceConfigs,
        hasTmdbCredentials: !!decryptedData.tmdbCredentials,
        hasSettings: !!decryptedData.settings,
      });

      return restoredBackup;
    } catch (error) {
      await logger.error("Failed to load and decrypt backup file", {
        location: "BackupRestoreService.selectAndRestoreEncryptedBackup",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get default backup export options
   */
  getDefaultExportOptions(): BackupExportOptions {
    return {
      includeSettings: true,
      includeServiceConfigs: true,
      includeServiceCredentials: true,
      includeTmdbCredentials: true,
      includeNetworkHistory: true,
      includeRecentIPs: true,
      includeDownloadConfig: true,
      includeServicesViewState: true,
      includeLibraryFilters: true,
      includeWidgetsConfig: true,
      includeWidgetConfigCredentials: true,
      includeWidgetSecureCredentials: false,
      includeWidgetProfiles: true,
      includeWidgetProfileCredentials: true,
      includeVoiceAssistantConfig: true,
      includeBookmarkHealthChecks: true,
      includeByokConfig: true,
      includeAiConfig: true,
      includeApiLoggingConfig: true,
      includeConversationalAISettings: true,
      includeConversationalAIProviderConfig: true,
      encryptSensitive: false,
    };
  }

  /**
   * Get backup selection configuration with sensitivity markers
   */
  getBackupSelectionConfig(): BackupSelectionConfig {
    return {
      settings: {
        enabled: true,
        sensitive: true, // Settings may contain sensitive preferences
      },
      serviceConfigs: {
        enabled: true,
        sensitive: true,
        includeCredentials: true,
      },
      tmdbCredentials: {
        enabled: true,
        sensitive: true,
      },
      networkHistory: {
        enabled: true,
        sensitive: false, // Network history is not considered sensitive
      },
      recentIPs: {
        enabled: true,
        sensitive: false, // Recent IPs are not considered highly sensitive
      },
      downloadConfig: {
        enabled: true,
        sensitive: false, // Download config is not sensitive (user preferences)
      },
      servicesViewState: {
        enabled: true,
        sensitive: false, // View state is not sensitive (UI preferences)
      },
      libraryFilters: {
        enabled: true,
        sensitive: false, // Library filters are user preferences only
      },
      voiceAssistantConfig: {
        enabled: true,
        sensitive: false, // Voice assistant configuration
      },
      bookmarkHealthChecks: {
        enabled: true,
        sensitive: false, // Bookmark health check status
      },
      widgetsConfig: {
        enabled: true,
        sensitive: false,
        includeCredentials: true,
      },
      widgetProfiles: {
        enabled: true,
        sensitive: false,
        includeCredentials: true,
      },
      byokConfig: {
        enabled: true,
        sensitive: true,
      },
      aiConfig: {
        enabled: true,
        sensitive: false,
      },
      apiLoggingConfig: {
        enabled: true,
        sensitive: false,
      },
      conversationalAISettings: {
        enabled: true,
        sensitive: false,
      },
      conversationalAIProviderConfig: {
        enabled: true,
        sensitive: false,
      },
    };
  }

  /**
   * Validate export options
   */
  validateExportOptions(options: BackupExportOptions): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (options.encryptSensitive && !options.password) {
      errors.push("Password is required when encryption is enabled");
    }

    if (options.password && options.password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (options.includeServiceCredentials && !options.includeServiceConfigs) {
      errors.push(
        "Service configurations must be included to include service credentials",
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get backup file size in bytes
   */
  async getBackupFileSize(filePath: string): Promise<number> {
    try {
      const file = new File(filePath);
      if (!file.exists) {
        return 0;
      }
      return file.size ?? 0;
    } catch (error) {
      await logger.error("Failed to get backup file size", {
        location: "BackupRestoreService.getBackupFileSize",
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Delete a backup file
   */
  async deleteBackup(filePath: string): Promise<void> {
    try {
      const deleteFile = new File(filePath);
      if (deleteFile.exists) {
        deleteFile.delete();
      }

      await logger.info("Backup file deleted", {
        location: "BackupRestoreService.deleteBackup",
      });
    } catch (error) {
      await logger.error("Failed to delete backup file", {
        location: "BackupRestoreService.deleteBackup",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * List all backup files in the documents directory
   */
  async listBackupFiles(): Promise<
    { name: string; path: string; modificationTime: number }[]
  > {
    try {
      const docDir = FileSystemLegacy.documentDirectory;
      if (!docDir) {
        return [];
      }

      const directory = new Directory(docDir);
      const files = directory.exists ? directory.list() : [];
      const backupFiles: {
        name: string;
        path: string;
        modificationTime: number;
      }[] = [];

      for (const fileItem of files) {
        // Skip directories, only process files
        if (fileItem instanceof Directory) {
          continue;
        }

        const fileName = fileItem.name;
        if (
          fileName.startsWith("uniarr-backup-") &&
          fileName.endsWith(".json")
        ) {
          if (fileItem.exists) {
            backupFiles.push({
              name: fileName,
              path: fileItem.uri,
              modificationTime: 0, // File API doesn't expose modification time directly
            });
          }
        }
      }

      // Sort by modification time (newest first)
      backupFiles.sort((a, b) => b.modificationTime - a.modificationTime);

      return backupFiles;
    } catch (error) {
      await logger.error("Failed to list backup files", {
        location: "BackupRestoreService.listBackupFiles",
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Export widget profiles to backup directory
   */
  async exportWidgetProfilesToBackup(): Promise<any[]> {
    try {
      const { widgetProfileService } = await import(
        "@/services/widgets/WidgetProfileService"
      );

      const profiles = await widgetProfileService.listProfiles();

      if (profiles.length === 0) {
        await logger.debug(
          "[BackupRestoreService] No widget profiles to export",
        );
        return [];
      }

      await logger.info("[BackupRestoreService] Exported widget profiles", {
        count: profiles.length,
      });

      return profiles;
    } catch (error) {
      await logger.error(
        "[BackupRestoreService] Failed to export widget profiles",
        {
          error,
        },
      );
      return [];
    }
  }

  /**
   * Restore widget profiles from backup
   */
  async restoreWidgetProfiles(profiles: any[]): Promise<void> {
    try {
      if (!Array.isArray(profiles) || profiles.length === 0) {
        return;
      }

      const { widgetProfileService } = await import(
        "@/services/widgets/WidgetProfileService"
      );

      for (const profile of profiles) {
        // Validate profile structure before saving
        const isValid = await widgetProfileService.validateProfile(profile);
        if (!isValid) {
          await logger.warn(
            "[BackupRestoreService] Skipping invalid widget profile",
            {
              profileName: profile.name,
            },
          );
          continue;
        }

        try {
          // Save profile with same ID and metadata
          await widgetProfileService.saveProfile(
            profile.name,
            profile.widgets,
            profile.description,
          );
        } catch (error) {
          await logger.warn(
            "[BackupRestoreService] Failed to restore individual widget profile",
            {
              profileName: profile.name,
              error,
            },
          );
        }
      }

      await logger.info("[BackupRestoreService] Widget profiles restored", {
        count: profiles.length,
      });
    } catch (error) {
      await logger.error(
        "[BackupRestoreService] Failed to restore widget profiles",
        {
          error,
        },
      );
      throw error;
    }
  }
}

export const backupRestoreService = BackupRestoreService.getInstance();
