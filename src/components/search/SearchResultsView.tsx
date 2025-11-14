import React, { useEffect, useMemo, type ReactNode } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import {
  ActivityIndicator,
  Chip,
  HelperText,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import type {
  UnifiedSearchError,
  UnifiedSearchResult,
} from "@/models/search.types";

interface SearchResultsViewProps {
  results: UnifiedSearchResult[];
  isLoading: boolean;
  hasPerformedSearch: boolean;
  errors: UnifiedSearchError[];
  primaryError: Error | null;
  durationMs: number;
  interpretedQuery?: string | null;
  onPressResult: (result: UnifiedSearchResult) => void;
  onBookmarkResult: (result: UnifiedSearchResult) => void;
  containerStyle?: ViewStyle;
  footerContent?: ReactNode;
}

const statusLabels = {
  inLibrary: "In Library",
  requested: "Requested",
  available: "Available",
} as const;

const formatSubtitle = (result: UnifiedSearchResult) => {
  const parts: string[] = [];
  if (result.year) {
    parts.push(String(result.year));
  }
  if (typeof result.runtime === "number" && result.runtime > 0) {
    const hours = Math.floor(result.runtime / 60);
    const minutes = result.runtime % 60;
    const runtimeLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    parts.push(runtimeLabel);
  }
  if (result.serviceName) {
    parts.push(result.serviceName);
  } else {
    parts.push(result.serviceType.toUpperCase());
  }
  return parts.join(" • ");
};

export function SearchResultsView({
  results,
  isLoading,
  hasPerformedSearch,
  errors,
  primaryError,
  durationMs,
  interpretedQuery,
  onPressResult,
  onBookmarkResult,
  containerStyle,
  footerContent,
}: SearchResultsViewProps) {
  const theme = useTheme<AppTheme>();

  useEffect(() => {
    console.warn("[SearchResultsView] Results updated", {
      resultsCount: results.length,
      sampleTitle: results[0]?.title,
      isLoading,
      hasPerformedSearch,
    });
  }, [results, isLoading, hasPerformedSearch]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
        },
        header: {
          marginBottom: spacing.sm,
        },
        headerText: {
          fontSize: 16,
          fontWeight: "600",
          color: theme.colors.onSurface,
          marginBottom: spacing.xs,
        },
        subHeaderText: {
          fontSize: 13,
          color: theme.colors.onSurfaceVariant,
        },
        list: {
          paddingBottom: spacing.lg,
        },
        card: {
          backgroundColor: theme.colors.surface,
          borderRadius: borderRadius.lg,
          padding: spacing.sm,
          marginBottom: spacing.sm,
          flexDirection: "row",
          gap: spacing.md,
          alignItems: "center",
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
        poster: {
          width: 72,
          height: 108,
          borderRadius: borderRadius.md,
          backgroundColor: theme.colors.surfaceVariant,
        },
        cardContent: {
          flex: 1,
        },
        title: {
          fontSize: 15,
          fontWeight: "600",
          color: theme.colors.onSurface,
          marginBottom: spacing.xs,
        },
        subtitle: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.xs,
        },
        chipRow: {
          flexDirection: "row",
          gap: spacing.xs,
          marginBottom: spacing.xs,
        },
        actions: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
        },
        emptyState: {
          alignItems: "center",
          paddingVertical: spacing.lg,
        },
        emptyText: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          marginTop: spacing.sm,
        },
        loaderContainer: {
          paddingVertical: spacing.lg,
          alignItems: "center",
        },
      }),
    [theme],
  );

  const renderResult = ({ item }: { item: UnifiedSearchResult }) => {
    const statusChips: string[] = [];
    if (item.isInLibrary) {
      statusChips.push(statusLabels.inLibrary);
    }
    if (item.isRequested) {
      statusChips.push(statusLabels.requested);
    }
    if (item.isAvailable) {
      statusChips.push(statusLabels.available);
    }

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onPressResult(item)}
        style={styles.card}
      >
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.poster} />
        ) : (
          <View style={styles.poster} />
        )}

        <View style={styles.cardContent}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {formatSubtitle(item)}
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={true}
          >
            <View style={styles.chipRow}>
              <Chip compact icon="play">
                {item.mediaType.toUpperCase()}
              </Chip>
              <Chip compact mode="outlined">
                {item.serviceType.toUpperCase()}
              </Chip>
              {statusChips.map((chip) => (
                <Chip key={chip} compact mode="outlined">
                  {chip}
                </Chip>
              ))}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <IconButton
              icon="bookmark-plus"
              size={20}
              onPress={() => onBookmarkResult(item)}
              accessibilityLabel="Bookmark result"
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const errorMessages = useMemo(() => {
    const combined: string[] = [];

    if (primaryError) {
      combined.push(primaryError.message);
    }

    errors.forEach((error) => {
      combined.push(`${error.serviceType.toUpperCase()}: ${error.message}`);
    });

    return combined;
  }, [errors, primaryError]);

  const renderListHeader = () => {
    console.warn("[SearchResultsView] Rendering header:", {
      resultsCount: results.length,
      hasPerformedSearch,
      isLoading,
      errorCount: errorMessages.length,
      interpretedQuery,
      durationMs,
    });
    return (
      <>
        <View style={styles.header}>
          <Text style={styles.headerText}>Results</Text>
          {hasPerformedSearch && interpretedQuery ? (
            <Text style={styles.subHeaderText}>
              Showing matches for "{interpretedQuery}" · {durationMs} ms
            </Text>
          ) : hasPerformedSearch ? (
            <Text style={styles.subHeaderText}>{durationMs} ms</Text>
          ) : null}
        </View>

        {errorMessages.length > 0 ? (
          <HelperText type="error">{errorMessages.join(" • ")}</HelperText>
        ) : null}

        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator animating size="small" />
          </View>
        ) : null}

        {!isLoading && hasPerformedSearch && results.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No results yet. Try refining your filters or adjusting services.
            </Text>
          </View>
        ) : null}
      </>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {renderListHeader()}

      <View style={styles.list}>
        {results.map((item) => (
          <React.Fragment key={item.id}>
            {renderResult({ item })}
          </React.Fragment>
        ))}
      </View>

      {footerContent ? (
        <View style={{ paddingTop: spacing.md }}>{footerContent}</View>
      ) : null}
    </View>
  );
}

export default SearchResultsView;
