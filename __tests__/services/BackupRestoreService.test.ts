import { backupRestoreService } from "@/services/backup/BackupRestoreService";

describe("BackupRestoreService - Encryption/Decryption", () => {
  it("should correctly encrypt and decrypt with matching keys", async () => {
    const testData = {
      settings: {
        state: {
          theme: "light",
          customTheme: {
            primary: "#1976d2",
          },
        },
      },
      serviceConfigs: [
        {
          id: "test-1",
          type: "sonarr",
          name: "My Sonarr",
          url: "http://localhost:8989",
          apiKey: "test-key-12345",
          enabled: true,
        },
      ],
    };

    const password = "TestPassword123!@#";

    // Test encryption
    const { encryptedData, salt } = await (
      backupRestoreService as any
    ).encryptSensitiveData(testData, password);

    expect(encryptedData).toBeDefined();
    expect(salt).toBeDefined();
    expect(encryptedData.length).toBeGreaterThan(0);

    // Test decryption with correct password
    const decryptedData = await backupRestoreService.decryptSensitiveData(
      encryptedData,
      password,
      salt,
      "",
    );

    // Verify the decrypted data matches original
    expect(decryptedData).toEqual(testData);
    expect(decryptedData.settings.state.theme).toBe("light");
    expect(decryptedData.serviceConfigs[0].apiKey).toBe("test-key-12345");
  });

  it("should fail decryption with wrong password", async () => {
    const testData = {
      settings: { state: { theme: "light" } },
      serviceConfigs: [],
    };

    const correctPassword = "CorrectPassword123";
    const wrongPassword = "WrongPassword456";

    const { encryptedData, salt } = await (
      backupRestoreService as any
    ).encryptSensitiveData(testData, correctPassword);

    // Attempt to decrypt with wrong password should fail
    await expect(
      backupRestoreService.decryptSensitiveData(
        encryptedData,
        wrongPassword,
        salt,
        "",
      ),
    ).rejects.toThrow(/incorrect password|Invalid JSON structure/i);
  });

  it("should handle large backup data correctly", async () => {
    const largeData = {
      settings: {
        state: {
          theme: "dark",
          customTheme: {
            primary: "#1976d2",
            secondary: "#dc004e",
            surface: "#121212",
          },
          preferences: {
            autoRefresh: true,
            refreshInterval: 300000,
            enableNotifications: true,
            logLevel: "info",
          },
        },
      },
      serviceConfigs: Array.from({ length: 5 }, (_, i) => ({
        id: `config-${i}`,
        type: ["sonarr", "radarr", "jellyseerr", "qbittorrent", "bazarr"][i],
        name: `Service ${i + 1}`,
        url: `http://localhost:${8000 + i * 1000}`,
        apiKey: `api-key-${i}-with-extra-content-to-increase-size`,
        username: `user-${i}`,
        password: `password-${i}-with-extra-security`,
        proxyUrl: `http://proxy:3128`,
        timeout: 30000,
        enabled: i % 2 === 0,
      })),
      tmdbCredentials: {
        apiKey: "tmdb-test-key-with-lots-of-characters",
      },
    };

    const password = "LongPasswordWithSpecialChars!@#$%^&*()";

    const { encryptedData, salt } = await (
      backupRestoreService as any
    ).encryptSensitiveData(largeData, password);

    const decryptedData = await backupRestoreService.decryptSensitiveData(
      encryptedData,
      password,
      salt,
      "",
    );

    // Deep equality check
    expect(decryptedData).toEqual(largeData);
    expect(decryptedData.serviceConfigs.length).toBe(5);
    expect(decryptedData.serviceConfigs[0].apiKey).toBe(
      "api-key-0-with-extra-content-to-increase-size",
    );
    expect(decryptedData.tmdbCredentials.apiKey).toContain("tmdb-test-key");
  });

  it("should handle special characters in passwords", async () => {
    const testData = {
      settings: { credentials: { password: "P@ssw0rd!#$%^&*()" } },
    };

    const passwords = [
      "P@ssw0rd!#$%^&*()",
      "你好世界123!@#",
      "émojis-🔐-🎯-💯",
      "Very-Long-Password-With-Many-Characters-To-Test-The-Key-Derivation-Process!@#$%",
    ];

    for (const password of passwords) {
      const { encryptedData, salt } = await (
        backupRestoreService as any
      ).encryptSensitiveData(testData, password);

      const decryptedData = await backupRestoreService.decryptSensitiveData(
        encryptedData,
        password,
        salt,
        "",
      );

      expect(decryptedData).toEqual(testData);
    }
  });
});

describe("BackupRestoreService - Backup Options", () => {
  it("should include new backup options in default export options", () => {
    const defaults = backupRestoreService.getDefaultExportOptions();

    expect(defaults.includeDownloadConfig).toBe(true);
    expect(defaults.includeServicesViewState).toBe(true);
    expect(defaults.includeSettings).toBe(true);
    expect(defaults.includeServiceConfigs).toBe(true);
    expect(defaults.includeNetworkHistory).toBe(true);
    expect(defaults.includeRecentIPs).toBe(true);
  });

  it("should include new backup options in selection config", () => {
    const config = backupRestoreService.getBackupSelectionConfig();

    expect(config.downloadConfig).toBeDefined();
    expect(config.downloadConfig.enabled).toBe(true);
    expect(config.downloadConfig.sensitive).toBe(false);

    expect(config.servicesViewState).toBeDefined();
    expect(config.servicesViewState.enabled).toBe(true);
    expect(config.servicesViewState.sensitive).toBe(false);
  });

  it("should validate export options correctly", () => {
    const validOptions = {
      includeSettings: true,
      includeServiceConfigs: false,
      includeServiceCredentials: false,
      includeTmdbCredentials: false,
      includeNetworkHistory: false,
      includeRecentIPs: false,
      includeDownloadConfig: true,
      includeServicesViewState: false,
      encryptSensitive: false,
    };

    const validation = backupRestoreService.validateExportOptions(validOptions);

    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  it("should detect invalid export options", () => {
    const invalidOptions = {
      includeSettings: false,
      includeServiceConfigs: false,
      includeServiceCredentials: false,
      includeTmdbCredentials: false,
      includeNetworkHistory: false,
      includeRecentIPs: false,
      includeDownloadConfig: false,
      includeServicesViewState: false,
      encryptSensitive: true,
      password: "test", // Too short
    };

    const validation =
      backupRestoreService.validateExportOptions(invalidOptions);

    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
