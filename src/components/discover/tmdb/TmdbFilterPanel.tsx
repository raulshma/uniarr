import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Chip,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';
import type { TmdbDiscoverFilters } from '@/hooks/tmdb/useTmdbDiscover';

interface TmdbGenre {
  id: number;
  name?: string;
}

interface Props {
  filters: TmdbDiscoverFilters;
  onFiltersChange: (next: Partial<TmdbDiscoverFilters>) => void;
  genres: TmdbGenre[];
  genresLoading?: boolean;
}

const sortOptions = [
  { label: 'Popularity', value: 'popularity.desc' },
  { label: 'Rating', value: 'vote_average.desc' },
  { label: 'Release Date', value: 'primary_release_date.desc' },
];

export const TmdbFilterPanel: React.FC<Props> = ({
  filters,
  onFiltersChange,
  genres,
  genresLoading,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginBottom: spacing.lg,
          gap: spacing.md,
        },
        segmentedWrapper: {
          borderRadius: 16,
          overflow: 'hidden',
        },
        labelRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        chipRow: {
          flexDirection: 'row',
          gap: spacing.xs,
        },
        yearRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
      }),
    [],
  );

  return (
    <View style={styles.container}>
      <View>
        <Text variant="titleMedium">Media Type</Text>
        <SegmentedButtons
          value={filters.mediaType}
          onValueChange={(value) =>
            onFiltersChange({ mediaType: value as 'movie' | 'tv' })
          }
          buttons={[
            {
              value: 'movie',
              label: 'Movies',
              icon: 'movie-open',
            },
            {
              value: 'tv',
              label: 'TV',
              icon: 'television-classic',
            },
          ]}
          style={styles.segmentedWrapper}
        />
      </View>

      <View>
        <View style={styles.labelRow}>
          <Text variant="titleMedium">Sort by</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {sortOptions.map((option) => (
              <Chip
                key={option.value}
                selected={filters.sortBy === option.value}
                onPress={() =>
                  onFiltersChange({ sortBy: option.value })
                }
              >
                {option.label}
              </Chip>
            ))}
          </View>
        </ScrollView>
      </View>

      <View>
        <View style={styles.labelRow}>
          <Text variant="titleMedium">Genre</Text>
          {genresLoading ? <ActivityIndicator size="small" /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                  onFiltersChange({ genreId: filters.genreId === genre.id ? undefined : genre.id })
                }
              >
                {genre.name ?? `Genre ${genre.id}`}
              </Chip>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.yearRow}>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium">Year</Text>
          <TextInput
            mode="outlined"
            keyboardType="number-pad"
            maxLength={4}
            value={filters.year ? String(filters.year) : ''}
            onChangeText={(text) => {
              const numeric = text.replace(/[^0-9]/g, '');
              if (!numeric) {
                onFiltersChange({ year: undefined });
                return;
              }
              const parsed = Number.parseInt(numeric, 10);
              if (Number.isFinite(parsed)) {
                onFiltersChange({ year: parsed });
              }
            }}
            placeholder={filters.mediaType === 'movie' ? 'Release year' : 'First air year'}
          />
        </View>
        {filters.mediaType === 'movie' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
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
    </View>
  );
};

export default TmdbFilterPanel;
