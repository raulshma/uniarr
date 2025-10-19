/**
 * File operations utilities for handling downloaded content
 * Provides functions to delete, share, and open downloaded files with system/3rd party players
 */

import { File } from "expo-file-system";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { Platform, Linking, Share } from "react-native";
import { logger } from "@/services/logger/LoggerService";

/**
 * Video player options available on different platforms
 */
export interface VideoPlayerOption {
  /** Display name of the player */
  readonly label: string;
  /** Package name (Android) or URL scheme (iOS) */
  readonly packageName: string;
  /** Icon name from Material Design Icons */
  readonly icon: string;
  /** Whether this is the system default player */
  readonly isDefault?: boolean;
}

/**
 * Popular video player apps on Android
 */
export const ANDROID_VIDEO_PLAYERS: readonly VideoPlayerOption[] = [
  {
    label: "MX Player",
    packageName: "com.mxtech.videoplayer.ad",
    icon: "play-circle",
  },
  {
    label: "MX Player Pro",
    packageName: "com.mxtech.videoplayer.pro",
    icon: "play-circle",
  },
  {
    label: "VLC",
    packageName: "org.videolan.vlc",
    icon: "play-circle",
  },
  {
    label: "Kodi",
    packageName: "org.xbmc.kodi",
    icon: "play-circle",
  },
  {
    label: "Plex",
    packageName: "com.plexapp.android",
    icon: "play-circle",
  },
  {
    label: "Infuse",
    packageName: "com.firecore.infuse",
    icon: "play-circle",
  },
  {
    label: "System Player",
    packageName: "com.android.systemui.video",
    icon: "play",
    isDefault: true,
  },
];

/**
 * Popular video player apps on iOS
 */
export const IOS_VIDEO_PLAYERS: readonly VideoPlayerOption[] = [
  {
    label: "VLC",
    packageName: "vlc-x-callback",
    icon: "play-circle",
  },
  {
    label: "Infuse",
    packageName: "infuse",
    icon: "play-circle",
  },
  {
    label: "Plex",
    packageName: "plex",
    icon: "play-circle",
  },
  {
    label: "System Player",
    packageName: "nplayer",
    icon: "play",
    isDefault: true,
  },
];

/**
 * Get available video players for the current platform
 */
export const getAvailableVideoPlayers = (): readonly VideoPlayerOption[] => {
  if (Platform.OS === "android") {
    return ANDROID_VIDEO_PLAYERS;
  } else if (Platform.OS === "ios") {
    return IOS_VIDEO_PLAYERS;
  }
  return [];
};

/**
 * Delete a file from the device storage
 * @param filePath - Full path to the file to delete
 * @returns Promise that resolves to true if successful, false otherwise
 */
export const deleteFile = async (filePath: string): Promise<boolean> => {
  try {
    if (!filePath) {
      logger.warn("Cannot delete file: empty file path");
      return false;
    }

    logger.info("Deleting file", { filePath });

    // Use File API from expo-file-system
    const file = new File(filePath);

    if (file.exists) {
      file.delete();
      logger.info("File deleted successfully", { filePath });
      return true;
    } else {
      logger.warn("File does not exist", { filePath });
      return false;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Failed to delete file", {
      filePath,
      error: message,
    });
    return false;
  }
};

/**
 * Check if a file exists at the given path
 * @param filePath - Full path to the file
 * @returns Promise that resolves to true if file exists, false otherwise
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    if (!filePath) {
      return false;
    }

    const info = await FileSystemLegacy.getInfoAsync(filePath);
    return info.exists ?? false;
  } catch (error) {
    logger.debug("Error checking file existence", {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

/**
 * Get file information (size, modification date, etc.)
 * @param filePath - Full path to the file
 * @returns Promise with file info or null if file doesn't exist
 */
