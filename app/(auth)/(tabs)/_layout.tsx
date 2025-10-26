import React from "react";
import { Tabs } from "expo-router";
import {
  NativeTabs,
  Icon,
  Label,
  VectorIcon,
} from "expo-router/unstable-native-tabs";
import { useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import CustomCurvedTabBar from "@/components/CustomCurvedTabBar";
import type { AppTheme } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";

export default function TabsLayout() {
  const theme = useTheme<AppTheme>();
  const { useNativeTabs, _hasHydrated } = useSettingsStore();

  // Wait for store hydration to prevent tab bar twitching
  if (!_hasHydrated) {
    return null;
  }

  if (useNativeTabs) {
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
              <VectorIcon
                family={MaterialCommunityIcons}
                name="view-dashboard"
              />
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
              <VectorIcon
                family={MaterialCommunityIcons}
                name="clock-outline"
              />
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
          <Icon
            src={<VectorIcon family={MaterialCommunityIcons} name="cog" />}
          />
          <Label>Settings</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        lazy: true,
        // Enable smooth fade transitions between tab screens
        animation: "fade",
      }}
      tabBar={(props) => <CustomCurvedTabBar {...props} />}
    >
      <Tabs.Screen
        name="services/index"
        options={{
          title: "Services",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons name="server" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="recently-added"
        options={{
          title: "Recently Added",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons
              name="clock-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons
              name="view-dashboard"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="downloads/index"
        options={{
          title: "Downloads",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons name="download" color={color} size={size} />
          ),
        }}
      />
      {/* Anime Hub moved to a dashboard shortcut tile per user request */}
      <Tabs.Screen
        name="settings/index"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
