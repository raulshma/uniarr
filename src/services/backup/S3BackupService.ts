/**
 * S3 Backup Service
 *
 * Service for managing AWS S3 backup operations with BYOK (Bring Your Own Key) credentials.
 * Implements singleton pattern for consistent S3 client management.
 */

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
  S3ClientConfig,
  type GetObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { Sha256 } from "@aws-crypto/sha256-js";
import { FetchHttpHandler } from "@aws-sdk/fetch-http-handler";
import { toUtf8, fromUtf8 } from "@aws-sdk/util-utf8-browser";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { Buffer } from "buffer";

import { logger } from "@/services/logger/LoggerService";
import { secureStorage } from "@/services/storage/SecureStorage";
import { useSettingsStore } from "@/store/settingsStore";
import type {
  S3BackupMetadata,
  S3UploadProgress,
  S3ConnectionTestResult,
} from "@/models/s3.types";
import {
  S3BackupError,
  S3BackupErrorCode,
  getS3ErrorMessage,
  createS3ErrorFromAWSError,
} from "./S3BackupService.errors";

// Custom FetchHttpHandler that normalizes date headers to RFC7231 format
import type { HttpRequest, HttpResponse } from "@aws-sdk/protocol-http";
import type { HttpHandlerOptions } from "@aws-sdk/types";

/**
 * S3BackupService - Singleton service for S3 backup operations
 *
 * Handles all AWS S3 interactions for backup/restore functionality including:
 * - S3 client initialization with lazy loading
 * - Connection testing
 * - Backup upload/download/listing/deletion
 * - Comprehensive error handling and logging
 */
class S3BackupService {
  private static instance: S3BackupService | null = null;
  private s3Client: S3Client | null = null;
  private isInitialized = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get singleton instance of S3BackupService
   */
  static getInstance(): S3BackupService {
    if (!S3BackupService.instance) {
      S3BackupService.instance = new S3BackupService();
    }
    return S3BackupService.instance;
  }

