import React from "react";
import { Stack } from "expo-router";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "react-native-paper";

export default function ResourcesLayout() {
  const theme = useTheme<AppTheme>();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Resources",
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="[resourceId]"
        options={{
          title: "Resource Details",
          headerLargeTitle: false,
          headerLargeTitleShadowVisible: false,
          headerTransparent: true,
        }}
      />
    </Stack>
  );
}
