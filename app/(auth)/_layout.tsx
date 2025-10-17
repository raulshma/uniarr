import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";

const AuthenticatedLayout = () => {
  const theme = useTheme<AppTheme>();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        // Disable default navigation animations to make navigation snappy.
        animation: "none",
      }}
    >
      <Stack.Screen name="(tabs)" />
      {/* Only explicitly declare routes that have special configurations or don't follow standard file-based routing */}
      <Stack.Screen name="add-service" />
      <Stack.Screen name="edit-service" />
      <Stack.Screen name="network-scan" />
    </Stack>
  );
};

export default AuthenticatedLayout;