export const getFileInfo = async (
  filePath: string,
): Promise<{ size: number; modTime: number } | null> => {
  try {
    if (!filePath) {
      return null;
    }

    const info = await FileSystemLegacy.getInfoAsync(filePath);

    if (!info.exists) {
      return null;
    }

    return {
      size: info.size || 0,
      modTime: info.modificationTime || 0,
    };
  } catch (error) {
    logger.debug("Error getting file info", {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Get MIME type for a file based on its extension
 * @param filePath - Full path to the file
 * @returns MIME type string
 */
export const getMimeType = (filePath: string): string => {
  const extension = filePath.split(".").pop()?.toLowerCase() || "";

  const mimeTypes: Record<string, string> = {
    // Video
    mp4: "video/mp4",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    wmv: "video/x-ms-wmv",
    flv: "video/x-flv",
    webm: "video/webm",
    m4v: "video/x-m4v",
    "3gp": "video/3gpp",
    m3u8: "application/x-mpegURL",
    ts: "video/mp2t",
    // Audio
    mp3: "audio/mpeg",
    aac: "audio/aac",
    flac: "audio/flac",
    wav: "audio/wav",
    // Subtitles
    srt: "text/plain",
    ass: "text/plain",
    vtt: "text/vtt",
  };

  return mimeTypes[extension] || "video/mp4";
};

/**
 * Open a downloaded file with a system or 3rd party video player
 * @param filePath - Full path to the file to open
 * @param playerOption - Optional specific player to use (Android only)
 * @returns Promise that resolves to true if successful, false otherwise
 */
export const openFileWithPlayer = async (
  filePath: string,
  playerOption?: VideoPlayerOption,
): Promise<boolean> => {
  try {
    if (!filePath) {
      logger.warn("Cannot open file: empty file path");
      return false;
    }

    // Check if file exists
    const exists = await fileExists(filePath);
    if (!exists) {
      logger.warn("Cannot open file: file does not exist", { filePath });
      return false;
    }

    const mimeType = getMimeType(filePath);

    if (Platform.OS === "android") {
      return await openFileAndroid(filePath, mimeType, playerOption);
    } else if (Platform.OS === "ios") {
      return await openFileIOS(filePath, playerOption);
    } else {
      logger.warn("Unsupported platform for opening files", {
        platform: Platform.OS,
      });
      return false;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Failed to open file with player", {
      filePath,
      error: message,
    });
    return false;
  }
};

/**
 * Open file on Android with specified player
 */
const openFileAndroid = async (
  filePath: string,
  mimeType: string,
  playerOption?: VideoPlayerOption,
): Promise<boolean> => {
  try {
    // If a specific player is requested
    if (
      playerOption &&
      playerOption.packageName !== "com.android.systemui.video"
    ) {
      const intentUri = `intent:#Intent;action=android.intent.action.VIEW;data=${encodeURIComponent(
        `file://${filePath}`,
      )};type=${mimeType};package=${playerOption.packageName};end`;

      try {
        await Linking.openURL(intentUri);
        logger.info("Opened file with player", {
          filePath,
          player: playerOption.label,
        });
        return true;
      } catch {
        logger.warn(
          "Failed to open with specified player, falling back to system",
          {
            filePath,
            player: playerOption.label,
          },
        );
      }
    }

    // Fallback to system player
    const fileUri = `file://${filePath}`;
    await Linking.openURL(fileUri);
    logger.info("Opened file with system player", { filePath });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Failed to open file on Android", {
      filePath,
      error: message,
    });
    return false;
  }
};

/**
 * Open file on iOS with specified player or system player
 */
