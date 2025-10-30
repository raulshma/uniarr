// Mock for expo-secure-store
module.exports = {
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  removeItemAsync: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  canUseSecureStorage: jest.fn().mockReturnValue(true),
};
