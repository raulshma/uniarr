// Mock for expo-crypto
module.exports = {
  digestStringAsync: jest.fn().mockResolvedValue("mocked-hash"),
  getRandomBytesAsync: jest
    .fn()
    .mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
};
