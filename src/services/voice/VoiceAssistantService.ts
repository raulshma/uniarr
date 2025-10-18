import { Platform } from "react-native";
import { secureStorage } from "../storage/SecureStorage";

// Types for voice assistant integration
export interface VoiceShortcut {
  id: string;
  title: string;
  subtitle?: string;
  phrase: string;
  action: string;
  parameters?: Record<string, any>;
  icon?: string;
  enabled: boolean;
  platform: "ios" | "android" | "both";
}

export interface VoiceCommand {
  command: string;
  action: string;
  parameters?: Record<string, any>;
  confidence?: number;
}

export interface VoiceAssistantConfig {
  enabled: boolean;
  shortcuts: VoiceShortcut[];
  naturalLanguageEnabled: boolean;
  voiceFeedback: boolean;
}

// Siri Shortcuts types (iOS)
export interface SiriShortcutActivity {
  activityType: string;
  title: string;
  suggestedPhrase?: string;
  userInfo?: Record<string, any>;
}

// Google Assistant types (Android)
export interface AppAction {
  action: string;
  intentName: string;
  parameters: {
    name: string;
    type: string;
  }[];
}

export class VoiceAssistantService {
  private static instance: VoiceAssistantService;
  private config: VoiceAssistantConfig;
  private shortcuts: Map<string, VoiceShortcut> = new Map();

  private constructor() {
    this.config = {
      enabled: false,
      shortcuts: [],
      naturalLanguageEnabled: true,
      voiceFeedback: true,
    };
    this.loadConfig();
  }

  static getInstance(): VoiceAssistantService {
    if (!VoiceAssistantService.instance) {
      VoiceAssistantService.instance = new VoiceAssistantService();
    }
    return VoiceAssistantService.instance;
  }

  // Configuration management
  async loadConfig(): Promise<void> {
    try {
      const stored = await secureStorage.getItem("voice_assistant_config");
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
      this.loadShortcuts();
    } catch (error) {
      console.error("Failed to load voice assistant config:", error);
    }
  }

  async saveConfig(): Promise<void> {
    try {
      await secureStorage.setItem(
        "voice_assistant_config",
        JSON.stringify(this.config),
      );
    } catch (error) {
      console.error("Failed to save voice assistant config:", error);
    }
  }

  async loadShortcuts(): Promise<void> {
    try {
      const stored = await secureStorage.getItem("voice_shortcuts");
      if (stored) {
        const shortcutsArray: VoiceShortcut[] = JSON.parse(stored);
        this.shortcuts.clear();
        shortcutsArray.forEach((shortcut) => {
          this.shortcuts.set(shortcut.id, shortcut);
        });
        this.config.shortcuts = shortcutsArray;
      }
    } catch (error) {
      console.error("Failed to load voice shortcuts:", error);
    }
  }

  async saveShortcuts(): Promise<void> {
    try {
      const shortcutsArray = Array.from(this.shortcuts.values());
      await secureStorage.setItem(
        "voice_shortcuts",
        JSON.stringify(shortcutsArray),
      );
      this.config.shortcuts = shortcutsArray;
      await this.saveConfig();
    } catch (error) {
      console.error("Failed to save voice shortcuts:", error);
    }
  }

  // Get current configuration
  getConfig(): VoiceAssistantConfig {
    return { ...this.config };
  }

  // Enable/disable voice assistant
  async setEnabled(enabled: boolean): Promise<void> {
    this.config.enabled = enabled;
    await this.saveConfig();

    if (enabled) {
      await this.initializeVoiceAssistant();
    } else {
      await this.cleanupVoiceAssistant();
    }
  }

