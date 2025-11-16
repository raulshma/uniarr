import React, { useMemo } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Text, useTheme, Chip, ProgressBar, Badge } from "react-native-paper";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";

import { Card } from "@/components/common/Card";
import { RecommendationActions } from "./RecommendationActions";
import type { AppTheme } from "@/constants/theme";
import type { Recommendation } from "@/models/recommendation.schemas";
import { spacing } from "@/theme/spacing";

export interface RecommendationCardProps {
  /** The recommendation to display */
  recommendation: Recommendation;
  /** Callback when user accepts the recommendation */
  onAccept: (recommendationId: string) => Promise<void>;
  /** Callback when user rejects the recommendation */
  onReject: (recommendationId: string, reason?: string) => Promise<void>;
  /** Whether the app is offline */
  isOffline: boolean;
  /** Whether feedback is being submitted */
  isSubmitting: boolean;
  /** Optional callback when card is pressed */
  onPress?: (recommendation: Recommendation) => void;
}

/**
 * Card component for displaying a single recommendation
 *
 * Features:
 * - Displays poster image with fallback
 * - Shows match score with visual progress indicator
 * - Lists reasons for match
 * - Shows similar watched content
 * - Displays availability status
 * - Hidden gem badge
 * - Action buttons for accepting/rejecting
 * - Accessibility support
 */
