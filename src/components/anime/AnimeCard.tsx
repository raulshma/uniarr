import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme, Icon, Chip } from 'react-native-paper';
import type { AppTheme } from '@/constants/theme';
import { MediaPoster } from '@/components/media/MediaPoster';

export type AnimeCardProps = {
  id: number;
  title: string;
  posterUrl?: string;
  rating?: number;
  isWatchlisted?: boolean;
  isTracked?: boolean;
  onPress?: () => void;
  width?: number;
};

const AnimeCard: React.FC<AnimeCardProps> = ({
  title,
  posterUrl,
  rating,
  isWatchlisted = false,
  isTracked = false,
  onPress,
  width = 160,
}) => {
  const theme = useTheme<AppTheme>();

  const posterHeight = useMemo(() => width * 1.5, [width]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width,
          marginRight: theme.custom.spacing.md,
        },
        posterContainer: {
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: theme.custom.spacing.xs,
        },
        badge: {
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 10,
        },
        chip: {
          height: 24,
          backgroundColor: theme.colors.primary,
        },
        chipText: {
          fontSize: 10,
          lineHeight: 12,
          color: theme.colors.onPrimary,
          fontWeight: '600',
        },
        ratingContainer: {
          position: 'absolute',
          bottom: 8,
          right: 8,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderRadius: 6,
          zIndex: 10,
        },
        ratingText: {
          color: '#FFD700',
          fontSize: 12,
          fontWeight: 'bold',
          marginLeft: 2,
        },
        title: {
          color: theme.colors.onSurface,
          fontSize: 14,
          lineHeight: 18,
        },
      }),
    [theme, width]
  );

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${rating ? `, rated ${rating}` : ''}`}
    >
      <View style={styles.posterContainer}>
        <MediaPoster
          uri={posterUrl}
          size={width}
          aspectRatio={2 / 3}
          borderRadius={12}
          accessibilityLabel={`${title} poster`}
        />

        {isWatchlisted && (
          <View style={styles.badge}>
            <Chip compact style={styles.chip} textStyle={styles.chipText}>
              Watchlist
            </Chip>
          </View>
        )}

        {isTracked && !isWatchlisted && (
          <View style={styles.badge}>
            <Chip compact style={[styles.chip, { backgroundColor: theme.colors.tertiary }]} textStyle={styles.chipText}>
              Tracked
            </Chip>
          </View>
        )}

        {rating && (
          <View style={styles.ratingContainer}>
            <Icon source="star" size={14} color="#FFD700" />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>
        )}
      </View>

      <Text variant="bodyMedium" numberOfLines={2} style={styles.title}>
        {title}
      </Text>
    </Pressable>
  );
};

export default AnimeCard;
