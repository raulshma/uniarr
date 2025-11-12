import { useMemo, useCallback } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { Text, Chip, IconButton, useTheme } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import type { RecommendationItem } from "@/services/search/SearchRecommendationsService";

interface RecommendationsViewProps {
  recommendations: RecommendationItem[];
  isLoading?: boolean;
  onSelectRecommendation?: (recommendation: RecommendationItem) => void;
  containerStyle?: ViewStyle;
  onRefresh?: () => void;
}

/**
 * RecommendationsView component
 * Displays personalized content recommendations
 */
export function RecommendationsView({
  recommendations,
  isLoading = false,
  onSelectRecommendation,
  containerStyle,
  onRefresh,
}: RecommendationsViewProps) {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
        },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.md,
        },
        title: {
          fontSize: 18,
          fontWeight: "600",
          color: theme.colors.onSurface,
        },
        refreshButton: {
          padding: 0,
          margin: 0,
        },
        loadingContainer: {
          paddingVertical: spacing.lg,
          alignItems: "center",
        },
        loadingText: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          marginTop: spacing.sm,
        },
        emptyContainer: {
          paddingVertical: spacing.lg,
          alignItems: "center",
        },
        emptyText: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
        },
        categoryGroup: {
          marginBottom: spacing.lg,
        },
        categoryHeader: {
          fontSize: 14,
          fontWeight: "600",
          color: theme.colors.primary,
          marginBottom: spacing.sm,
          marginLeft: spacing.sm,
          textTransform: "capitalize",
        },
        recommendationCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: borderRadius.md,
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.outline,
        },
        recommendationCardTouched: {
          backgroundColor: theme.colors.surfaceVariant,
        },
        cardHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: spacing.sm,
        },
        cardTitle: {
          fontSize: 14,
          fontWeight: "600",
          color: theme.colors.onSurface,
          flex: 1,
          marginRight: spacing.sm,
        },
        typeChip: {
          height: 24,
          justifyContent: "center",
        },
        chipText: {
          fontSize: 11,
        },
        reasonText: {
          fontSize: 13,
          color: theme.colors.onSurfaceVariant,
          lineHeight: 18,
          marginBottom: spacing.sm,
        },
        scoreContainer: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginBottom: spacing.sm,
        },
        scoreLabel: {
          fontSize: 11,
          color: theme.colors.onSurfaceVariant,
        },
        scoreBar: {
          flex: 1,
          height: 6,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 3,
          overflow: "hidden",
        },
        scoreValue: {
          fontSize: 11,
          fontWeight: "600",
          color: theme.colors.primary,
          minWidth: 30,
          textAlign: "right",
        },
        actionButton: {
          marginTop: spacing.sm,
        },
        typeIcon: {
          width: 24,
          height: 24,
          borderRadius: 4,
          justifyContent: "center",
          alignItems: "center",
          marginRight: spacing.sm,
        },
      }),
    [theme],
  );

  const groupedRecommendations = useMemo(() => {
    const groups = new Map<string, RecommendationItem[]>();

    recommendations.forEach((rec) => {
      const type = rec.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(rec);
    });

    return groups;
  }, [recommendations]);

  const getTypeIcon = (type: RecommendationItem["type"]) => {
    const icons: Record<RecommendationItem["type"], string> = {
      trending: "trending-up",
      similar: "shuffle-variant",
      gaps: "puzzle",
      seasonal: "calendar-season",
      genre: "tag-multiple",
      completion: "check-all",
    };
    return icons[type];
  };

  const getTypeColor = (type: RecommendationItem["type"]) => {
    const colors: Record<RecommendationItem["type"], string> = {
      trending: theme.colors.error,
      similar: theme.colors.secondary,
      gaps: theme.colors.tertiary,
      seasonal: theme.colors.primary,
      genre: theme.colors.primary,
      completion: theme.colors.secondary,
    };
    return colors[type];
  };

  const handleSelectRecommendation = useCallback(
    (recommendation: RecommendationItem) => {
      onSelectRecommendation?.(recommendation);
    },
    [onSelectRecommendation],
  );

  /**
   * Ensure match score is in 0-100 range
   * Handles both 0-1 and 0-100 formats from AI
   */
  const normalizeMatchScore = useCallback((score: number): number => {
    if (score <= 1) {
      return Math.round(score * 100);
    }
    return Math.min(Math.max(Math.round(score), 0), 100);
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, containerStyle]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading recommendations...</Text>
        </View>
      </View>
    );
  }

  if (recommendations.length === 0) {
    return (
      <View style={[styles.container, containerStyle]}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No recommendations available</Text>
          <Text style={styles.emptyText}>
            Configure your services and preferences to get personalized
            suggestions
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Recommended For You</Text>
        <IconButton
          icon="refresh"
          size={20}
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={isLoading}
        />
      </View>

      {/* Recommendations by Category */}
      {Array.from(groupedRecommendations.entries()).map(([category, items]) => (
        <View key={category} style={styles.categoryGroup}>
          <Text style={styles.categoryHeader}>{category}</Text>
          {items.map((rec, index) => (
            <TouchableOpacity
              key={`${category}-${index}`}
              onPress={() => handleSelectRecommendation(rec)}
              activeOpacity={0.7}
            >
              <View style={styles.recommendationCard}>
                {/* Title and Type */}
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {rec.title}
                  </Text>
                  <Chip
                    style={styles.typeChip}
                    textStyle={styles.chipText}
                    icon={getTypeIcon(rec.type)}
                  >
                    {rec.mediaType}
                  </Chip>
                </View>

                {/* Reason */}
                <Text style={styles.reasonText} numberOfLines={2}>
                  {rec.reason}
                </Text>

                {/* Match Score */}
                <View style={styles.scoreContainer}>
                  <Text style={styles.scoreLabel}>Match:</Text>
                  <View style={styles.scoreBar}>
                    <View
                      style={{
                        width: `${normalizeMatchScore(rec.estimatedMatchScore)}%`,
                        height: "100%",
                        backgroundColor: getTypeColor(rec.type),
                      }}
                    />
                  </View>
                  <Text style={styles.scoreValue}>
                    {normalizeMatchScore(rec.estimatedMatchScore)}%
                  </Text>
                </View>

                {/* Action Button */}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleSelectRecommendation(rec)}
                >
                  <Chip
                    icon="plus"
                    onPress={() => handleSelectRecommendation(rec)}
                  >
                    Search
                  </Chip>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}
