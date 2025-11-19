import React, { useState, useMemo, useCallback } from "react";
import { ScrollView, StyleSheet, View, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useTheme, IconButton, Chip, Banner } from "react-native-paper";
import Animated, { FadeIn } from "react-native-reanimated";

import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { RecommendationCard } from "@/components/recommendations/RecommendationCard";
import { ContentGapsSection } from "@/components/recommendations/ContentGapsSection";
import type { AppTheme } from "@/constants/theme";
import type { Recommendation } from "@/models/recommendation.schemas";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useContentGaps } from "@/hooks/useContentGaps";
import { useRecommendationFeedback } from "@/hooks/useRecommendationFeedback";
import { useAuth } from "@/services/auth/AuthProvider";
import { spacing } from "@/theme/spacing";
import { logger } from "@/services/logger/LoggerService";

// Get user ID from auth provider

const RecommendationsScreen = () => {
  const theme = useTheme<AppTheme>();
  const [showContentGaps, setShowContentGaps] = useState(false);
  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? "guest";

  // Fetch recommendations
  const {
    recommendations,
    isLoading,
    error,
    isFetching,
    cacheAge,
    isOffline,
    context,
    refetch,
    refresh,
  } = useRecommendations({
    userId,
    limit: 5,
    includeHiddenGems: true,
  });

  // Fetch content gaps (only when toggled)
  const {
    contentGaps,
    isLoading: isLoadingGaps,
    error: gapsError,
    refetch: refetchGaps,
  } = useContentGaps({
    userId,
    enabled: showContentGaps,
  });

  // Feedback handling
  const { acceptRecommendation, rejectRecommendation, isSubmitting } =
    useRecommendationFeedback();

  // Calculate cache age display
  const cacheAgeDisplay = useMemo(() => {
    if (!cacheAge) return null;

    const ageInMinutes = Math.floor(cacheAge / (1000 * 60));
    if (ageInMinutes < 1) return "Just now";
    if (ageInMinutes < 60) return `${ageInMinutes}m ago`;

    const ageInHours = Math.floor(ageInMinutes / 60);
    if (ageInHours < 24) return `${ageInHours}h ago`;

    const ageInDays = Math.floor(ageInHours / 24);
    return `${ageInDays}d ago`;
  }, [cacheAge]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    try {
      void logger.info("User initiated recommendations refresh");
      await refresh();
      if (showContentGaps) {
        await refetchGaps();
      }
    } catch (error) {
      void logger.error("Failed to refresh recommendations", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [refresh, showContentGaps, refetchGaps]);

  // Handle recommendation acceptance
  const handleAccept = useCallback(
    async (recommendationIdOrObject: string | Recommendation) => {
      const recommendationId =
        typeof recommendationIdOrObject === "string"
          ? recommendationIdOrObject
          : recommendationIdOrObject.id;
      try {
        await acceptRecommendation(userId, recommendationIdOrObject);
      } catch (error) {
        void logger.error("Failed to accept recommendation", {
          recommendationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [acceptRecommendation, userId],
  );

  // Handle recommendation rejection
  const handleReject = useCallback(
    async (
      recommendationIdOrObject: string | Recommendation,
      reason?: string,
    ) => {
      const recommendationId =
        typeof recommendationIdOrObject === "string"
          ? recommendationIdOrObject
          : recommendationIdOrObject.id;
      try {
        await rejectRecommendation(userId, recommendationIdOrObject, reason);
      } catch (error) {
        void logger.error("Failed to reject recommendation", {
          recommendationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [rejectRecommendation, userId],
  );

  // Toggle content gaps
  const handleToggleContentGaps = useCallback(() => {
    setShowContentGaps((prev) => !prev);
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        scrollContent: {
          padding: spacing.md,
          gap: spacing.md,
        },
        header: {
          marginBottom: spacing.sm,
        },
        headerRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.xs,
        },
        title: {
          fontWeight: "700",
          color: theme.colors.onBackground,
        },
        subtitle: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
        },
        metaRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginTop: spacing.xs,
        },
        metaChip: {
          height: 28,
        },
        offlineBanner: {
          marginBottom: spacing.md,
        },
        recommendationsSection: {
          gap: spacing.md,
        },
        sectionHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        sectionTitle: {
          fontWeight: "600",
          color: theme.colors.onSurface,
        },
        emptyContainer: {
          paddingVertical: spacing.xl,
        },
      }),
    [theme],
  );

  // Loading state
  if (isLoading || isAuthLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <LoadingState message="Generating personalized recommendations..." />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="lightbulb-outline"
          title="Unable to Load Recommendations"
          description={
            error instanceof Error
              ? error.message
              : "Something went wrong while loading your recommendations."
          }
          actionLabel="Retry"
          onActionPress={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  // Empty state
  if (!recommendations || recommendations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="lightbulb-outline"
          title="No Recommendations Yet"
          description="Start watching content to get personalized recommendations based on your taste."
          actionLabel="Refresh"
          onActionPress={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text variant="headlineMedium" style={styles.title}>
              For You
            </Text>
            <IconButton
              icon="refresh"
              size={24}
              onPress={handleRefresh}
              disabled={isFetching}
            />
          </View>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Personalized recommendations based on your watch history
          </Text>

          {/* Meta information */}
          <View style={styles.metaRow}>
            {cacheAgeDisplay && (
              <Chip
                compact
                icon="clock-outline"
                style={styles.metaChip}
                textStyle={{ fontSize: 12 }}
              >
                {cacheAgeDisplay}
              </Chip>
            )}
            {context && (
              <Chip
                compact
                icon="history"
                style={styles.metaChip}
                textStyle={{ fontSize: 12 }}
              >
                {context.watchHistoryCount} watched
              </Chip>
            )}
          </View>
        </View>

        {/* Offline indicator */}
        {isOffline && (
          <Banner visible={true} icon="wifi-off" style={styles.offlineBanner}>
            You're offline. Showing cached recommendations.
          </Banner>
        )}

        {/* Recommendations list */}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.recommendationsSection}
        >
          {recommendations.map((recommendation, index) => (
            <RecommendationCard
              key={recommendation.id || `rec-${index}`}
              recommendation={recommendation}
              onAccept={handleAccept}
              onReject={handleReject}
              isOffline={isOffline}
              isSubmitting={isSubmitting}
              userId={userId}
            />
          ))}
        </Animated.View>

        {/* Content Gaps Section */}
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Missing from Your Library
          </Text>
          <IconButton
            icon={showContentGaps ? "chevron-up" : "chevron-down"}
            size={24}
            onPress={handleToggleContentGaps}
          />
        </View>

        {showContentGaps && (
          <ContentGapsSection
            contentGaps={contentGaps}
            isLoading={isLoadingGaps}
            error={gapsError}
            onRefresh={refetchGaps}
            isOffline={isOffline}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default RecommendationsScreen;
