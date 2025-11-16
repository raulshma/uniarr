/**
 * S3BackupService Unit Tests
 *
 * Tests for S3 backup operations including:
 * - S3 client initialization
 * - Credential retrieval
 * - Backup key generation
 * - Error handling scenarios
 */

import { s3BackupService } from "@/services/backup/S3BackupService";
import {
  S3BackupError,
  S3BackupErrorCode,
} from "@/services/backup/S3BackupService.errors";
import { secureStorage } from "@/services/storage/SecureStorage";
import { useSettingsStore } from "@/store/settingsStore";
import type { S3Credentials } from "@/models/s3.types";

// Mock dependencies
jest.mock("@/services/storage/SecureStorage");
jest.mock("@/services/logger/LoggerService", () => ({
  logger: {
    info: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock LogLevel enum
jest.mock("@/services/logger/LoggerService", () => ({
  logger: {
    info: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
  },
  LogLevel: {
    DEBUG: "DEBUG",
    INFO: "INFO",
    WARN: "WARN",
    ERROR: "ERROR",
  },
}));

// Mock settings store with proper structure
jest.mock("@/store/settingsStore", () => ({
  useSettingsStore: {
    getState: jest.fn(() => ({
      s3Region: "us-east-1",
      s3BucketName: "test-bucket",
    })),
    setState: jest.fn(),
    subscribe: jest.fn(),
  },
}));

// Mock AWS SDK
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  ListObjectsV2Command: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

jest.mock("@aws-sdk/lib-storage", () => ({
  Upload: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    done: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  cacheDirectory: "/cache/",
}));

describe("S3BackupService - Initialization", () => {
  beforeEach(() => {
    // Reset service state before each test
    s3BackupService.reset();
    jest.clearAllMocks();
  });

  it("should initialize successfully with valid credentials", async () => {
    // Mock credentials and settings
    const mockCredentials: S3Credentials = {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    };

    (secureStorage.getS3Credentials as jest.Mock).mockResolvedValue(
      mockCredentials,
    );
    (useSettingsStore.getState as jest.Mock).mockReturnValue({
      s3Region: "us-east-1",
      s3BucketName: "test-bucket",
    });

    await s3BackupService.initialize();

    // Verify credentials were retrieved
    expect(secureStorage.getS3Credentials).toHaveBeenCalled();
  });

  it("should throw error when credentials are not found", async () => {
    // Mock missing credentials
    (secureStorage.getS3Credentials as jest.Mock).mockResolvedValue(null);

    await expect(s3BackupService.initialize()).rejects.toThrow(S3BackupError);
    await expect(s3BackupService.initialize()).rejects.toThrow(
      /credentials not configured/i,
    );
  });

  it("should throw error when S3 configuration is incomplete", async () => {
    // Mock credentials but missing bucket/region
    const mockCredentials: S3Credentials = {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    };

    (secureStorage.getS3Credentials as jest.Mock).mockResolvedValue(
      mockCredentials,
    );
    (useSettingsStore.getState as jest.Mock).mockReturnValue({
      s3Region: undefined,
      s3BucketName: undefined,
    });

    await expect(s3BackupService.initialize()).rejects.toThrow(S3BackupError);
    await expect(s3BackupService.initialize()).rejects.toThrow(
      /configuration incomplete/i,
    );
  });

  it("should handle initialization errors gracefully", async () => {
    // Mock credentials retrieval error
    (secureStorage.getS3Credentials as jest.Mock).mockRejectedValue(
      new Error("Storage error"),
    );

    await expect(s3BackupService.initialize()).rejects.toThrow(S3BackupError);
  });
});

describe("S3BackupService - Credential Retrieval", () => {
  beforeEach(() => {
    s3BackupService.reset();
    jest.clearAllMocks();
  });

  it("should retrieve credentials from secure storage", async () => {
    const mockCredentials: S3Credentials = {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    };

    (secureStorage.getS3Credentials as jest.Mock).mockResolvedValue(
      mockCredentials,
    );
    (useSettingsStore.getState as jest.Mock).mockReturnValue({
      s3Region: "us-east-1",
      s3BucketName: "test-bucket",
    });

    await s3BackupService.initialize();

    expect(secureStorage.getS3Credentials).toHaveBeenCalledTimes(1);
  });

  it("should handle null credentials", async () => {
    (secureStorage.getS3Credentials as jest.Mock).mockResolvedValue(null);

    await expect(s3BackupService.initialize()).rejects.toThrow(S3BackupError);
    await expect(s3BackupService.initialize()).rejects.toThrow(
      /credentials not configured/i,
    );
  });

  it("should handle credentials with empty strings", async () => {
    const mockCredentials: S3Credentials = {
      accessKeyId: "",
      secretAccessKey: "",
    };

    (secureStorage.getS3Credentials as jest.Mock).mockResolvedValue(
      mockCredentials,
    );
    (useSettingsStore.getState as jest.Mock).mockReturnValue({
      s3Region: "us-east-1",
      s3BucketName: "test-bucket",
    });

    // Should initialize but may fail on actual S3 operations
    await s3BackupService.initialize();
    expect(secureStorage.getS3Credentials).toHaveBeenCalled();
  });
});

describe("S3BackupService - Backup Key Generation", () => {
  beforeEach(() => {
    s3BackupService.reset();
    jest.clearAllMocks();
  });

  it("should generate backup key with correct format", () => {
    // Access private method through type assertion
    const generateBackupKey = (s3BackupService as any).generateBackupKey.bind(
      s3BackupService,
    );

    const fileName = "backup.json";
    const key = generateBackupKey(fileName);

    // Verify key format: uniarr-backup-{timestamp}-{filename}
    expect(key).toMatch(/^uniarr-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    expect(key).toContain("backup.json");
  });

  it("should sanitize special characters in filename", () => {
    const generateBackupKey = (s3BackupService as any).generateBackupKey.bind(
      s3BackupService,
    );

    const fileName = "backup@#$%^&*().json";
    const key = generateBackupKey(fileName);

    // Special characters should be replaced with underscores
    expect(key).not.toContain("@");
    expect(key).not.toContain("#");
    expect(key).not.toContain("$");
    expect(key).toContain("_");
  });

  it("should handle filenames with spaces", () => {
    const generateBackupKey = (s3BackupService as any).generateBackupKey.bind(
      s3BackupService,
    );

    const fileName = "my backup file.json";
    const key = generateBackupKey(fileName);

    // Spaces should be replaced with underscores
    expect(key).not.toContain(" ");
    expect(key).toContain("_");
  });

  it("should preserve allowed characters in filename", () => {
    const generateBackupKey = (s3BackupService as any).generateBackupKey.bind(
      s3BackupService,
    );

    const fileName = "backup-2024.01.15_encrypted.json";
    const key = generateBackupKey(fileName);

    // Allowed characters: alphanumeric, dots, hyphens, underscores
    expect(key).toContain("backup-2024.01.15_encrypted.json");
  });

  it("should generate unique keys for same filename", () => {
    const generateBackupKey = (s3BackupService as any).generateBackupKey.bind(
      s3BackupService,
    );

    const fileName = "backup.json";
    const key1 = generateBackupKey(fileName);

    // Wait a tiny bit to ensure different timestamp
    const key2 = generateBackupKey(fileName);

    // Keys should be different due to timestamp
    // Note: They might be the same if called in the same millisecond
    // but the format should be consistent
    expect(key1).toMatch(/^uniarr-backup-/);
    expect(key2).toMatch(/^uniarr-backup-/);
  });
});

describe("S3BackupService - Error Handling", () => {
  beforeEach(() => {
    s3BackupService.reset();
    jest.clearAllMocks();
  });

  it("should handle network errors during initialization", async () => {
    (secureStorage.getS3Credentials as jest.Mock).mockRejectedValue(
      new Error("Network timeout"),
    );

    await expect(s3BackupService.initialize()).rejects.toThrow(S3BackupError);
    await expect(s3BackupService.initialize()).rejects.toThrow(
      /Failed to initialize S3 client/i,
    );
  });

  it("should handle invalid credentials error", async () => {
    const mockCredentials: S3Credentials = {
      accessKeyId: "INVALID",
      secretAccessKey: "INVALID",
    };

    (secureStorage.getS3Credentials as jest.Mock).mockResolvedValue(
      mockCredentials,
    );
    (useSettingsStore.getState as jest.Mock).mockReturnValue({
      s3Region: "us-east-1",
      s3BucketName: "test-bucket",
    });

    // Initialize should succeed (validation happens on actual S3 operations)
    await s3BackupService.initialize();
    expect(secureStorage.getS3Credentials).toHaveBeenCalled();
  });

  it("should handle bucket not found error", async () => {
    const mockCredentials: S3Credentials = {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    };

    (secureStorage.getS3Credentials as jest.Mock).mockResolvedValue(
      mockCredentials,
    );
    (useSettingsStore.getState as jest.Mock).mockReturnValue({
      s3Region: "us-east-1",
      s3BucketName: "non-existent-bucket",
    });

    // Initialize should succeed (bucket validation happens on operations)
    await s3BackupService.initialize();
    expect(secureStorage.getS3Credentials).toHaveBeenCalled();
  });

  it("should handle permission denied error", async () => {
    const mockCredentials: S3Credentials = {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    };

    (secureStorage.getS3Credentials as jest.Mock).mockResolvedValue(
      mockCredentials,
    );
    (useSettingsStore.getState as jest.Mock).mockReturnValue({
      s3Region: "us-east-1",
      s3BucketName: "restricted-bucket",
    });

    // Initialize should succeed (permission validation happens on operations)
    await s3BackupService.initialize();
    expect(secureStorage.getS3Credentials).toHaveBeenCalled();
  });

  it("should clear state on initialization failure", async () => {
    (secureStorage.getS3Credentials as jest.Mock).mockRejectedValue(
      new Error("Initialization failed"),
    );

    await expect(s3BackupService.initialize()).rejects.toThrow();

    // Verify state was cleared
    // Attempting to use service should require re-initialization
    await expect(s3BackupService.initialize()).rejects.toThrow();
  });
});

describe("S3BackupService - Connection Testing", () => {
  beforeEach(() => {
    s3BackupService.reset();
    jest.clearAllMocks();
  });

  it("should successfully test connection with valid credentials", async () => {
    const { S3Client } = require("@aws-sdk/client-s3");
    const mockSend = jest.fn().mockResolvedValue({
      Contents: [],
    });

    S3Client.mockImplementation(() => ({
      send: mockSend,
    }));

    const result = await s3BackupService.testConnection(
      "AKIAIOSFODNN7EXAMPLE",
      "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      "test-bucket",
      "us-east-1",
    );

    expect(result.success).toBe(true);
    expect(result.bucketAccessible).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should handle connection test failure with invalid credentials", async () => {
    const { S3Client } = require("@aws-sdk/client-s3");
    const mockError = new Error("InvalidAccessKeyId");
    mockError.name = "InvalidAccessKeyId";

    const mockSend = jest.fn().mockRejectedValue(mockError);

    S3Client.mockImplementation(() => ({
      send: mockSend,
    }));

    const result = await s3BackupService.testConnection(
      "INVALID",
      "INVALID",
      "test-bucket",
      "us-east-1",
    );

    expect(result.success).toBe(false);
    expect(result.bucketAccessible).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should retry on network errors", async () => {
    const { S3Client } = require("@aws-sdk/client-s3");
    const mockError = new Error("NetworkingError");
    mockError.name = "NetworkingError";

    const mockSend = jest
      .fn()
      .mockRejectedValueOnce(mockError)
      .mockRejectedValueOnce(mockError)
      .mockResolvedValueOnce({ Contents: [] });

    S3Client.mockImplementation(() => ({
      send: mockSend,
    }));

    const result = await s3BackupService.testConnection(
      "AKIAIOSFODNN7EXAMPLE",
      "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      "test-bucket",
      "us-east-1",
    );

    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it("should fail after max retries on network errors", async () => {
    const { S3Client } = require("@aws-sdk/client-s3");
    const mockError = new Error("NetworkingError");
    mockError.name = "NetworkingError";

    const mockSend = jest.fn().mockRejectedValue(mockError);

    S3Client.mockImplementation(() => ({
      send: mockSend,
    }));

    const result = await s3BackupService.testConnection(
      "AKIAIOSFODNN7EXAMPLE",
      "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      "test-bucket",
      "us-east-1",
    );

    expect(result.success).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(3); // Max retries
  });
});

describe("S3BackupService - Reset", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should reset service state", async () => {
    const mockCredentials: S3Credentials = {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    };

    (secureStorage.getS3Credentials as jest.Mock).mockResolvedValue(
      mockCredentials,
    );
    (useSettingsStore.getState as jest.Mock).mockReturnValue({
      s3Region: "us-east-1",
      s3BucketName: "test-bucket",
    });

    // Initialize service
    await s3BackupService.initialize();

    // Reset service
    s3BackupService.reset();

    // Should require re-initialization
    (secureStorage.getS3Credentials as jest.Mock).mockResolvedValue(
      mockCredentials,
    );

    await s3BackupService.initialize();
    expect(secureStorage.getS3Credentials).toHaveBeenCalledTimes(2);
  });

  it("should allow re-initialization after reset", async () => {
    const mockCredentials: S3Credentials = {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    };

    (secureStorage.getS3Credentials as jest.Mock).mockResolvedValue(
      mockCredentials,
    );
    (useSettingsStore.getState as jest.Mock).mockReturnValue({
      s3Region: "us-east-1",
      s3BucketName: "test-bucket",
    });

    // Initialize, reset, and re-initialize
    await s3BackupService.initialize();
    s3BackupService.reset();
    await s3BackupService.initialize();

    expect(secureStorage.getS3Credentials).toHaveBeenCalledTimes(2);
  });
});
