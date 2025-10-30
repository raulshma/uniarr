// Mock for expo-file-system
module.exports = {
  File: {
    existsAsync: jest.fn(),
    readAsStringAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
    deleteAsync: jest.fn(),
    makeDirectoryAsync: jest.fn(),
    readDirectoryAsync: jest.fn(),
  },
  Directory: {
    documentDirectory: "/mock/documents/",
    cacheDirectory: "/mock/cache/",
  },
};
