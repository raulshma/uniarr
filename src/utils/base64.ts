export function base64Encode(input: string): string {
  try {
    return btoa(input);
  } catch (error) {
    throw new Error(
      `No base64 encoder available: ensure 'react-native-base64' is installed or a global btoa/Buffer is present. Original error: ${(error as Error).message}`,
    );
  }
}

export function base64Decode(input: string): string {
  try {
    return atob(input);
  } catch (error) {
    throw new Error(
      `No base64 decoder available: ensure 'react-native-base64' is installed or a global atob/Buffer is present. Original error: ${(error as Error).message}`,
    );
  }
}