export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onAccept,
  onReject,
  isOffline,
  isSubmitting,
  onPress,
}) => {
  const theme = useTheme<AppTheme>();

  // Get match score color based on value
  const matchScoreColor = useMemo(() => {
    if (recommendation.matchScore >= 80) return theme.colors.primary;
    if (recommendation.matchScore >= 60) return theme.colors.secondary;
    return theme.colors.tertiary;
  }, [recommendation.matchScore, theme]);

  // Format availability status
  const availabilityText = useMemo(() => {
    if (!recommendation.availability) return "Availability unknown";

    if (recommendation.availability.inLibrary) {
      return "In your library";
    }

    if (recommendation.availability.inQueue) {
      return "In download queue";
    }

    if (recommendation.availability.availableServices.length > 0) {
      return `Available to add`;
    }

    return "Availability unknown";
  }, [recommendation.availability]);

  const availabilityIcon = useMemo(() => {
    if (!recommendation.availability) return "help-circle-outline";

    if (recommendation.availability.inLibrary) {
      return "check-circle";
    }

    if (recommendation.availability.inQueue) {
      return "download";
    }

    if (recommendation.availability.availableServices.length > 0) {
      return "plus-circle-outline";
    }

    return "help-circle-outline";
  }, [recommendation.availability]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cardContent: {
          padding: spacing.md,
          gap: spacing.md,
        },
        topRow: {
          flexDirection: "row",
          gap: spacing.md,
        },
        posterContainer: {
          width: 100,
          height: 150,
          borderRadius: 8,
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
        infoContainer: {
          flex: 1,
          gap: spacing.sm,
        },
        titleRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: spacing.sm,
        },
        titleContainer: {
          flex: 1,
        },
        title: {
          fontWeight: "700",
          color: theme.colors.onSurface,
          fontSize: 18,
        },
        metadata: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          marginTop: spacing.xs,
        },
        metadataText: {
          fontSize: 13,
          color: theme.colors.onSurfaceVariant,
        },
        metadataDot: {
          width: 3,
          height: 3,
          borderRadius: 1.5,
          backgroundColor: theme.colors.onSurfaceVariant,
        },
        hiddenGemBadge: {
          backgroundColor: theme.colors.tertiaryContainer,
        },
        matchScoreContainer: {
          gap: spacing.xs,
        },
        matchScoreRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        matchScoreLabel: {
          fontSize: 13,
          fontWeight: "600",
          color: theme.colors.onSurfaceVariant,
        },
        matchScoreValue: {
          fontSize: 16,
          fontWeight: "700",
        },
        progressBar: {
          height: 6,
          borderRadius: 3,
        },
        availabilityChip: {
          alignSelf: "flex-start",
        },
        section: {
          gap: spacing.xs,
        },
        sectionTitle: {
          fontSize: 13,
          fontWeight: "600",
          color: theme.colors.onSurfaceVariant,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        reasonsList: {
          gap: spacing.xs,
        },
        reasonItem: {
          flexDirection: "row",
          gap: spacing.sm,
        },
        reasonBullet: {
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.primary,
          marginTop: 7,
        },
        reasonText: {
          flex: 1,
          fontSize: 14,
          color: theme.colors.onSurface,
          lineHeight: 20,
        },
        similarList: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.xs,
        },
        similarChip: {
          height: 28,
        },
        overview: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          lineHeight: 20,
        },
      }),
    [theme],
  );

  const handleCardPress = () => {
    if (onPress) {
      onPress(recommendation);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <Card
        contentPadding={0}
        animated={false}
        accessibilityLabel={`Recommendation: ${recommendation.title}, ${recommendation.type}, match score ${recommendation.matchScore} percent`}
      >
        <Pressable
          onPress={handleCardPress}
          disabled={!onPress}
          accessibilityRole="button"
          accessibilityHint="Tap to view more details"
        >
          <View style={styles.cardContent}>
            {/* Top row with poster and basic info */}
            <View style={styles.topRow}>
              {/* Poster */}
              <View style={styles.posterContainer}>
                {recommendation.metadata.posterUrl ? (
                  <Image
                    source={{ uri: recommendation.metadata.posterUrl }}
                    style={styles.poster}
                    contentFit="cover"
                    transition={200}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={styles.posterPlaceholder}>
                    <Text style={{ color: theme.colors.onSurfaceVariant }}>
                      No Image
                    </Text>
                  </View>
                )}
              </View>

              {/* Info */}
              <View style={styles.infoContainer}>
                {/* Title and hidden gem badge */}
                <View style={styles.titleRow}>
                  <View style={styles.titleContainer}>
                    <Text
                      variant="titleLarge"
                      style={styles.title}
                      numberOfLines={2}
                    >
                      {recommendation.title}
                    </Text>

                    {/* Metadata */}
                    <View style={styles.metadata}>
                      {recommendation.year && (
                        <>
                          <Text style={styles.metadataText}>
                            {recommendation.year}
                          </Text>
                          <View style={styles.metadataDot} />
                        </>
                      )}
                      <Text style={styles.metadataText}>
                        {recommendation.type.charAt(0).toUpperCase() +
                          recommendation.type.slice(1)}
                      </Text>
                      {recommendation.metadata.rating > 0 && (
                        <>
                          <View style={styles.metadataDot} />
                          <Text style={styles.metadataText}>
                            ⭐ {recommendation.metadata.rating.toFixed(1)}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  {recommendation.isHiddenGem && (
                    <Badge
                      size={24}
                      style={styles.hiddenGemBadge}
                      accessibilityLabel="Hidden gem"
                    >
                      💎
                    </Badge>
                  )}
                </View>

                {/* Match score */}
                <View style={styles.matchScoreContainer}>
                  <View style={styles.matchScoreRow}>
                    <Text style={styles.matchScoreLabel}>Match Score</Text>
                    <Text
                      style={[
                        styles.matchScoreValue,
                        { color: matchScoreColor },
                      ]}
                    >
                      {recommendation.matchScore}%
                    </Text>
                  </View>
                  <ProgressBar
                    progress={recommendation.matchScore / 100}
                    color={matchScoreColor}
                    style={styles.progressBar}
                  />
                </View>

                {/* Availability */}
                <Chip
                  icon={availabilityIcon}
                  compact
                  style={styles.availabilityChip}
                  textStyle={{ fontSize: 12 }}
                >
                  {availabilityText}
                </Chip>
              </View>
            </View>

            {/* Overview */}
            {recommendation.metadata.overview && (
              <View style={styles.section}>
                <Text style={styles.overview} numberOfLines={3}>
                  {recommendation.metadata.overview}
                </Text>
              </View>
            )}

            {/* Reasons for match */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Why you'll like this</Text>
              <View style={styles.reasonsList}>
                {recommendation.reasonsForMatch.map((reason, index) => (
                  <View key={index} style={styles.reasonItem}>
                    <View style={styles.reasonBullet} />
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Similar to watched */}
            {recommendation.similarToWatched.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Similar to</Text>
                <View style={styles.similarList}>
                  {recommendation.similarToWatched.map((title, index) => (
                    <Chip
                      key={index}
                      compact
                      style={styles.similarChip}
                      textStyle={{ fontSize: 12 }}
                    >
                      {title}
                    </Chip>
                  ))}
                </View>
              </View>
            )}

            {/* Action buttons */}
            <RecommendationActions
              recommendation={recommendation}
              onAccept={onAccept}
              onReject={onReject}
              isOffline={isOffline}
              isSubmitting={isSubmitting}
            />
          </View>
        </Pressable>
      </Card>
    </Animated.View>
  );
};
