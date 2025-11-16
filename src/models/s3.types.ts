/**
 * S3 Backup and Restore Type Definitions
 *
 * Type definitions for AWS S3 backup functionality with BYOK (Bring Your Own Key) credentials.
 */

/**
 * S3 configuration stored in Settings Store
 */
export interface S3Config {
  enabled: boolean;
  bucketName: string;
  region: string;
  autoBackupEnabled: boolean;
  autoBackupFrequency?: "daily" | "weekly" | "monthly";
  deleteLocalAfterUpload: boolean;
}

/**
 * AWS credentials stored in Secure Storage
 */
export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Metadata for a backup file stored in S3
 */
export interface S3BackupMetadata {
  key: string;
  fileName: string;
  size: number;
  lastModified: Date;
  encrypted: boolean;
}

/**
 * S3 backup file with additional version information
 */
export interface S3BackupFile {
  key: string;
  fileName: string;
  size: number;
  lastModified: Date;
  encrypted: boolean;
  version?: string;
}

/**
 * Progress information for S3 upload/download operations
 */
export interface S3UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Result of S3 connection test
 */
export interface S3ConnectionTestResult {
  success: boolean;
  error?: string;
  bucketAccessible: boolean;
}

/**
 * Generic result type for S3 operations
 */
export interface S3OperationResult<T = any> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Options for creating a backup with S3 upload
 */
export interface S3BackupOptions {
  uploadToS3: boolean;
  deleteLocalAfterUpload?: boolean;
  onProgress?: (progress: S3UploadProgress) => void;
}

/**
 * Result of backup creation with optional S3 upload
 */
export interface BackupWithS3Result {
  localPath: string;
  s3Key?: string;
}

/**
 * S3 metadata extension for backup data
 */
export interface S3BackupMetadataExtension {
  uploadedAt?: string;
  s3Key?: string;
  bucketName?: string;
  region?: string;
}
