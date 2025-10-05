import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { IconButton } from 'react-native-paper';

import DashboardScreen from '@/../app/(auth)/dashboard';
import ServicesScreen from '@/../app/(auth)/services';
import DownloadsScreen from '@/../app/(auth)/downloads';
import SettingsScreen from '@/../app/(auth)/settings/add-service';

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1A1A1A',
          borderTopColor: '#333333',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#FFD700',
        tabBarInactiveTintColor: '#666666',
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
