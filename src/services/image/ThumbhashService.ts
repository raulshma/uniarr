import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";

import { logger } from "@/services/logger/LoggerService";

const STORAGE_KEY = "ThumbhashService:thumbhashes";

/**
 * Simple thumbhash management service.
 * Provides clean API for thumbhash generation, storage, and retrieval.
 */
class ThumbhashService {
  private static instance: ThumbhashService | null = null;
  private thumbhashes: Map<string, string> = new Map();
  private isInitialized = false;
  private pendingGenerations = new Map<string, Promise<string | null>>();

  static getInstance(): ThumbhashService {
    if (!ThumbhashService.instance) {
      ThumbhashService.instance = new ThumbhashService();
    }
    return ThumbhashService.instance;
  }

  /**
   * Get stored thumbhash for a URI.
   * Returns undefined if no thumbhash exists.
   */
  getThumbhash(uri: string): string | undefined {
    if (!uri) return undefined;

    try {
      const key = this.sanitizeUri(uri);
      return this.thumbhashes.get(key);
    } catch {
      return undefined;
    }
  }

  /**
   * Generate thumbhash for a URI and store it.
   * Returns the generated thumbhash or null if generation failed.
   */
  async generateThumbhash(uri: string): Promise<string | null> {
    if (!uri) return null;

    const key = this.sanitizeUri(uri);

    // Return existing thumbhash if available
    if (this.thumbhashes.has(key)) {
      return this.thumbhashes.get(key)!;
    }

    // Check if generation is already in progress
    const pending = this.pendingGenerations.get(key);
    if (pending) {
      return pending;
    }

    const generationPromise = this.doGenerateThumbhash(uri, key);
    this.pendingGenerations.set(key, generationPromise);

    try {
      const result = await generationPromise;
      return result;
    } finally {
      this.pendingGenerations.delete(key);
    }
  }

  /**
   * Generate thumbhash for multiple URIs in parallel.
   */
  async generateThumbhashes(uris: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();

    await Promise.all(
      uris.map(async (uri) => {
        const thumbhash = await this.generateThumbhash(uri);
        results.set(uri, thumbhash);
      })
    );

    return results;
  }

  /**
   * Check if thumbhash exists for a URI without generating it.
   */
  hasThumbhash(uri: string): boolean {
    if (!uri) return false;

    try {
      const key = this.sanitizeUri(uri);
      return this.thumbhashes.has(key);
    } catch {
      return false;
    }
  }

  /**
   * Clear all stored thumbhashes.
   */
  async clearThumbhashes(): Promise<void> {
    this.thumbhashes.clear();
    this.pendingGenerations.clear();

    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      void logger.info("ThumbhashService: cleared all thumbhashes.");
    } catch (error) {
      void logger.error("ThumbhashService: failed to clear thumbhashes.", {
        error: this.stringifyError(error),
      });
    }
  }

  /**
   * Get the number of stored thumbhashes.
   */
  getCount(): number {
    return this.thumbhashes.size;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const serialized = await AsyncStorage.getItem(STORAGE_KEY);
      if (serialized) {
        const parsed = JSON.parse(serialized) as Record<string, string>;
        if (parsed && typeof parsed === "object") {
          Object.entries(parsed).forEach(([key, value]) => {
            if (typeof value === "string" && value.length) {
              this.thumbhashes.set(key, value);
            }
          });
        }
      }
    } catch (error) {
      void logger.warn("ThumbhashService: failed to restore thumbhashes.", {
        error: this.stringifyError(error),
      });
    }

    this.isInitialized = true;
  }

  private async doGenerateThumbhash(uri: string, key: string): Promise<string | null> {
    await this.ensureInitialized();

    try {
      // Double-check if thumbhash was added while we were waiting
      if (this.thumbhashes.has(key)) {
        return this.thumbhashes.get(key)!;
      }

      void logger.debug("ThumbhashService: generating thumbhash", { uri });

      const thumbhash = await Image.generateThumbhashAsync(uri);

      if (thumbhash && typeof thumbhash === "string" && thumbhash.length) {
        this.thumbhashes.set(key, thumbhash);
        void this.persistThumbhashes();
        void logger.debug("ThumbhashService: generated thumbhash successfully", { uri });
        return thumbhash;
      }

      return null;
    } catch (error) {
      void logger.debug("ThumbhashService: failed to generate thumbhash", {
        uri,
        error: this.stringifyError(error),
      });
      return null;
    }
  }

  private async persistThumbhashes(): Promise<void> {
    try {
      const thumbhashObj: Record<string, string> = {};
      this.thumbhashes.forEach((value, key) => {
        thumbhashObj[key] = value;
      });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(thumbhashObj));
    } catch (error) {
      void logger.warn("ThumbhashService: failed to persist thumbhashes", {
        error: this.stringifyError(error),
      });
    }
  }

  /**
   * Remove sensitive query parameters from URIs before storage.
   */
  private sanitizeUri(uri: string): string {
    try {
      const parsed = new URL(uri);
      // Remove apikey and other potentially sensitive params
      ["apikey", "token", "access_token"].forEach((param) =>
        parsed.searchParams.delete(param)
      );
      parsed.hash = "";
      return parsed.toString();
    } catch {
      return uri;
    }
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }
}

export const thumbhashService = ThumbhashService.getInstance();
export { ThumbhashService };