import { backupRestoreService } from "@/services/backup/BackupRestoreService";
import { widgetCredentialService } from "@/services/widgets/WidgetCredentialService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystemLegacy from "expo-file-system/legacy";

/**
 * Integration test for widget secure credential backup/restore functionality.
 * Validates that:
 * 1. Widget credentials from SecureStore are backed up correctly
 * 2. Credentials are encrypted when encryption is enabled
 * 3. Credentials are restored from encrypted backups with correct password
 * 4. Wrong password decryption fails gracefully
 * 5. All widget credentials are preserved through backup/restore cycle
 */

describe("Widget Secure Credential Backup and Restore Integration", () => {
  beforeEach(async () => {
    // Clear AsyncStorage before each test
    await AsyncStorage.clear();

    // Clean up any existing test backup files
    try {
      const files = await FileSystemLegacy.readDirectoryAsync(
        FileSystemLegacy.documentDirectory!,
      );
      for (const file of files) {
        if (file.includes("uniarr-backup")) {
          try {
            await FileSystemLegacy.deleteAsync(
              `${FileSystemLegacy.documentDirectory}${file}`,
            );
          } catch {
            // Ignore errors
          }
        }
      }
    } catch {
      // Ignore errors
    }
  });

  describe("Widget Secure Credential Collection", () => {
    it("should backup widget secure credentials when option enabled", async () => {
      // Set up test credentials for multiple widgets
      const testCredentials = {
        youtube: { apiKey: "youtube-test-key-12345" },
        twitch: { clientId: "twitch-id-67890", clientSecret: "twitch-secret" },
        rss: { apiKey: "rss-feed-key" },
      };

      // Store credentials
      for (const [widgetId, credentials] of Object.entries(testCredentials)) {
        await widgetCredentialService.setCredentials(widgetId, credentials);
      }

      // Create backup with secure credentials included
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetSecureCredentials = true;
      backupOptions.encryptSensitive = false;

      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);
      expect(backupFile).toBeDefined();

      // Read backup file
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      // Verify widget secure credentials are in backup
      expect(backupData.appData.widgetSecureCredentials).toBeDefined();
      expect(typeof backupData.appData.widgetSecureCredentials).toBe("object");

      // Verify all credentials are present
      expect(backupData.appData.widgetSecureCredentials.youtube).toEqual({
        apiKey: "youtube-test-key-12345",
      });
      expect(backupData.appData.widgetSecureCredentials.twitch).toEqual({
        clientId: "twitch-id-67890",
        clientSecret: "twitch-secret",
      });
      expect(backupData.appData.widgetSecureCredentials.rss).toEqual({
        apiKey: "rss-feed-key",
      });
    });

    it("should exclude widget secure credentials when option disabled", async () => {
      // Set up test credentials
      await widgetCredentialService.setCredentials("youtube", {
        apiKey: "test-key",
      });

      // Create backup without secure credentials
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetSecureCredentials = false;
      backupOptions.encryptSensitive = false;

      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      // Verify widget secure credentials are NOT in backup
      expect(backupData.appData.widgetSecureCredentials).toBeUndefined();
    });

    it("should handle empty credentials gracefully", async () => {
      // Don't set any credentials

      // Create backup with secure credentials included
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetSecureCredentials = true;
      backupOptions.encryptSensitive = false;

      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      // widgetSecureCredentials should be undefined or empty
      expect(
        backupData.appData.widgetSecureCredentials === undefined ||
          Object.keys(backupData.appData.widgetSecureCredentials).length === 0,
      ).toBe(true);
    });
  });

  describe("Widget Secure Credential Encryption", () => {
    it("should encrypt widget secure credentials when encryptSensitive enabled", async () => {
      // Set up test credentials
      await widgetCredentialService.setCredentials("youtube", {
        apiKey: "youtube-secret-key-12345",
      });

      // Create encrypted backup
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetSecureCredentials = true;
      backupOptions.encryptSensitive = true;
      backupOptions.password = "test-password-123";

      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      // Verify encryption metadata
      expect(backupData.encrypted).toBe(true);
      expect(backupData.encryptionInfo).toBeDefined();
      expect(backupData.encryptionInfo.algorithm).toBe("XOR-PBKDF2");
      expect(backupData.encryptionInfo.salt).toBeDefined();
      expect(backupData.encryptionInfo.iv).toBeDefined();

      // Verify encrypted data contains the credentials (encrypted)
      expect(backupData.appData.encryptedData).toBeDefined();
      expect(typeof backupData.appData.encryptedData).toBe("string");

      // Verify plain JSON doesn't contain credentials
      expect(backupData.appData.widgetSecureCredentials).toBeUndefined();
    });

    it("should store widget credentials in plain JSON when encryption disabled", async () => {
      // Set up test credentials
      const testCreds = { apiKey: "plain-text-key" };
      await widgetCredentialService.setCredentials("twitch", testCreds);

      // Create unencrypted backup
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetSecureCredentials = true;
      backupOptions.encryptSensitive = false;

      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      // Verify credentials are in plain JSON
      expect(backupData.appData.widgetSecureCredentials).toBeDefined();
      expect(backupData.appData.widgetSecureCredentials.twitch).toEqual(
        testCreds,
      );
      expect(backupData.encrypted).not.toBe(true);
      expect(backupData.appData.encryptedData).toBeUndefined();
    });
  });

  describe("Widget Secure Credential Restore", () => {
    it("should restore plain widget secure credentials", async () => {
      // Set up initial credentials
      const originalCreds = {
        youtube: { apiKey: "youtube-key-original" },
        twitch: { clientId: "twitch-client-original" },
      };

      for (const [widgetId, creds] of Object.entries(originalCreds)) {
        await widgetCredentialService.setCredentials(widgetId, creds);
      }

      // Create backup
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetSecureCredentials = true;
      backupOptions.encryptSensitive = false;

      await backupRestoreService.createSelectiveBackup(backupOptions);

      // Clear credentials
      await widgetCredentialService.removeCredentials("youtube");
      await widgetCredentialService.removeCredentials("twitch");

      // Verify they're cleared
      const retrievedCreds =
        await widgetCredentialService.getCredentials("youtube");
      expect(retrievedCreds).toBeNull();

      // Restore backup
      await backupRestoreService.selectAndRestoreBackup();

      // Verify credentials are restored
      const restoredYouTube =
        await widgetCredentialService.getCredentials("youtube");
      const restoredTwitch =
        await widgetCredentialService.getCredentials("twitch");

      expect(restoredYouTube).toEqual(originalCreds.youtube);
      expect(restoredTwitch).toEqual(originalCreds.twitch);
    });

    it("should restore encrypted widget secure credentials with correct password", async () => {
      // Set up initial credentials
      const originalCreds = {
        youtube: { apiKey: "encrypted-youtube-key" },
      };

      await widgetCredentialService.setCredentials(
        "youtube",
        originalCreds.youtube,
      );

      // Create encrypted backup
      const password = "secure-password-456";
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetSecureCredentials = true;
      backupOptions.encryptSensitive = true;
      backupOptions.password = password;

      await backupRestoreService.createSelectiveBackup(backupOptions);

      // Clear credentials
      await widgetCredentialService.removeCredentials("youtube");

      // Restore encrypted backup with correct password
      await backupRestoreService.selectAndRestoreEncryptedBackup(password);

      // Verify credentials are restored
      const restoredCreds =
        await widgetCredentialService.getCredentials("youtube");
      expect(restoredCreds).toEqual(originalCreds.youtube);
    });

    it("should fail gracefully with wrong password", async () => {
      // Set up credentials
      await widgetCredentialService.setCredentials("youtube", {
        apiKey: "test-key",
      });

      // Create encrypted backup
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetSecureCredentials = true;
      backupOptions.encryptSensitive = true;
      backupOptions.password = "correct-password";

      await backupRestoreService.createSelectiveBackup(backupOptions);

      // Try to restore with wrong password
      const wrongPasswordRestore = async () => {
        await backupRestoreService.selectAndRestoreEncryptedBackup(
          "wrong-password",
        );
      };

      // Should throw error or handle gracefully
      await expect(wrongPasswordRestore).rejects.toThrow();
    });

    it("should restore multiple widget credentials in single operation", async () => {
      // Set up multiple credentials
      const credentials = {
        youtube: { apiKey: "yt-api-key", channelId: "yt-channel-id" },
        twitch: { clientId: "twitch-id", clientSecret: "twitch-secret" },
        rss: { feedUrl: "rss-feed-url", username: "rss-user" },
      };

      for (const [widgetId, creds] of Object.entries(credentials)) {
        await widgetCredentialService.setCredentials(widgetId, creds);
      }

      // Create backup
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetSecureCredentials = true;
      backupOptions.encryptSensitive = false;

      await backupRestoreService.createSelectiveBackup(backupOptions);

      // Clear all credentials
      for (const widgetId of Object.keys(credentials)) {
        await widgetCredentialService.removeCredentials(widgetId);
      }

      // Restore
      await backupRestoreService.selectAndRestoreBackup();

      // Verify all are restored
      for (const [widgetId, expectedCreds] of Object.entries(credentials)) {
        const restored = await widgetCredentialService.getCredentials(widgetId);
        expect(restored).toEqual(expectedCreds);
      }
    });

    it("should merge with existing credentials during restore", async () => {
      // Set up initial credentials
      const initialCreds = { youtube: { apiKey: "initial-key" } };
      await widgetCredentialService.setCredentials(
        "youtube",
        initialCreds.youtube,
      );

      // Create backup with different credentials
      const backupCreds = { youtube: { apiKey: "backup-key" } };
      await widgetCredentialService.setCredentials(
        "youtube",
        backupCreds.youtube,
      );

      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetSecureCredentials = true;
      backupOptions.encryptSensitive = false;

      await backupRestoreService.createSelectiveBackup(backupOptions);

      // Restore should replace with backup credentials
      await backupRestoreService.selectAndRestoreBackup();

      const restored = await widgetCredentialService.getCredentials("youtube");
      expect(restored).toEqual(backupCreds.youtube);
    });
  });

  describe("Widget Credential Backup Edge Cases", () => {
    it("should handle credentials with special characters", async () => {
      const specialCharsCreds = {
        apiKey: "special!@#$%^&*()_+-=[]{}|;:'\",.<?/`~chars",
        secretKey: "multi\nline\nkey",
        token: '{"json": "value"}',
      };

      await widgetCredentialService.setCredentials(
        "special-widget",
        specialCharsCreds,
      );

      // Backup and restore
      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetSecureCredentials = true;
      backupOptions.encryptSensitive = false;

      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);

      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      // Verify special characters are preserved
      expect(
        backupData.appData.widgetSecureCredentials["special-widget"],
      ).toEqual(specialCharsCreds);
    });

    it("should handle credentials with empty values", async () => {
      const emptyCreds = {
        apiKey: "",
        token: "",
        username: "user",
      };

      await widgetCredentialService.setCredentials("widget-empty", emptyCreds);

      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetSecureCredentials = true;
      backupOptions.encryptSensitive = false;

      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      // Empty values should be preserved
      expect(
        backupData.appData.widgetSecureCredentials["widget-empty"],
      ).toEqual(emptyCreds);
    });

    it("should handle very large credential values", async () => {
      const largeCreds = {
        largeApiKey: "x".repeat(10000),
        token: "y".repeat(5000),
      };

      await widgetCredentialService.setCredentials("large-widget", largeCreds);

      const backupOptions = backupRestoreService.getDefaultExportOptions();
      backupOptions.includeWidgetsConfig = true;
      backupOptions.includeWidgetSecureCredentials = true;
      backupOptions.encryptSensitive = false;

      const backupFile =
        await backupRestoreService.createSelectiveBackup(backupOptions);
      const backupContent =
        await FileSystemLegacy.readAsStringAsync(backupFile);
      const backupData = JSON.parse(backupContent);

      expect(
        backupData.appData.widgetSecureCredentials["large-widget"],
      ).toEqual(largeCreds);
    });
  });
});
