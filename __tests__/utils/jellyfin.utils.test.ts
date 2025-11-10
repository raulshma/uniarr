import { extractJellyfinAddress } from "@/utils/jellyfin.utils";
import type { ServiceConfig } from "@/models/service.types";

describe("jellyfin.utils", () => {
  describe("extractJellyfinAddress", () => {
    it("should extract a valid Jellyfin URL from service config", () => {
      const config: ServiceConfig = {
        id: "test-jellyfin",
        name: "My Jellyfin",
        type: "jellyfin",
        url: "https://jellyfin.example.com",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const address = extractJellyfinAddress(config);
      expect(address).toBe("https://jellyfin.example.com");
    });

    it("should return undefined if config type is not jellyfin", () => {
      const config: ServiceConfig = {
        id: "test-sonarr",
        name: "My Sonarr",
        type: "sonarr",
        url: "https://sonarr.example.com",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const address = extractJellyfinAddress(config);
      expect(address).toBeUndefined();
    });

    it("should return undefined if URL is missing", () => {
      const config: ServiceConfig = {
        id: "test-jellyfin",
        name: "My Jellyfin",
        type: "jellyfin",
        url: "",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const address = extractJellyfinAddress(config);
      expect(address).toBeUndefined();
    });

    it("should return undefined if URL does not have a valid scheme", () => {
      const config: ServiceConfig = {
        id: "test-jellyfin",
        name: "My Jellyfin",
        type: "jellyfin",
        url: "jellyfin.example.com",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const address = extractJellyfinAddress(config);
      expect(address).toBeUndefined();
    });

    it("should handle http URLs", () => {
      const config: ServiceConfig = {
        id: "test-jellyfin",
        name: "My Jellyfin",
        type: "jellyfin",
        url: "http://jellyfin.local:8096",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const address = extractJellyfinAddress(config);
      expect(address).toBe("http://jellyfin.local:8096");
    });
  });
});
