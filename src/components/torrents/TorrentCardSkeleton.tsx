import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { SkeletonPlaceholder } from '@/components/common/Skeleton';
import type { AppTheme } from '@/constants/theme';

export type TorrentCardSkeletonProps = {
  style?: StyleProp<ViewStyle>;
  showActions?: boolean;
};

const TorrentCardSkeleton: React.FC<TorrentCardSkeletonProps> = ({ style, showActions = true }) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderRadius: theme.custom.spacing.md,
          backgroundColor: theme.colors.elevation.level1,
          padding: theme.custom.spacing.md,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.custom.spacing.sm,
        },
        metaRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: theme.custom.spacing.sm,
        },
        actionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.custom.spacing.xs,
          marginTop: theme.custom.spacing.sm,
        },
      }),
    [theme],
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <SkeletonPlaceholder width="75%" height={18} borderRadius={6} />
        <SkeletonPlaceholder width="20%" height={14} borderRadius={6} />
      </View>
      <SkeletonPlaceholder width="100%" height={6} borderRadius={4} />
      <View style={styles.metaRow}>
        <SkeletonPlaceholder width="45%" height={12} borderRadius={6} />
        <SkeletonPlaceholder width="30%" height={12} borderRadius={6} />
      </View>
      {showActions ? (
        <View style={styles.actionRow}>
          <SkeletonPlaceholder width={32} height={32} borderRadius={16} />
          <SkeletonPlaceholder width={32} height={32} borderRadius={16} />
          <SkeletonPlaceholder width={32} height={32} borderRadius={16} />
        </View>
      ) : null}
    </View>
  );
};

export default TorrentCardSkeleton;
