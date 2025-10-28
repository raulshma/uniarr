import * as FileSystemLegacy from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import { logger } from "@/services/logger/LoggerService";
import { type Widget } from "@/services/widgets/WidgetService";

export interface WidgetProfile {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  createdAt: string;
  updatedAt: string;
  version: string;
}

class WidgetProfileService {
  private static instance: WidgetProfileService | null = null;
  private readonly PROFILES_DIR = `${FileSystemLegacy.documentDirectory}uniarr-widget-profiles/`;
  private readonly PROFILE_EXTENSION = ".json";

  static getInstance(): WidgetProfileService {
    if (!WidgetProfileService.instance) {
      WidgetProfileService.instance = new WidgetProfileService();
    }
    return WidgetProfileService.instance;
  }

  /**
   * Initialize profiles directory if it doesn't exist
   */
  private async ensureProfilesDirectory(): Promise<void> {
    try {
      const dirInfo = await FileSystemLegacy.getInfoAsync(this.PROFILES_DIR);
      if (!dirInfo.exists) {
        await FileSystemLegacy.makeDirectoryAsync(this.PROFILES_DIR, {
          intermediates: true,
        });
        logger.debug("[WidgetProfileService] Created profiles directory");
      }
    } catch (error) {
      logger.error(
        "[WidgetProfileService] Failed to ensure profiles directory",
        {
          error,
        },
      );
    }
  }

  /**
   * Save current widget configuration as a named profile
   */
  async saveProfile(
    name: string,
    widgets: Widget[],
    description?: string,
  ): Promise<WidgetProfile> {
    try {
      await this.ensureProfilesDirectory();

      const profile: WidgetProfile = {
        id: this.generateProfileId(name),
        name,
        description,
        widgets: JSON.parse(JSON.stringify(widgets)), // Deep copy
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: "1.0",
      };

      const filePath = `${this.PROFILES_DIR}${profile.id}${this.PROFILE_EXTENSION}`;
      await FileSystemLegacy.writeAsStringAsync(
        filePath,
        JSON.stringify(profile, null, 2),
      );

      await logger.info("[WidgetProfileService] Profile saved", {
        profileId: profile.id,
        profileName: name,
        widgetCount: widgets.length,
      });

      return profile;
    } catch (error) {
      await logger.error("[WidgetProfileService] Failed to save profile", {
        error,
        profileName: name,
      });
      throw error;
    }
  }

  /**
   * Load a profile by ID
   */
  async loadProfile(profileId: string): Promise<WidgetProfile> {
    try {
      const filePath = `${this.PROFILES_DIR}${profileId}${this.PROFILE_EXTENSION}`;
      const content = await FileSystemLegacy.readAsStringAsync(filePath);
      const profile: WidgetProfile = JSON.parse(content);

      await logger.info("[WidgetProfileService] Profile loaded", {
        profileId,
        profileName: profile.name,
        widgetCount: profile.widgets.length,
      });

      return profile;
    } catch (error) {
      await logger.error("[WidgetProfileService] Failed to load profile", {
        error,
        profileId,
      });
      throw error;
    }
  }

  /**
   * List all saved profiles
   */
  async listProfiles(): Promise<WidgetProfile[]> {
    try {
      await this.ensureProfilesDirectory();

      const files = await FileSystemLegacy.readDirectoryAsync(
        this.PROFILES_DIR,
      );
      const profileFiles = files.filter((f) =>
        f.endsWith(this.PROFILE_EXTENSION),
      );

      const profiles: WidgetProfile[] = [];
      for (const file of profileFiles) {
        try {
          const filePath = `${this.PROFILES_DIR}${file}`;
          const content = await FileSystemLegacy.readAsStringAsync(filePath);
          const profile: WidgetProfile = JSON.parse(content);
          profiles.push(profile);
        } catch (error) {
          await logger.warn(
            "[WidgetProfileService] Failed to read profile file",
            {
              file,
              error,
            },
          );
        }
      }

      // Sort by updatedAt descending (most recent first)
      profiles.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

      await logger.debug("[WidgetProfileService] Profiles listed", {
        count: profiles.length,
      });

      return profiles;
    } catch (error) {
      await logger.error("[WidgetProfileService] Failed to list profiles", {
        error,
      });
      return [];
    }
  }

  /**
   * Update an existing profile
   */
  async updateProfile(
    profileId: string,
    updates: Partial<Omit<WidgetProfile, "id" | "createdAt">>,
  ): Promise<WidgetProfile> {
    try {
      const profile = await this.loadProfile(profileId);

      const updatedProfile: WidgetProfile = {
        ...profile,
        ...updates,
        id: profile.id, // Ensure ID doesn't change
        createdAt: profile.createdAt, // Ensure created date doesn't change
        updatedAt: new Date().toISOString(),
      };

      const filePath = `${this.PROFILES_DIR}${profileId}${this.PROFILE_EXTENSION}`;
      await FileSystemLegacy.writeAsStringAsync(
        filePath,
        JSON.stringify(updatedProfile, null, 2),
      );

      await logger.info("[WidgetProfileService] Profile updated", {
        profileId,
        profileName: updatedProfile.name,
      });

      return updatedProfile;
    } catch (error) {
      await logger.error("[WidgetProfileService] Failed to update profile", {
        error,
        profileId,
      });
      throw error;
    }
  }

