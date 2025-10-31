module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  roots: ["<rootDir>/__tests__"],
  testPathIgnorePatterns: ["<rootDir>/__tests__/mocks/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "react-native-mmkv": "<rootDir>/__tests__/mocks/react-native-mmkv.js",
    "expo-file-system": "<rootDir>/__tests__/mocks/expo-file-system.js",
    "expo-sharing": "<rootDir>/__tests__/mocks/expo-sharing.js",
    "expo-document-picker": "<rootDir>/__tests__/mocks/expo-document-picker.js",
    "expo-crypto": "<rootDir>/__tests__/mocks/expo-crypto.js",
    "expo-secure-store": "<rootDir>/__tests__/mocks/expo-secure-store.js",
    "expo-constants": "<rootDir>/__tests__/mocks/expo-constants.js",
    "@react-native-community/netinfo":
      "<rootDir>/__tests__/mocks/react-native-community-netinfo.js",
    "@react-native-async-storage/async-storage":
      "<rootDir>/__tests__/mocks/react-native-async-storage.js",
    "react-native": "<rootDir>/node_modules/react-native",
  },
  clearMocks: true,
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native(-.*)?|expo(-.*)?|@react-native-async-storage/async-storage|@react-native-community/netinfo|react-native-mmkv|@testing-library))",
  ],
};
