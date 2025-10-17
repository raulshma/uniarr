import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";

import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

export interface ResponsiveLayoutProps {
  /**
   * Children to render
   */
  children: React.ReactNode;
  /**
   * Layout type for different screen sizes
   */
  layout?: {
    phone?: "column" | "row";
    tablet?: "column" | "row" | "grid";
    desktop?: "column" | "row" | "grid";
  };
  /**
   * Custom styles for different breakpoints
   */
  style?: {
    phone?: ViewStyle;
    tablet?: ViewStyle;
    desktop?: ViewStyle;
  };
  /**
   * Padding for different breakpoints
   */
  padding?: {
    phone?: number;
    tablet?: number;
    desktop?: number;
  };
  /**
   * Maximum width for content
   */
  maxWidth?: number;
  /**
   * Whether to center content
   * @default true
   */
  centerContent?: boolean;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  layout = {
    phone: "column",
    tablet: "column",
    desktop: "row",
  },
  style,
  padding = {
    phone: 16,
    tablet: 24,
    desktop: 32,
  },
  maxWidth = 1200,
  centerContent = true,
}) => {
  const { isPhone, isTablet, width } = useResponsiveLayout();

  // Determine current layout type
  const getLayoutType = () => {
    if (isPhone) return layout.phone ?? "column";
    if (isTablet) return layout.tablet ?? "column";
    return layout.desktop ?? "row";
  };

  // Determine current padding
  const getCurrentPadding = () => {
    if (isPhone) return padding.phone ?? 16;
    if (isTablet) return padding.tablet ?? 24;
    return padding.desktop ?? 32;
  };

  // Determine current style
  const getCurrentStyle = () => {
    if (isPhone) return style?.phone;
    if (isTablet) return style?.tablet;
    return style?.desktop;
  };

  const layoutType = getLayoutType();
  const currentPadding = getCurrentPadding();
  const currentStyle = getCurrentStyle();

  // Get container style based on layout type
  const getContainerStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flex: 1,
      padding: currentPadding,
    };

    // Apply max width and centering on larger screens
    if (width > 800 && centerContent) {
      baseStyle.alignSelf = "center";
      baseStyle.maxWidth = maxWidth;
    }

    // Apply layout-specific styles
    switch (layoutType) {
      case "row":
        return {
          ...baseStyle,
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "flex-start",
        };
      case "grid":
        return {
          ...baseStyle,
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignContent: "flex-start",
        };
      case "column":
      default:
        return {
          ...baseStyle,
          flexDirection: "column",
        };
    }
  };

  return (
    <View style={[styles.container, getContainerStyle(), currentStyle]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
