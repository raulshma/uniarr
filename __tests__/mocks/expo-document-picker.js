// Mock for expo-document-picker
module.exports = {
  getDocumentAsync: jest.fn().mockResolvedValue({
    cancelled: false,
    uri: "/mock/file.json",
    name: "backup.json",
    size: 1024,
  }),
};
