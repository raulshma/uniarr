import React, { useEffect, useState, useMemo, useRef } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Text, useTheme, Chip, Divider, Portal } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInUp,
  interpolate,
  runOnJS,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";
import { useAuth } from "@/services/auth/AuthProvider";
import { borderRadius } from "@/constants/sizes";
import type { Widget } from "@/services/widgets/WidgetService";
import { widgetService } from "@/services/widgets/WidgetService";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import { FadeIn, FadeOut, ANIMATION_DURATIONS } from "@/utils/animations.utils";
import { BottomDrawer } from "@/components/common";
import WidgetHeader from "@/components/widgets/common/WidgetHeader";
import { ContentRecommendationService } from "@/services/ai/recommendations";
import type { Recommendation } from "@/models/recommendation.schemas";
import { logger } from "@/services/logger/LoggerService";

// Use the authenticated or guest user ID

interface RecommendationsWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

const RecommendationsWidget: React.FC<RecommendationsWidgetProps> = ({
  widget,
  onRefresh,
  onEdit,
}) => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const { onPress: hapticPress } = useHaptics();
  const styles = useStyles(theme);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<Recommendation | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [swipedCards, setSwipedCards] = useState<number[]>([]);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const currentBatchRef = useRef(0);

  const { user } = useAuth();
  const userId = user?.id ?? "guest";

  const CARDS_PER_BATCH = 3;

  // Keep ref in sync with state
  useEffect(() => {
    currentBatchRef.current = currentBatch;
  }, [currentBatch]);

  const handleCardSwiped = (index: number) => {
    setSwipedCards((prev) => {
      const newSwiped = [...prev, index];

      // Check if we've swiped all cards in current batch
      const batch = currentBatchRef.current;
      const currentBatchStart = batch * CARDS_PER_BATCH;
      const currentBatchEnd = currentBatchStart + CARDS_PER_BATCH;
      const currentBatchIndices = Array.from(
        { length: CARDS_PER_BATCH },
        (_, i) => currentBatchStart + i,
      ).filter((i) => i < recommendations.length);

      const allBatchSwiped = currentBatchIndices.every((i) =>
        newSwiped.includes(i),
      );

      console.log("Swipe check:", {
        index,
        batch,
        currentBatchIndices,
        newSwiped,
        allBatchSwiped,
        hasMore: currentBatchEnd < recommendations.length,
        totalCards: recommendations.length,
      });

      if (allBatchSwiped) {
        // Move to next batch after a short delay
        setTimeout(() => {
          if (currentBatchEnd < recommendations.length) {
            // Move to next batch
            console.log("Moving to next batch");
            setCurrentBatch((prev) => prev + 1);
          } else {
            // Loop back to the beginning
            console.log("Looping back to start");
            setCurrentBatch(0);
            setResetKey((prev) => prev + 1);
            // Clear swiped cards after state updates
            setTimeout(() => {
              setSwipedCards([]);
            }, 50);
          }
        }, 300);
      }

      return newSwiped;
    });
  };

  // Load recommendations
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;

    const loadRecommendations = async () => {
      try {
        setLoading(true);
        setError(null);

        // Set a timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (!isCancelled) {
            setLoading(false);
            setError("Request timed out. Please try again.");
            void logger.warn("Recommendation widget load timed out");
          }
        }, 15000); // 15 second timeout

        // Get widget configuration
        const widgetConfig = await widgetService.getWidget(widget.id);
        const limit = widgetConfig?.config?.limit || 9; // Default to 9 for 3 batches

        // Try to get cached data first
        const cached = await widgetService.getWidgetData<{
          recommendations: Recommendation[];
          generatedAt: string;
        }>(widget.id);

        // Only use cache if it has enough recommendations
        if (cached && cached.recommendations.length >= limit && !isCancelled) {
          clearTimeout(timeoutId);
          setRecommendations(cached.recommendations.slice(0, limit));
          const age = Date.now() - new Date(cached.generatedAt).getTime();
          setCacheAge(age);
          setLoading(false);
          return;
        }

        // Fetch fresh recommendations
        const service = ContentRecommendationService.getInstance();
        const response = await service.getRecommendations({
          userId,
          limit,
          includeHiddenGems: true,
        });

        console.log("Fetched recommendations:", {
          requested: limit,
          received: response.recommendations.length,
        });

        if (!isCancelled) {
          clearTimeout(timeoutId);
          setRecommendations(response.recommendations);
          setCacheAge(0);

          // Cache the data
          await widgetService.setWidgetData(
            widget.id,
            {
              recommendations: response.recommendations,
              generatedAt: response.generatedAt.toISOString(),
            },
            {
              ttlMs: 24 * 60 * 60 * 1000, // 24 hours
            },
          );
        }
      } catch (err) {
        if (!isCancelled) {
          clearTimeout(timeoutId);
          void logger.error("Failed to load recommendations for widget", {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load recommendations",
          );
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadRecommendations();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [widget.id, userId]);

  const handleViewAll = () => {
    hapticPress();
    router.push("/(auth)/(tabs)/recommendations");
  };

  const handleRecommendationPress = (recommendation: Recommendation) => {
    hapticPress();
    setSelectedRecommendation(recommendation);
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setTimeout(() => setSelectedRecommendation(null), 300);
  };

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

  if (loading) {
    return (
      <Animated.View
        style={styles.container}
        entering={FadeIn.duration(ANIMATION_DURATIONS.QUICK)}
        exiting={FadeOut.duration(ANIMATION_DURATIONS.NORMAL)}
      >
        <WidgetHeader title={widget.title} onEdit={onEdit} />
        <View style={styles.loadingSkeleton}>
          {Array.from({ length: 3 }).map((_, index) => (
            <View key={index} style={styles.skeletonItem}>
              <SkeletonPlaceholder
                width={80}
                height={120}
                borderRadius={borderRadius.md}
              />
              <View style={styles.skeletonContent}>
                <SkeletonPlaceholder width={150} height={16} borderRadius={4} />
                <SkeletonPlaceholder
                  width={100}
                  height={12}
                  borderRadius={4}
                  style={{ marginTop: spacing.xs }}
                />
                <SkeletonPlaceholder
                  width={60}
                  height={24}
                  borderRadius={12}
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            </View>
          ))}
        </View>
      </Animated.View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <WidgetHeader title={widget.title} onEdit={onEdit} />
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={theme.custom.sizes.iconSizes.xxl}
            color={theme.colors.error}
          />
          <Text variant="bodySmall" style={styles.errorText}>
            {error}
          </Text>
        </View>
      </View>
    );
  }

  if (recommendations.length === 0) {
    return (
      <View style={styles.container}>
        <WidgetHeader title={widget.title} onEdit={onEdit} />
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="lightbulb-outline"
            size={theme.custom.sizes.iconSizes.xxl}
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant="bodySmall" style={styles.emptyText}>
            No recommendations yet
          </Text>
          <Text variant="bodySmall" style={styles.emptySubtext}>
            Start watching content to get personalized suggestions
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WidgetHeader
        title={""}
        onEdit={onEdit}
        additionalActions={
          cacheAgeDisplay ? (
            <Chip
              compact
              icon="clock-outline"
              style={styles.cacheAgeChip}
              textStyle={styles.cacheAgeText}
            >
              {cacheAgeDisplay}
            </Chip>
          ) : undefined
        }
      />

      <View
        style={[
          styles.stackContainer,
          {
            height: 240 + (CARDS_PER_BATCH - 1) * 14,
          },
        ]}
      >
        {recommendations.map((recommendation, index) => {
          const batchIndex = Math.floor(index / CARDS_PER_BATCH);
          const isInCurrentOrPreviousBatch = batchIndex <= currentBatch;

          if (!isInCurrentOrPreviousBatch) {
            return null;
          }

          // Calculate position within visible cards
          const visibleIndex = index - currentBatch * CARDS_PER_BATCH;

          // Get current batch indices
          const currentBatchStart = currentBatch * CARDS_PER_BATCH;
          const currentBatchIndices = Array.from(
            { length: CARDS_PER_BATCH },
            (_, i) => currentBatchStart + i,
          ).filter((i) => i < recommendations.length);

          // Count how many cards before this one are swiped in current batch
          const swipedBeforeCount = currentBatchIndices.filter(
            (i) => i < index && swipedCards.includes(i),
          ).length;

          return (
            <StackedCard
              key={`${recommendation.id || `rec-${index}`}-${resetKey}`}
              recommendation={recommendation}
              index={index}
              visibleIndex={visibleIndex}
              swipedBeforeCount={swipedBeforeCount}
              totalCards={recommendations.length}
              currentBatch={currentBatch}
              onPress={() => handleRecommendationPress(recommendation)}
              onSwipe={() => handleCardSwiped(index)}
              isSwiped={swipedCards.includes(index)}
              theme={theme}
              styles={styles}
            />
          );
        })}
      </View>

      <Pressable onPress={handleViewAll} style={styles.viewAllButton}>
        <Text variant="labelLarge" style={styles.viewAllText}>
          View All Recommendations
        </Text>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.colors.primary}
        />
      </Pressable>

      {/* Recommendation Details Drawer */}
      <Portal>
        <BottomDrawer
          visible={drawerVisible}
          onDismiss={handleCloseDrawer}
          title="Recommendation Details"
          maxHeight="80%"
        >
          {selectedRecommendation && (
            <View style={styles.drawerContent}>
              {/* Poster and Basic Info */}
              <View style={styles.drawerHeader}>
                {selectedRecommendation.metadata.posterUrl ? (
                  <Image
                    source={{
                      uri: selectedRecommendation.metadata.posterUrl,
                    }}
                    style={styles.drawerPoster}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={[styles.drawerPoster, styles.posterPlaceholder]}>
                    <MaterialCommunityIcons
                      name="image-off"
                      size={48}
                      color={theme.colors.onSurfaceVariant}
                    />
                  </View>
                )}
                <View style={styles.drawerHeaderInfo}>
                  <Text variant="headlineSmall" style={styles.drawerTitle}>
                    {selectedRecommendation.title}
                  </Text>
                  <Text variant="bodyMedium" style={styles.drawerMeta}>
                    {selectedRecommendation.year} •{" "}
                    {selectedRecommendation.type}
                  </Text>
                  <View style={styles.drawerChips}>
                    <Chip
                      icon="star"
                      style={styles.drawerMatchChip}
                      textStyle={styles.matchScoreText}
                    >
                      {selectedRecommendation.matchScore}% match
                    </Chip>
                    {selectedRecommendation.isHiddenGem && (
                      <Chip
                        icon="diamond-stone"
                        style={styles.drawerHiddenGemChip}
                        textStyle={styles.hiddenGemText}
                      >
                        Hidden Gem
                      </Chip>
                    )}
                  </View>
                </View>
              </View>

              <Divider style={styles.divider} />

              {/* Overview */}
              {selectedRecommendation.metadata.overview && (
                <View style={styles.drawerSection}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Overview
                  </Text>
                  <Text variant="bodyMedium" style={styles.sectionText}>
                    {selectedRecommendation.metadata.overview}
                  </Text>
                </View>
              )}

              {/* Genres */}
              {selectedRecommendation.metadata.genres.length > 0 && (
                <View style={styles.drawerSection}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Genres
                  </Text>
                  <View style={styles.genreContainer}>
                    {selectedRecommendation.metadata.genres.map(
                      (genre, idx) => (
                        <Chip
                          key={idx}
                          compact
                          style={styles.genreChip}
                          textStyle={styles.genreText}
                        >
                          {genre}
                        </Chip>
                      ),
                    )}
                  </View>
                </View>
              )}

              {/* Rating & Popularity */}
              <View style={styles.drawerSection}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Ratings
                </Text>
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons
                      name="star"
                      size={20}
                      color={theme.colors.primary}
                    />
                    <Text variant="bodyMedium" style={styles.statText}>
                      {selectedRecommendation.metadata.rating.toFixed(1)}/10
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons
                      name="fire"
                      size={20}
                      color={theme.colors.error}
                    />
                    <Text variant="bodyMedium" style={styles.statText}>
                      {selectedRecommendation.metadata.popularity.toFixed(0)}{" "}
                      popularity
                    </Text>
                  </View>
                </View>
              </View>

              {/* Reasons for Match */}
              <View style={styles.drawerSection}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Why We Recommend This
                </Text>
                {selectedRecommendation.reasonsForMatch.map((reason, idx) => (
                  <View key={idx} style={styles.reasonItem}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color={theme.colors.primary}
                    />
                    <Text variant="bodyMedium" style={styles.reasonText}>
                      {reason}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Similar To Watched */}
              {selectedRecommendation.similarToWatched.length > 0 && (
                <View style={styles.drawerSection}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Similar To What You've Watched
                  </Text>
                  {selectedRecommendation.similarToWatched.map((title, idx) => (
                    <View key={idx} style={styles.similarItem}>
                      <MaterialCommunityIcons
                        name="movie-open"
                        size={18}
                        color={theme.colors.onSurfaceVariant}
                      />
                      <Text variant="bodyMedium" style={styles.similarText}>
                        {title}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Where to Watch */}
              <View style={styles.drawerSection}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Where to Watch
                </Text>
                <Text variant="bodyMedium" style={styles.sectionText}>
                  {selectedRecommendation.whereToWatch}
                </Text>
              </View>

              {/* Availability */}
              {selectedRecommendation.availability && (
                <View style={styles.drawerSection}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Availability
                  </Text>
                  <View style={styles.availabilityContainer}>
                    {selectedRecommendation.availability.inLibrary && (
                      <Chip
                        icon="check-circle"
                        style={styles.availabilityChip}
                        textStyle={styles.availabilityText}
                      >
                        In Library
                      </Chip>
                    )}
                    {selectedRecommendation.availability.inQueue && (
                      <Chip
                        icon="download"
                        style={styles.availabilityChip}
                        textStyle={styles.availabilityText}
                      >
                        In Queue
                      </Chip>
                    )}
                    {selectedRecommendation.availability.availableServices
                      .length > 0 && (
                      <Text variant="bodySmall" style={styles.servicesText}>
                        Available on:{" "}
                        {selectedRecommendation.availability.availableServices.join(
                          ", ",
                        )}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}
        </BottomDrawer>
      </Portal>
    </View>
  );
};

const useStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      width: "100%",
      minHeight: 200,
    },
    loadingSkeleton: {
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    skeletonItem: {
      flexDirection: "row",
      gap: spacing.md,
    },
    skeletonContent: {
      flex: 1,
      justifyContent: "center",
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xl,
      gap: spacing.sm,
    },
    emptyText: {
      opacity: 0.7,
      fontWeight: "600",
    },
    emptySubtext: {
      opacity: 0.5,
      textAlign: "center",
      paddingHorizontal: spacing.lg,
    },
    errorText: {
      color: theme.colors.error,
      textAlign: "center",
      paddingHorizontal: spacing.lg,
    },
    stackContainer: {
      marginTop: spacing.sm,
      marginBottom: spacing.xxs,
      position: "relative",
      minHeight: 240,
    },
    stackedCard: {
      position: "absolute",
      width: "100%",
      borderRadius: borderRadius.xl,
      overflow: "hidden",
    },
    cardPressable: {
      width: "100%",
    },
    cardContent: {
      width: "100%",
      height: 240,
      borderRadius: borderRadius.xl,
      overflow: "hidden",
      backgroundColor: theme.colors.surface,
      elevation: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    cardPoster: {
      width: "100%",
      height: "100%",
      backgroundColor: theme.colors.surfaceVariant,
    },
    posterPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    cardOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      padding: spacing.lg,
    },
    cardInfo: {
      gap: spacing.sm,
    },
    cardTitle: {
      fontWeight: "700",
      color: "#FFFFFF",
    },
    cardMeta: {
      color: "rgba(255, 255, 255, 0.8)",
    },
    cardChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    cardOverview: {
      color: "rgba(255, 255, 255, 0.9)",
      lineHeight: 18,
    },
    matchScoreChip: {
      height: 28,
      backgroundColor: theme.colors.primaryContainer,
      alignSelf: "flex-start",
    },
    matchScoreText: {
      fontSize: 11,
      color: theme.colors.onPrimaryContainer,
      fontWeight: "600",
      lineHeight: 14,
    },
    hiddenGemChip: {
      height: 28,
      backgroundColor: theme.colors.tertiaryContainer,
      alignSelf: "flex-start",
      marginTop: spacing.xxs,
    },
    hiddenGemText: {
      fontSize: 11,
      color: theme.colors.onTertiaryContainer,
      fontWeight: "600",
      lineHeight: 14,
    },
    viewAllButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.none,
      gap: spacing.xs,
    },
    viewAllText: {
      color: theme.colors.primary,
      fontWeight: "600",
    },
    cacheAgeChip: {
      height: 28,
      backgroundColor: theme.colors.surfaceVariant,
    },
    cacheAgeText: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 14,
    },
    drawerContent: {
      gap: spacing.lg,
    },
    drawerHeader: {
      flexDirection: "row",
      gap: spacing.md,
    },
    drawerPoster: {
      width: 120,
      height: 180,
      borderRadius: borderRadius.md,
      backgroundColor: theme.colors.surfaceVariant,
    },
    drawerHeaderInfo: {
      flex: 1,
      gap: spacing.xs,
    },
    drawerTitle: {
      fontWeight: "700",
      color: theme.colors.onSurface,
    },
    drawerMeta: {
      color: theme.colors.onSurfaceVariant,
    },
    drawerChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    drawerMatchChip: {
      height: 28,
      backgroundColor: theme.colors.primaryContainer,
    },
    drawerHiddenGemChip: {
      height: 28,
      backgroundColor: theme.colors.tertiaryContainer,
    },
    divider: {
      marginVertical: spacing.sm,
    },
    drawerSection: {
      gap: spacing.sm,
    },
    sectionTitle: {
      fontWeight: "600",
      color: theme.colors.onSurface,
    },
    sectionText: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 22,
    },
    genreContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    genreChip: {
      height: 28,
      backgroundColor: theme.colors.secondaryContainer,
    },
    genreText: {
      fontSize: 12,
      color: theme.colors.onSecondaryContainer,
    },
    statsContainer: {
      flexDirection: "row",
      gap: spacing.lg,
    },
    statItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    statText: {
      color: theme.colors.onSurface,
    },
    reasonItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    reasonText: {
      flex: 1,
      color: theme.colors.onSurface,
      lineHeight: 20,
    },
    similarItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xxs,
    },
    similarText: {
      flex: 1,
      color: theme.colors.onSurfaceVariant,
    },
    availabilityContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      alignItems: "center",
    },
    availabilityChip: {
      height: 28,
      backgroundColor: theme.colors.primaryContainer,
    },
    availabilityText: {
      fontSize: 12,
      color: theme.colors.onPrimaryContainer,
    },
    servicesText: {
      color: theme.colors.onSurfaceVariant,
      fontStyle: "italic",
    },
  });

interface StackedCardProps {
  recommendation: Recommendation;
  index: number;
  visibleIndex: number;
  swipedBeforeCount: number;
  totalCards: number;
  currentBatch: number;
  onPress: () => void;
  onSwipe: () => void;
  isSwiped: boolean;
  theme: AppTheme;
  styles: ReturnType<typeof useStyles>;
}

const StackedCard: React.FC<StackedCardProps> = ({
  recommendation,
  index,
  visibleIndex,
  swipedBeforeCount,
  totalCards,
  currentBatch,
  onPress,
  onSwipe,
  isSwiped,
  theme,
  styles,
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const { onPress: hapticPress } = useHaptics();

  // Doubled offsets - each card shows 12-14px below the previous
  const CARD_OFFSET = 14;

  // Adjust position based on how many cards before this were swiped
  const adjustedVisibleIndex = visibleIndex - swipedBeforeCount;
  const topOffset = adjustedVisibleIndex * CARD_OFFSET;
  const leftOffset = adjustedVisibleIndex * 12;

  // Scale down slightly for cards further back in the stack
  const stackScale = 1 - adjustedVisibleIndex * 0.02;

  // Animate cards flying in when batch changes
  const batchIndex = Math.floor(index / 3);
  const isNewBatch = batchIndex === currentBatch && batchIndex > 0;

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      if (!isSwiped) {
        translateX.value = event.translationX;
        translateY.value = event.translationY * 0.3;
      }
    })
    .onEnd((event) => {
      if (!isSwiped) {
        const shouldSwipe =
          Math.abs(event.translationX) > 120 || Math.abs(event.velocityX) > 500;

        if (shouldSwipe) {
          // Swipe away the card
          const direction = event.translationX > 0 ? 1 : -1;
          translateX.value = withTiming(direction * 500, { duration: 300 });
          translateY.value = withTiming(event.translationY * 0.5, {
            duration: 300,
          });
          scale.value = withTiming(0.8, { duration: 300 });
          runOnJS(onSwipe)();
        } else {
          // Snap back
          translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
          translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
        }
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    if (isSwiped) {
      return {
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { scale: scale.value * stackScale },
          {
            rotate: `${interpolate(translateX.value, [-500, 0, 500], [-20, 0, 20])}deg`,
          },
        ],
        opacity: interpolate(
          translateX.value,
          [-500, 0, 500],
          [0, 1, 0],
          Extrapolation.CLAMP,
        ),
        top: withSpring(topOffset, { damping: 20, stiffness: 120 }),
        left: withSpring(leftOffset, { damping: 20, stiffness: 120 }),
        right: withSpring(leftOffset, { damping: 20, stiffness: 120 }),
        zIndex: totalCards - index,
      };
    }

    const rotation = interpolate(
      translateX.value,
      [-200, 0, 200],
      [-15, 0, 15],
      Extrapolation.CLAMP,
    );

    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, 150],
      [1, 0.5],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        {
          scale: withSpring(scale.value * stackScale, {
            damping: 20,
            stiffness: 120,
          }),
        },
        { rotate: `${rotation}deg` },
      ],
      opacity,
      top: withSpring(topOffset, { damping: 20, stiffness: 120 }),
      left: withSpring(leftOffset, { damping: 20, stiffness: 120 }),
      right: withSpring(leftOffset, { damping: 20, stiffness: 120 }),
      zIndex: totalCards - index,
    };
  });

  const handlePressIn = () => {
    if (!isSwiped) {
      scale.value = withSpring(0.98);
    }
  };

  const handlePressOut = () => {
    if (!isSwiped) {
      scale.value = withSpring(1);
    }
  };

  const handlePress = () => {
    if (!isSwiped) {
      hapticPress();
      onPress();
    }
  };

  if (isSwiped) {
    return null;
  }

  // Different animation for new batch cards
  const enteringAnimation = isNewBatch
    ? FadeInUp.delay(visibleIndex * 150)
        .duration(600)
        .springify()
        .damping(12)
        .stiffness(100)
    : FadeInUp.delay(visibleIndex * 100)
        .duration(400)
        .springify();

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.stackedCard, animatedStyle]}
        entering={enteringAnimation}
      >
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.cardPressable}
        >
          <View style={styles.cardContent}>
            {recommendation.metadata.posterUrl ? (
              <Image
                source={{ uri: recommendation.metadata.posterUrl }}
                style={styles.cardPoster}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.cardPoster, styles.posterPlaceholder]}>
                <MaterialCommunityIcons
                  name="image-off"
                  size={48}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            )}

            <View style={styles.cardOverlay}>
              <View style={styles.cardInfo}>
                <Text variant="headlineSmall" style={styles.cardTitle}>
                  {recommendation.title}
                </Text>
                <Text variant="bodyMedium" style={styles.cardMeta}>
                  {recommendation.year} • {recommendation.type}
                </Text>

                <View style={styles.cardChips}>
                  <Chip
                    compact
                    icon="star"
                    style={styles.matchScoreChip}
                    textStyle={styles.matchScoreText}
                  >
                    {recommendation.matchScore}% match
                  </Chip>
                  {recommendation.isHiddenGem && (
                    <Chip
                      compact
                      icon="diamond-stone"
                      style={styles.hiddenGemChip}
                      textStyle={styles.hiddenGemText}
                    >
                      Hidden Gem
                    </Chip>
                  )}
                </View>

                {recommendation.metadata.overview && (
                  <Text
                    variant="bodySmall"
                    numberOfLines={2}
                    style={styles.cardOverview}
                  >
                    {recommendation.metadata.overview}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
};

export default RecommendationsWidget;
