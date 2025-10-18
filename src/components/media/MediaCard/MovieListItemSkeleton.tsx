import React, { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import type { AppTheme } from "@/constants/theme";

export type MovieListItemSkeletonProps = {
  style?: StyleProp<ViewStyle>;
};

const MovieListItemSkeleton: React.FC<MovieListItemSkeletonProps> = ({
  style,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: theme.custom.spacing.sm,
          paddingHorizontal: theme.custom.spacing.md,
          borderRadius: 12,
        },
        poster: {
          marginRight: theme.custom.spacing.md,
        },
        content: {
          flex: 1,
        },
        line: {
          marginBottom: theme.custom.spacing.xs,
        },
        metadata: {
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
        width={72}
        height={108}
        borderRadius={10}
        style={styles.poster}
      />
      <View style={styles.content}>
        <SkeletonPlaceholder
          width="80%"
          height={18}
          borderRadius={6}
          style={styles.line}
        />
        <SkeletonPlaceholder
          width="60%"
          height={14}
          borderRadius={6}
          style={styles.line}
        />
        <SkeletonPlaceholder
          width="40%"
          height={12}
          borderRadius={6}
          style={styles.metadata}
        />
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

export default MovieListItemSkeleton;
