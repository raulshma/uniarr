import React, { useMemo, useState } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Text, Chip, Portal, Divider } from "react-native-paper";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { RecommendationActions } from "./RecommendationActions";
import type { Recommendation } from "@/models/recommendation.schemas";
import { spacing } from "@/theme/spacing";
import { useTheme } from "@/hooks/useTheme";
import { BottomDrawer } from "@/components/common";
import { borderRadius } from "@/constants/sizes";
import { useHaptics } from "@/hooks/useHaptics";

export interface RecommendationCardProps {
  /** The recommendation to display */
  recommendation: Recommendation;
  /** Callback when user accepts the recommendation */
  onAccept: (recommendationOrId: Recommendation | string) => Promise<void>;
  /** Callback when user rejects the recommendation */
  onReject: (
    recommendationOrId: Recommendation | string,
    reason?: string,
  ) => Promise<void>;
  /** Whether the app is offline */
  isOffline: boolean;
  /** Whether feedback is being submitted */
  isSubmitting: boolean;
  /** Optional callback when card is pressed */
  onPress?: (recommendation: Recommendation) => void;
  /** Optional callback when card is long pressed */
  onLongPress?: (recommendation: Recommendation) => void;
  /** User ID of current user */
  userId?: string;
}

/**
 * Premium Card component for displaying a single recommendation
 */
