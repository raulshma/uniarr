import React, { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import type { AppTheme } from "@/constants/theme";

export type ServiceCardSkeletonProps = {
  style?: StyleProp<ViewStyle>;
};

const ServiceCardSkeleton: React.FC<ServiceCardSkeletonProps> = ({ style }) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          alignItems: "center",
          padding: theme.custom.spacing.md,
          borderRadius: theme.custom.sizes.borderRadius.lg,
          backgroundColor: theme.colors.elevation.level1,
        },
        icon: {
          marginRight: theme.custom.spacing.md,
        },
        content: {
          flex: 1,
        },
        statusRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.custom.spacing.xs,
          marginTop: theme.custom.spacing.xs,
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
        <SkeletonPlaceholder width="60%" height={18} borderRadius={6} />
        <SkeletonPlaceholder
          width="40%"
          height={14}
          borderRadius={6}
          style={{
            marginTop: theme.custom.spacing.xxs,
            marginBottom: theme.custom.spacing.xs,
          }}
        />
        <View style={styles.statusRow}>
          <SkeletonPlaceholder width={12} height={12} borderRadius={6} />
          <SkeletonPlaceholder width="35%" height={12} borderRadius={6} />
        </View>
      </View>
      <SkeletonPlaceholder
        width={24}
        height={24}
        borderRadius={12}
        style={styles.action}
      />
    </View>
  );
};

export default ServiceCardSkeleton;
