import React from "react";
import {
  NativeTabs,
  Icon,
  Label,
  VectorIcon,
} from "expo-router/unstable-native-tabs";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { AppTheme } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";

export default function TabsLayout() {
  const theme = useTheme<AppTheme>();
  const { _hasHydrated } = useSettingsStore();

  // Wait for store hydration to prevent tab bar twitching
  if (!_hasHydrated) {
    return null;
  }

  return (
    <NativeTabs
      backgroundColor={theme.colors.surface}
      tintColor={theme.colors.primary}
      iconColor={theme.colors.onSurfaceVariant}
      badgeBackgroundColor={theme.colors.primaryContainer}
      badgeTextColor={theme.colors.onPrimaryContainer}
    >
      <NativeTabs.Trigger name="dashboard/index">
        <Icon
          src={
            <VectorIcon family={MaterialCommunityIcons} name="view-dashboard" />
          }
        />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="services/index">
        <Icon
          src={<VectorIcon family={MaterialCommunityIcons} name="server" />}
        />
        <Label>Services</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recently-added">
        <Icon
          src={
            <VectorIcon family={MaterialCommunityIcons} name="clock-outline" />
          }
        />
        <Label>Recently Added</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="downloads/index">
        <Icon
          src={<VectorIcon family={MaterialCommunityIcons} name="download" />}
        />
        <Label>Downloads</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings/index">
        <Icon src={<VectorIcon family={MaterialCommunityIcons} name="cog" />} />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