export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onAccept,
  onReject,
  isOffline,
  isSubmitting,
  onPress,
  onLongPress,
  userId,
}) => {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const { onPress: hapticPress } = useHaptics();
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Get match score color based on value
  const matchScoreColor = useMemo(() => {
    if (recommendation.matchScore >= 90) return ["#4CAF50", "#81C784"]; // High match (Green)
    if (recommendation.matchScore >= 75) return ["#2196F3", "#64B5F6"]; // Good match (Blue)
    if (recommendation.matchScore >= 60) return ["#FF9800", "#FFB74D"]; // Medium match (Orange)
    return ["#F44336", "#E57373"]; // Low match (Red)
  }, [recommendation.matchScore]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handleCardPress = () => {
    if (onPress) {
      onPress(recommendation);
    }
  };

  const handleCardLongPress = () => {
    hapticPress();
    if (onLongPress) {
      onLongPress(recommendation);
    } else {
      setDrawerVisible(true);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderRadius: 24,
          overflow: "hidden",
          marginBottom: spacing.md,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
        gradientBackground: {
          ...StyleSheet.absoluteFillObject,
          opacity: 0.1,
        },
        contentContainer: {
          flexDirection: "row",
        },
        posterContainer: {
          width: 120,
          height: 180,
        },
        poster: {
          width: "100%",
          height: "100%",
        },
        posterOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.2)",
        },
        infoContainer: {
          flex: 1,
          padding: spacing.md,
          justifyContent: "space-between",
        },
        headerRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: spacing.xs,
        },
        title: {
          fontSize: 18,
          fontWeight: "800",
          color: theme.colors.onSurface,
          flex: 1,
          marginRight: spacing.sm,
          letterSpacing: 0.2,
        },
        matchBadge: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 28,
        },
        matchScore: {
          color: theme.colors.onPrimary,
          fontWeight: "bold",
          fontSize: 12,
        },
        metadataRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginBottom: spacing.sm,
        },
        metadataText: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
          fontWeight: "500",
        },
        dot: {
          width: 3,
          height: 3,
          borderRadius: 1.5,
          backgroundColor: theme.colors.onSurfaceVariant,
          opacity: 0.5,
        },
        reasonsContainer: {
          marginBottom: spacing.sm,
        },
        reasonText: {
          fontSize: 13,
          color: theme.colors.onSurface,
          opacity: 0.9,
          lineHeight: 18,
        },
        actionsContainer: {
          marginTop: "auto",
        },
        glassOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: theme.dark
            ? "rgba(255,255,255,0.05)"
            : "rgba(255,255,255,0.5)",
        },
        hiddenGemBadge: {
          position: "absolute",
          top: 8,
          left: 8,
          backgroundColor: theme.dark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.6)",
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          minHeight: 26,
        },
        hiddenGemText: {
          color: "#FFD700",
          fontSize: 11,
          fontWeight: "bold",
        },
      }),
    [theme],
  );

  return (
    <>
      <Animated.View
        entering={FadeInUp.duration(400).springify()}
        style={[styles.container, animatedStyle]}
      >
        <Pressable
          onPress={handleCardPress}
          onLongPress={handleCardLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <LinearGradient
            colors={[
              theme.dark ? "#1A1A1A" : "#FFFFFF",
              theme.dark ? "#2D2D2D" : "#F5F5F5",
            ]}
            style={StyleSheet.absoluteFill}
          />

          {/* Subtle color glow based on match score */}
          <LinearGradient
            colors={[matchScoreColor[0] as string, "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBackground}
          />

          <View style={styles.contentContainer}>
            {/* Poster Section */}
            <View style={styles.posterContainer}>
              <Image
                source={{ uri: recommendation.metadata.posterUrl }}
                style={styles.poster}
                contentFit="cover"
                transition={300}
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.4)"]}
                style={styles.posterOverlay}
              />
              {recommendation.isHiddenGem && (
                <View style={styles.hiddenGemBadge}>
                  <Text style={styles.hiddenGemText}>💎 GEM</Text>
                </View>
              )}
            </View>

            {/* Info Section */}
            <View style={styles.infoContainer}>
              <View style={styles.headerRow}>
                <Text style={styles.title} numberOfLines={2}>
                  {recommendation.title}
                </Text>
                <LinearGradient
                  colors={matchScoreColor as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.matchBadge}
                >
                  <Text style={styles.matchScore}>
                    {recommendation.matchScore}%
                  </Text>
                </LinearGradient>
              </View>

              <View style={styles.metadataRow}>
                <Text style={styles.metadataText}>{recommendation.year}</Text>
                <View style={styles.dot} />
                <Text style={styles.metadataText}>
                  {recommendation.type.toUpperCase()}
                </Text>
                {recommendation.metadata.rating > 0 && (
                  <>
                    <View style={styles.dot} />
                    <Text style={styles.metadataText}>
                      ★ {recommendation.metadata.rating.toFixed(1)}
                    </Text>
                  </>
                )}
              </View>

              {/* Overview */}
              {recommendation.metadata.overview && (
                <View style={{ marginBottom: spacing.sm }}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.colors.onSurface,
                      opacity: 0.8,
                      lineHeight: 18,
                    }}
                    numberOfLines={3}
                  >
                    {recommendation.metadata.overview}
                  </Text>
                </View>
              )}

              {/* Genres */}
              {recommendation.metadata.genres.length > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    marginBottom: spacing.sm,
                  }}
                >
                  {recommendation.metadata.genres
                    .slice(0, 3)
                    .map((genre, idx) => (
                      <Chip
                        key={idx}
                        compact
                        style={{
                          height: 28,
                          backgroundColor: theme.colors.surfaceVariant,
                        }}
                        textStyle={{
                          fontSize: 11,
                          color: theme.colors.onSurfaceVariant,
                        }}
                      >
                        {genre}
                      </Chip>
                    ))}
                </View>
              )}

              {/* Reasons for Match */}
              <View style={styles.reasonsContainer}>
                {recommendation.reasonsForMatch.map((reason, idx) => (
                  <View
                    key={idx}
                    style={{ flexDirection: "row", marginBottom: 4 }}
                  >
                    <Text style={{ color: matchScoreColor[0], marginRight: 6 }}>
                      •
                    </Text>
                    <Text style={styles.reasonText} numberOfLines={2}>
                      {reason}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Similar Content */}
              {recommendation.similarToWatched.length > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    marginBottom: spacing.sm,
                  }}
                >
                  {recommendation.similarToWatched
                    .slice(0, 3)
                    .map((title, idx) => (
                      <Chip
                        key={idx}
                        compact
                        icon="check-circle"
                        style={{
                          height: 28,
                          backgroundColor: theme.colors.primaryContainer,
                        }}
                        textStyle={{
                          fontSize: 11,
                          color: theme.colors.onPrimaryContainer,
                        }}
                      >
                        {title}
                      </Chip>
                    ))}
                </View>
              )}

              <View style={styles.actionsContainer}>
                <RecommendationActions
                  recommendation={recommendation}
                  onAccept={onAccept}
                  onReject={onReject}
                  isOffline={isOffline}
                  isSubmitting={isSubmitting}
                  userId={userId ?? ""}
                />
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>

      {/* Recommendation Details Drawer */}
      <Portal>
        <BottomDrawer
          visible={drawerVisible}
          onDismiss={handleCloseDrawer}
          title="Recommendation Details"
          maxHeight="85%"
        >
          <View style={drawerStyles.content}>
            {/* Poster and Basic Info */}
            <View style={drawerStyles.header}>
              <Image
                source={{ uri: recommendation.metadata.posterUrl }}
                style={drawerStyles.poster}
                contentFit="cover"
                transition={200}
              />
              <View style={drawerStyles.headerInfo}>
                <Text
                  variant="headlineSmall"
                  style={[
                    drawerStyles.title,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {recommendation.title}
                </Text>
                <Text
                  variant="bodyMedium"
                  style={[
                    drawerStyles.meta,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {recommendation.year} • {recommendation.type}
                </Text>
                <View style={drawerStyles.chips}>
                  <Chip
                    icon="star"
                    style={[
                      drawerStyles.matchChip,
                      { backgroundColor: theme.colors.primaryContainer },
                    ]}
                    textStyle={{
                      fontSize: 12,
                      color: theme.colors.onPrimaryContainer,
                      fontWeight: "600",
                    }}
                  >
                    {recommendation.matchScore}% match
                  </Chip>
                  {recommendation.isHiddenGem && (
                    <Chip
                      icon="diamond-stone"
                      style={[
                        drawerStyles.hiddenGemChip,
                        { backgroundColor: theme.colors.tertiaryContainer },
                      ]}
                      textStyle={{
                        fontSize: 12,
                        color: theme.colors.onTertiaryContainer,
                        fontWeight: "600",
                      }}
                    >
                      Hidden Gem
                    </Chip>
                  )}
                </View>
              </View>
            </View>

            <Divider style={drawerStyles.divider} />

            {/* Overview */}
            {recommendation.metadata.overview && (
              <View style={drawerStyles.section}>
                <Text
                  variant="titleMedium"
                  style={[
                    drawerStyles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Overview
                </Text>
                <Text
                  variant="bodyMedium"
                  style={[
                    drawerStyles.sectionText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {recommendation.metadata.overview}
                </Text>
              </View>
            )}

            {/* Genres */}
            {recommendation.metadata.genres.length > 0 && (
              <View style={drawerStyles.section}>
                <Text
                  variant="titleMedium"
                  style={[
                    drawerStyles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Genres
                </Text>
                <View style={drawerStyles.genreContainer}>
                  {recommendation.metadata.genres.map((genre, idx) => (
                    <Chip
                      key={idx}
                      compact
                      style={[
                        drawerStyles.genreChip,
                        { backgroundColor: theme.colors.secondaryContainer },
                      ]}
                      textStyle={{
                        fontSize: 12,
                        color: theme.colors.onSecondaryContainer,
                      }}
                    >
                      {genre}
                    </Chip>
                  ))}
                </View>
              </View>
            )}

            {/* Rating & Popularity */}
            <View style={drawerStyles.section}>
              <Text
                variant="titleMedium"
                style={[
                  drawerStyles.sectionTitle,
                  { color: theme.colors.onSurface },
                ]}
              >
                Ratings
              </Text>
              <View style={drawerStyles.statsContainer}>
                <View style={drawerStyles.statItem}>
                  <MaterialCommunityIcons
                    name="star"
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    {recommendation.metadata.rating.toFixed(1)}/10
                  </Text>
                </View>
                <View style={drawerStyles.statItem}>
                  <MaterialCommunityIcons
                    name="fire"
                    size={20}
                    color={theme.colors.error}
                  />
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurface }}
                  >
                    {recommendation.metadata.popularity.toFixed(0)} popularity
                  </Text>
                </View>
              </View>
            </View>

            {/* Reasons for Match */}
            <View style={drawerStyles.section}>
              <Text
                variant="titleMedium"
                style={[
                  drawerStyles.sectionTitle,
                  { color: theme.colors.onSurface },
                ]}
              >
                Why We Recommend This
              </Text>
              {recommendation.reasonsForMatch.map((reason, idx) => (
                <View key={idx} style={drawerStyles.reasonItem}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text
                    variant="bodyMedium"
                    style={[
                      drawerStyles.reasonText,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {reason}
                  </Text>
                </View>
              ))}
            </View>

            {/* Similar To Watched */}
            {recommendation.similarToWatched.length > 0 && (
              <View style={drawerStyles.section}>
                <Text
                  variant="titleMedium"
                  style={[
                    drawerStyles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Similar To What You've Watched
                </Text>
                {recommendation.similarToWatched.map((title, idx) => (
                  <View key={idx} style={drawerStyles.similarItem}>
                    <MaterialCommunityIcons
                      name="movie-open"
                      size={18}
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text
                      variant="bodyMedium"
                      style={[
                        drawerStyles.similarText,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {title}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Where to Watch */}
            <View style={drawerStyles.section}>
              <Text
                variant="titleMedium"
                style={[
                  drawerStyles.sectionTitle,
                  { color: theme.colors.onSurface },
                ]}
              >
                Where to Watch
              </Text>
              <Text
                variant="bodyMedium"
                style={[
                  drawerStyles.sectionText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {recommendation.whereToWatch}
              </Text>
            </View>

            {/* Availability */}
            {recommendation.availability && (
              <View style={drawerStyles.section}>
                <Text
                  variant="titleMedium"
                  style={[
                    drawerStyles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Availability
                </Text>
                <View style={drawerStyles.availabilityContainer}>
                  {recommendation.availability.inLibrary && (
                    <Chip
                      icon="check-circle"
                      style={[
                        drawerStyles.availabilityChip,
                        { backgroundColor: theme.colors.primaryContainer },
                      ]}
                      textStyle={{
                        fontSize: 12,
                        color: theme.colors.onPrimaryContainer,
                      }}
                    >
                      In Library
                    </Chip>
                  )}
                  {recommendation.availability.inQueue && (
                    <Chip
                      icon="download"
                      style={[
                        drawerStyles.availabilityChip,
                        { backgroundColor: theme.colors.primaryContainer },
                      ]}
                      textStyle={{
                        fontSize: 12,
                        color: theme.colors.onPrimaryContainer,
                      }}
                    >
                      In Queue
                    </Chip>
                  )}
                  {recommendation.availability.availableServices.length > 0 && (
                    <Text
                      variant="bodySmall"
                      style={[
                        drawerStyles.servicesText,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      Available on:{" "}
                      {recommendation.availability.availableServices.join(", ")}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
        </BottomDrawer>
      </Portal>
    </>
  );
};

const drawerStyles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    gap: spacing.md,
  },
  poster: {
    width: 120,
    height: 180,
    borderRadius: borderRadius.md,
  },
  headerInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontWeight: "700",
  },
  meta: {},
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  matchChip: {
    height: 28,
  },
  hiddenGemChip: {
    height: 28,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  sectionText: {
    lineHeight: 22,
  },
  genreContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  genreChip: {
    height: 28,
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
  reasonItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  reasonText: {
    flex: 1,
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
  },
  availabilityContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    alignItems: "center",
  },
  availabilityChip: {
    height: 28,
  },
  servicesText: {
    fontStyle: "italic",
  },
});
