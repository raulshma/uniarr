import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";

const PublicLayout = () => {
  const theme = useTheme<AppTheme>();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        // Enable smooth fade transitions between screens
        animation: "fade",
        animationDuration: 300,
      }}
    />
  );
};

export default PublicLayout;
