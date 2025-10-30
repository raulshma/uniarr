// Mock for expo-sharing
module.exports = {
  shareAsync: jest.fn(),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
};
