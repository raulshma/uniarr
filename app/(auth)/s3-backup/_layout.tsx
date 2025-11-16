import { Stack } from "expo-router";
import { useTheme } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";

const BackupLayout = () => {
  const theme = useTheme<AppTheme>();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: "fade",
        animationDuration: 300,
      }}
    >
      <Stack.Screen name="s3-settings" />
      <Stack.Screen name="s3-backups" />
      <Stack.Screen
        name="upload-backup-modal"
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
          headerShown: false,
        }}
      />
    </Stack>
  );
};

export default BackupLayout;
