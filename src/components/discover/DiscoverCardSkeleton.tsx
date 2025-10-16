import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { SkeletonPlaceholder } from '@/components/common/Skeleton';
import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';

const DiscoverCardSkeleton = () => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width: 152,
          marginRight: spacing.md,
        },
        posterWrapper: {
          marginBottom: spacing.xs,
        },
        title: {
          marginTop: spacing.xs,
        },
      }),
    []
  );

  return (
    <View style={styles.container}>
      <View style={styles.posterWrapper}>
        <SkeletonPlaceholder width={152} height={228} borderRadius={12} />
      </View>
      <SkeletonPlaceholder width="100%" height={16} borderRadius={4} style={styles.title} />
    </View>
  );
};

export default DiscoverCardSkeleton;