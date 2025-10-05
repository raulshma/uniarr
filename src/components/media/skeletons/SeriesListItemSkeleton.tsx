import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { SkeletonPlaceholder } from '@/components/common/Skeleton';
import type { AppTheme } from '@/constants/theme';

export type SeriesListItemSkeletonProps = {
  style?: StyleProp<ViewStyle>;
};

const SeriesListItemSkeleton: React.FC<SeriesListItemSkeletonProps> = ({ style }) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          padding: theme.custom.spacing.md,
          borderRadius: 18,
          backgroundColor: theme.colors.elevation.level1,
        },
        poster: {
          marginRight: theme.custom.spacing.lg,
        },
        content: {
          flex: 1,
        },
        line: {
          marginBottom: theme.custom.spacing.xs,
        },
        progressTrack: {
          marginTop: theme.custom.spacing.sm,
          marginBottom: theme.custom.spacing.xs,
        },
        meta: {
          marginTop: theme.custom.spacing.xs,
        },
      }),
    [theme],
  );

  return (
    <View style={[styles.container, style]}>
      <SkeletonPlaceholder width={96} height={144} borderRadius={16} style={styles.poster} />
      <View style={styles.content}>
        <SkeletonPlaceholder width="70%" height={18} borderRadius={6} style={styles.line} />
        <SkeletonPlaceholder width="50%" height={16} borderRadius={6} style={styles.line} />
        <SkeletonPlaceholder width="100%" height={8} borderRadius={4} style={styles.progressTrack} />
        <SkeletonPlaceholder width="40%" height={14} borderRadius={6} style={styles.meta} />
      </View>
    </View>
  );
};

export default SeriesListItemSkeleton;
