// Mock for @react-native-community/netinfo
module.exports = {
  fetch: jest.fn().mockResolvedValue({
    type: "wifi",
    isConnected: true,
    isInternetReachable: true,
  }),
};
