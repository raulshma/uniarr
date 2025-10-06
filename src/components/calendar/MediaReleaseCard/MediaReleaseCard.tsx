import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, Chip, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';
import type { MediaRelease } from '@/models/calendar.types';
import { MediaPoster } from '@/components/media/MediaPoster';

export type MediaReleaseCardProps = {
  release: MediaRelease;
  compact?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const MediaReleaseCard: React.FC<MediaReleaseCardProps> = ({
  release,
  compact = false,
  onPress,
  style,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: compact ? 6 : 8,
      padding: compact ? theme.custom.spacing.xs : theme.custom.spacing.sm,
      marginBottom: compact ? 0 : theme.custom.spacing.xs,
    },
    pressable: {
      flex: 1,
    },
    content: {
      flexDirection: compact ? 'row' : 'column',
      alignItems: compact ? 'center' : 'flex-start',
    },
    posterContainer: {
      marginRight: compact ? theme.custom.spacing.xs : 0,
      marginBottom: compact ? 0 : theme.custom.spacing.xs,
    },
    info: {
      flex: 1,
      minWidth: 0, // Allow text to wrap
    },
    title: {
      fontSize: compact 
        ? theme.custom.typography.bodySmall.fontSize 
        : theme.custom.typography.bodyMedium.fontSize,
      fontFamily: compact 
        ? theme.custom.typography.bodySmall.fontFamily 
        : theme.custom.typography.bodyMedium.fontFamily,
      fontWeight: compact 
        ? theme.custom.typography.bodySmall.fontWeight as any
        : theme.custom.typography.bodyMedium.fontWeight as any,
      lineHeight: compact 
        ? theme.custom.typography.bodySmall.lineHeight 
        : theme.custom.typography.bodyMedium.lineHeight,
      letterSpacing: compact 
        ? theme.custom.typography.bodySmall.letterSpacing 
        : theme.custom.typography.bodyMedium.letterSpacing,
      color: theme.colors.onSurfaceVariant,
    },
    subtitle: {
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      fontWeight: theme.custom.typography.labelSmall.fontWeight as any,
      lineHeight: theme.custom.typography.labelSmall.lineHeight,
      letterSpacing: theme.custom.typography.labelSmall.letterSpacing,
      color: theme.colors.onSurfaceVariant,
      opacity: 0.7,
      marginTop: compact ? 0 : theme.custom.spacing.xxs,
    },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: compact ? 0 : theme.custom.spacing.xs,
    },
    chip: {
      marginRight: theme.custom.spacing.xxs,
      marginBottom: theme.custom.spacing.xxs,
    },
  });

  const statusConfig = useMemo(() => {
    switch (release.status) {
      case 'upcoming':
        return { label: 'Upcoming', tone: 'primary' as const };
      case 'released':
        return { label: 'Released', tone: 'secondary' as const };
      case 'delayed':
        return { label: 'Delayed', tone: 'error' as const };
      case 'cancelled':
        return { label: 'Cancelled', tone: 'outline' as const };
      default:
        return { label: 'Unknown', tone: 'outline' as const };
    }
  }, [release.status]);

  const typeConfig = useMemo(() => {
    switch (release.type) {
      case 'movie':
        return { label: 'Movie', icon: 'movie-open' };
      case 'series':
        return { label: 'Series', icon: 'television-classic' };
      case 'episode':
        return { label: 'Episode', icon: 'play-circle' };
      default:
        return { label: 'Media', icon: 'play' };
    }
  }, [release.type]);

  const downloadStatusConfig = useMemo(() => {
    if (!release.downloadStatus) return null;
    
    switch (release.downloadStatus) {
      case 'available':
        return { label: 'Available', tone: 'secondary' as const };
      case 'downloading':
        return { label: 'Downloading', tone: 'primary' as const };
      case 'queued':
        return { label: 'Queued', tone: 'tertiary' as const };
      case 'missing':
        return { label: 'Missing', tone: 'error' as const };
      case 'unknown':
        return { label: 'Unknown', tone: 'outline' as const };
      default:
        return null;
    }
  }, [release.downloadStatus]);

  const getChipStyle = (tone: string) => {
    const toneColorMap: Record<string, { background: string; text: string }> = {
      primary: { background: theme.colors.primaryContainer, text: theme.colors.onPrimaryContainer },
      secondary: { background: theme.colors.secondaryContainer, text: theme.colors.onSecondaryContainer },
      tertiary: { background: theme.colors.tertiaryContainer, text: theme.colors.onTertiaryContainer },
      error: { background: theme.colors.errorContainer, text: theme.colors.onErrorContainer },
      outline: { background: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant },
    };

    const colors = toneColorMap[tone] || toneColorMap.outline;
    return {
      backgroundColor: colors?.background || theme.colors.surfaceVariant,
      textColor: colors?.text || theme.colors.onSurfaceVariant,
    };
  };

  const formatReleaseDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0) return `In ${diffDays} days`;
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getSubtitle = () => {
    const parts: string[] = [];
    
    if (release.type === 'episode' && release.seriesTitle) {
      parts.push(release.seriesTitle);
      if (release.seasonNumber && release.episodeNumber) {
        parts.push(`S${release.seasonNumber}E${release.episodeNumber}`);
      }
    } else if (release.year) {
      parts.push(String(release.year));
    }
    
    if (release.network) {
      parts.push(release.network);
    }
    
    return parts.join(' • ');
  };

  const statusChipStyle = getChipStyle(statusConfig.tone);
  const downloadChipStyle = downloadStatusConfig ? getChipStyle(downloadStatusConfig.tone) : null;

  return (
    <View style={[styles.container, style]}>
      <Pressable
        style={styles.pressable}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${release.title}, ${typeConfig.label}, ${statusConfig.label}`}
      >
        <View style={styles.content}>
          {!compact && release.posterUrl && (
            <View style={styles.posterContainer}>
              <MediaPoster
                uri={release.posterUrl}
                size="small"
                borderRadius={6}
                showPlaceholderLabel={false}
              />
            </View>
          )}

          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={compact ? 1 : 2}>
              {release.title}
            </Text>
            
            <Text style={styles.subtitle} numberOfLines={1}>
              {getSubtitle()}
            </Text>

            {!compact && (
              <View style={styles.badges}>
                <Chip
                  compact
                  mode="flat"
                  style={[styles.chip, { backgroundColor: statusChipStyle.backgroundColor }]}
                  textStyle={{ color: statusChipStyle.textColor }}
                >
                  {statusConfig.label}
                </Chip>

                <Chip
                  compact
                  mode="flat"
                  style={[styles.chip, { backgroundColor: theme.colors.surfaceVariant }]}
                  textStyle={{ color: theme.colors.onSurfaceVariant }}
                >
                  {typeConfig.label}
                </Chip>

                {downloadChipStyle && (
                  <Chip
                    compact
                    mode="flat"
                    style={[styles.chip, { backgroundColor: downloadChipStyle.backgroundColor }]}
                    textStyle={{ color: downloadChipStyle.textColor }}
                  >
                    {downloadStatusConfig!.label}
                  </Chip>
                )}

                {release.monitored && (
                  <Chip
                    compact
                    mode="flat"
                    style={[styles.chip, { backgroundColor: theme.colors.primaryContainer }]}
                    textStyle={{ color: theme.colors.onPrimaryContainer }}
                  >
                    Monitored
                  </Chip>
                )}
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
};

export default MediaReleaseCard;