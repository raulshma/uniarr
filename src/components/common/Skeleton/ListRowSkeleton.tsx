import React, { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import SkeletonPlaceholder from "./SkeletonPlaceholder";
import type { AppTheme } from "@/constants/theme";

export type ListRowSkeletonProps = {
  style?: StyleProp<ViewStyle>;
  showSecondaryLine?: boolean;
  showAction?: boolean;
};

const ListRowSkeleton: React.FC<ListRowSkeletonProps> = ({
  style,
  showSecondaryLine = true,
  showAction = true,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          alignItems: "center",
          padding: theme.custom.spacing.md,
          borderRadius: 12,
          backgroundColor: theme.colors.elevation.level1,
        },
        icon: {
          marginRight: theme.custom.spacing.md,
        },
        content: {
          flex: 1,
        },
        line: {
          marginBottom: theme.custom.spacing.xs,
        },
        action: {
          marginLeft: theme.custom.spacing.sm,
        },
      }),
    [theme],
  );

  return (
    <View style={[styles.container, style]}>
      <SkeletonPlaceholder
        width={48}
        height={48}
        borderRadius={24}
        style={styles.icon}
      />
      <View style={styles.content}>
        <SkeletonPlaceholder
          width="70%"
          height={18}
          borderRadius={6}
          style={styles.line}
        />
        {showSecondaryLine ? (
          <SkeletonPlaceholder width="50%" height={14} borderRadius={6} />
        ) : null}
      </View>
      {showAction ? (
        <SkeletonPlaceholder
          width={24}
          height={24}
          borderRadius={12}
          style={styles.action}
        />
      ) : null}
    </View>
  );
};

export default ListRowSkeleton;
