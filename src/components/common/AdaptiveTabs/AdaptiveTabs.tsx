import React from "react";
import { View, StyleSheet, Platform, type ViewStyle } from "react-native";
import {
  BottomNavigation,
  Surface,
  useTheme,
  type BottomNavigationProps,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import type { AppTheme } from "@/constants/theme";

export interface AdaptiveTabProps {
  /**
   * Tab configuration object
   */
  tabs: {
    key: string;
    title: string;
    focusedIcon: string;
    unfocusedIcon: string;
    badge?: boolean | string | number;
  }[];
  /**
   * Currently active tab key
   */
  activeTab: string;
  /**
   * Callback when tab changes
   */
  onTabChange: (key: string) => void;
  /**
   * Whether to show labels
   * @default true
   */
  showLabels?: boolean;
  /**
   * Whether to shift labels on focus (mobile behavior)
   * @default true
   */
  shifting?: boolean;
  /**
   * Custom style for the tab container
   */
  style?: ViewStyle;
  /**
   * Whether to use compact mode on tablets
   * @default false
   */
  compact?: boolean;
}

export const AdaptiveTabs: React.FC<AdaptiveTabProps> = ({
  tabs,
  activeTab,
  onTabChange,
  showLabels = true,
  shifting = false,
  style,
  compact = false,
}) => {
  const theme = useTheme<AppTheme>();
  const { isTablet, isDesktop } = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  // Determine if we should use side navigation on larger screens
  const useSideNavigation = isTablet || isDesktop;

  // Configure tabs based on screen size
  const getTabBarProps = (): BottomNavigationProps<any> => {
    const baseProps: BottomNavigationProps<any> = {
      navigationState: {
        index: tabs.findIndex((tab) => tab.key === activeTab),
        routes: tabs.map((tab) => ({
          key: tab.key,
          title: tab.title,
          focusedIcon: tab.focusedIcon,
          unfocusedIcon: tab.unfocusedIcon,
          badge: tab.badge,
        })),
      },
      onIndexChange: (index: number) => {
        const tab = tabs[index];
        if (tab) {
          onTabChange(tab.key);
        }
      },
      renderScene: () => null, // Required prop but not used for tab bar only
      barStyle: [
        styles.barStyle,
        {
          backgroundColor: theme.colors.surface,
          paddingBottom: useSideNavigation ? 0 : insets.bottom,
        },
      ],
      activeColor: theme.colors.primary,
      inactiveColor: theme.colors.onSurfaceVariant,
      renderTouchable:
        Platform.OS === "ios"
          ? undefined
          : (props: any) => (
              <Surface
                style={[
                  styles.touchableSurface,
                  {
                    backgroundColor: props.focused
                      ? theme.colors.primaryContainer
                      : "transparent",
                    borderRadius: theme.roundness,
                  },
                ]}
                elevation={props.focused ? 2 : 0}
              >
                {props.children}
              </Surface>
            ),
    };

    if (useSideNavigation) {
      // Side navigation for tablets/desktop
      return {
        ...baseProps,
        style: [
          styles.sideNavigation,
          {
            backgroundColor: theme.colors.surface,
            borderRightColor: theme.colors.outlineVariant,
            borderRightWidth: 1,
          },
          style,
        ],
        labeled: !compact,
        shifting: false,
        sceneAnimationEnabled: false,
        compact: compact,
      };
    }

    // Bottom navigation for phones
    return {
      ...baseProps,
      style: [
        styles.bottomNavigation,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          borderTopWidth: 1,
        },
        style,
      ],
      labeled: showLabels,
      shifting: shifting && showLabels,
      sceneAnimationEnabled: true,
      compact: false,
    };
  };

  if (useSideNavigation) {
    return (
      <View
        style={[
          styles.sideNavigationContainer,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <View style={styles.sideNavigationHeader}>
          {/* Could add app logo/title here */}
        </View>
        <BottomNavigation {...getTabBarProps()} />
      </View>
    );
  }

  return (
    <Surface
      style={[
        styles.bottomNavigationContainer,
        { backgroundColor: theme.colors.surface },
      ]}
    >
      <BottomNavigation {...getTabBarProps()} />
    </Surface>
  );
};

const styles = StyleSheet.create({
  bottomNavigationContainer: {
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bottomNavigation: {
    borderTopWidth: 0,
  },
  barStyle: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  sideNavigationContainer: {
    width: 280,
    height: "100%",
    borderRightWidth: 1,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sideNavigation: {
    flex: 1,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  sideNavigationHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.12)",
  },
  touchableSurface: {
    margin: 4,
  },
});
