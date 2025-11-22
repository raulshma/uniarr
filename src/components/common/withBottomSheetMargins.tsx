import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";

interface WithBottomSheetMarginsProps {
  children: React.ReactNode;
  style?: ViewStyle;
  horizontalMargin?: number;
}

/**
 * HOC that adds consistent horizontal margins to bottom sheets and modals
 *
 * Usage:
 * ```tsx
 * <BottomDrawer>
 *   <WithBottomSheetMargins>
 *     <YourContent />
 *   </WithBottomSheetMargins>
 * </BottomDrawer>
 * ```
 */
export const WithBottomSheetMargins: React.FC<WithBottomSheetMarginsProps> = ({
  children,
  style,
  horizontalMargin = spacing.md,
}) => {
  const theme = useTheme<AppTheme>();

  return (
    <View
      style={[
        styles.container,
        {
          marginHorizontal: horizontalMargin,
          backgroundColor: theme.colors.surface,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

/**
 * HOC function that wraps a component with bottom sheet margins
 *
 * Usage:
 * ```tsx
 * const MyComponentWithMargins = withBottomSheetMargins(MyComponent);
 * ```
 */
export function withBottomSheetMargins<P extends object>(
  Component: React.ComponentType<P>,
  defaultMargin: number = spacing.md,
) {
  return React.forwardRef<any, P & { horizontalMargin?: number }>(
    (props, ref) => {
      const { horizontalMargin = defaultMargin, ...rest } = props;

      return (
        <WithBottomSheetMargins horizontalMargin={horizontalMargin}>
          <Component {...(rest as P)} ref={ref} />
        </WithBottomSheetMargins>
      );
    },
  );
}

export default WithBottomSheetMargins;
