import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme, Chip, Button } from "react-native-paper";
import Animated, { FadeIn } from "react-native-reanimated";
import { Image } from "expo-image";

import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import type { AppTheme } from "@/constants/theme";
import type { Recommendation } from "@/models/recommendation.schemas";
import { spacing } from "@/theme/spacing";

export interface ContentGapsSectionProps {
  /** List of content gaps */
  contentGaps: Recommendation[];
  /** Whether content gaps are loading */
  isLoading: boolean;
  /** Error loading content gaps */
  error: Error | null;
  /** Callback to refresh content gaps */
  onRefresh: () => Promise<void>;
  /** Whether the app is offline */
  isOffline: boolean;
}

/**
 * Section component for displaying content gaps
 *
 * Features:
 * - Displays missing popular content
 * - Shows gap significance explanation
 * - Displays popularity and rating metrics
 * - Provides actions to add missing content
 * - Loading and error states
 */
export const ContentGapsSection: React.FC<ContentGapsSectionProps> = ({
  contentGaps,
  isLoading,
  error,
  onRefresh,
  isOffline,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: spacing.md,
        },
        description: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.sm,
        },
        gapsList: {
          gap: spacing.md,
        },
        gapCard: {
          padding: spacing.md,
        },
        gapContent: {
          flexDirection: "row",
          gap: spacing.md,
        },
        posterContainer: {
          width: 80,
          height: 120,
          borderRadius: 6,
          overflow: "hidden",
          backgroundColor: theme.colors.surfaceVariant,
        },
        poster: {
          width: "100%",
          height: "100%",
        },
        posterPlaceholder: {
          width: "100%",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.colors.surfaceVariant,
        },
        gapInfo: {
          flex: 1,
          gap: spacing.sm,
        },
        gapTitle: {
          fontWeight: "700",
          color: theme.colors.onSurface,
          fontSize: 16,
        },
        gapMetadata: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          flexWrap: "wrap",
        },
        metadataChip: {
          height: 24,
        },
        significance: {
          fontSize: 13,
          color: theme.colors.onSurfaceVariant,
          lineHeight: 18,
        },
        gapActions: {
          flexDirection: "row",
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
        addButton: {
          flex: 1,
        },
        emptyContainer: {
          paddingVertical: spacing.lg,
        },
      }),
    [theme],
  );

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <LoadingState message="Analyzing your library..." />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          icon="alert-circle-outline"
          title="Unable to Load Content Gaps"
          description={
            error instanceof Error
              ? error.message
              : "Something went wrong while analyzing your library."
          }
          actionLabel="Retry"
          onActionPress={onRefresh}
        />
      </View>
    );
  }

  // Empty state
  if (!contentGaps || contentGaps.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          icon="check-circle-outline"
          title="No Content Gaps Found"
          description="Your library is well-rounded! We couldn't find any significant gaps in popular content that matches your taste."
        />
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <Text style={styles.description}>
        Popular content in your favorite genres that's missing from your
        library.
      </Text>

      <View style={styles.gapsList}>
        {contentGaps.map((gap, index) => (
          <Animated.View
            key={gap.id || `gap-${index}`}
            entering={FadeIn.duration(300).delay(index * 50)}
          >
            <Card contentPadding={0} animated={false}>
              <View style={styles.gapCard}>
                <View style={styles.gapContent}>
                  {/* Poster */}
                  <View style={styles.posterContainer}>
                    {gap.metadata.posterUrl ? (
                      <Image
                        source={{ uri: gap.metadata.posterUrl }}
                        style={styles.poster}
                        contentFit="cover"
                        transition={200}
                        accessibilityIgnoresInvertColors
                      />
                    ) : (
                      <View style={styles.posterPlaceholder}>
                        <Text
                          style={{
                            fontSize: 10,
                            color: theme.colors.onSurfaceVariant,
                          }}
                        >
                          No Image
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={styles.gapInfo}>
                    <Text
                      variant="titleMedium"
                      style={styles.gapTitle}
                      numberOfLines={2}
                    >
                      {gap.title}
                    </Text>

                    {/* Metadata chips */}
                    <View style={styles.gapMetadata}>
                      {gap.year && (
                        <Chip
                          compact
                          style={styles.metadataChip}
                          textStyle={{ fontSize: 11 }}
                        >
                          {gap.year}
                        </Chip>
                      )}
                      <Chip
                        compact
                        icon="star"
                        style={styles.metadataChip}
                        textStyle={{ fontSize: 11 }}
                      >
                        {gap.metadata.rating.toFixed(1)}
                      </Chip>
                      <Chip
                        compact
                        icon="fire"
                        style={styles.metadataChip}
                        textStyle={{ fontSize: 11 }}
                      >
                        {gap.metadata.popularity}% popular
                      </Chip>
                    </View>

                    {/* Significance explanation */}
                    {gap.reasonsForMatch.length > 0 && (
                      <Text style={styles.significance} numberOfLines={2}>
                        {gap.reasonsForMatch[0]}
                      </Text>
                    )}

                    {/* Actions */}
                    <View style={styles.gapActions}>
                      <Button
                        mode="contained"
                        icon="plus"
                        onPress={() => {
                          // TODO: Implement add to library action
                          // This should open a service selection dialog
                        }}
                        disabled={isOffline}
                        style={styles.addButton}
                        compact
                      >
                        Add to Library
                      </Button>
                      <Button
                        mode="outlined"
                        icon="information-outline"
                        onPress={() => {
                          // TODO: Implement view details action
                        }}
                        disabled={isOffline}
                        compact
                      >
                        Details
                      </Button>
                    </View>
                  </View>
                </View>
              </View>
            </Card>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
};
