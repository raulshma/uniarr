import { useWindowDimensions } from "react-native";

export type DeviceType = "phone" | "tablet" | "desktop";
export type LayoutBreakpoint = "compact" | "medium" | "expanded" | "large";

export interface ResponsiveLayout {
  deviceType: DeviceType;
  breakpoint: LayoutBreakpoint;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  columns: {
    default: number;
    portrait: number;
    landscape: number;
  };
  spacing: {
    small: number;
    medium: number;
    large: number;
  };
  sizing: {
    poster: {
      small: number;
      medium: number;
      large: number;
    };
    card: {
      width: number;
      height: number;
    };
  };
}

/**
 * Hook for responsive layout calculations
 * Provides device type detection and responsive sizing
 */
export const useResponsiveLayout = (): ResponsiveLayout => {
  const { width, height } = useWindowDimensions();

  // Determine device type based on screen size
  const getDeviceType = (w: number, h: number): DeviceType => {
    const minDimension = Math.min(w, h);

    // Tablet detection: minimum 600px in the smaller dimension
    if (minDimension >= 600) {
      return "tablet";
    }

    // Desktop detection: minimum 1024px in the smaller dimension
    if (minDimension >= 1024) {
      return "desktop";
    }

    return "phone";
  };

  // Determine Material Design 3 breakpoint
  const getBreakpoint = (w: number): LayoutBreakpoint => {
    if (w < 600) return "compact";
    if (w < 840) return "medium";
    if (w < 1200) return "expanded";
    return "large";
  };

  // Determine orientation
  const orientation = width > height ? "landscape" : "portrait";

  const deviceType = getDeviceType(width, height);
  const breakpoint = getBreakpoint(width);
  const isPhone = deviceType === "phone";
  const isTablet = deviceType === "tablet";
  const isDesktop = deviceType === "desktop";

  // Calculate responsive columns for grids
  const columns = {
    default: isDesktop ? 6 : isTablet ? 4 : 3,
    portrait: isDesktop ? 4 : isTablet ? 3 : 2,
    landscape: isDesktop ? 8 : isTablet ? 6 : 4,
  };

  // Calculate responsive spacing
  const spacing = {
    small: isDesktop ? 8 : isTablet ? 6 : 4,
    medium: isDesktop ? 16 : isTablet ? 12 : 8,
    large: isDesktop ? 24 : isTablet ? 18 : 12,
  };

  // Calculate responsive sizing
  const sizing = {
    poster: {
      small: isDesktop ? 120 : isTablet ? 100 : 80,
      medium: isDesktop ? 160 : isTablet ? 140 : 120,
      large: isDesktop ? 200 : isTablet ? 180 : 160,
    },
    card: {
      width: isDesktop ? 300 : isTablet ? 280 : 260,
      height: isDesktop ? 400 : isTablet ? 360 : 320,
    },
  };

  return {
    deviceType,
    breakpoint,
    isPhone,
    isTablet,
    isDesktop,
    width,
    height,
    orientation,
    columns,
    spacing,
    sizing,
  };
};

/**
 * Hook for getting responsive value based on breakpoint
 */
export const useResponsiveValue = <T>(
  values: Partial<Record<LayoutBreakpoint, T>>,
  defaultValue: T,
): T => {
  const { breakpoint } = useResponsiveLayout();
  return values[breakpoint] ?? defaultValue;
};

/**
 * Hook for responsive grid calculations
 */
export const useResponsiveGrid = () => {
  const { columns, spacing, width } = useResponsiveLayout();

  const calculateGridColumns = (itemWidth: number, gap?: number): number => {
    const actualGap = gap ?? spacing.medium;
    const availableWidth = width - actualGap; // Account for padding
    const columnsWithGap = Math.floor(
      (availableWidth + actualGap) / (itemWidth + actualGap),
    );
    return Math.max(1, Math.min(columnsWithGap, columns.default));
  };

  const calculateItemWidth = (desiredColumns: number, gap?: number): number => {
    const actualGap = gap ?? spacing.medium;
    const totalGapWidth = (desiredColumns - 1) * actualGap;
    const availableWidth = width - actualGap * 2; // Account for padding
    return Math.floor((availableWidth - totalGapWidth) / desiredColumns);
  };

  return {
    calculateGridColumns,
    calculateItemWidth,
    columns,
    spacing,
  };
};
