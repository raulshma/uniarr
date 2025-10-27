import { secureStorage } from "@/services/storage/SecureStorage";
import { logger } from "@/services/logger/LoggerService";

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
