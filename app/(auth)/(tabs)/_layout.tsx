import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CustomCurvedTabBar from '@/components/CustomCurvedTabBar';
import type { AppTheme } from '@/constants/theme';

export default function TabsLayout() {
  const theme = useTheme<AppTheme>();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        lazy: true,
      }}
      tabBar={(props) => <CustomCurvedTabBar {...props} />}
    >
      <Tabs.Screen
        name="services/index"
        options={{
          title: "Services",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="server" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="recently-added"
        options={{
          title: "Recently Added",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clock-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="downloads/index"
        options={{
          title: "Downloads",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="download" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}