  /**
   * Initialize S3 client with credentials from secure storage
   * This method sets up the S3 client for subsequent operations
   *
   * @throws {S3BackupError} If credentials are not found or initialization fails
   */
  async initialize(): Promise<void> {
    try {
      await logger.info("Initializing S3BackupService", {
        location: "S3BackupService.initialize",
      });

      // Get credentials from secure storage
      const credentials = await secureStorage.getS3Credentials();
      if (!credentials) {
        throw new S3BackupError(
          S3BackupErrorCode.CREDENTIALS_NOT_FOUND,
          getS3ErrorMessage(S3BackupErrorCode.CREDENTIALS_NOT_FOUND),
        );
      }

      // Get S3 configuration from settings store
      const { s3Region, s3BucketName, s3CustomEndpoint, s3ForcePathStyle } =
        useSettingsStore.getState();
      if (!s3Region || !s3BucketName) {
        throw new S3BackupError(
          S3BackupErrorCode.CREDENTIALS_NOT_FOUND,
          "S3 configuration incomplete. Please configure bucket name and region.",
        );
      }

      // Create S3 client configuration
      const clientConfig: S3ClientConfig = {
        region: s3Region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
        // Use React Native compatible SHA256 and UTF8 encoding
        sha256: Sha256,
        utf8Decoder: fromUtf8,
        utf8Encoder: toUtf8,
        // Use fetch-based HTTP handler for React Native
        requestHandler: new FixedDateFetchHttpHandler({
          requestTimeout: 60000, // 60 seconds for uploads
        }),
        // Disable host prefix to avoid additional parsing issues
        disableHostPrefix: true,
      };

      // Add custom endpoint if configured (for S3-compatible services)
      if (s3CustomEndpoint) {
        clientConfig.endpoint = s3CustomEndpoint;
        clientConfig.forcePathStyle = s3ForcePathStyle ?? false;
      }

      // Create S3 client
      this.s3Client = new S3Client(clientConfig);

      this.isInitialized = true;

      await logger.info("S3BackupService initialized successfully", {
        location: "S3BackupService.initialize",
        region: s3Region,
        bucketName: s3BucketName,
      });
    } catch (error) {
      await logger.error("Failed to initialize S3BackupService", {
        location: "S3BackupService.initialize",
        error: error instanceof Error ? error.message : String(error),
      });

      // Clear any partially initialized state
      this.s3Client = null;
      this.isInitialized = false;

      if (error instanceof S3BackupError) {
        throw error;
      }

      throw new S3BackupError(
        S3BackupErrorCode.NETWORK_ERROR,
        "Failed to initialize S3 client",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Get S3 client instance with lazy initialization
   * Ensures client is initialized before returning
   *
   * @returns {Promise<S3Client>} Initialized S3 client
   * @throws {S3BackupError} If initialization fails
   * @private
   */
  private async getS3Client(): Promise<S3Client> {
    // If not initialized, initialize now
    if (!this.isInitialized || !this.s3Client) {
      await this.initialize();
    }

    // Double-check after initialization
    if (!this.s3Client) {
      throw new S3BackupError(
        S3BackupErrorCode.CREDENTIALS_NOT_FOUND,
        "S3 client not initialized. Please configure S3 credentials.",
      );
    }

    return this.s3Client;
  }

  /**
   * Generate S3 object key for backup file
   * Creates a consistent naming pattern: uniarr-backup-{timestamp}-{filename}
   *
   * @param {string} fileName - Original backup filename
   * @returns {string} S3 object key
   * @private
   */
  private generateBackupKey(fileName: string): string {
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

    // Ensure the key starts with the backup prefix for easy filtering
    const key = `uniarr-backup-${sanitizedFileName}`;

    return key;
  }

  /**
   * Test S3 connection and bucket accessibility
   * Verifies credentials and bucket access without modifying data
   *
   * @param {string} accessKeyId - AWS Access Key ID
   * @param {string} secretAccessKey - AWS Secret Access Key
   * @param {string} bucketName - S3 bucket name
   * @param {string} region - AWS region
   * @param {string} customEndpoint - Optional custom S3-compatible endpoint
   * @param {boolean} forcePathStyle - Use path-style URLs for S3-compatible services
   * @returns {Promise<S3ConnectionTestResult>} Connection test result
   */
  async testConnection(
    accessKeyId: string,
    secretAccessKey: string,
    bucketName: string,
    region: string,
    customEndpoint?: string,
    forcePathStyle?: boolean,
  ): Promise<S3ConnectionTestResult> {
    await logger.info("Testing S3 connection", {
      location: "S3BackupService.testConnection",
      bucketName,
      region,
      customEndpoint: customEndpoint || "AWS S3",
      forcePathStyle: forcePathStyle ?? false,
    });

    // Create a temporary S3 client with provided credentials
    const testClientConfig: any = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // Use React Native compatible SHA256 and UTF8 encoding
      sha256: Sha256,
      utf8Decoder: fromUtf8,
      utf8Encoder: toUtf8,
      // Use fetch-based HTTP handler for React Native
      requestHandler: new FixedDateFetchHttpHandler({
        requestTimeout: 30000, // 30 seconds for connection test
      }),
    };

    // Add custom endpoint if provided (for S3-compatible services)
    if (customEndpoint) {
      testClientConfig.endpoint = customEndpoint;
      testClientConfig.forcePathStyle = forcePathStyle ?? false;
    }

    const testClient = new S3Client(testClientConfig);

    // Retry configuration
    const maxRetries = 3;
    const retryDelays = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Attempt to list objects in the bucket (with max 1 result to minimize data transfer)
        const command = new ListObjectsV2Command({
          Bucket: bucketName,
          MaxKeys: 1,
          Prefix: "uniarr-backup-", // Only look for our backup files
        });

        await testClient.send(command);

        // If we get here, the connection was successful
        await logger.info("S3 connection test successful", {
          location: "S3BackupService.testConnection",
          bucketName,
          region,
          attempt: attempt + 1,
        });

        return {
          success: true,
          bucketAccessible: true,
        };
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries - 1;

        await logger.warn("S3 connection test attempt failed", {
          location: "S3BackupService.testConnection",
          attempt: attempt + 1,
          maxRetries,
          error: error.message || String(error),
          errorName: error.name || error.code,
        });

        // Check if this is a retryable error (network issues)
        const isNetworkError =
          error.name?.includes("NetworkingError") ||
          error.code?.includes("ENOTFOUND") ||
          error.code?.includes("ETIMEDOUT") ||
          error.code?.includes("ECONNREFUSED") ||
          error.message?.includes("network") ||
          error.message?.includes("timeout");

        // For non-network errors, fail immediately (no retry)
        if (!isNetworkError || isLastAttempt) {
          // Convert AWS error to our error type
          const s3Error = createS3ErrorFromAWSError(error);

          await logger.error("S3 connection test failed", {
            location: "S3BackupService.testConnection",
            bucketName,
            region,
            errorCode: s3Error.code,
            errorMessage: s3Error.message,
            attempts: attempt + 1,
          });

          return {
            success: false,
            error: s3Error.message,
            bucketAccessible: false,
          };
        }

        // Wait before retrying (only for network errors)
        if (attempt < maxRetries - 1) {
          await logger.info("Retrying S3 connection test", {
            location: "S3BackupService.testConnection",
            attempt: attempt + 1,
            nextRetryIn: retryDelays[attempt],
          });

          await new Promise((resolve) =>
            setTimeout(resolve, retryDelays[attempt]),
          );
        }
      }
    }

    // This should never be reached due to the loop logic, but TypeScript needs it
    return {
      success: false,
      error: getS3ErrorMessage(S3BackupErrorCode.NETWORK_ERROR),
      bucketAccessible: false,
    };
  }

