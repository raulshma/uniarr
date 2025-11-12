import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { Text, Chip, IconButton, useTheme } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import type { SearchInterpretation } from "@/utils/validation/searchSchemas";

interface SearchInterpretationViewProps {
  interpretation: Partial<SearchInterpretation>;
  isStreaming?: boolean;
  onEditMedia?: (mediaTypes: string[]) => void;
  onEditGenres?: (genres: string[]) => void;
  onEditFilters?: (filters: any) => void;
  containerStyle?: ViewStyle;
}

/**
 * SearchInterpretationView component
 * Displays the AI's interpretation of the search query
 * Allows users to review and edit the interpretation
 */
export function SearchInterpretationView({
  interpretation,
  isStreaming = false,
  onEditMedia,
  onEditGenres,
  onEditFilters,
  containerStyle,
}: SearchInterpretationViewProps) {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          backgroundColor: theme.colors.surface,
          marginHorizontal: spacing.sm,
          borderRadius: borderRadius.lg,
          marginBottom: spacing.md,
        },
        card: {
          backgroundColor: theme.colors.surfaceVariant,
          marginBottom: spacing.md,
          borderRadius: borderRadius.md,
        },
        section: {
          marginBottom: spacing.lg,
        },
        sectionHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.sm,
        },
        sectionTitle: {
          fontSize: 14,
          fontWeight: "600",
          color: theme.colors.onSurface,
        },
        editButton: {
          padding: 0,
          margin: 0,
        },
        tagContainer: {
          flexDirection: "row",
          gap: spacing.sm,
        },
        chip: {
          height: 32,
          justifyContent: "center",
        },
        chipText: {
          fontSize: 12,
        },
        filterSection: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          backgroundColor: theme.colors.background,
          borderRadius: borderRadius.md,
          marginVertical: spacing.sm,
        },
        filterRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: spacing.xs,
        },
        filterLabel: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
        },
        filterValue: {
          fontSize: 12,
          fontWeight: "500",
          color: theme.colors.onSurface,
        },
        warningContainer: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          backgroundColor: theme.colors.errorContainer,
          borderRadius: borderRadius.md,
          marginVertical: spacing.sm,
        },
        warningText: {
          fontSize: 12,
          color: theme.colors.error,
          fontStyle: "italic",
        },
        emptyState: {
          paddingVertical: spacing.md,
          alignItems: "center",
        },
        emptyStateText: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          fontStyle: "italic",
        },
        streamingLabel: {
          fontSize: 11,
          color: theme.colors.primary,
          fontStyle: "italic",
        },
      }),
    [theme],
  );

  const hasContent =
    (interpretation.mediaTypes?.length ?? 0) > 0 ||
    (interpretation.genres?.length ?? 0) > 0 ||
    interpretation.qualityPreference ||
    interpretation.languagePreference ||
    (interpretation.filters && Object.keys(interpretation.filters).length > 0);

  if (!hasContent) {
    return (
      <View style={[styles.container, containerStyle]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Interpretation will appear here as you type...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Media Types */}
      {interpretation.mediaTypes && interpretation.mediaTypes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Media Types</Text>
            <TouchableOpacity
              onPress={() =>
                onEditMedia?.(interpretation.mediaTypes as string[])
              }
              style={styles.editButton}
            >
              <IconButton icon="pencil" size={16} />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={true}
          >
            <View style={styles.tagContainer}>
              {interpretation.mediaTypes.map((type, index) => (
                <Chip
                  key={`mediatype-${index}`}
                  style={styles.chip}
                  textStyle={styles.chipText}
                  icon="play"
                >
                  {type}
                </Chip>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Genres */}
      {interpretation.genres && interpretation.genres.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Genres</Text>
            <TouchableOpacity
              onPress={() => onEditGenres?.(interpretation.genres as string[])}
              style={styles.editButton}
            >
              <IconButton icon="pencil" size={16} />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={true}
          >
            <View style={styles.tagContainer}>
              {interpretation.genres.map((genre, index) => (
                <Chip
                  key={`genre-${index}`}
                  style={styles.chip}
                  textStyle={styles.chipText}
                  icon="tag"
                >
                  {genre}
                </Chip>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Quality & Language Preferences */}
      {(interpretation.qualityPreference ||
        interpretation.languagePreference) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.filterSection}>
            {interpretation.qualityPreference && (
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Quality:</Text>
                <Text style={styles.filterValue}>
                  {interpretation.qualityPreference}
                </Text>
              </View>
            )}
            {interpretation.languagePreference && (
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Language:</Text>
                <Text style={styles.filterValue}>
                  {interpretation.languagePreference}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Filters */}
      {interpretation.filters &&
        Object.keys(interpretation.filters).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Filters</Text>
            <View style={styles.filterSection}>
              {interpretation.filters.isCompleted && (
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>Status:</Text>
                  <Text style={styles.filterValue}>Completed Only</Text>
                </View>
              )}
              {interpretation.filters.minRating && (
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>Min Rating:</Text>
                  <Text style={styles.filterValue}>
                    {interpretation.filters.minRating}
                  </Text>
                </View>
              )}
              {interpretation.filters.minEpisodes && (
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>Min Episodes:</Text>
                  <Text style={styles.filterValue}>
                    {interpretation.filters.minEpisodes}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

      {/* Year Range */}
      {interpretation.yearRange && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Year Range</Text>
          <View style={styles.filterSection}>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>From:</Text>
              <Text style={styles.filterValue}>
                {interpretation.yearRange.start}
              </Text>
            </View>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>To:</Text>
              <Text style={styles.filterValue}>
                {interpretation.yearRange.end}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Search Warnings */}
      {interpretation.searchWarnings &&
        interpretation.searchWarnings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Warnings</Text>
            {interpretation.searchWarnings.map((warning, index) => (
              <View key={`warning-${index}`} style={styles.warningContainer}>
                <Text style={styles.warningText}>{warning}</Text>
              </View>
            ))}
          </View>
        )}

      {/* Confidence & Streaming Status */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Confidence:</Text>
          <Text style={styles.filterValue}>
            {interpretation.confidence
              ? `${Math.round((interpretation.confidence as number) * 100)}%`
              : "N/A"}
          </Text>
        </View>
        {isStreaming && (
          <View style={styles.filterRow}>
            <Text style={styles.streamingLabel}>Interpreting...</Text>
          </View>
        )}
      </View>
    </View>
  );
}
