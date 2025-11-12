import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Chip,
  Dialog,
  HelperText,
  Portal,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useRouter } from "expo-router";

import {
  AnimatedSection,
  PageTransition,
} from "@/components/common/AnimatedComponents";
import { TabHeader } from "@/components/common/TabHeader";
import { SearchInput } from "@/components/search/SearchInput";
import { SearchInterpretationView } from "@/components/search/SearchInterpretationView";
import { RecommendationsView } from "@/components/search/SearchRecommendationsView";
import { SearchResultsView } from "@/components/search/SearchResultsView";
import { useAISearch } from "@/hooks/useAISearch";
import { useDialog } from "@/components/common";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import type { SearchInterpretation } from "@/utils/validation/searchSchemas";
import type { UnifiedSearchResult } from "@/models/search.types";

const MEDIA_OPTIONS: SearchInterpretation["mediaTypes"] = [
  "anime",
  "series",
  "movie",
];

const MAX_HISTORY_CHIPS = 6;

const IntelligentSearchScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const { present } = useDialog();

  const {
    searchQuery,
    setSearchQuery,
    interpretation,
    partialInterpretation,
    isInterpretingSearch,
    interpretationError,
    results,
    isSearching,
    searchError,
    searchErrors,
    lastSearchDurationMs,
    hasPerformedSearch,
    recommendations,
    isLoadingRecommendations,
    recommendationsError,
    interpretedQuery,
    recommendedServiceIds,
    searchHistory,
    clearHistory,
    refreshRecommendations,
    performSearch,
    refineInterpretation,
    bookmarkResult,
    clearSearch,
  } = useAISearch({ autoSearch: true });

  const interpretationForDisplay = useMemo(() => {
    if (
      partialInterpretation &&
      Object.keys(partialInterpretation).length > 0
    ) {
      return partialInterpretation;
    }
    return interpretation ?? {};
  }, [interpretation, partialInterpretation]);

  const [mediaDialogVisible, setMediaDialogVisible] = useState(false);
  const [mediaSelection, setMediaSelection] = useState<
    SearchInterpretation["mediaTypes"]
  >([]);

  const [genresDialogVisible, setGenresDialogVisible] = useState(false);
  const [genresSelection, setGenresSelection] = useState<string[]>([]);
  const [genreInput, setGenreInput] = useState("");

  const [filtersDialogVisible, setFiltersDialogVisible] = useState(false);
  const [filtersCompletedOnly, setFiltersCompletedOnly] = useState(false);
  const [filtersMinRating, setFiltersMinRating] = useState("");
  const [filtersMinEpisodes, setFiltersMinEpisodes] = useState("");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        page: {
          flex: 1,
        },
        headerContainer: {
          paddingHorizontal: spacing.sm,
          paddingTop: spacing.sm,
        },
        content: {
          flex: 1,
          marginTop: spacing.xs,
          marginHorizontal: spacing.sm,
        },
        listHeader: {
          gap: spacing.md,
          paddingBottom: spacing.md,
        },
        section: {
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        sectionHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        sectionTitle: {
          fontSize: 16,
          fontWeight: "600",
          color: theme.colors.onSurface,
        },
        chipRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
        },
        helperText: {
          marginHorizontal: spacing.md,
        },
        dialogChipRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
        historyEmpty: {
          fontSize: 13,
          color: theme.colors.onSurfaceVariant,
          fontStyle: "italic",
        },
        dialogActions: {
          justifyContent: "flex-end",
        },
        dialogContentSpacing: {
          gap: spacing.sm,
        },
        filtersField: {
          marginTop: spacing.sm / 2,
        },
        filtersInput: {
          backgroundColor: theme.colors.surfaceVariant,
        },
        filtersRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        streamingBadge: {
          alignSelf: "flex-start",
          backgroundColor: theme.colors.surfaceVariant,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: 12,
        },
        streamingText: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
          fontStyle: "italic",
        },
      }),
    [theme],
  );

  const runSearchIfPossible = useCallback(() => {
    const candidate = (interpretedQuery ?? searchQuery).trim();
    if (candidate.length >= 2) {
      void performSearch(candidate);
    }
  }, [interpretedQuery, performSearch, searchQuery]);

  const handleMediaDialogOpen = useCallback(
    (mediaTypes?: string[]) => {
      const initial = (
        mediaTypes?.length
          ? mediaTypes
          : (interpretationForDisplay.mediaTypes ?? [])
      ) as SearchInterpretation["mediaTypes"];
      setMediaSelection(initial);
      setMediaDialogVisible(true);
    },
    [interpretationForDisplay.mediaTypes],
  );

  const toggleMediaType = useCallback(
    (type: (typeof MEDIA_OPTIONS)[number]) => {
      setMediaSelection((prev) =>
        prev.includes(type)
          ? (prev.filter(
              (item) => item !== type,
            ) as SearchInterpretation["mediaTypes"])
          : ([...prev, type] as SearchInterpretation["mediaTypes"]),
      );
    },
    [],
  );

  const handleMediaDialogApply = useCallback(() => {
    if (mediaSelection.length === 0) {
      refineInterpretation({ mediaTypes: undefined });
    } else {
      refineInterpretation({ mediaTypes: mediaSelection });
    }
    setMediaDialogVisible(false);
    runSearchIfPossible();
  }, [mediaSelection, refineInterpretation, runSearchIfPossible]);

  const handleGenresDialogOpen = useCallback(
    (genres?: string[]) => {
      const initial = genres?.length
        ? genres
        : (interpretationForDisplay.genres ?? []);
      setGenresSelection(initial);
      setGenreInput("");
      setGenresDialogVisible(true);
    },
    [interpretationForDisplay.genres],
  );

  const toggleGenre = useCallback((genre: string) => {
    setGenresSelection((prev) =>
      prev.includes(genre)
        ? prev.filter((item) => item !== genre)
        : [...prev, genre],
    );
  }, []);

  const handleAddGenre = useCallback(() => {
    const trimmed = genreInput.trim();
    if (!trimmed) {
      return;
    }
    setGenresSelection((prev) =>
      prev.includes(trimmed) ? prev : [...prev, trimmed],
    );
    setGenreInput("");
  }, [genreInput]);

  const handleGenresDialogApply = useCallback(() => {
    if (genresSelection.length === 0) {
      refineInterpretation({ genres: undefined });
    } else {
      refineInterpretation({ genres: genresSelection });
    }
    setGenresDialogVisible(false);
    runSearchIfPossible();
  }, [genresSelection, refineInterpretation, runSearchIfPossible]);

  const handleFiltersDialogOpen = useCallback(
    (filters?: SearchInterpretation["filters"]) => {
      setFiltersCompletedOnly(Boolean(filters?.isCompleted));
      setFiltersMinRating(
        filters?.minRating !== undefined ? String(filters.minRating) : "",
      );
      setFiltersMinEpisodes(
        filters?.minEpisodes !== undefined ? String(filters.minEpisodes) : "",
      );
      setFiltersDialogVisible(true);
    },
    [],
  );

  const handleFiltersDialogApply = useCallback(() => {
    const nextFilters: SearchInterpretation["filters"] = {};

    if (filtersCompletedOnly) {
      nextFilters.isCompleted = true;
    }

    if (filtersMinRating.trim()) {
      const parsed = Number(filtersMinRating.trim());
      if (!Number.isNaN(parsed)) {
        nextFilters.minRating = parsed;
      }
    }

    if (filtersMinEpisodes.trim()) {
      const parsed = Number(filtersMinEpisodes.trim());
      if (!Number.isNaN(parsed)) {
        nextFilters.minEpisodes = parsed;
      }
    }

    if (Object.keys(nextFilters).length === 0) {
      refineInterpretation({ filters: undefined });
    } else {
      refineInterpretation({ filters: nextFilters });
    }

    setFiltersDialogVisible(false);
    runSearchIfPossible();
  }, [
    filtersCompletedOnly,
    filtersMinEpisodes,
    filtersMinRating,
    refineInterpretation,
    runSearchIfPossible,
  ]);

  const handleRecommendationSelect = useCallback(
    (recommendation: { title: string }) => {
      setSearchQuery(recommendation.title);
      void performSearch(recommendation.title);
    },
    [performSearch, setSearchQuery],
  );

  const handleHistorySelect = useCallback(
    (query: string) => {
      setSearchQuery(query);
      void performSearch(query);
    },
    [performSearch, setSearchQuery],
  );

  const handleClearHistory = useCallback(() => {
    if (!searchHistory.length) {
      return;
    }
    present({
      title: "Clear AI search history?",
      message: "This removes your past natural language searches.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            void clearHistory();
          },
        },
      ],
    });
  }, [clearHistory, present, searchHistory.length]);

  const handleResultPress = useCallback(
    (item: UnifiedSearchResult) => {
      if (item.serviceType === "jellyseerr") {
        const mediaType = item.mediaType === "series" ? "series" : "movie";
        const mediaId =
          item.externalIds?.tmdbId ?? item.externalIds?.serviceNativeId;

        router.push({
          pathname: "/(auth)/jellyseerr/[serviceId]/[mediaType]/[mediaId]",
          params: {
            serviceId: item.serviceId,
            mediaType,
            mediaId: mediaId ? String(mediaId) : "",
          },
        });
        return;
      }

      if (item.serviceType === "jellyfin") {
        const nativeId = item.externalIds?.serviceNativeId;
        router.push({
          pathname: "/(auth)/jellyfin/[serviceId]/details/[itemId]",
          params: {
            serviceId: item.serviceId,
            itemId: nativeId ? String(nativeId) : "",
          },
        });
        return;
      }

      if (item.serviceType === "sonarr") {
        const nativeId = item.externalIds?.serviceNativeId;
        const tvdbId = item.externalIds?.tvdbId;
        const id =
          nativeId && String(nativeId) !== "0"
            ? String(nativeId)
            : tvdbId && String(tvdbId) !== "0"
              ? String(tvdbId)
              : undefined;

        router.push({
          pathname: "/(auth)/sonarr/[serviceId]/series/[id]",
          params: {
            serviceId: item.serviceId,
            id: id ?? "",
          },
        });
        return;
      }

      if (item.serviceType === "radarr") {
        const nativeId = item.externalIds?.serviceNativeId;
        const tmdbId = item.externalIds?.tmdbId;
        const id =
          nativeId && String(nativeId) !== "0"
            ? String(nativeId)
            : tmdbId && String(tmdbId) !== "0"
              ? String(tmdbId)
              : undefined;

        router.push({
          pathname: "/(auth)/radarr/[serviceId]/movies/[id]",
          params: {
            serviceId: item.serviceId,
            id: id ?? "",
          },
        });
        return;
      }

      router.push({
        pathname: "/(auth)/search",
        params: { query: item.title },
      });
    },
    [router],
  );

  const handleBookmark = useCallback(
    async (result: UnifiedSearchResult) => {
      try {
        await bookmarkResult(result);
        present({
          title: "Saved to AI history",
          message: `${result.title} will be easier to find next time.`,
          buttons: [{ text: "OK" }],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        present({
          title: "Couldn't bookmark",
          message,
          buttons: [{ text: "Dismiss" }],
        });
      }
    },
    [bookmarkResult, present],
  );

  const headerContent = (
    <View style={styles.listHeader}>
      <SearchInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmitSearch={() => {
          void performSearch();
        }}
        isStreaming={isInterpretingSearch}
        interpretation={interpretationForDisplay}
        onClear={clearSearch}
      />

      {interpretationError ? (
        <HelperText type="error">{interpretationError.message}</HelperText>
      ) : null}

      {isInterpretingSearch ? (
        <View style={styles.streamingBadge}>
          <Text style={styles.streamingText}>
            AI is interpreting your query…
          </Text>
        </View>
      ) : null}

      <SearchInterpretationView
        interpretation={interpretationForDisplay}
        isStreaming={isInterpretingSearch}
        onEditMedia={handleMediaDialogOpen}
        onEditGenres={handleGenresDialogOpen}
        onEditFilters={handleFiltersDialogOpen}
      />

      {recommendedServiceIds.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Suggested services</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={true}
          >
            <View style={styles.chipRow}>
              {recommendedServiceIds.map((service) => (
                <Chip key={service} mode="outlined" icon="server">
                  {service}
                </Chip>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {searchHistory.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent searches</Text>
            <Button onPress={handleClearHistory} compact>
              Clear
            </Button>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={true}
          >
            <View style={styles.chipRow}>
              {searchHistory.slice(0, MAX_HISTORY_CHIPS).map((entry) => (
                <Chip
                  key={entry.id}
                  mode="outlined"
                  onPress={() => handleHistorySelect(entry.query)}
                >
                  {entry.query}
                </Chip>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : (
        <Text style={styles.historyEmpty}>
          Your searches will appear here for quick access.
        </Text>
      )}

      {recommendationsError ? (
        <HelperText type="error">{recommendationsError.message}</HelperText>
      ) : null}

      <RecommendationsView
        recommendations={recommendations}
        isLoading={isLoadingRecommendations}
        onSelectRecommendation={handleRecommendationSelect}
        onRefresh={() => {
          void refreshRecommendations();
        }}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <PageTransition style={styles.page} transitionType="fade">
        <View style={styles.headerContainer}>
          <AnimatedSection delay={0} animated>
            <TabHeader
              title="AI Search"
              showTitle
              showBackButton
              onBackPress={() => router.back()}
            />
          </AnimatedSection>
        </View>

        <AnimatedSection style={{ flex: 1 }} delay={80} animated>
          <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={true}>
            {headerContent}
            <View style={{ height: 450 }}>
              <SearchResultsView
                results={results}
                isLoading={isSearching}
                hasPerformedSearch={hasPerformedSearch}
                errors={searchErrors}
                primaryError={searchError}
                durationMs={lastSearchDurationMs}
                interpretedQuery={interpretedQuery}
                onPressResult={handleResultPress}
                onBookmarkResult={handleBookmark}
              />
            </View>
          </ScrollView>
        </AnimatedSection>
      </PageTransition>

      <Portal>
        <Dialog
          visible={mediaDialogVisible}
          onDismiss={() => setMediaDialogVisible(false)}
        >
          <Dialog.Title>Media types</Dialog.Title>
          <Dialog.Content>
            <View style={styles.dialogChipRow}>
              {MEDIA_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  mode="outlined"
                  icon="play"
                  selected={mediaSelection.includes(option)}
                  onPress={() => toggleMediaType(option)}
                >
                  {option}
                </Chip>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setMediaDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleMediaDialogApply}>Apply</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={genresDialogVisible}
          onDismiss={() => setGenresDialogVisible(false)}
        >
          <Dialog.Title>Genres</Dialog.Title>
          <Dialog.Content style={styles.dialogContentSpacing}>
            <TextInput
              mode="outlined"
              label="Add genre"
              value={genreInput}
              onChangeText={setGenreInput}
              onSubmitEditing={handleAddGenre}
              returnKeyType="done"
            />
            <View style={styles.dialogChipRow}>
              {genresSelection.map((genre) => (
                <Chip
                  key={genre}
                  mode="outlined"
                  selected
                  onClose={() => toggleGenre(genre)}
                  closeIcon="close"
                >
                  {genre}
                </Chip>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setGenresDialogVisible(false)}>
              Cancel
            </Button>
            <Button onPress={handleGenresDialogApply}>Apply</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={filtersDialogVisible}
          onDismiss={() => setFiltersDialogVisible(false)}
        >
          <Dialog.Title>Filters</Dialog.Title>
          <Dialog.Content style={styles.dialogContentSpacing}>
            <View style={styles.filtersRow}>
              <Text>Completed series only</Text>
              <Switch
                value={filtersCompletedOnly}
                onValueChange={setFiltersCompletedOnly}
              />
            </View>
            <TextInput
              mode="outlined"
              label="Minimum rating"
              value={filtersMinRating}
              onChangeText={setFiltersMinRating}
              keyboardType="numeric"
              style={styles.filtersField}
              left={<TextInput.Icon icon="star" />}
            />
            <TextInput
              mode="outlined"
              label="Minimum episodes"
              value={filtersMinEpisodes}
              onChangeText={setFiltersMinEpisodes}
              keyboardType="numeric"
              style={styles.filtersField}
              left={<TextInput.Icon icon="counter" />}
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setFiltersDialogVisible(false)}>
              Cancel
            </Button>
            <Button onPress={handleFiltersDialogApply}>Apply</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default IntelligentSearchScreen;
