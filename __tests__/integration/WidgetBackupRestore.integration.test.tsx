import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { widgetProfileService } from "@/services/widgets/WidgetProfileService";
import { backupRestoreService } from "@/services/backup/BackupRestoreService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystemLegacy from "expo-file-system/legacy";

/**
 * Integration test for widget backup/restore functionality.
 * Validates that:
 * 1. Widget configurations survive full backup→restore cycles
 * 2. Custom widget profiles can be created, saved, and restored
 * 3. Widget cache is cleared on restore (fresh data on reload)
 * 4. Profile import/export works correctly
 * 5. Error handling for corrupted profiles
 */

describe("Widget Backup and Restore Integration", () => {
  beforeEach(async () => {
    // Clear AsyncStorage before each test
    await AsyncStorage.clear();

    // Reset WidgetService singleton
    (widgetService as any).isInitialized = false;
    (widgetService as any).widgets.clear();
    (widgetService as any).widgetData = {};

    // Clean up profiles directory
    try {
      const profilesDir = `${FileSystemLegacy.documentDirectory}uniarr-widget-profiles/`;
      const dirInfo = await FileSystemLegacy.getInfoAsync(profilesDir);
      if (dirInfo.exists) {
        const files = await FileSystemLegacy.readDirectoryAsync(profilesDir);
        for (const file of files) {
          try {
            await FileSystemLegacy.deleteAsync(`${profilesDir}${file}`);
          } catch (e) {
            // Ignore errors
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  });

  describe("Widget Backup and Restore", () => {
    it("should backup widget configuration with all properties", async () => {
      // Initialize and modify widgets
      await widgetService.initialize();

      // Get default widgets and modify
      const widgets = await widgetService.getWidgets();
      expect(widgets.length).toBeGreaterThan(0);

      // Enable and reconfigure a widget
      await widgetService.updateWidget(widgets[0]!.id, {
        enabled: true,
        size: "large",
        config: { testKey: "testValue" },
      });

      // Create backup
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.encryptSensitive = false;

      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);
      expect(backupFile).toBeDefined();

      // Read backup file
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      // Verify widgets are in backup
      expect(backupData.appData.widgetsConfig).toBeDefined();
      expect(Array.isArray(backupData.appData.widgetsConfig)).toBe(true);
      expect(backupData.appData.widgetsConfig.length).toBeGreaterThan(0);

      // Verify widget properties are preserved
      const backedUpWidget = backupData.appData.widgetsConfig[0];
      expect(backedUpWidget.id).toBeDefined();
      expect(backedUpWidget.type).toBeDefined();
      expect(backedUpWidget.title).toBeDefined();
      expect(backedUpWidget.enabled).toBeDefined();
      expect(backedUpWidget.order).toBeDefined();
      expect(backedUpWidget.size).toBeDefined();
    });

    it("should restore widget configuration and clear cache", async () => {
      // Initialize and set up initial state
      await widgetService.initialize();
      const initialWidgets = await widgetService.getWidgets();

      // Cache some data
      await widgetService.setWidgetData(initialWidgets[0]!.id, {
        cachedData: "should be cleared",
      });

      // Verify cache exists
      let cachedData = await widgetService.getWidgetData(initialWidgets[0]!.id);
      expect(cachedData).toBeDefined();

      // Create modified widgets array
      const modifiedWidgets = initialWidgets.map((w, idx) => ({
        ...w,
        enabled: !w.enabled,
        order: initialWidgets.length - idx - 1, // Reverse order
      }));

      // Restore widgets
      await widgetService.restoreWidgets(modifiedWidgets);

      // Verify widgets were restored with new properties
      const restoredWidgets = await widgetService.getWidgets();
      expect(restoredWidgets[0]?.id).toBe(
        modifiedWidgets[modifiedWidgets.length - 1]?.id,
      );
      expect(restoredWidgets[0]?.order).toBe(0);

      // Verify cache was cleared
      cachedData = await widgetService.getWidgetData(initialWidgets[0]!.id);
      expect(cachedData).toBeNull();
    });

    it("should round-trip full backup with widget configurations", async () => {
      // Initialize and modify
      await widgetService.initialize();
      let widgets = await widgetService.getWidgets();

      // Modify widget
      await widgetService.updateWidget(widgets[0]!.id, {
        enabled: !widgets[0]!.enabled,
        size: "large",
        config: { customKey: "customValue" },
      });

      // Store original state
      const originalWidgets = await widgetService.getWidgets();

      // Create backup
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);

      // Read and parse backup
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      // Reset widget service to simulate fresh app
      (widgetService as any).isInitialized = false;
      (widgetService as any).widgets.clear();
      (widgetService as any).widgetData = {};

      // Restore from backup
      await backupRestoreService.restoreBackup(backupData);

      // Verify restored state matches original
      const restoredWidgets = await widgetService.getWidgets();
      expect(restoredWidgets.length).toBe(originalWidgets.length);

      // Verify first widget properties match
      expect(restoredWidgets[0]!.enabled).toBe(originalWidgets[0]!.enabled);
      expect(restoredWidgets[0]!.size).toBe(originalWidgets[0]!.size);
      expect(restoredWidgets[0]!.config).toEqual(originalWidgets[0]!.config);
    });
  });

  describe("Widget Profiles", () => {
    it("should save a widget profile", async () => {
      // Initialize widgets
      await widgetService.initialize();
      const widgets = await widgetService.getWidgets();

      // Save profile
      const profile = await widgetProfileService.saveProfile(
        "Test Profile",
        widgets,
        "A test profile",
      );

      expect(profile.id).toBeDefined();
      expect(profile.name).toBe("Test Profile");
      expect(profile.description).toBe("A test profile");
      expect(profile.widgets).toEqual(widgets);
      expect(profile.createdAt).toBeDefined();
      expect(profile.updatedAt).toBeDefined();
    });

    it("should list saved profiles", async () => {
      // Initialize
      await widgetService.initialize();
      const widgets = await widgetService.getWidgets();

      // Save multiple profiles
      await widgetProfileService.saveProfile("Profile 1", widgets);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await widgetProfileService.saveProfile("Profile 2", widgets);

      // List profiles
      const profiles = await widgetProfileService.listProfiles();
      expect(profiles.length).toBe(2);
      expect(profiles[0]?.name).toBeDefined();
      expect(profiles[0]?.id).toBeDefined();
    });

    it("should load a profile by ID", async () => {
      // Initialize and save
      await widgetService.initialize();
      const widgets = await widgetService.getWidgets();
      const savedProfile = await widgetProfileService.saveProfile(
        "Load Test",
        widgets,
      );

      // Load profile
      const loadedProfile = await widgetProfileService.loadProfile(
        savedProfile.id,
      );

      expect(loadedProfile.id).toBe(savedProfile.id);
      expect(loadedProfile.name).toBe("Load Test");
      expect(loadedProfile.widgets).toEqual(widgets);
    });

    it("should rename a profile", async () => {
      // Initialize and save
      await widgetService.initialize();
      const widgets = await widgetService.getWidgets();
      const profile = await widgetProfileService.saveProfile(
        "Original Name",
        widgets,
      );

      // Rename
      const renamed = await widgetProfileService.renameProfile(
        profile.id,
        "New Name",
      );

      expect(renamed.name).toBe("New Name");
      expect(renamed.id).toBe(profile.id);

      // Verify persisted
      const loaded = await widgetProfileService.loadProfile(profile.id);
      expect(loaded.name).toBe("New Name");
    });

    it("should delete a profile", async () => {
      // Initialize and save
      await widgetService.initialize();
      const widgets = await widgetService.getWidgets();
      const profile = await widgetProfileService.saveProfile(
        "Delete Me",
        widgets,
      );

      // Verify it exists
      let profiles = await widgetProfileService.listProfiles();
      expect(profiles.length).toBe(1);

      // Delete
      await widgetProfileService.deleteProfile(profile.id);

      // Verify it's gone
      profiles = await widgetProfileService.listProfiles();
      expect(profiles.length).toBe(0);
    });

    it("should validate profile structure", async () => {
      const validProfile = {
        id: "test-1",
        name: "Valid Profile",
        widgets: [
          {
            id: "w1",
            type: "service-status",
            title: "Status",
            enabled: true,
            order: 0,
            size: "medium" as const,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const isValid = await widgetProfileService.validateProfile(validProfile);
      expect(isValid).toBe(true);

      // Invalid profile - missing widgets array
      const invalidProfile1 = { ...validProfile, widgets: undefined };
      const isValid1 =
        await widgetProfileService.validateProfile(invalidProfile1);
      expect(isValid1).toBe(false);

      // Invalid profile - missing required widget fields
      const invalidProfile2 = {
        ...validProfile,
        widgets: [{ id: "w1", type: "service-status" }],
      };
      const isValid2 =
        await widgetProfileService.validateProfile(invalidProfile2);
      expect(isValid2).toBe(false);
    });

    it("should update profile with new widget config", async () => {
      // Initialize and save
      await widgetService.initialize();
      const widgets = await widgetService.getWidgets();
      const profile = await widgetProfileService.saveProfile(
        "Update Test",
        widgets,
      );

      // Modify widgets
      const modifiedWidgets = widgets.map((w) => ({
        ...w,
        enabled: !w.enabled,
      }));

      // Update profile
      const updated = await widgetProfileService.updateProfile(profile.id, {
        widgets: modifiedWidgets,
        description: "Updated description",
      });

      expect(updated.widgets).toEqual(modifiedWidgets);
      expect(updated.description).toBe("Updated description");

      // Verify persisted
      const loaded = await widgetProfileService.loadProfile(profile.id);
      expect(loaded.widgets).toEqual(modifiedWidgets);
    });
  });

  describe("Profile Backup and Restore", () => {
    it("should include widget profiles in backup", async () => {
      // Initialize, create profiles
      await widgetService.initialize();
      const widgets = await widgetService.getWidgets();
      await widgetProfileService.saveProfile("Profile 1", widgets);
      await widgetProfileService.saveProfile("Profile 2", widgets);

      // Create backup with profiles
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetProfiles = true;
      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);

      // Read backup
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      // Verify profiles are in backup
      expect(backupData.appData.widgetProfiles).toBeDefined();
      expect(Array.isArray(backupData.appData.widgetProfiles)).toBe(true);
      expect(backupData.appData.widgetProfiles.length).toBeGreaterThanOrEqual(
        2,
      );
    });

    it("should restore widget profiles from backup", async () => {
      // Initialize and create profiles
      await widgetService.initialize();
      const widgets = await widgetService.getWidgets();
      const profile1 = await widgetProfileService.saveProfile(
        "Restore Test 1",
        widgets,
      );
      const profile2 = await widgetProfileService.saveProfile(
        "Restore Test 2",
        widgets,
      );

      // Create backup
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetProfiles = true;
      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);

      // Clean profiles directory
      await widgetProfileService.deleteAllProfiles();

      // Verify profiles are deleted
      let profiles = await widgetProfileService.listProfiles();
      expect(profiles.length).toBe(0);

      // Restore from backup
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);
      await backupRestoreService.restoreWidgetProfiles(
        backupData.appData.widgetProfiles,
      );

      // Verify profiles are restored
      profiles = await widgetProfileService.listProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(2);
      expect(profiles.some((p) => p.name === "Restore Test 1")).toBe(true);
      expect(profiles.some((p) => p.name === "Restore Test 2")).toBe(true);
    });
  });

  describe("Widget Credentials Backup and Restore", () => {
    it("should backup widget credentials from config", async () => {
      // Initialize and modify widgets with credentials
      await widgetService.initialize();
      const widgets = await widgetService.getWidgets();

      if (widgets.length > 0) {
        await widgetService.updateWidget(widgets[0]!.id, {
          config: {
            apiKey: "test-api-key-123",
            username: "testuser",
            password: "testpass",
            customData: "some value",
          },
        });
      }

      // Create backup with credentials
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetConfigCredentials = true;
      backupOptions.encryptSensitive = false;

      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);
      expect(backupFile).toBeDefined();

      // Read backup file
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      // Verify credentials are in backup
      expect(backupData.appData.widgetsCredentials).toBeDefined();
      expect(typeof backupData.appData.widgetsCredentials).toBe("object");
      expect(
        Object.keys(backupData.appData.widgetsCredentials).length,
      ).toBeGreaterThan(0);

      // Verify credential data is preserved
      const widgetId = widgets[0]!.id;
      const credentials = backupData.appData.widgetsCredentials[widgetId];
      expect(credentials).toBeDefined();
      expect(credentials.apiKey).toBe("test-api-key-123");
      expect(credentials.username).toBe("testuser");
    });

    it("should not backup widget credentials when disabled", async () => {
      // Initialize and modify widgets with credentials
      await widgetService.initialize();
      const widgets = await widgetService.getWidgets();

      if (widgets.length > 0) {
        await widgetService.updateWidget(widgets[0]!.id, {
          config: {
            apiKey: "test-api-key-123",
          },
        });
      }

      // Create backup without credentials
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetConfigCredentials = false;

      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);

      // Read backup file
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      // Verify credentials are NOT in backup
      expect(
        backupData.appData.widgetsCredentials === undefined ||
          Object.keys(backupData.appData.widgetsCredentials).length === 0,
      ).toBe(true);
    });

    it("should encrypt widget credentials when encryptSensitive is true", async () => {
      // Initialize and modify widgets with credentials
      await widgetService.initialize();
      const widgets = await widgetService.getWidgets();

      if (widgets.length > 0) {
        await widgetService.updateWidget(widgets[0]!.id, {
          config: {
            apiKey: "secret-key-456",
            token: "secret-token",
          },
        });
      }

      // Create encrypted backup with credentials
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetConfigCredentials = true;
      backupOptions.encryptSensitive = true;

      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);

      // Read backup file
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      // Verify credentials are in encrypted data, not plain
      expect(backupData.appData.encryptedData).toBeDefined();
      expect(backupData.appData.widgetsCredentials).toBeUndefined();
    });

    it("should restore widget credentials to widget config", async () => {
      // Initialize and create widget with credentials
      await widgetService.initialize();
      const widgets = await widgetService.getWidgets();

      if (widgets.length > 0) {
        const widgetId = widgets[0]!.id;
        await widgetService.updateWidget(widgetId, {
          config: {
            originalKey: "original-value",
            apiKey: "secret-123",
          },
        });

        // Create backup with credentials
        const backupOptions = backupRestoreService.getDefaultExportOptions();
        backupOptions.includeWidgetsConfig = true;
        backupOptions.includeWidgetConfigCredentials = true;
        backupOptions.encryptSensitive = false;

        const backupFile =
          await backupRestoreService.createSelectiveBackup(backupOptions);

        // Clear widgets data
        await AsyncStorage.removeItem("WidgetService:widgets");
        (widgetService as any).widgets.clear();

        // Restore from backup
        const backupContent =
          await FileSystemLegacy.readAsStringAsync(backupFile);
        const backupData = JSON.parse(backupContent);
        await backupRestoreService.restoreBackup(backupData);

        // Verify credentials are restored
        const restoredWidgetsData = await AsyncStorage.getItem(
          "WidgetService:widgets",
        );
        expect(restoredWidgetsData).toBeDefined();

        if (restoredWidgetsData) {
          const restoredWidgets = JSON.parse(restoredWidgetsData);
          const restoredWidget = restoredWidgets.find(
            (w: any) => w.id === widgetId,
          );
          expect(restoredWidget).toBeDefined();
          expect(restoredWidget.config.apiKey).toBe("secret-123");
          expect(restoredWidget.config.originalKey).toBe("original-value");
        }
      }
    });
  });
});
