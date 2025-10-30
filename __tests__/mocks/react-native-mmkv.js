// Mock for react-native-mmkv
module.exports = {
  createMMKV: jest.fn(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    getNumber: jest.fn(),
    getBoolean: jest.fn(),
    getObject: jest.fn(),
    delete: jest.fn(),
    getAllKeys: jest.fn(),
    clear: jest.fn(),
  })),
};
