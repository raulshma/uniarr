import { Stack } from 'expo-router';

const AuthenticatedLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add-service" />
    </Stack>
  );
};

export default AuthenticatedLayout;
