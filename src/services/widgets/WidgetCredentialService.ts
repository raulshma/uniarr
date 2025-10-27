import { secureStorage } from "@/services/storage/SecureStorage";
import { logger } from "@/services/logger/LoggerService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CREDENTIAL_KEY_PREFIX = "WidgetCredentialService";

export type WidgetCredentials = Record<string, string>;

class WidgetCredentialService {
  private static instance: WidgetCredentialService | null = null;

  static getInstance(): WidgetCredentialService {
    if (!WidgetCredentialService.instance) {
      WidgetCredentialService.instance = new WidgetCredentialService();
    }

    return WidgetCredentialService.instance;
  }

  async getCredentials(widgetId: string): Promise<WidgetCredentials | null> {
    try {
      const key = this.buildKey(widgetId);
      const raw = await secureStorage.getItem(key);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as WidgetCredentials;
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      return parsed;
    } catch (error) {
      await logger.warn("Failed to parse widget credentials.", {
        widgetId,
        location: "WidgetCredentialService.getCredentials",
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async setCredentials(
    widgetId: string,
    credentials: WidgetCredentials,
  ): Promise<void> {
    try {
      const key = this.buildKey(widgetId);
      await secureStorage.setItem(key, JSON.stringify(credentials));
    } catch (error) {
      await logger.error("Failed to persist widget credentials.", {
        widgetId,
        location: "WidgetCredentialService.setCredentials",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async removeCredentials(widgetId: string): Promise<void> {
    try {
      const key = this.buildKey(widgetId);
      await secureStorage.removeItem(key);
    } catch (error) {
      await logger.error("Failed to purge widget credentials.", {
        widgetId,
        location: "WidgetCredentialService.removeCredentials",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Retrieve all widget credentials from SecureStorage
   * Iterates through all known widget types to find stored credentials
   */
  async getAllCredentials(): Promise<Record<string, WidgetCredentials>> {
    try {
      const allCredentials: Record<string, WidgetCredentials> = {};

      // All possible widget types that might have credentials
      const widgetTypes: string[] = [
        "service-status",
        "download-progress",
        "recent-activity",
        "statistics",
        "calendar-preview",
        "shortcuts",
        "bookmarks",
        "rss-feed",
        "subreddit",
        "hacker-news",
        "weather",
        "youtube",
        "twitch",
      ];

      // Try to retrieve credentials for each widget type
      for (const widgetType of widgetTypes) {
        try {
          const credentials = await this.getCredentials(widgetType);
          if (credentials && Object.keys(credentials).length > 0) {
            allCredentials[widgetType] = credentials;
          }
        } catch {
          // Log but continue to next widget type
          await logger.debug(
            `No credentials found for widget type: ${widgetType}`,
            {
              location: "WidgetCredentialService.getAllCredentials",
              widgetType,
            },
          );
        }
      }

      // Also check AsyncStorage for widget instances with their own IDs
      try {
        const widgetsJson = await AsyncStorage.getItem("WidgetService:widgets");
        if (widgetsJson) {
          const widgets = JSON.parse(widgetsJson) as {
            id: string;
            type: string;
          }[];

          // For each widget instance, try to retrieve its credentials
          for (const widget of widgets) {
            try {
              const credentials = await this.getCredentials(widget.id);
              if (credentials && Object.keys(credentials).length > 0) {
                allCredentials[widget.id] = credentials;
              }
            } catch {
              // Log but continue
              await logger.debug(
                `No credentials found for widget instance: ${widget.id}`,
                {
                  location: "WidgetCredentialService.getAllCredentials",
                  widgetId: widget.id,
                },
              );
            }
          }
        }
      } catch (storageError) {
        await logger.debug(
          "Failed to check AsyncStorage for widget instances",
          {
            location: "WidgetCredentialService.getAllCredentials",
            error:
              storageError instanceof Error
                ? storageError.message
                : String(storageError),
          },
        );
      }

      return allCredentials;
    } catch (error) {
      await logger.error("Failed to retrieve all widget credentials.", {
        location: "WidgetCredentialService.getAllCredentials",
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }

  private buildKey(widgetId: string): string {
    const sanitizedWidgetId = this.sanitizeWidgetId(widgetId);
    return `${CREDENTIAL_KEY_PREFIX}.${sanitizedWidgetId}`;
  }

  private sanitizeWidgetId(widgetId: string): string {
    const normalized = widgetId.trim();
    const sanitized = normalized.replace(/[^A-Za-z0-9._-]/g, "_");
    return sanitized.length > 0 ? sanitized : "default";
  }
}

export const widgetCredentialService = WidgetCredentialService.getInstance();
export { WidgetCredentialService };
