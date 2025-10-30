import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SkiaLoader } from "@/components/common/SkiaLoader";

import BottomDrawer from "@/components/common/BottomDrawer";
import type { AppTheme } from "@/constants/theme";
import type { TmdbDiscoverFilters } from "@/hooks/tmdb/useTmdbDiscover";
import { spacing } from "@/theme/spacing";

interface TmdbGenre {
  id: number;
  name?: string;
}

interface Props {
  visible: boolean;
  filters: TmdbDiscoverFilters;
  genres: TmdbGenre[];
  genresLoading?: boolean;
  onFiltersChange: (next: Partial<TmdbDiscoverFilters>) => void;
  onReset: () => void;
  onClose: () => void;
}

const sortOptions = [
  { label: "Popularity", value: "popularity.desc" },
  { label: "Rating", value: "vote_average.desc" },
  { label: "Release Date", value: "primary_release_date.desc" },
];

export const TmdbFiltersDrawer: React.FC<Props> = ({
  visible,
  filters,
  genres,
  genresLoading,
  onFiltersChange,
  onReset,
  onClose,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginBottom: spacing.lg,
          gap: spacing.sm,
        },
        segmentedWrapper: {
          borderRadius: 16,
          overflow: "hidden",
        },
        chipRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.xs,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        resetButton: {
          alignSelf: "flex-start",
        },
        adultRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          marginTop: spacing.sm,
        },
      }),
    [],
  );

  return (
    <BottomDrawer
      visible={visible}
      onDismiss={onClose}
      title="Filters"
      maxHeight="80%"
    >
      <Button
        mode="text"
        onPress={onReset}
        icon="backup-restore"
        style={styles.resetButton}
        contentStyle={{ flexDirection: "row-reverse" }}
        labelStyle={{ color: theme.colors.primary }}
      >
        Reset filters
      </Button>

      <View style={styles.section}>
        <Text variant="titleMedium">Media Type</Text>
        <SegmentedButtons
          value={filters.mediaType}
          onValueChange={(value) =>
            onFiltersChange({ mediaType: value as "movie" | "tv" })
          }
          buttons={[
            { value: "movie", label: "Movies", icon: "movie-open" },
            { value: "tv", label: "TV", icon: "television-classic" },
          ]}
          style={styles.segmentedWrapper}
        />
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium">Sort By</Text>
        <View style={styles.chipRow}>
          {sortOptions.map((option) => (
            <Chip
              key={option.value}
              mode={filters.sortBy === option.value ? "flat" : "outlined"}
              selected={filters.sortBy === option.value}
              onPress={() => onFiltersChange({ sortBy: option.value })}
            >
              {option.label}
            </Chip>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text variant="titleMedium">Genre</Text>
          {genresLoading ? <SkiaLoader size={20} centered /> : null}
        </View>
        <View style={styles.chipRow}>
          <Chip
            selected={!filters.genreId}
            onPress={() => onFiltersChange({ genreId: undefined })}
          >
            Any
          </Chip>
          {genres.map((genre) => (
            <Chip
              key={genre.id}
              selected={filters.genreId === genre.id}
              onPress={() =>
                onFiltersChange({
                  genreId: filters.genreId === genre.id ? undefined : genre.id,
                })
              }
            >
              {genre.name ?? `Genre ${genre.id}`}
            </Chip>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium">Year</Text>
        <TextInput
          mode="outlined"
          keyboardType="number-pad"
          maxLength={4}
          value={filters.year ? String(filters.year) : ""}
          onChangeText={(text) => {
            const numeric = text.replace(/[^0-9]/g, "");
            if (!numeric) {
              onFiltersChange({ year: undefined });
              return;
            }
            const parsed = Number.parseInt(numeric, 10);
            if (Number.isFinite(parsed)) {
              onFiltersChange({ year: parsed });
            }
          }}
          placeholder={
            filters.mediaType === "movie" ? "Release year" : "First air year"
          }
        />

        {filters.mediaType === "movie" ? (
          <View style={styles.adultRow}>
            <Text>Include adult</Text>
            <Switch
              value={Boolean(filters.includeAdult)}
              onValueChange={(value) =>
                onFiltersChange({ includeAdult: value })
              }
            />
          </View>
        ) : null}
      </View>
    </BottomDrawer>
  );
};

export default TmdbFiltersDrawer;
