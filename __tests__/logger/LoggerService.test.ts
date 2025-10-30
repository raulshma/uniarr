// Ensure native modules and Expo constants are mocked for the test environment.
jest.mock("expo-constants", () => ({ appOwnership: "standalone" }));
jest.mock("react-native-mmkv", () => ({
  createMMKV: jest.fn(() => {
    const store = new Map();
    return {
      set: jest.fn((k, v) => store.set(String(k), String(v))),
      getString: jest.fn((k) => {
        const v = store.get(String(k));
        return typeof v === "undefined" ? undefined : String(v);
      }),
      getNumber: jest.fn((k) => {
        const v = store.get(String(k));
        return typeof v === "undefined" ? undefined : Number(v);
      }),
      getBoolean: jest.fn((k) => {
        const v = store.get(String(k));
        return typeof v === "undefined" ? undefined : v === "true";
      }),
      getObject: jest.fn((k) => {
        const v = store.get(String(k));
        try {
          return typeof v === "undefined" ? undefined : JSON.parse(String(v));
        } catch (_e) {
          return undefined;
        }
      }),
      remove: jest.fn((k) => store.delete(String(k))),
      getAllKeys: jest.fn(() => Array.from(store.keys())),
      clearAll: jest.fn(() => store.clear()),
    };
  }),
}));

import { logger } from "@/services/logger/LoggerService";
import { storageInitPromise } from "@/services/storage/MMKVStorage";
import { storageAdapter } from "@/services/storage/StorageAdapter";
import { LogLevel } from "@/models/logger.types";

describe("LoggerService (integration)", () => {
  beforeAll(async () => {
    // Ensure storage backend is initialized (MMKV mock will be used)
    await storageInitPromise;
  });

  beforeEach(async () => {
    // Clear central storage and logger entries for a clean slate
    await storageAdapter.clear();
    await logger.clear();
  });

  test("persists and retrieves logs", async () => {
    await logger.debug("unit test debug", { foo: "bar" });

    const logs = await logger.getLogs();
    const found = logs.some((l) => l.message.includes("unit test debug"));

    expect(found).toBe(true);
  });

  test("setMinimumLevel persists and filters logs", async () => {
    logger.setMinimumLevel(LogLevel.WARN);

    // debug should be filtered
    await logger.debug("should be filtered");
    // error should be present
    await logger.error("should be present");

    const logs = await logger.getLogs({ minimumLevel: LogLevel.WARN });

    expect(logs.some((l) => l.message.includes("should be present"))).toBe(
      true,
    );
    expect(logs.some((l) => l.message.includes("should be filtered"))).toBe(
      false,
    );
  });
});
