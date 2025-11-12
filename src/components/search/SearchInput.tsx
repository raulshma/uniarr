import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { Text, TextInput, useTheme, Chip } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import type { SearchInterpretation } from "@/utils/validation/searchSchemas";

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmitSearch?: () => void;
  placeholder?: string;
  onInterpretationStream?: (partial: Partial<SearchInterpretation>) => void;
  onInterpretationComplete?: (interpretation: SearchInterpretation) => void;
  isStreaming?: boolean;
  interpretation?: Partial<SearchInterpretation>;
  containerStyle?: ViewStyle;
  onClear?: () => void;
}

/**
 * SearchInput component with AI-powered suggestions
 * Displays streaming interpretation results in real-time
 */
export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search naturally: "anime from 2020 with romance"',
  onInterpretationStream,
  onInterpretationComplete,
  onSubmitSearch,
  isStreaming = false,
  interpretation,
  containerStyle,
  onClear,
}: SearchInputProps) {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: theme.colors.background,
        },
        inputContainer: {
          marginBottom: spacing.md,
        },
        input: {
          height: theme.custom.sizes.touchSizes.md,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: borderRadius.lg,
          fontSize: 16,
          paddingHorizontal: spacing.lg,
        },
        streamingIndicator: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
        streamingText: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
          fontStyle: "italic",
        },
        interpretationPreview: {
          marginBottom: spacing.md,
          paddingHorizontal: spacing.xs,
        },
        interpretationLabel: {
          fontSize: 12,
          fontWeight: "600",
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.xs,
          marginLeft: spacing.sm,
        },
        tags: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
          paddingHorizontal: spacing.sm,
        },
        chip: {
          height: 32,
          justifyContent: "center",
        },
        confidenceBadge: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          marginTop: spacing.sm,
          paddingHorizontal: spacing.sm,
        },
        confidenceLabel: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
        },
        confidenceValue: {
          fontSize: 12,
          fontWeight: "600",
          color: theme.colors.primary,
        },
      }),
    [theme],
  );

  const handleClearInput = useCallback(() => {
    onClear?.();
    onChangeText("");
  }, [onChangeText, onClear]);

  const confidencePercentage = interpretation?.confidence
    ? Math.round((interpretation.confidence as number) * 100)
    : null;

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Search Input */}
      <View style={styles.inputContainer}>
        <TextInput
          mode="flat"
          placeholder={placeholder}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
          contentStyle={{
            backgroundColor: "transparent",
          }}
          underlineStyle={{ display: "none" }}
          left={
            <TextInput.Icon icon="magnify" size={20} onPress={onSubmitSearch} />
          }
          right={
            value.length > 0 ? (
              <TextInput.Icon
                icon="close"
                size={20}
                onPress={handleClearInput}
              />
            ) : undefined
          }
        />
      </View>

      {/* Streaming Indicator */}
      {isStreaming && (
        <View style={styles.streamingIndicator}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.streamingText}>
            AI is interpreting your search...
          </Text>
        </View>
      )}

      {/* Media Types */}
      {interpretation?.mediaTypes && interpretation.mediaTypes.length > 0 && (
        <View style={styles.interpretationPreview}>
          <Text style={styles.interpretationLabel}>Media Types</Text>
          <View style={styles.tags}>
            {interpretation.mediaTypes.map((type, index) => (
              <Chip
                key={`mediatype-${index}`}
                style={styles.chip}
                textStyle={{ fontSize: 12 }}
                icon="play"
              >
                {type}
              </Chip>
            ))}
          </View>
        </View>
      )}

      {/* Genres */}
      {interpretation?.genres && interpretation.genres.length > 0 && (
        <View style={styles.interpretationPreview}>
          <Text style={styles.interpretationLabel}>Genres</Text>
          <View style={styles.tags}>
            {interpretation.genres.slice(0, 5).map((genre, index) => (
              <Chip
                key={`genre-${index}`}
                style={styles.chip}
                textStyle={{ fontSize: 12 }}
                icon="tag"
              >
                {genre}
              </Chip>
            ))}
            {(interpretation.genres?.length ?? 0) > 5 && (
              <Chip style={styles.chip} textStyle={{ fontSize: 12 }}>
                +{(interpretation.genres?.length ?? 0) - 5} more
              </Chip>
            )}
          </View>
        </View>
      )}

      {/* Quality Preference */}
      {interpretation?.qualityPreference && (
        <View style={styles.interpretationPreview}>
          <Text style={styles.interpretationLabel}>Quality</Text>
          <View style={styles.tags}>
            <Chip style={styles.chip} textStyle={{ fontSize: 12 }} icon="hd">
              {interpretation.qualityPreference}
            </Chip>
          </View>
        </View>
      )}

      {/* Year Range */}
      {interpretation?.yearRange && (
        <View style={styles.interpretationPreview}>
          <Text style={styles.interpretationLabel}>Year Range</Text>
          <View style={styles.tags}>
            <Chip
              style={styles.chip}
              textStyle={{ fontSize: 12 }}
              icon="calendar"
            >
              {interpretation.yearRange.start} - {interpretation.yearRange.end}
            </Chip>
          </View>
        </View>
      )}

      {/* Confidence Score */}
      {confidencePercentage !== null && (
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceLabel}>Confidence:</Text>
          <Text style={styles.confidenceValue}>{confidencePercentage}%</Text>
        </View>
      )}

      {/* Search Warnings */}
      {interpretation?.searchWarnings &&
        interpretation.searchWarnings.length > 0 && (
          <View style={styles.interpretationPreview}>
            {interpretation.searchWarnings.map((warning, index) => (
              <Chip
                key={`warning-${index}`}
                style={styles.chip}
                textStyle={{ fontSize: 12 }}
                icon="alert"
                mode="outlined"
              >
                {warning}
              </Chip>
            ))}
          </View>
        )}
    </View>
  );
}