  // Add a new voice shortcut
  async addShortcut(shortcut: Omit<VoiceShortcut, "id">): Promise<string> {
    const id = `shortcut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newShortcut: VoiceShortcut = {
      ...shortcut,
      id,
    };

    this.shortcuts.set(id, newShortcut);
    await this.saveShortcuts();

    // Register with platform-specific APIs
    await this.registerShortcutWithPlatform(newShortcut);

    return id;
  }

  // Remove a voice shortcut
  async removeShortcut(id: string): Promise<void> {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      this.shortcuts.delete(id);
      await this.saveShortcuts();

      // Unregister from platform-specific APIs
      await this.unregisterShortcutFromPlatform(shortcut);
    }
  }

  // Update a voice shortcut
  async updateShortcut(
    id: string,
    updates: Partial<VoiceShortcut>,
  ): Promise<void> {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      const updatedShortcut = { ...shortcut, ...updates };
      this.shortcuts.set(id, updatedShortcut);
      await this.saveShortcuts();

      // Update platform registration if needed
      if (updates.enabled !== undefined || updates.phrase !== undefined) {
        await this.updateShortcutWithPlatform(updatedShortcut);
      }
    }
  }

  // Get all shortcuts
  getShortcuts(): VoiceShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  // Get shortcuts for specific platform
  getShortcutsForPlatform(platform: "ios" | "android"): VoiceShortcut[] {
    return this.getShortcuts().filter(
      (shortcut) =>
        shortcut.platform === "both" || shortcut.platform === platform,
    );
  }

  // Platform-specific initialization
  private async initializeVoiceAssistant(): Promise<void> {
    if (Platform.OS === "ios") {
      await this.initializeSiriShortcuts();
    } else if (Platform.OS === "android") {
      await this.initializeGoogleAssistant();
    }
  }

  private async cleanupVoiceAssistant(): Promise<void> {
    if (Platform.OS === "ios") {
      await this.cleanupSiriShortcuts();
    } else if (Platform.OS === "android") {
      await this.cleanupGoogleAssistant();
    }
  }

  // Siri Shortcuts implementation (iOS)
  private async initializeSiriShortcuts(): Promise<void> {
    // Note: This requires native iOS code or Expo development build
    // For now, we'll provide the interface and note the requirement

    // Register all enabled iOS shortcuts
    const iosShortcuts = this.getShortcutsForPlatform("ios");
    for (const shortcut of iosShortcuts) {
      if (shortcut.enabled) {
        await this.registerShortcutWithPlatform(shortcut);
      }
    }
  }

  private async cleanupSiriShortcuts(): Promise<void> {}

  private async registerShortcutWithPlatform(
    shortcut: VoiceShortcut,
  ): Promise<void> {
    if (
      Platform.OS === "ios" &&
      (shortcut.platform === "ios" || shortcut.platform === "both")
    ) {
      await this.registerSiriShortcut(shortcut);
    } else if (
      Platform.OS === "android" &&
      (shortcut.platform === "android" || shortcut.platform === "both")
    ) {
      await this.registerGoogleAssistantAction(shortcut);
    }
  }

  private async unregisterShortcutFromPlatform(
    shortcut: VoiceShortcut,
  ): Promise<void> {
    if (
      Platform.OS === "ios" &&
      (shortcut.platform === "ios" || shortcut.platform === "both")
    ) {
      await this.unregisterSiriShortcut(shortcut);
    } else if (
      Platform.OS === "android" &&
      (shortcut.platform === "android" || shortcut.platform === "both")
    ) {
      await this.unregisterGoogleAssistantAction(shortcut);
    }
  }

  private async updateShortcutWithPlatform(
    shortcut: VoiceShortcut,
  ): Promise<void> {
    await this.unregisterShortcutFromPlatform(shortcut);
    if (shortcut.enabled) {
      await this.registerShortcutWithPlatform(shortcut);
    }
  }

  // Siri Shortcuts native methods (require native implementation)
  private async registerSiriShortcut(shortcut: VoiceShortcut): Promise<void> {
    // This would use react-native-siri-shortcut or native iOS code
    // For now, we'll log what would be registered
    // Example implementation would be:
    // const SiriShortcut = require('react-native-siri-shortcut');
    // await SiriShortcut.addShortcut({
    //   activityType: shortcut.id,
    //   title: shortcut.title,
    //   suggestedPhrase: shortcut.phrase,
    //   userInfo: shortcut.parameters,
    // });
  }

  private async unregisterSiriShortcut(shortcut: VoiceShortcut): Promise<void> {
    // Example: await SiriShortcut.deleteShortcut(shortcut.id);
  }

  // Google Assistant implementation (Android)
  private async initializeGoogleAssistant(): Promise<void> {
    // Register all enabled Android shortcuts
    const androidShortcuts = this.getShortcutsForPlatform("android");
    for (const shortcut of androidShortcuts) {
      if (shortcut.enabled) {
        await this.registerShortcutWithPlatform(shortcut);
      }
    }
  }

  private async cleanupGoogleAssistant(): Promise<void> {}

  private async registerGoogleAssistantAction(
    shortcut: VoiceShortcut,
  ): Promise<void> {
    // This requires Android App Actions configuration in AndroidManifest.xml
    // and shortcuts.xml resource file
    // Example implementation would involve:
    // 1. Adding intent filters to AndroidManifest.xml
    // 2. Creating shortcuts.xml with App Actions
    // 3. Using react-native-voice for voice recognition (optional)
  }

  private async unregisterGoogleAssistantAction(
    shortcut: VoiceShortcut,
  ): Promise<void> {}

  // Voice command processing
  async processVoiceCommand(command: string): Promise<VoiceCommand | null> {
    if (!this.config.enabled || !this.config.naturalLanguageEnabled) {
      return null;
    }

    // Simple pattern matching for common commands
    // In a real implementation, this would use NLP or ML models
    const normalizedCommand = command.toLowerCase().trim();

    // Media search commands
    if (
      normalizedCommand.includes("search for") ||
      normalizedCommand.includes("find")
    ) {
      const searchTerm = this.extractSearchTerm(normalizedCommand);
      if (searchTerm) {
        return {
          command: "search_media",
          action: "search",
          parameters: { query: searchTerm },
        };
      }
    }

    // Service status commands
    if (
      normalizedCommand.includes("service status") ||
      normalizedCommand.includes("check services")
    ) {
      return {
        command: "check_services",
        action: "get_service_status",
      };
    }

    // Download status commands
    if (
      normalizedCommand.includes("downloads") ||
      normalizedCommand.includes("downloading")
    ) {
      return {
        command: "check_downloads",
        action: "get_download_status",
      };
    }

    // Add media commands
    if (
      normalizedCommand.includes("add") &&
      (normalizedCommand.includes("series") ||
        normalizedCommand.includes("movie"))
    ) {
      const mediaName = this.extractMediaName(normalizedCommand);
      if (mediaName) {
        return {
          command: "add_media",
          action: "add_media",
          parameters: { name: mediaName },
        };
      }
    }

    // Request commands
    if (
      normalizedCommand.includes("request") ||
      normalizedCommand.includes("approve")
    ) {
      return {
        command: "manage_requests",
        action: "get_pending_requests",
      };
    }

    return null;
  }

  // Helper methods for command parsing
  private extractSearchTerm(command: string): string | null {
    const patterns = [/search for (.+)/i, /find (.+)/i, /look for (.+)/i];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private extractMediaName(command: string): string | null {
    const patterns = [/add (.+?)(?: to | series| movie|$)/i, /add (.+)/i];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  // Get available voice commands for the current context
  getAvailableCommands(): {
    phrase: string;
    description: string;
    action: string;
  }[] {
    return [
      {
        phrase: "Search for [movie/series name]",
        description: "Search for media across all services",
        action: "search_media",
      },
      {
        phrase: "Check service status",
        description: "Get status of all connected services",
        action: "check_services",
      },
      {
        phrase: "What's downloading?",
        description: "Check current download status",
        action: "check_downloads",
      },
      {
        phrase: "Add [movie/series name]",
        description: "Add media to your services",
        action: "add_media",
      },
      {
        phrase: "Check requests",
        description: "View pending Jellyseerr requests",
        action: "manage_requests",
      },
    ];
  }

  // Get platform-specific capabilities
  getPlatformCapabilities(): {
    siriShortcuts: boolean;
    googleAssistant: boolean;
    voiceRecognition: boolean;
  } {
    return {
      siriShortcuts: Platform.OS === "ios",
      googleAssistant: Platform.OS === "android",
      voiceRecognition: false, // Requires additional native implementation
    };
  }
}

export default VoiceAssistantService;
