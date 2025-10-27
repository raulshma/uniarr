import axios, { AxiosError } from "axios";
import * as semver from "semver";
import Constants from "expo-constants";
import { logger } from "@/services/logger/LoggerService";

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  assets: {
    name: string;
    browser_download_url: string;
  }[];
  published_at: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  releaseUrl: string;
  publishedAt: string;
}

const GITHUB_API_URL =
  "https://api.github.com/repos/raulshma/uniarr/releases/latest";
const FALLBACK_RELEASES_URL = "https://github.com/raulshma/uniarr/releases";

export class AppUpdateService {
  /**
   * Get the current app version from Expo Constants
   */
  static getCurrentVersion(): string {
    const version =
      Constants.expoConfig?.version || Constants.manifest?.version || "0.0.0";
    return version;
  }

  /**
   * Fetch the latest release from GitHub API
   * Falls back to releases page URL if API call fails
   */
  static async fetchLatestRelease(): Promise<UpdateCheckResult> {
    try {
      const currentVersion = this.getCurrentVersion();

      const response = await axios.get<GitHubRelease>(GITHUB_API_URL, {
        timeout: 10000,
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      });

      const release = response.data;

      // Validate that we have a valid version tag
      if (!release.tag_name) {
        throw new Error("Invalid release data: missing tag_name");
      }

      // Extract version from tag (e.g., "v0.1.5" -> "0.1.5")
      const latestVersion = release.tag_name.replace(/^v/, "");

      // Validate versions with semver
      if (!semver.valid(currentVersion) || !semver.valid(latestVersion)) {
        void logger.warn("Invalid version format", {
          location: "AppUpdateService.fetchLatestRelease",
          currentVersion,
          latestVersion,
        });
      }

      // Compare versions
      const hasUpdate =
        (semver.valid(latestVersion) !== null &&
          semver.valid(currentVersion) !== null &&
          semver.gt(latestVersion, currentVersion)) ||
        false;

      // Truncate release notes to first 200 characters
      const releaseNotes = this.truncateReleaseNotes(release.body);

      return {
        hasUpdate,
        currentVersion,
        latestVersion,
        releaseNotes,
        releaseUrl: release.html_url,
        publishedAt: release.published_at,
      };
    } catch (error) {
      void logger.error("Failed to fetch latest release from GitHub", {
        location: "AppUpdateService.fetchLatestRelease",
        error: error instanceof Error ? error.message : String(error),
        errorCode: error instanceof AxiosError ? error.code : undefined,
      });

      // Return fallback result with link to releases page
      return {
        hasUpdate: false,
        currentVersion: this.getCurrentVersion(),
        latestVersion: "unknown",
        releaseNotes: "Unable to fetch release notes",
        releaseUrl: FALLBACK_RELEASES_URL,
        publishedAt: "",
      };
    }
  }

  /**
   * Truncate release notes to first 200 characters
   */
  private static truncateReleaseNotes(notes: string): string {
    if (!notes) {
      return "No release notes available";
    }

    if (notes.length <= 200) {
      return notes;
    }

    // Try to truncate at a word boundary
    const truncated = notes.substring(0, 200);
    const lastSpaceIndex = truncated.lastIndexOf(" ");

    if (lastSpaceIndex > 0) {
      return truncated.substring(0, lastSpaceIndex) + "…";
    }

    return truncated + "…";
  }

  /**
   * Compare two semantic versions
   */
  static isNewerVersion(latest: string, current: string): boolean {
    try {
      return semver.gt(latest, current);
    } catch {
      return false;
    }
  }
}

export default AppUpdateService;
