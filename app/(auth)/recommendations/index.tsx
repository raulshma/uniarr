import React, { useState, useMemo, useCallback } from "react";
import { ScrollView, StyleSheet, View, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useTheme, IconButton, Chip, Banner } from "react-native-paper";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

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
        gradientBackground: {
          ...StyleSheet.absoluteFillObject,
          opacity: 0.15,
        },
        scrollContent: {
          padding: spacing.md,
          paddingTop: spacing.lg,
          gap: spacing.lg,
          paddingBottom: 100,
        },
        header: {
          marginBottom: spacing.sm,
        },
        headerTop: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.xs,
        },
        title: {
          fontWeight: "800",
          color: theme.colors.onBackground,
          fontSize: 32,
          letterSpacing: -0.5,
        },
        subtitle: {
          fontSize: 16,
          color: theme.colors.onSurfaceVariant,
          maxWidth: "80%",
          lineHeight: 24,
        },
        metaRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginTop: spacing.md,
        },
        metaChip: {
          height: 32,
          backgroundColor: theme.colors.surfaceVariant,
        },
        offlineBanner: {
          marginBottom: spacing.md,
          borderRadius: 12,
          overflow: "hidden",
        },
        recommendationsSection: {
          gap: spacing.lg,
        },
        sectionHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: spacing.md,
        },
        sectionTitle: {
          fontWeight: "700",
          fontSize: 20,
          color: theme.colors.onSurface,
        },
        emptyContainer: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        },
      }),
    [theme],
  );

  // Loading state
  if (isLoading || isAuthLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[theme.colors.primaryContainer, theme.colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        />
        <SafeAreaView style={styles.emptyContainer}>
          <LoadingState message="Curating your personal feed..." />
        </SafeAreaView>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.emptyContainer}>
          <EmptyState
            icon="lightbulb-off-outline"
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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 0.8 }}
        style={styles.gradientBackground}
      />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.duration(600).springify()}
            style={styles.header}
          >
            <View style={styles.headerTop}>
              <Text style={styles.title}>For You</Text>
              <IconButton
                icon="refresh"
                mode="contained-tonal"
                size={24}
                onPress={handleRefresh}
                disabled={isFetching}
              />
            </View>
            <Text style={styles.subtitle}>
              Curated picks based on your unique taste and watching habits.
            </Text>

            {/* Meta information */}
            <View style={styles.metaRow}>
              {cacheAgeDisplay && (
                <Chip
                  icon="clock-outline"
                  style={styles.metaChip}
                  textStyle={{ fontSize: 12, fontWeight: "600" }}
                >
                  {cacheAgeDisplay}
                </Chip>
              )}
              {context && (
                <Chip
                  icon="history"
                  style={styles.metaChip}
                  textStyle={{ fontSize: 12, fontWeight: "600" }}
                >
                  {context.watchHistoryCount} watched
                </Chip>
              )}
            </View>
          </Animated.View>

          {/* Offline indicator */}
          {isOffline && (
            <Banner visible={true} icon="wifi-off" style={styles.offlineBanner}>
              You're offline. Showing cached recommendations.
            </Banner>
          )}

          {/* Empty State check inside scroll view to allow refresh */}
          {!recommendations || recommendations.length === 0 ? (
            <View style={{ marginTop: spacing.xl }}>
              <EmptyState
                icon="movie-open-outline"
                title="No Recommendations Yet"
                description="Start watching content to get personalized recommendations based on your taste."
                actionLabel="Refresh"
                onActionPress={() => refetch()}
              />
            </View>
          ) : (
            <>
              {/* Recommendations list */}
              <View style={styles.recommendationsSection}>
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
              </View>

              {/* Content Gaps Section */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Missing from Library</Text>
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
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default RecommendationsScreen;
