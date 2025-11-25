import React, { useMemo } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { Text, useTheme, Button } from "react-native-paper";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

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
          marginTop: spacing.sm,
        },
        description: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.md,
          paddingHorizontal: spacing.xs,
        },
        scrollContent: {
          paddingHorizontal: spacing.xs,
          gap: spacing.md,
          paddingBottom: spacing.md,
        },
        gapCard: {
          width: 160,
          borderRadius: 16,
          backgroundColor: theme.colors.surface,
          overflow: "hidden",
          elevation: 4,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
        posterContainer: {
          width: "100%",
          height: 240,
          backgroundColor: theme.colors.surfaceVariant,
        },
        poster: {
          width: "100%",
          height: "100%",
        },
        posterOverlay: {
          ...StyleSheet.absoluteFillObject,
        },
        cardContent: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: spacing.sm,
        },
        gapTitle: {
          fontWeight: "700",
          color: "#fff",
          fontSize: 14,
          marginBottom: 4,
          textShadowColor: "rgba(0,0,0,0.8)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        },
        statsRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        },
        statText: {
          color: "rgba(255,255,255,0.9)",
          fontSize: 11,
          fontWeight: "600",
        },
        addButton: {
          marginTop: 4,
          backgroundColor: theme.colors.primary,
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {contentGaps.map((gap, index) => (
          <Animated.View
            key={gap.id || `gap-${index}`}
            entering={FadeInRight.duration(400)
              .delay(index * 100)
              .springify()}
          >
            <View style={styles.gapCard}>
              <View style={styles.posterContainer}>
                <Image
                  source={{ uri: gap.metadata.posterUrl }}
                  style={styles.poster}
                  contentFit="cover"
                  transition={200}
                />
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.9)"]}
                  locations={[0.4, 0.7, 1]}
                  style={styles.posterOverlay}
                />

                <View style={styles.cardContent}>
                  <Text style={styles.gapTitle} numberOfLines={2}>
                    {gap.title}
                  </Text>

                  <View style={styles.statsRow}>
                    <Text style={styles.statText}>
                      ⭐ {gap.metadata.rating.toFixed(1)}
                    </Text>
                    <Text style={styles.statText}>
                      🔥 {gap.metadata.popularity}%
                    </Text>
                  </View>

                  <Button
                    mode="contained"
                    icon="plus"
                    onPress={() => {
                      // TODO: Implement add to library action
                    }}
                    disabled={isOffline}
                    style={styles.addButton}
                    labelStyle={{ fontSize: 12, marginVertical: 4 }}
                    compact
                  >
                    Add
                  </Button>
                </View>
              </View>
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </Animated.View>
  );
};
