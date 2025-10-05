import React from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CurvedBottomBar } from 'react-native-curved-bottom-bar';
import { IconButton, useTheme } from 'react-native-paper';

import DashboardScreen from '@/../app/(auth)/(tabs)/dashboard';
import ServicesScreen from '@/../app/(auth)/(tabs)/services';
import DownloadsScreen from '@/../app/(auth)/(tabs)/downloads';
import RecentlyAddedScreen from '@/../app/(auth)/(tabs)/recently-added';
import SettingsScreen from '@/../app/(auth)/(tabs)/settings';
import type { AppTheme } from '@/constants/theme';

const BottomTabNavigator = () => {
  const theme = useTheme<AppTheme>();

  const _renderIcon = (routeName: string, selectedTab: string) => {
    const isSelected = routeName === selectedTab;
    const color = isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant;

    switch (routeName) {
      case 'DashboardTab':
        return 'view-dashboard';
      case 'ServicesTab':
        return 'server';
      case 'RecentlyAddedTab':
        return 'clock-outline';
      case 'DownloadsTab':
        return 'download';
      case 'SettingsTab':
        return 'cog';
      default:
        return 'help-circle';
    }
  };

  const renderTabBar = ({ routeName, selectedTab, navigate }: {
    routeName: string;
    selectedTab: string;
    navigate: (routeName: string) => void;
  }) => {
    return (
      <TouchableOpacity
        onPress={() => navigate(routeName)}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconButton
          icon={_renderIcon(routeName, selectedTab)}
          size={25}
          iconColor={routeName === selectedTab ? theme.colors.primary : theme.colors.onSurfaceVariant}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <CurvedBottomBar.Navigator
        id="main-navigator"
        type="DOWN"
        style={{ backgroundColor: theme.colors.surface }}
        borderColor={theme.colors.outlineVariant}
        borderWidth={1}
        height={55}
        width={undefined}
        circleWidth={50}
        circlePosition={undefined}
        bgColor={theme.colors.surface}
        initialRouteName="ServicesTab"
        borderTopLeftRight
        shadowStyle={{
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.1,
          shadowRadius: 5,
        }}
        screenListeners={undefined}
        screenOptions={{ headerShown: false }}
        defaultScreenOptions={undefined}
        backBehavior="history"
        renderCircle={({ selectedTab, navigate }: { selectedTab: string; navigate: (routeName: string) => void }) => (
          <Animated.View style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#E8E8E8',
            bottom: 30,
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 1,
            },
            shadowOpacity: 0.2,
            shadowRadius: 1.41,
            elevation: 1,
          }}>
            <TouchableOpacity
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 25,
                width: 50,
                height: 50,
              }}
              onPress={() => navigate('RecentlyAddedTab')}
            >
              <IconButton
                icon="clock-outline"
                size={25}
                iconColor="gray"
              />
            </TouchableOpacity>
          </Animated.View>
        )}
        tabBar={renderTabBar}
      >
        <CurvedBottomBar.Screen
          name="ServicesTab"
          position="LEFT"
          component={() => <ServicesScreen />}
        />
        <CurvedBottomBar.Screen
          name="DashboardTab"
          position="LEFT"
          component={() => <DashboardScreen />}
        />
        <CurvedBottomBar.Screen
          name="RecentlyAddedTab"
          position="CENTER"
          component={() => <RecentlyAddedScreen />}
        />
        <CurvedBottomBar.Screen
          name="DownloadsTab"
          position="RIGHT"
          component={() => <DownloadsScreen />}
        />
        <CurvedBottomBar.Screen
          name="SettingsTab"
          position="RIGHT"
          component={() => <SettingsScreen />}
        />
      </CurvedBottomBar.Navigator>
    </View>
  );
};

export default BottomTabNavigator;