const openFileIOS = async (
  filePath: string,
  playerOption?: VideoPlayerOption,
): Promise<boolean> => {
  try {
    // iOS uses URL schemes for third-party apps
    if (playerOption && playerOption.packageName !== "nplayer") {
      // Try to open with specific app via URL scheme
      // Note: This requires the app to support x-callback-url
      const scheme = `${playerOption.packageName}://open?url=${encodeURIComponent(
        `file://${filePath}`,
      )}`;

      try {
        const canOpen = await Linking.canOpenURL(scheme);
        if (canOpen) {
          await Linking.openURL(scheme);
          logger.info("Opened file with iOS app", {
            filePath,
            app: playerOption.label,
          });
          return true;
        }
      } catch {
        logger.warn("Cannot open with specified iOS app", {
          filePath,
          app: playerOption.label,
        });
      }
    }

    // Fallback to opening with system association
    const fileUri = `file://${filePath}`;
    await Linking.openURL(fileUri);
    logger.info("Opened file with iOS system player", { filePath });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Failed to open file on iOS", {
      filePath,
      error: message,
    });
    return false;
  }
};

/**
 * Share a file using the system share sheet
 * @param filePath - Full path to the file
 * @param title - Optional title for the share dialog
 * @returns Promise that resolves to true if share was successful
 */
export const shareFile = async (
  filePath: string,
  title?: string,
): Promise<boolean> => {
  try {
    if (!filePath) {
      logger.warn("Cannot share file: empty file path");
      return false;
    }

    // Check if file exists
    const exists = await fileExists(filePath);
    if (!exists) {
      logger.warn("Cannot share file: file does not exist", { filePath });
      return false;
    }

    const fileName = filePath.split("/").pop() || "File";

    await Share.share({
      url: `file://${filePath}`,
      title: title || fileName,
      message: `Check out this file: ${fileName}`,
    });

    logger.info("File shared successfully", { filePath });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Share cancellation is not an error, it's just user action
    if (message !== "User did not share") {
      logger.warn("Error sharing file", {
        filePath,
        error: message,
      });
    }
    return false;
  }
};

/**
 * Get directory size (sum of all files in directory)
 * @param dirPath - Full path to the directory
 * @returns Promise with total size in bytes
 */
export const getDirectorySize = async (dirPath: string): Promise<number> => {
  try {
    if (!dirPath) {
      return 0;
    }

    let totalSize = 0;
    const info = await FileSystemLegacy.readDirectoryAsync(dirPath);

    for (const fileName of info) {
      try {
        const filePath = `${dirPath}${fileName}`;
        const fileInfo = await FileSystemLegacy.getInfoAsync(filePath);

        if (fileInfo.isDirectory) {
          totalSize += await getDirectorySize(filePath);
        } else if (fileInfo.exists) {
          totalSize += (fileInfo as any).size || 0;
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return totalSize;
  } catch (error) {
    logger.debug("Error calculating directory size", {
      dirPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
};

/**
 * Extract filename from full path
 * @param filePath - Full path to the file
 * @returns Filename with extension
 */
export const getFileName = (filePath: string): string => {
  return filePath.split("/").pop() || "Unknown";
};

/**
 * Extract file extension from path
 * @param filePath - Full path to the file
 * @returns File extension (without dot)
 */
export const getFileExtension = (filePath: string): string => {
  const fileName = getFileName(filePath);
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop() || "" : "";
};

/**
 * Check if file is a video file
 * @param filePath - Full path to the file
 * @returns True if file is a video, false otherwise
 */
export const isVideoFile = (filePath: string): boolean => {
  const videoExtensions = [
    "mp4",
    "mkv",
    "avi",
    "mov",
    "wmv",
    "flv",
    "webm",
    "m4v",
    "3gp",
    "ts",
    "m3u8",
  ];
  const extension = getFileExtension(filePath).toLowerCase();
  return videoExtensions.includes(extension);
};

/**
 * Check if file is a subtitle file
 * @param filePath - Full path to the file
 * @returns True if file is a subtitle, false otherwise
 */
export const isSubtitleFile = (filePath: string): boolean => {
  const subtitleExtensions = ["srt", "ass", "ssa", "sub", "vtt", "sbv"];
  const extension = getFileExtension(filePath).toLowerCase();
  return subtitleExtensions.includes(extension);
};