  /**
   * Rename a profile
   */
  async renameProfile(
    profileId: string,
    newName: string,
  ): Promise<WidgetProfile> {
    return this.updateProfile(profileId, { name: newName });
  }

  /**
   * Delete a profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    try {
      const filePath = `${this.PROFILES_DIR}${profileId}${this.PROFILE_EXTENSION}`;
      await FileSystemLegacy.deleteAsync(filePath);

      await logger.info("[WidgetProfileService] Profile deleted", {
        profileId,
      });
    } catch (error) {
      await logger.error("[WidgetProfileService] Failed to delete profile", {
        error,
        profileId,
      });
      throw error;
    }
  }

  /**
   * Export a profile as a portable JSON file
   */
  async exportProfile(profileId: string): Promise<void> {
    try {
      const profile = await this.loadProfile(profileId);
      const filePath = `${this.PROFILES_DIR}${profileId}${this.PROFILE_EXTENSION}`;

      // Share the file
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        throw new Error("Sharing is not available on this device");
      }

      await Sharing.shareAsync(filePath, {
        mimeType: "application/json",
        dialogTitle: `Export Widget Profile: ${profile.name}`,
        UTI: "public.json",
      });

      await logger.info("[WidgetProfileService] Profile exported", {
        profileId,
        profileName: profile.name,
      });
    } catch (error) {
      await logger.error("[WidgetProfileService] Failed to export profile", {
        error,
        profileId,
      });
      throw error;
    }
  }

  /**
   * Import a profile from a JSON file
   */
  async importProfile(): Promise<WidgetProfile> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        throw new Error("Profile import cancelled");
      }

      if (!result.assets || result.assets.length === 0) {
        throw new Error("No file selected");
      }

      const asset = result.assets[0];
      if (!asset) {
        throw new Error("Failed to get selected file");
      }

      const content = await FileSystemLegacy.readAsStringAsync(asset.uri);
      const profile: WidgetProfile = JSON.parse(content);

      // Validate profile structure
      if (
        !profile.id ||
        !profile.name ||
        !Array.isArray(profile.widgets) ||
        !profile.createdAt
      ) {
        throw new Error("Invalid widget profile structure");
      }

      // Check if profile with same ID already exists
      const existingProfiles = await this.listProfiles();
      const existingProfile = existingProfiles.find((p) => p.id === profile.id);

      if (existingProfile) {
        // Generate new ID to avoid conflicts
        profile.id = this.generateProfileId(`${profile.name} (imported)`);
      }

      // Save the imported profile
      const filePath = `${this.PROFILES_DIR}${profile.id}${this.PROFILE_EXTENSION}`;
      profile.updatedAt = new Date().toISOString();

      await FileSystemLegacy.writeAsStringAsync(
        filePath,
        JSON.stringify(profile, null, 2),
      );

      await logger.info("[WidgetProfileService] Profile imported", {
        profileId: profile.id,
        profileName: profile.name,
        widgetCount: profile.widgets.length,
      });

      return profile;
    } catch (error) {
      await logger.error("[WidgetProfileService] Failed to import profile", {
        error,
      });
      throw error;
    }
  }

  /**
   * Validate profile structure
   */
  async validateProfile(profile: any): Promise<boolean> {
    try {
      if (
        !profile ||
        typeof profile !== "object" ||
        !profile.id ||
        !profile.name ||
        !Array.isArray(profile.widgets) ||
        !profile.createdAt
      ) {
        return false;
      }

      // Validate each widget has required fields
      for (const widget of profile.widgets) {
        if (
          !widget.id ||
          !widget.type ||
          !widget.title ||
          typeof widget.enabled !== "boolean" ||
          typeof widget.order !== "number" ||
          !widget.size
        ) {
          return false;
        }
      }

      return true;
    } catch (error) {
      await logger.error("[WidgetProfileService] Profile validation failed", {
        error,
      });
      return false;
    }
  }

  /**
   * Get profile file size
   */
  async getProfileFileSize(profileId: string): Promise<number> {
    try {
      const filePath = `${this.PROFILES_DIR}${profileId}${this.PROFILE_EXTENSION}`;
      const fileInfo = await FileSystemLegacy.getInfoAsync(filePath);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        // For FileSystemLegacy, we get file size by reading the content length
        const content = await FileSystemLegacy.readAsStringAsync(filePath);
        return new Blob([content]).size;
      }
      return 0;
    } catch (error) {
      await logger.warn(
        "[WidgetProfileService] Failed to get profile file size",
        {
          error,
          profileId,
        },
      );
      return 0;
    }
  }

  /**
   * Generate a profile ID from a name (sanitized)
   */
  private generateProfileId(name: string): string {
    const timestamp = Date.now();
    const sanitizedName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
    return `profile-${sanitizedName}-${timestamp}`;
  }

  /**
   * Delete all profiles (for testing or reset)
   */
  async deleteAllProfiles(): Promise<void> {
    try {
      const profiles = await this.listProfiles();
      for (const profile of profiles) {
        await this.deleteProfile(profile.id);
      }
      await logger.info("[WidgetProfileService] All profiles deleted");
    } catch (error) {
      await logger.error(
        "[WidgetProfileService] Failed to delete all profiles",
        {
          error,
        },
      );
    }
  }
}

export const widgetProfileService = WidgetProfileService.getInstance();
export { WidgetProfileService };
