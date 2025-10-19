import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";

const AuthLayout = () => {
  const theme = useTheme<AppTheme>();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: "none",
      }}
    />
  );
};

export default AuthLayout;
