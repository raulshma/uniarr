import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { SkeletonPlaceholder } from '@/components/common/Skeleton';
import type { AppTheme } from '@/constants/theme';

export type MediaCardSkeletonProps = {
  style?: StyleProp<ViewStyle>;
  showFooter?: boolean;
};

const MediaCardSkeleton: React.FC<MediaCardSkeletonProps> = ({ style, showFooter = true }) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          padding: theme.custom.spacing.md,
          backgroundColor: theme.colors.elevation.level1,
          borderRadius: 16,
        },
        poster: {
          marginRight: theme.custom.spacing.md,
        },
        content: {
          flex: 1,
          justifyContent: 'flex-start',
        },
        line: {
          marginBottom: theme.custom.spacing.xs,
        },
        chipsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.custom.spacing.xs,
          marginTop: theme.custom.spacing.xs,
        },
        footer: {
          marginTop: theme.custom.spacing.md,
        },
      }),
    [theme],
  );

  return (
    <View style={[styles.container, style]}>
      <SkeletonPlaceholder width={92} height={136} borderRadius={12} style={styles.poster} />
      <View style={styles.content}>
        <SkeletonPlaceholder width="70%" height={20} borderRadius={6} style={styles.line} />
        <SkeletonPlaceholder width="55%" height={16} borderRadius={6} style={styles.line} />
        <View style={styles.chipsRow}>
          <SkeletonPlaceholder width={82} height={24} borderRadius={12} />
          <SkeletonPlaceholder width={74} height={24} borderRadius={12} />
        </View>
        {showFooter ? (
          <View style={styles.footer}>
            <SkeletonPlaceholder width="100%" height={36} borderRadius={12} />
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default MediaCardSkeleton;
