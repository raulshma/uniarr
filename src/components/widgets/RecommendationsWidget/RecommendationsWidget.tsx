import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { Text, useTheme, Chip } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image } from "expo-image";

import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import type { Widget } from "@/services/widgets/WidgetService";
import { widgetService } from "@/services/widgets/WidgetService";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";
import {
  FadeIn,
  FadeOut,
  ANIMATION_DURATIONS,
  Animated,
} from "@/utils/animations.utils";
import { Card } from "@/components/common";
import WidgetHeader from "@/components/widgets/common/WidgetHeader";
import { useSettingsStore } from "@/store/settingsStore";
import { ContentRecommendationService } from "@/services/ai/recommendations";
import type { Recommendation } from "@/models/recommendation.schemas";
import { logger } from "@/services/logger/LoggerService";

// TODO: Replace with actual user ID from auth context
const MOCK_USER_ID = "user_123";

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
  const frostedEnabled = useSettingsStore((s) => s.frostedWidgetsEnabled);
  const styles = useStyles(theme);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheAge, setCacheAge] = useState<number | null>(null);

  // Load recommendations
  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get widget configuration
        const widgetConfig = await widgetService.getWidget(widget.id);
        const limit = widgetConfig?.config?.limit || 3;

        // Try to get cached data first
        const cached = await widgetService.getWidgetData<{
          recommendations: Recommendation[];
          generatedAt: string;
        }>(widget.id);

        if (cached) {
          setRecommendations(cached.recommendations.slice(0, limit));
          const age = Date.now() - new Date(cached.generatedAt).getTime();
          setCacheAge(age);
          setLoading(false);
          return;
        }

        // Fetch fresh recommendations
        const service = ContentRecommendationService.getInstance();
        const response = await service.getRecommendations({
          userId: MOCK_USER_ID,
          limit,
          includeHiddenGems: true,
        });

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
      } catch (err) {
        void logger.error("Failed to load recommendations for widget", {
          error: err instanceof Error ? err.message : String(err),
        });
        setError(
          err instanceof Error ? err.message : "Failed to load recommendations",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadRecommendations();
  }, [widget.id]);

  const handleViewAll = () => {
    hapticPress();
    router.push("/(auth)/(tabs)/recommendations");
  };

  const handleRecommendationPress = (recommendation: Recommendation) => {
    hapticPress();
    // Navigate to recommendations screen with the specific recommendation
    router.push("/(auth)/(tabs)/recommendations");
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
      <Card variant={frostedEnabled ? "frosted" : "custom"} style={styles.card}>
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
                  <SkeletonPlaceholder
                    width={150}
                    height={16}
                    borderRadius={4}
                  />
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
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant={frostedEnabled ? "frosted" : "custom"} style={styles.card}>
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
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card variant={frostedEnabled ? "frosted" : "custom"} style={styles.card}>
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
      </Card>
    );
  }

  return (
    <Card variant={frostedEnabled ? "frosted" : "custom"} style={styles.card}>
      <View style={styles.container}>
        <WidgetHeader
          title={widget.title}
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {recommendations.map((recommendation, index) => (
            <Pressable
              key={recommendation.id || `rec-${index}`}
              onPress={() => handleRecommendationPress(recommendation)}
              style={styles.recommendationCard}
            >
              {recommendation.metadata.posterUrl ? (
                <Image
                  source={{ uri: recommendation.metadata.posterUrl }}
                  style={styles.poster}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.poster, styles.posterPlaceholder]}>
                  <MaterialCommunityIcons
                    name="image-off"
                    size={32}
                    color={theme.colors.onSurfaceVariant}
                  />
                </View>
              )}
              <View style={styles.recommendationContent}>
                <Text
                  variant="titleSmall"
                  numberOfLines={2}
                  style={styles.recommendationTitle}
                >
                  {recommendation.title}
                </Text>
                <Text
                  variant="bodySmall"
                  numberOfLines={1}
                  style={styles.recommendationMeta}
                >
                  {recommendation.year} • {recommendation.type}
                </Text>
                <View style={styles.matchScoreContainer}>
                  <Chip
                    compact
                    icon="star"
                    style={styles.matchScoreChip}
                    textStyle={styles.matchScoreText}
                  >
                    {recommendation.matchScore}% match
                  </Chip>
                </View>
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
            </Pressable>
          ))}
        </ScrollView>

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
      </View>
    </Card>
  );
};

const useStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      borderRadius: borderRadius.xl,
    },
    container: {
      borderRadius: borderRadius.xl,
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
    scrollContent: {
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    recommendationCard: {
      width: 160,
      marginRight: spacing.md,
    },
    poster: {
      width: "100%",
      height: 240,
      borderRadius: borderRadius.md,
      backgroundColor: theme.colors.surfaceVariant,
    },
    posterPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    recommendationContent: {
      marginTop: spacing.sm,
      gap: spacing.xxs,
    },
    recommendationTitle: {
      fontWeight: "600",
      color: theme.colors.onSurface,
    },
    recommendationMeta: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
    },
    matchScoreContainer: {
      marginTop: spacing.xs,
    },
    matchScoreChip: {
      height: 24,
      backgroundColor: theme.colors.primaryContainer,
      alignSelf: "flex-start",
    },
    matchScoreText: {
      fontSize: 11,
      color: theme.colors.onPrimaryContainer,
      fontWeight: "600",
    },
    hiddenGemChip: {
      height: 24,
      backgroundColor: theme.colors.tertiaryContainer,
      alignSelf: "flex-start",
      marginTop: spacing.xxs,
    },
    hiddenGemText: {
      fontSize: 11,
      color: theme.colors.onTertiaryContainer,
      fontWeight: "600",
    },
    viewAllButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outlineVariant,
      gap: spacing.xs,
    },
    viewAllText: {
      color: theme.colors.primary,
      fontWeight: "600",
    },
    cacheAgeChip: {
      height: 24,
      backgroundColor: theme.colors.surfaceVariant,
    },
    cacheAgeText: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
    },
  });

export default RecommendationsWidget;
