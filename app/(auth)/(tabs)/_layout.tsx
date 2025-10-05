import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { IconButton, useTheme } from 'react-native-paper';

import DashboardScreen from '@/../app/(auth)/(tabs)/dashboard';
import ServicesScreen from '@/../app/(auth)/(tabs)/services';
import DownloadsScreen from '@/../app/(auth)/(tabs)/downloads';
import RecentlyAddedScreen from '@/../app/(auth)/(tabs)/recently-added';
import SettingsScreen from '@/../app/(auth)/(tabs)/settings';

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="view-dashboard" size={size} iconColor={color} />
          ),
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="ServicesTab"
        component={ServicesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="server" size={size} iconColor={color} />
          ),
          tabBarLabel: 'Services',
        }}
      />
      <Tab.Screen
        name="DownloadsTab"
        component={DownloadsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="download" size={size} iconColor={color} />
          ),
          tabBarLabel: 'Downloads',
        }}
      />
      <Tab.Screen
        name="RecentlyAddedTab"
        component={RecentlyAddedScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="plus" size={size} iconColor={color} />
          ),
          tabBarLabel: 'Recent',
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="cog" size={size} iconColor={color} />
          ),
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;