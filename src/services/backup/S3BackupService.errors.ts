/**
 * S3 Backup Service Error Types
 *
 * Error codes and error class for S3 backup operations.
 */

/**
 * Error codes for S3 backup operations
 */
export enum S3BackupErrorCode {
  CREDENTIALS_NOT_FOUND = "CREDENTIALS_NOT_FOUND",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  BUCKET_NOT_FOUND = "BUCKET_NOT_FOUND",
  NETWORK_ERROR = "NETWORK_ERROR",
  UPLOAD_FAILED = "UPLOAD_FAILED",
  DOWNLOAD_FAILED = "DOWNLOAD_FAILED",
  DELETE_FAILED = "DELETE_FAILED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  TIMEOUT = "TIMEOUT",
  INVALID_BACKUP_FILE = "INVALID_BACKUP_FILE",
}

/**
 * Custom error class for S3 backup operations
 */
export class S3BackupError extends Error {
  public readonly code: S3BackupErrorCode;
  public readonly originalError?: Error;

  constructor(code: S3BackupErrorCode, message: string, originalError?: Error) {
    super(message);
    this.name = "S3BackupError";
    this.code = code;
    this.originalError = originalError;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, S3BackupError);
    }
  }
}

/**
 * User-friendly error messages for each error code
 */
export const S3_ERROR_MESSAGES: Record<S3BackupErrorCode, string> = {
  [S3BackupErrorCode.CREDENTIALS_NOT_FOUND]:
    "AWS credentials not configured. Please set up your S3 credentials in settings.",
  [S3BackupErrorCode.INVALID_CREDENTIALS]:
    "Invalid AWS credentials. Please verify your Access Key ID and Secret Access Key.",
  [S3BackupErrorCode.BUCKET_NOT_FOUND]:
    "S3 bucket not found. Please verify the bucket name and ensure it exists.",
  [S3BackupErrorCode.NETWORK_ERROR]:
    "Network connection failed. Please check your internet connection and try again.",
  [S3BackupErrorCode.UPLOAD_FAILED]:
    "Failed to upload backup to S3. Please try again.",
  [S3BackupErrorCode.DOWNLOAD_FAILED]:
    "Failed to download backup from S3. Please try again.",
  [S3BackupErrorCode.DELETE_FAILED]:
    "Failed to delete backup from S3. Please try again.",
  [S3BackupErrorCode.PERMISSION_DENIED]:
    "Access denied. Please verify your AWS credentials have the required S3 permissions.",
  [S3BackupErrorCode.TIMEOUT]:
    "Operation timed out. Please check your network connection and try again.",
  [S3BackupErrorCode.INVALID_BACKUP_FILE]:
    "The selected file is not a valid backup file.",
};

/**
 * Helper function to get user-friendly error message
 */
export function getS3ErrorMessage(code: S3BackupErrorCode): string {
  return S3_ERROR_MESSAGES[code];
}

/**
 * Helper function to create S3BackupError from AWS SDK error
 */
export function createS3ErrorFromAWSError(
  awsError: any,
  defaultCode: S3BackupErrorCode = S3BackupErrorCode.NETWORK_ERROR,
): S3BackupError {
  // Map common AWS error codes to our error codes
  const errorName = awsError.name || awsError.code || "";

  if (errorName.includes("NoSuchBucket")) {
    return new S3BackupError(
      S3BackupErrorCode.BUCKET_NOT_FOUND,
      getS3ErrorMessage(S3BackupErrorCode.BUCKET_NOT_FOUND),
      awsError,
    );
  }

  if (
    errorName.includes("InvalidAccessKeyId") ||
    errorName.includes("SignatureDoesNotMatch")
  ) {
    return new S3BackupError(
      S3BackupErrorCode.INVALID_CREDENTIALS,
      getS3ErrorMessage(S3BackupErrorCode.INVALID_CREDENTIALS),
      awsError,
    );
  }

  if (errorName.includes("AccessDenied") || errorName.includes("Forbidden")) {
    return new S3BackupError(
      S3BackupErrorCode.PERMISSION_DENIED,
      getS3ErrorMessage(S3BackupErrorCode.PERMISSION_DENIED),
      awsError,
    );
  }

  if (errorName.includes("Timeout") || errorName.includes("RequestTimeout")) {
    return new S3BackupError(
      S3BackupErrorCode.TIMEOUT,
      getS3ErrorMessage(S3BackupErrorCode.TIMEOUT),
      awsError,
    );
  }

  if (
    errorName.includes("NetworkingError") ||
    errorName.includes("ENOTFOUND")
  ) {
    return new S3BackupError(
      S3BackupErrorCode.NETWORK_ERROR,
      getS3ErrorMessage(S3BackupErrorCode.NETWORK_ERROR),
      awsError,
    );
  }

  // Default to the provided code
  return new S3BackupError(
    defaultCode,
    getS3ErrorMessage(defaultCode),
    awsError,
  );
}
