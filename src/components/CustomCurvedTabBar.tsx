import React, { useMemo, useCallback } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Dimensions,
  type PressableStateCallbackType,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Path, Svg } from "react-native-svg";
import { getPathDown } from "react-native-curved-bottom-bar/src/CurvedBottomBar/utils/pathDown";
import type { AppTheme } from "@/constants/theme";

const { width: screenWidth } = Dimensions.get("window");

const CustomCurvedTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();

  // Generate the curved path for the bottom bar
  const curvedPath = useMemo(
    () => getPathDown(screenWidth, 65, 65, true, "CENTER"),
    [],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        mainContainer: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 65,
        },
        curvedBackground: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
        },
        contentContainer: {
          height: 65,
          alignItems: "center",
        },
        tabPosition: {
          position: "absolute",
          width: 60, // Fixed width for each tab area
          height: 65,
          alignItems: "center",
          justifyContent: "center",
        },
        tabItem: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 8,
        },
        tabItemPressed: {
          opacity: 0.85,
        },
        tabItemFocused: {
          borderWidth: 2,
          borderRadius: 28,
          paddingVertical: 6,
        },
        centerButton: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          position: "absolute",
          bottom: 30,
          left: screenWidth / 2 - 28,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 8,
        },
        centerButtonPressed: {
          opacity: 0.9,
        },
        centerButtonFocused: {
          borderWidth: 2,
        },
      }),
    [],
  );

  const renderTab = useCallback(
    (route: any, index: number) => {
      const descriptor = descriptors[route.key];
      if (!descriptor) return null;

      const { options } = descriptor;
      const isFocused = state.index === index;

      const onPress = () => {
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      };

      const onLongPress = () => {
        navigation.emit({
          type: "tabLongPress",
          target: route.key,
        });
      };

      let iconName = "";
      switch (route.name) {
        case "dashboard/index":
          iconName = "view-dashboard";
          break;
        case "services/index":
          iconName = "server";
          break;
        case "recently-added":
          iconName = "clock-outline";
          break;
        case "downloads/index":
          iconName = "download";
          break;
        case "settings/index":
          iconName = "cog";
          break;
        default:
          iconName = "help-circle";
      }

      const labelCandidate = (() => {
        if (typeof options.tabBarLabel === "string") {
          return options.tabBarLabel;
        }

        if (typeof options.title === "string") {
          return options.title;
        }

        return route.name;
      })();

      const accessibilityLabel = `${labelCandidate} tab`;
      const accessibilityHint = isFocused
        ? `You're currently viewing the ${labelCandidate} tab`
        : `Navigate to the ${labelCandidate} tab`;

      return (
        <Pressable
          key={route.key}
          onPress={onPress}
          onLongPress={onLongPress}
          style={(state: PressableStateCallbackType) => {
            const { pressed } = state;
            const isFocused = Boolean((state as { focused?: boolean }).focused);
            const composed: any[] = [styles.tabItem];

            if (pressed) {
              composed.push(styles.tabItemPressed);
            }

            if (isFocused) {
              composed.push(styles.tabItemFocused);
              composed.push({ borderColor: theme.colors.primary });
            }

            return composed;
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: isFocused }}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          focusable
        >
          <MaterialCommunityIcons
            name={iconName as any}
            size={24}
            color={
              isFocused ? theme.colors.primary : theme.colors.onSurfaceVariant
            }
          />
        </Pressable>
      );
    },
    [
      descriptors,
      state.index,
      navigation,
      styles,
      theme.colors.primary,
      theme.colors.onSurfaceVariant,
    ],
  );

  const renderCenterButton = useCallback(() => {
    const dashboardRoute = state.routes.find(
      (route) => route.name === "dashboard/index",
    );
    const isDashboardFocused =
      state.index ===
      state.routes.findIndex((route) => route.name === "dashboard/index");

    const onPress = () => {
      if (dashboardRoute) {
        const event = navigation.emit({
          type: "tabPress",
          target: dashboardRoute.key,
          canPreventDefault: true,
        });

        if (!isDashboardFocused && !event.defaultPrevented) {
          navigation.navigate(dashboardRoute.name);
        }
      }
    };

    const accessibilityLabel = isDashboardFocused
      ? "Dashboard tab, selected"
      : "Dashboard tab";
    const accessibilityHint = isDashboardFocused
      ? "Displays the dashboard overview"
      : "Navigate to the dashboard overview";

    return (
      <Pressable
        onPress={onPress}
        style={(state: PressableStateCallbackType) => {
          const { pressed } = state;
          const isFocused = Boolean((state as { focused?: boolean }).focused);
          const composed: any[] = [
            styles.centerButton,
            {
              backgroundColor: isDashboardFocused
                ? theme.colors.primary
                : theme.colors.surfaceVariant,
              shadowColor: theme.colors.shadow,
            },
          ];

          if (pressed) {
            composed.push(styles.centerButtonPressed);
          }

          if (isFocused) {
            composed.push(styles.centerButtonFocused);
            composed.push({ borderColor: theme.colors.primary });
          }

          return composed;
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: isDashboardFocused }}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        focusable
      >
        <MaterialCommunityIcons
          name="view-dashboard"
          size={28}
          color={
            isDashboardFocused
              ? theme.colors.onPrimary
              : theme.colors.onSurfaceVariant
          }
        />
      </Pressable>
    );
  }, [
    state.routes,
    state.index,
    navigation,
    styles,
    theme.colors.primary,
    theme.colors.surfaceVariant,
    theme.colors.shadow,
    theme.colors.onPrimary,
    theme.colors.onSurfaceVariant,
  ]);

  const tabPositions = useMemo(
    () => [
      { left: screenWidth * 0.08 }, // services (far left)
      { left: screenWidth * 0.25 }, // recently-added (near left)
      { right: screenWidth * 0.25 }, // downloads (near right)
      { right: screenWidth * 0.08 }, // settings (far right)
    ],
    [],
  );

  return (
    <View style={[styles.mainContainer, { paddingBottom: insets.bottom }]}>
      {/* Curved background */}
      <View style={styles.curvedBackground}>
        <Svg width={screenWidth} height={65}>
          <Path fill={theme.colors.surface} d={curvedPath} />
        </Svg>
      </View>

      {/* Tab content overlay */}
      <View style={styles.contentContainer}>
        {/* Positioned tabs around center button */}
        {state.routes
          .filter((route) => route.name !== "dashboard/index") // Exclude dashboard from spread tabs
          .map((route, index) => {
            // Find the original index in the state.routes array
            const originalIndex = state.routes.findIndex(
              (r) => r.key === route.key,
            );
            // Position each tab at specific locations around the center
            const position = tabPositions[index] || {};

            return (
              <View key={route.key} style={[styles.tabPosition, position]}>
                {renderTab(route, originalIndex)}
              </View>
            );
          })}

        {/* Center button (Dashboard) */}
        {renderCenterButton()}
      </View>
    </View>
  );
};

export default CustomCurvedTabBar;
