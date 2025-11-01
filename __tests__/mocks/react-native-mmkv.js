// Simple in-memory mock for react-native-mmkv with the methods used by
// MMKVStorageAdapter in the app. The mock keeps a Map internally and
// exposes synchronous methods similar to the native MMKV instance.
module.exports = {
  createMMKV: jest.fn(() => {
    const store = new Map();

    return {
      set: jest.fn((key, value) => {
        store.set(String(key), String(value));
      }),
      getString: jest.fn((key) => {
        const v = store.get(String(key));
        return typeof v === "undefined" ? undefined : String(v);
      }),
      getNumber: jest.fn((key) => {
        const v = store.get(String(key));
        return typeof v === "undefined" ? undefined : Number(v);
      }),
      getBoolean: jest.fn((key) => {
        const v = store.get(String(key));
        return typeof v === "undefined" ? undefined : v === "true";
      }),
      getObject: jest.fn((key) => {
        const v = store.get(String(key));
        try {
          return typeof v === "undefined" ? undefined : JSON.parse(String(v));
        } catch (_e) {
          return undefined;
        }
      }),
      // adapter expects `remove` and `clearAll`
      remove: jest.fn((key) => {
        store.delete(String(key));
      }),
      getAllKeys: jest.fn(() => Array.from(store.keys())),
      clearAll: jest.fn(() => store.clear()),
    };
  }),
};
