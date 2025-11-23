import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
  Text,
  useTheme,
  Button,
  Chip,
  RadioButton,
  Divider,
  Switch,
  IconButton,
} from "react-native-paper";
import { useQuery } from "@tanstack/react-query";

import { JikanClient } from "@/services/jikan/JikanClient";
import { spacing } from "@/theme/spacing";
import type { AppTheme } from "@/constants/theme";
import type { JikanSearchAnimeQuery } from "@/models/jikan.types";

interface SearchFilterSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onApply: (filters: Partial<JikanSearchAnimeQuery>) => void;
  currentFilters: Partial<JikanSearchAnimeQuery>;
}

const ANIME_TYPES = [
  { label: "TV", value: "tv" },
  { label: "Movie", value: "movie" },
  { label: "OVA", value: "ova" },
  { label: "Special", value: "special" },
  { label: "ONA", value: "ona" },
  { label: "Music", value: "music" },
];

const ANIME_STATUS = [
  { label: "Airing", value: "airing" },
  { label: "Complete", value: "complete" },
  { label: "Upcoming", value: "upcoming" },
];

const ANIME_RATING = [
  { label: "G - All Ages", value: "g" },
  { label: "PG - Children", value: "pg" },
  { label: "PG-13 - Teens 13+", value: "pg13" },
  { label: "R - 17+", value: "r17" },
  { label: "R+ - Mild Nudity", value: "r" },
  { label: "Rx - Hentai", value: "rx" },
];

const ORDER_BY = [
  { label: "Title", value: "title" },
  { label: "Start Date", value: "start_date" },
  { label: "End Date", value: "end_date" },
  { label: "Score", value: "score" },
  { label: "Rank", value: "rank" },
  { label: "Popularity", value: "popularity" },
];

const SORT_OPTIONS = [
  { label: "Ascending", value: "asc" },
  { label: "Descending", value: "desc" },
];

export const SearchFilterSheet: React.FC<SearchFilterSheetProps> = ({
  visible,
  onDismiss,
  onApply,
  currentFilters,
}) => {
  const theme = useTheme<AppTheme>();
  const [filters, setFilters] =
    useState<Partial<JikanSearchAnimeQuery>>(currentFilters);

  // Reset local state when visible changes or currentFilters change
  useEffect(() => {
    if (visible) {
      setFilters(currentFilters);
    }
  }, [visible, currentFilters]);

  const { data: genres } = useQuery({
    queryKey: ["jikan", "genres", "anime"],
    queryFn: () => JikanClient.getAnimeGenres(),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  const handleApply = () => {
    onApply(filters);
    onDismiss();
  };

  const handleReset = () => {
    const resetFilters: Partial<JikanSearchAnimeQuery> = {
      q: filters.q, // Keep the search query
      sfw: true, // Default SFW to true
    };
    setFilters(resetFilters);
  };

  const toggleGenre = (genreId: number) => {
    const currentGenres = filters.genres ? filters.genres.split(",") : [];
    const idStr = genreId.toString();

    let newGenres: string[];
    if (currentGenres.includes(idStr)) {
      newGenres = currentGenres.filter((id) => id !== idStr);
    } else {
      newGenres = [...currentGenres, idStr];
    }

    setFilters({ ...filters, genres: newGenres.join(",") || undefined });
  };

  if (!visible) return null;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <IconButton icon="close" onPress={onDismiss} />
        <Text variant="titleMedium">Filters</Text>
        <Button onPress={handleReset}>Reset</Button>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Sort & Order */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Sort By
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipContainer}
          >
            {ORDER_BY.map((item) => (
              <Chip
                key={item.value}
                selected={filters.order_by === item.value}
                onPress={() =>
                  setFilters({ ...filters, order_by: item.value as any })
                }
                style={styles.chip}
                showSelectedOverlay
              >
                {item.label}
              </Chip>
            ))}
          </ScrollView>

          <View style={styles.row}>
            {SORT_OPTIONS.map((item) => (
              <View key={item.value} style={styles.radioContainer}>
                <RadioButton
                  value={item.value}
                  status={filters.sort === item.value ? "checked" : "unchecked"}
                  onPress={() =>
                    setFilters({ ...filters, sort: item.value as any })
                  }
                />
                <Text
                  onPress={() =>
                    setFilters({ ...filters, sort: item.value as any })
                  }
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Divider style={styles.divider} />

        {/* Type */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Type
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipContainer}
          >
            {ANIME_TYPES.map((item) => (
              <Chip
                key={item.value}
                selected={filters.type === item.value}
                onPress={() =>
                  setFilters({
                    ...filters,
                    type:
                      filters.type === item.value
                        ? undefined
                        : (item.value as any),
                  })
                }
                style={styles.chip}
                showSelectedOverlay
              >
                {item.label}
              </Chip>
            ))}
          </ScrollView>
        </View>

        <Divider style={styles.divider} />

        {/* Status */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Status
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipContainer}
          >
            {ANIME_STATUS.map((item) => (
              <Chip
                key={item.value}
                selected={filters.status === item.value}
                onPress={() =>
                  setFilters({
                    ...filters,
                    status:
                      filters.status === item.value
                        ? undefined
                        : (item.value as any),
                  })
                }
                style={styles.chip}
                showSelectedOverlay
              >
                {item.label}
              </Chip>
            ))}
          </ScrollView>
        </View>

        <Divider style={styles.divider} />

        {/* Rating */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Rating
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipContainer}
          >
            {ANIME_RATING.map((item) => (
              <Chip
                key={item.value}
                selected={filters.rating === item.value}
                onPress={() =>
                  setFilters({
                    ...filters,
                    rating:
                      filters.rating === item.value
                        ? undefined
                        : (item.value as any),
                  })
                }
                style={styles.chip}
                showSelectedOverlay
              >
                {item.label}
              </Chip>
            ))}
          </ScrollView>
        </View>

        <Divider style={styles.divider} />

        {/* SFW */}
        <View
          style={[
            styles.section,
            styles.row,
            { justifyContent: "space-between" },
          ]}
        >
          <Text variant="titleSmall">Safe For Work (SFW)</Text>
          <Switch
            value={filters.sfw ?? true}
            onValueChange={(val) => setFilters({ ...filters, sfw: val })}
          />
        </View>

        <Divider style={styles.divider} />

        {/* Genres */}
        <View style={styles.section}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Genres
          </Text>
          <View style={styles.wrapContainer}>
            {genres?.map((genre) => {
              const isSelected = (filters.genres?.split(",") ?? []).includes(
                genre.mal_id.toString(),
              );
              return (
                <Chip
                  key={genre.mal_id}
                  selected={isSelected}
                  onPress={() => toggleGenre(genre.mal_id)}
                  style={styles.chip}
                  showSelectedOverlay
                  compact
                >
                  {genre.name}
                </Chip>
              );
            })}
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <Button
          mode="contained"
          onPress={handleApply}
          style={styles.applyButton}
        >
          Apply Filters
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.sm,
  },
  content: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  chipContainer: {
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  wrapContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  divider: {
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  radioContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: spacing.md,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    borderTopWidth: 1,
  },
  applyButton: {
    width: "100%",
  },
});
