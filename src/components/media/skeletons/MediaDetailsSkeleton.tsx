import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, useTheme } from 'react-native-paper';

import { SkeletonPlaceholder } from '@/components/common/Skeleton/';
import type { AppTheme } from '@/constants/theme';

export type MediaDetailsSkeletonProps = {
  style?: StyleProp<ViewStyle>;
  showSeasons?: boolean;
};

const MediaDetailsSkeleton: React.FC<MediaDetailsSkeletonProps> = ({
  style,
  showSeasons = true
}) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        contentContainer: {
          paddingBottom: 32,
        },
        posterContainer: {
          alignItems: 'center',
          paddingVertical: 20,
        },
        titleContainer: {
          paddingHorizontal: 20,
          marginBottom: 16,
        },
        overviewContainer: {
          paddingHorizontal: 20,
          marginBottom: 24,
        },
        detailsCard: {
          paddingHorizontal: 20,
          marginBottom: 20,
        },
        card: {
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 12,
        },
        cardContent: {
          padding: 16,
        },
        detailRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 12,
        },
        fileInfoSection: {
          paddingHorizontal: 20,
          marginBottom: 32,
        },
        sectionTitle: {
          marginBottom: 16,
        },
        fileInfoCard: {
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 12,
        },
        seasonsSection: {
          paddingHorizontal: 20,
          marginTop: 32,
        },
        seasonsContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 16,
        },
        seasonCard: {
          width: '48%',
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 12,
          padding: 12,
          alignItems: 'center',
        },
        episodesSection: {
          paddingHorizontal: 20,
          marginTop: 24,
        },
        episodeItem: {
          flexDirection: 'row',
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          alignItems: 'center',
        },
      }),
    [theme],
  );

  return (
    <ScrollView style={[styles.container, style]} contentContainerStyle={styles.contentContainer}>
      {/* Large Poster */}
      <View style={styles.posterContainer}>
        <SkeletonPlaceholder width={280} height={420} borderRadius={16} />
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <SkeletonPlaceholder width="80%" height={32} borderRadius={8} />
      </View>

      {/* Overview */}
      <View style={styles.overviewContainer}>
        <SkeletonPlaceholder width="100%" height={16} borderRadius={6} style={{ marginBottom: 8 }} />
        <SkeletonPlaceholder width="100%" height={16} borderRadius={6} style={{ marginBottom: 8 }} />
        <SkeletonPlaceholder width="70%" height={16} borderRadius={6} />
      </View>

      {/* Details Card */}
      <View style={styles.detailsCard}>
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.detailRow}>
              <SkeletonPlaceholder width="30%" height={16} borderRadius={6} />
              <SkeletonPlaceholder width="20%" height={16} borderRadius={6} />
            </View>
            <View style={styles.detailRow}>
              <SkeletonPlaceholder width="25%" height={16} borderRadius={6} />
              <SkeletonPlaceholder width="25%" height={16} borderRadius={6} />
            </View>
            <View style={styles.detailRow}>
              <SkeletonPlaceholder width="35%" height={16} borderRadius={6} />
              <SkeletonPlaceholder width={80} height={32} borderRadius={16} />
            </View>
          </Card.Content>
        </Card>
      </View>

      {/* File Information */}
      <View style={styles.fileInfoSection}>
        <SkeletonPlaceholder width="40%" height={24} borderRadius={8} style={styles.sectionTitle} />
        <Card style={styles.fileInfoCard}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.detailRow}>
              <SkeletonPlaceholder width="25%" height={16} borderRadius={6} />
              <SkeletonPlaceholder width="30%" height={16} borderRadius={6} />
            </View>
            <View style={styles.detailRow}>
              <SkeletonPlaceholder width="20%" height={16} borderRadius={6} />
              <SkeletonPlaceholder width="25%" height={16} borderRadius={6} />
            </View>
            <View style={styles.detailRow}>
              <SkeletonPlaceholder width="35%" height={16} borderRadius={6} />
              <SkeletonPlaceholder width="20%" height={16} borderRadius={6} />
            </View>
          </Card.Content>
        </Card>
      </View>

      {/* Seasons - Only for series */}
      {showSeasons && (
        <View style={styles.seasonsSection}>
          <SkeletonPlaceholder width="25%" height={24} borderRadius={8} style={styles.sectionTitle} />
          <View style={styles.seasonsContainer}>
            <View style={styles.seasonCard}>
              <SkeletonPlaceholder width={120} height={180} borderRadius={12} />
              <View style={{ alignItems: 'center', marginTop: 8 }}>
                <SkeletonPlaceholder width="60%" height={18} borderRadius={6} style={{ marginBottom: 4 }} />
                <SkeletonPlaceholder width="50%" height={14} borderRadius={6} />
              </View>
            </View>
            <View style={styles.seasonCard}>
              <SkeletonPlaceholder width={120} height={180} borderRadius={12} />
              <View style={{ alignItems: 'center', marginTop: 8 }}>
                <SkeletonPlaceholder width="60%" height={18} borderRadius={6} style={{ marginBottom: 4 }} />
                <SkeletonPlaceholder width="50%" height={14} borderRadius={6} />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Episodes - Only for series */}
      {showSeasons && (
        <View style={styles.episodesSection}>
          <SkeletonPlaceholder width="25%" height={24} borderRadius={8} style={styles.sectionTitle} />
          <View style={styles.episodeItem}>
            <SkeletonPlaceholder width={80} height={120} borderRadius={8} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <SkeletonPlaceholder width="70%" height={18} borderRadius={6} style={{ marginBottom: 6 }} />
              <SkeletonPlaceholder width="50%" height={14} borderRadius={6} style={{ marginBottom: 8 }} />
              <SkeletonPlaceholder width="30%" height={14} borderRadius={6} />
            </View>
          </View>
          <View style={styles.episodeItem}>
            <SkeletonPlaceholder width={80} height={120} borderRadius={8} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <SkeletonPlaceholder width="70%" height={18} borderRadius={6} style={{ marginBottom: 6 }} />
              <SkeletonPlaceholder width="50%" height={14} borderRadius={6} style={{ marginBottom: 8 }} />
              <SkeletonPlaceholder width="30%" height={14} borderRadius={6} />
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default MediaDetailsSkeleton;