  /**
   * Upload backup file to S3
   * Uses multipart upload for files larger than 5MB
   *
   * @param {string} localFilePath - Path to local backup file
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise<string>} S3 object key of uploaded backup
   * @throws {S3BackupError} If upload fails
   */
  async uploadBackup(
    localFilePath: string,
    onProgress?: (progress: S3UploadProgress) => void,
  ): Promise<string> {
    try {
      await logger.info("Starting S3 backup upload", {
        location: "S3BackupService.uploadBackup",
        localFilePath,
      });

      // Get S3 client (will initialize if needed)
      const client = await this.getS3Client();

      // Get bucket name from settings
      const { s3BucketName } = useSettingsStore.getState();
      if (!s3BucketName) {
        throw new S3BackupError(
          S3BackupErrorCode.CREDENTIALS_NOT_FOUND,
          "S3 bucket name not configured",
        );
      }

      // Read the file content
      const fileContent =
        await FileSystemLegacy.readAsStringAsync(localFilePath);

      // Get file info for size
      const fileInfo = await FileSystemLegacy.getInfoAsync(localFilePath);
      if (!fileInfo.exists) {
        throw new S3BackupError(
          S3BackupErrorCode.UPLOAD_FAILED,
          "Backup file not found at specified path",
        );
      }

      const fileSize = fileInfo.size || 0;

      // Extract filename from path
      const fileName = localFilePath.split("/").pop() || "backup.json";

      // Generate S3 key
      const s3Key = this.generateBackupKey(fileName);

      await logger.info("Uploading backup to S3", {
        location: "S3BackupService.uploadBackup",
        fileName,
        s3Key,
        fileSize,
        bucketName: s3BucketName,
      });

      // Convert file content to buffer
      const buffer = Buffer.from(fileContent, "utf-8");

      // Use Upload from @aws-sdk/lib-storage for multipart upload support
      const upload = new Upload({
        client,
        params: {
          Bucket: s3BucketName,
          Key: s3Key,
          Body: buffer,
          ContentType: "application/json",
          // Add metadata
          Metadata: {
            "uniarr-version": "1.0",
            "upload-timestamp": new Date().toISOString(),
          },
        },
        // Configure multipart upload (5MB parts)
        queueSize: 4, // Number of concurrent uploads
        partSize: 5 * 1024 * 1024, // 5MB parts
      });

      // Track progress
      let lastReportedPercentage = 0;
      upload.on("httpUploadProgress", (progress) => {
        if (
          onProgress &&
          progress.loaded !== undefined &&
          progress.total !== undefined
        ) {
          const percentage = Math.round(
            (progress.loaded / progress.total) * 100,
          );

          // Only report progress every 5% to avoid excessive callbacks
          if (percentage >= lastReportedPercentage + 5 || percentage === 100) {
            lastReportedPercentage = percentage;

            onProgress({
              loaded: progress.loaded,
              total: progress.total,
              percentage,
            });

            void logger.info("Upload progress", {
              location: "S3BackupService.uploadBackup",
              percentage,
              loaded: progress.loaded,
              total: progress.total,
            });
          }
        }
      });

      // Execute the upload
      await upload.done();

      await logger.info("S3 backup upload completed successfully", {
        location: "S3BackupService.uploadBackup",
        s3Key,
        fileSize,
        bucketName: s3BucketName,
      });

      return s3Key;
    } catch (error: any) {
      await logger.error("S3 backup upload failed", {
        location: "S3BackupService.uploadBackup",
        error: error.message || String(error),
        errorName: error.name || error.code,
      });

      // If it's already an S3BackupError, rethrow it
      if (error instanceof S3BackupError) {
        throw error;
      }

      // Convert AWS errors to S3BackupError
      const s3Error = createS3ErrorFromAWSError(
        error,
        S3BackupErrorCode.UPLOAD_FAILED,
      );

      throw s3Error;
    }
  }

