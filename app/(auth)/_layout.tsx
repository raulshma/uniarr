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
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add-service" />
    </Stack>
  );
};

export default AuthenticatedLayout;
