import { useState, useEffect, useCallback } from "react";
import { VoiceAssistantService } from "../services/voice";
import type {
  VoiceShortcut,
  VoiceAssistantConfig,
} from "../services/voice/VoiceAssistantService";

export interface UseVoiceAssistantReturn {
  // Configuration
  config: VoiceAssistantConfig;
  isEnabled: boolean;
  isLoading: boolean;

  // Platform capabilities
  platformCapabilities: {
    siriShortcuts: boolean;
    googleAssistant: boolean;
    voiceRecognition: boolean;
  };

  // Shortcuts management
  shortcuts: VoiceShortcut[];
  addShortcut: (shortcut: Omit<VoiceShortcut, "id">) => Promise<string>;
  removeShortcut: (id: string) => Promise<void>;
  updateShortcut: (
    id: string,
    updates: Partial<VoiceShortcut>,
  ) => Promise<void>;

  // Voice command processing
  processVoiceCommand: (command: string) => Promise<any>;

  // Available commands for UI
  availableCommands: {
    phrase: string;
    description: string;
    action: string;
  }[];

  // Actions
  setEnabled: (enabled: boolean) => Promise<void>;
  refreshConfig: () => Promise<void>;
}

export const useVoiceAssistant = (): UseVoiceAssistantReturn => {
  const [voiceService] = useState(() => VoiceAssistantService.getInstance());
  const [config, setConfig] = useState<VoiceAssistantConfig>(
    voiceService.getConfig(),
  );
  const [shortcuts, setShortcuts] = useState<VoiceShortcut[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await voiceService.loadConfig();
        setConfig(voiceService.getConfig());
        setShortcuts(voiceService.getShortcuts());
      } catch (error) {
        console.error("Failed to load voice assistant data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [voiceService]);

  // Refresh configuration
  const refreshConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      await voiceService.loadConfig();
      setConfig(voiceService.getConfig());
      setShortcuts(voiceService.getShortcuts());
    } catch (error) {
      console.error("Failed to refresh voice assistant config:", error);
    } finally {
      setIsLoading(false);
    }
  }, [voiceService]);

  // Set enabled state
  const setEnabled = useCallback(
    async (enabled: boolean) => {
      setIsLoading(true);
      try {
        await voiceService.setEnabled(enabled);
        setConfig(voiceService.getConfig());
      } catch (error) {
        console.error("Failed to set voice assistant enabled state:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [voiceService],
  );

  // Add shortcut
  const addShortcut = useCallback(
    async (shortcut: Omit<VoiceShortcut, "id">) => {
      try {
        const id = await voiceService.addShortcut(shortcut);
        setShortcuts(voiceService.getShortcuts());
        return id;
      } catch (error) {
        console.error("Failed to add voice shortcut:", error);
        throw error;
      }
    },
    [voiceService],
  );

  // Remove shortcut
  const removeShortcut = useCallback(
    async (id: string) => {
      try {
        await voiceService.removeShortcut(id);
        setShortcuts(voiceService.getShortcuts());
      } catch (error) {
        console.error("Failed to remove voice shortcut:", error);
        throw error;
      }
    },
    [voiceService],
  );

  // Update shortcut
  const updateShortcut = useCallback(
    async (id: string, updates: Partial<VoiceShortcut>) => {
      try {
        await voiceService.updateShortcut(id, updates);
        setShortcuts(voiceService.getShortcuts());
      } catch (error) {
        console.error("Failed to update voice shortcut:", error);
        throw error;
      }
    },
    [voiceService],
  );

  // Process voice command
  const processVoiceCommand = useCallback(
    async (command: string) => {
      try {
        return await voiceService.processVoiceCommand(command);
      } catch (error) {
        console.error("Failed to process voice command:", error);
        throw error;
      }
    },
    [voiceService],
  );

  return {
    config,
    isEnabled: config.enabled,
    isLoading,
    platformCapabilities: voiceService.getPlatformCapabilities(),
    shortcuts,
    addShortcut,
    removeShortcut,
    updateShortcut,
    processVoiceCommand,
    availableCommands: voiceService.getAvailableCommands(),
    setEnabled,
    refreshConfig,
  };
};

export default useVoiceAssistant;