  /**
   * List all backup files in S3 bucket
   * Returns backups sorted by last modified date (newest first)
   *
   * @returns {Promise<S3BackupMetadata[]>} Array of backup metadata
   * @throws {S3BackupError} If listing fails
   */
  async listBackups(): Promise<S3BackupMetadata[]> {
    try {
      await logger.info("Listing S3 backups", {
        location: "S3BackupService.listBackups",
      });

      // Get S3 client (will initialize if needed)
      const client = await this.getS3Client();

      // Get bucket name from settings
      const { s3BucketName } = useSettingsStore.getState();
      if (!s3BucketName) {
        throw new S3BackupError(
          S3BackupErrorCode.CREDENTIALS_NOT_FOUND,
          "S3 bucket name not configured",
        );
      }

      // List objects with backup prefix
      const command = new ListObjectsV2Command({
        Bucket: s3BucketName,
        Prefix: "uniarr-backup-", // Filter to only our backup files
      });

      const response = await client.send(command);

      // Handle empty bucket scenario
      if (!response.Contents || response.Contents.length === 0) {
        await logger.info("No backups found in S3 bucket", {
          location: "S3BackupService.listBackups",
          bucketName: s3BucketName,
        });

        return [];
      }

      // Parse S3 objects into S3BackupMetadata format
      const backups: S3BackupMetadata[] = response.Contents.filter(
        (obj) =>
          obj.Key && typeof obj.Size === "number" && obj.LastModified != null,
      ).map((obj) => {
        // Extract filename from key (remove prefix and timestamp)
        const key = obj.Key!;
        const fileName = key.split("/").pop() || key;

        // Determine if backup is encrypted by checking filename
        // Encrypted backups typically have 'encrypted' in the filename
        const encrypted = fileName.toLowerCase().includes("encrypted");

        // Ensure lastModified is a Date object (handle string serialization)
        const lastModified =
          obj.LastModified instanceof Date
            ? obj.LastModified
            : new Date(obj.LastModified!);

        return {
          key,
          fileName,
          size: obj.Size!,
          lastModified,
          encrypted,
        };
      });

      // Sort backups by last modified date descending (newest first)
      backups.sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
      );

      await logger.info("Successfully listed S3 backups", {
        location: "S3BackupService.listBackups",
        bucketName: s3BucketName,
        backupCount: backups.length,
      });

      return backups;
    } catch (error: any) {
      await logger.error("Failed to list S3 backups", {
        location: "S3BackupService.listBackups",
        error: error.message || String(error),
        errorName: error.name || error.code,
      });

      // If it's already an S3BackupError, rethrow it
      if (error instanceof S3BackupError) {
        throw error;
      }

      // Convert AWS errors to S3BackupError
      const s3Error = createS3ErrorFromAWSError(
        error,
        S3BackupErrorCode.NETWORK_ERROR,
      );

      throw s3Error;
    }
  }

  /**
   * Download backup file from S3
   * Saves to temporary directory and reports progress
   *
   * @param {string} key - S3 object key
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise<string>} Path to downloaded file
   * @throws {S3BackupError} If download fails
   */
  async downloadBackup(
    key: string,
    onProgress?: (progress: S3UploadProgress) => void,
  ): Promise<string> {
    // Generate temporary file path early for reuse across retry strategies
    const fileName = key.split("/").pop() || "backup.json";
    const tempFilePath = `${FileSystemLegacy.cacheDirectory}${fileName}`;

    let commandInput: GetObjectCommandInput | undefined;

    try {
      await logger.info("Starting S3 backup download", {
        location: "S3BackupService.downloadBackup",
        key,
      });

      // Get S3 client (will initialize if needed)
      const client = await this.getS3Client();

      // Get bucket name from settings
      const { s3BucketName } = useSettingsStore.getState();
      if (!s3BucketName) {
        throw new S3BackupError(
          S3BackupErrorCode.CREDENTIALS_NOT_FOUND,
          "S3 bucket name not configured",
        );
      }

      commandInput = {
        Bucket: s3BucketName,
        Key: key,
      };

      // Create GetObject command
      const command = new GetObjectCommand(commandInput);

      await logger.info("Downloading backup from S3", {
        location: "S3BackupService.downloadBackup",
        key,
        bucketName: s3BucketName,
      });

      // Execute the download
      const response = await client.send(command);

      // Verify response has body
      if (!response.Body) {
        throw new S3BackupError(
          S3BackupErrorCode.DOWNLOAD_FAILED,
          "S3 response body is empty",
        );
      }

      // Get content length for progress tracking
      const contentLength = response.ContentLength || 0;

      await logger.info("Saving downloaded backup to temporary file", {
        location: "S3BackupService.downloadBackup",
        tempFilePath,
        contentLength,
      });

      // Stream the response body to file
      await this.streamToFile(
        response.Body as any,
        tempFilePath,
        contentLength,
        onProgress,
      );

      await logger.info("S3 backup download completed successfully", {
        location: "S3BackupService.downloadBackup",
        key,
        tempFilePath,
        fileSize: contentLength,
      });

      return tempFilePath;
    } catch (error: any) {
      if (this.isRfc7231DateError(error) && commandInput) {
        await logger.warn(
          "Retrying S3 backup download via signed URL fallback",
          {
            location: "S3BackupService.downloadBackup",
            key,
          },
        );

        return this.downloadBackupViaSignedUrl(
          commandInput,
          tempFilePath,
          onProgress,
        );
      }

      await logger.error("S3 backup download failed", {
        location: "S3BackupService.downloadBackup",
        key,
        error: error.message || String(error),
        errorName: error.name || error.code,
      });

      const responseHeaders = error?.$response?.headers;
      if (responseHeaders) {
        await logger.warn("Captured raw S3 response headers", {
          location: "S3BackupService.downloadBackup",
          key,
          headers: responseHeaders,
        });
      }

      // If it's already an S3BackupError, rethrow it
      if (error instanceof S3BackupError) {
        throw error;
      }

      // Convert AWS errors to S3BackupError
      const s3Error = createS3ErrorFromAWSError(
        error,
        S3BackupErrorCode.DOWNLOAD_FAILED,
      );

      throw s3Error;
    }
  }

  /**
   * Convert S3 stream to local file with progress tracking
   * Handles the streaming download and saves to the specified file path
   *
   * @param {ReadableStream} stream - S3 response body stream
   * @param {string} filePath - Destination file path
   * @param {number} totalSize - Total file size for progress calculation
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise<void>}
   * @throws {S3BackupError} If stream processing fails
   * @private
   */
  private async streamToFile(
    stream: any,
    filePath: string,
    totalSize: number,
    onProgress?: (progress: S3UploadProgress) => void,
  ): Promise<void> {
    try {
      // Convert stream to string
      // The AWS SDK returns a ReadableStream that we need to consume
      let chunks: Uint8Array[] = [];
      let loadedBytes = 0;
      let lastReportedPercentage = 0;

      // Handle different stream types (Node.js vs Web streams)
      if (stream.getReader) {
        // Web ReadableStream
        const reader = stream.getReader();

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          if (value) {
            chunks.push(value);
            loadedBytes += value.length;

            // Report progress
            if (onProgress && totalSize > 0) {
              const percentage = Math.round((loadedBytes / totalSize) * 100);

              // Only report progress every 5% to avoid excessive callbacks
              if (
                percentage >= lastReportedPercentage + 5 ||
                percentage === 100
              ) {
                lastReportedPercentage = percentage;

                onProgress({
                  loaded: loadedBytes,
                  total: totalSize,
                  percentage,
                });

                void logger.info("Download progress", {
                  location: "S3BackupService.streamToFile",
                  percentage,
                  loaded: loadedBytes,
                  total: totalSize,
                });
              }
            }
          }
        }
      } else if (stream.on) {
        // Node.js Readable stream
        await new Promise<void>((resolve, reject) => {
          stream.on("data", (chunk: Uint8Array) => {
            chunks.push(chunk);
            loadedBytes += chunk.length;

            // Report progress
            if (onProgress && totalSize > 0) {
              const percentage = Math.round((loadedBytes / totalSize) * 100);

              // Only report progress every 5% to avoid excessive callbacks
              if (
                percentage >= lastReportedPercentage + 5 ||
                percentage === 100
              ) {
                lastReportedPercentage = percentage;

                onProgress({
                  loaded: loadedBytes,
                  total: totalSize,
                  percentage,
                });

                void logger.info("Download progress", {
                  location: "S3BackupService.streamToFile",
                  percentage,
                  loaded: loadedBytes,
                  total: totalSize,
                });
              }
            }
          });

          stream.on("end", () => resolve());
          stream.on("error", (error: Error) => reject(error));
        });
      } else {
        throw new S3BackupError(
          S3BackupErrorCode.DOWNLOAD_FAILED,
          "Unsupported stream type",
        );
      }

      // Combine all chunks into a single buffer
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const buffer = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert buffer to string
      const content = new TextDecoder().decode(buffer);

      // Write to file
      await FileSystemLegacy.writeAsStringAsync(filePath, content, {
        encoding: FileSystemLegacy.EncodingType.UTF8,
      });

      await logger.info("Stream successfully written to file", {
        location: "S3BackupService.streamToFile",
        filePath,
        bytesWritten: loadedBytes,
      });
    } catch (error: any) {
      await logger.error("Failed to stream S3 response to file", {
        location: "S3BackupService.streamToFile",
        filePath,
        error: error.message || String(error),
      });

      // If it's already an S3BackupError, rethrow it
      if (error instanceof S3BackupError) {
        throw error;
      }

      throw new S3BackupError(
        S3BackupErrorCode.DOWNLOAD_FAILED,
        "Failed to save downloaded backup to file",
        error instanceof Error ? error : undefined,
      );
    }
  }

  private async writeArrayBufferToFile(
    buffer: ArrayBuffer,
    filePath: string,
    totalSize: number,
    onProgress?: (progress: S3UploadProgress) => void,
  ): Promise<void> {
    try {
      const uint8 = new Uint8Array(buffer);
      const content = new TextDecoder().decode(uint8);

      await FileSystemLegacy.writeAsStringAsync(filePath, content, {
        encoding: FileSystemLegacy.EncodingType.UTF8,
      });

      const effectiveTotal = totalSize > 0 ? totalSize : uint8.length;
      if (onProgress && effectiveTotal > 0) {
        onProgress({
          loaded: effectiveTotal,
          total: effectiveTotal,
          percentage: 100,
        });
      }

      await logger.info("ArrayBuffer successfully written to file", {
        location: "S3BackupService.writeArrayBufferToFile",
        filePath,
        bytesWritten: uint8.length,
      });
    } catch (error: any) {
      await logger.error("Failed to write ArrayBuffer to file", {
        location: "S3BackupService.writeArrayBufferToFile",
        filePath,
        error: error.message || String(error),
      });

      throw new S3BackupError(
        S3BackupErrorCode.DOWNLOAD_FAILED,
        "Failed to save downloaded backup from signed URL",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Delete backup file from S3
   * Permanently removes the backup from the bucket
   *
   * @param {string} key - S3 object key to delete
   * @returns {Promise<void>}
   * @throws {S3BackupError} If deletion fails
   */
  async deleteBackup(key: string): Promise<void> {
    try {
      await logger.info("Starting S3 backup deletion", {
        location: "S3BackupService.deleteBackup",
        key,
      });

      // Get S3 client (will initialize if needed)
      const client = await this.getS3Client();

      // Get bucket name from settings
      const { s3BucketName } = useSettingsStore.getState();
      if (!s3BucketName) {
        throw new S3BackupError(
          S3BackupErrorCode.CREDENTIALS_NOT_FOUND,
          "S3 bucket name not configured",
        );
      }

      // Create DeleteObject command
      const command = new DeleteObjectCommand({
        Bucket: s3BucketName,
        Key: key,
      });

      await logger.info("Deleting backup from S3", {
        location: "S3BackupService.deleteBackup",
        key,
        bucketName: s3BucketName,
      });

      // Execute the deletion
      await client.send(command);

      await logger.info("S3 backup deletion completed successfully", {
        location: "S3BackupService.deleteBackup",
        key,
        bucketName: s3BucketName,
      });
    } catch (error: any) {
      await logger.error("S3 backup deletion failed", {
        location: "S3BackupService.deleteBackup",
        key,
        error: error.message || String(error),
        errorName: error.name || error.code,
      });

      // If it's already an S3BackupError, rethrow it
      if (error instanceof S3BackupError) {
        throw error;
      }

      // Convert AWS errors to S3BackupError
      const s3Error = createS3ErrorFromAWSError(
        error,
        S3BackupErrorCode.DELETE_FAILED,
      );

      throw s3Error;
    }
  }

  /**
   * Reset the service instance
   * Clears the S3 client and initialization state
   * Useful for testing or when credentials change
   */
  reset(): void {
    this.s3Client = null;
    this.isInitialized = false;

    void logger.info("S3BackupService reset", {
      location: "S3BackupService.reset",
    });
  }

  private isRfc7231DateError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return /Invalid RFC7231 date-time value/i.test(error.message);
  }

  private async downloadBackupViaSignedUrl(
    commandInput: GetObjectCommandInput,
    tempFilePath: string,
    onProgress?: (progress: S3UploadProgress) => void,
  ): Promise<string> {
    try {
      const client = await this.getS3Client();
      const command = new GetObjectCommand(commandInput);
      const signedUrl = await getSignedUrl(client, command, {
        expiresIn: 900,
      });

      await logger.info("Fetching S3 backup via signed URL fallback", {
        location: "S3BackupService.downloadBackupViaSignedUrl",
        key: commandInput.Key,
        bucket: commandInput.Bucket,
      });

      const response = await fetch(signedUrl);

      if (!response.ok) {
        throw new S3BackupError(
          S3BackupErrorCode.DOWNLOAD_FAILED,
          `Signed URL download failed with status ${response.status}`,
        );
      }

      const contentLengthHeader = response.headers.get("content-length");
      const contentLength = contentLengthHeader
        ? Number(contentLengthHeader)
        : 0;

      const normalizedSize = Number.isFinite(contentLength) ? contentLength : 0;

      const bodyStream = response.body as any;
      const hasReadableStream =
        !!bodyStream &&
        (typeof bodyStream.getReader === "function" ||
          typeof bodyStream.on === "function");

      if (hasReadableStream) {
        await this.streamToFile(
          bodyStream,
          tempFilePath,
          normalizedSize,
          onProgress,
        );
      } else {
        const buffer = await response.arrayBuffer();
        await this.writeArrayBufferToFile(
          buffer,
          tempFilePath,
          normalizedSize,
          onProgress,
        );
      }

      await logger.info("Signed URL download completed", {
        location: "S3BackupService.downloadBackupViaSignedUrl",
        key: commandInput.Key,
        tempFilePath,
        fileSize: normalizedSize,
      });

      return tempFilePath;
    } catch (error) {
      if (error instanceof S3BackupError) {
        throw error;
      }

      throw new S3BackupError(
        S3BackupErrorCode.DOWNLOAD_FAILED,
        "Failed to download backup via signed URL",
        error instanceof Error ? error : undefined,
      );
    }
  }
}

class FixedDateFetchHttpHandler extends FetchHttpHandler {
  private static readonly targetHeaders = new Set([
    "date",
    "last-modified",
    "expires",
  ]);

  public override async handle(
    input: HttpRequest,
    options?: HttpHandlerOptions,
  ): Promise<{ response: HttpResponse }> {
    const result = await super.handle(input, options);
    const headers = result.response.headers;

    for (const [headerKey, rawValue] of Object.entries(headers)) {
      const normalizedKey = headerKey.toLowerCase();

      if (!FixedDateFetchHttpHandler.targetHeaders.has(normalizedKey)) {
        continue;
      }

      const normalizedValue = this.normalizeDateHeaderValue(
        Array.isArray(rawValue) ? rawValue[0] : rawValue,
      );

      if (normalizedValue) {
        headers[normalizedKey] = normalizedValue;
        if (normalizedKey !== headerKey) {
          delete headers[headerKey];
        }
        continue;
      }

      const fallbackValue = FixedDateFetchHttpHandler.createFallbackDateValue();
      headers[normalizedKey] = fallbackValue;
      if (normalizedKey !== headerKey) {
        delete headers[headerKey];
      }

      await logger.warn("Patched invalid date header", {
        location: "FixedDateFetchHttpHandler.handle",
        headerKey: normalizedKey,
        rawValue,
        fallbackValue,
      });
    }

    return result;
  }

  private normalizeDateHeaderValue(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const candidates: (() => number)[] = [
      () => Date.parse(trimmed),
      () => {
        const numericValue = Number(trimmed);
        if (Number.isNaN(numericValue)) {
          return Number.NaN;
        }
        const milliseconds =
          trimmed.length <= 10 ? numericValue * 1000 : numericValue;
        return milliseconds;
      },
    ];

    const lacksTimezone = !/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
    if (lacksTimezone) {
      candidates.push(() => Date.parse(`${trimmed}Z`));
    }

    for (const getTimestamp of candidates) {
      const timestamp = getTimestamp();
      if (!Number.isNaN(timestamp)) {
        return new Date(timestamp).toUTCString();
      }
    }

    return undefined;
  }

  private static createFallbackDateValue(): string {
    return new Date().toUTCString();
  }
}

// Export singleton instance
export const s3BackupService = S3BackupService.getInstance();
