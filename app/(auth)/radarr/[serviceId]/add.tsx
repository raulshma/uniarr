import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  HelperText,
  List,
  RadioButton,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Controller, useForm, type ControllerRenderProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { MediaCard } from '@/components/media/MediaCard';
import type { AppTheme } from '@/constants/theme';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import type { RadarrConnector } from '@/connectors/implementations/RadarrConnector';
import { queryKeys } from '@/hooks/queryKeys';
import type { AddMovieRequest, Movie } from '@/models/movie.types';
import type { QualityProfile, RootFolder } from '@/models/media.types';
import { spacing } from '@/theme/spacing';

const searchDebounceMs = 400;

const addMovieSchema = z.object({
  qualityProfileId: z.number().int().min(1, 'Select a quality profile'),
  rootFolderPath: z.string().min(1, 'Select a root folder'),
  monitored: z.boolean(),
  searchOnAdd: z.boolean(),
  minimumAvailability: z.string().min(1, 'Select minimum availability'),
});

type AddMovieFormValues = z.infer<typeof addMovieSchema>;

const formatByteSize = (bytes?: number): string | undefined => {
  if (bytes === undefined || bytes === null) {
    return undefined;
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const rootFolderDescription = (folder: RootFolder): string | undefined => {
  const parts: string[] = [];
  if (folder.accessible !== undefined) {
    parts.push(folder.accessible ? 'Accessible' : 'Unavailable');
  }
  const sizeLabel = formatByteSize(folder.freeSpace);
  if (sizeLabel) {
    parts.push(`${sizeLabel} free`);
  }
  return parts.length ? parts.join(' • ') : undefined;
};

const availabilityOptions = [
  { label: 'Announced', value: 'announced' },
  { label: 'In Cinemas', value: 'inCinemas' },
  { label: 'Released', value: 'released' },
  { label: 'PreDB', value: 'preDB' },
  { label: 'TBA', value: 'tba' },
];

const RadarrAddMovieScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const queryClient = useQueryClient();
  const { serviceId, query: initialQueryParam, tmdbId: tmdbIdParam } =
    useLocalSearchParams<{ serviceId?: string; query?: string; tmdbId?: string }>();
  const serviceKey = serviceId ?? '';
  const initialQuery = typeof initialQueryParam === 'string' ? initialQueryParam.trim() : '';

  const parseNumberParam = (value?: string): number | undefined => {
    if (!value) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const prefillTmdbId = parseNumberParam(tmdbIdParam);

  const manager = useMemo(() => ConnectorManager.getInstance(), []);
  const connector = useMemo(() => {
    const instance = manager.getConnector(serviceKey);
    if (!instance || instance.config.type !== 'radarr') {
      return undefined;
    }
    return instance as RadarrConnector;
  }, [manager, serviceKey]);

  const ensureConnector = useCallback(() => {
    if (!connector) {
      throw new Error(`Radarr connector not registered for service ${serviceKey}.`);
    }
    return connector;
  }, [connector, serviceKey]);

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [debouncedTerm, setDebouncedTerm] = useState(initialQuery);
  const [selectedMovie, setSelectedMovie] = useState<Movie | undefined>(undefined);
  const prefillAppliedRef = useRef(false);

  useEffect(() => {
    if (!initialQuery) {
      return;
    }

    setSearchTerm((current) => (current.trim().length === 0 ? initialQuery : current));
    setDebouncedTerm((current) => (current.trim().length === 0 ? initialQuery : current));
  }, [initialQuery]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddMovieFormValues>({
    resolver: zodResolver(addMovieSchema),
    defaultValues: {
      qualityProfileId: undefined,
      rootFolderPath: '',
      monitored: true,
      searchOnAdd: true,
      minimumAvailability: 'released',
    },
    mode: 'onChange',
  });

  const watchedQualityProfileId = watch('qualityProfileId');
  const watchedRootFolderPath = watch('rootFolderPath');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedTerm(searchTerm.trim());
    }, searchDebounceMs);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    if (!debouncedTerm.length) {
      setSelectedMovie(undefined);
    }
  }, [debouncedTerm]);

  const qualityProfilesQuery = useQuery<QualityProfile[]>({
    queryKey: queryKeys.radarr.qualityProfiles(serviceKey),
    queryFn: async () => ensureConnector().getQualityProfiles(),
    enabled: Boolean(connector),
    staleTime: 30 * 60 * 1000,
  });

  const rootFoldersQuery = useQuery<RootFolder[]>({
    queryKey: queryKeys.radarr.rootFolders(serviceKey),
    queryFn: async () => ensureConnector().getRootFolders(),
    enabled: Boolean(connector),
    staleTime: 10 * 60 * 1000,
  });

  const searchQuery = useQuery<Movie[]>({
    queryKey: queryKeys.radarr.search(serviceKey, debouncedTerm, undefined),
    queryFn: async () => ensureConnector().search(debouncedTerm),
    enabled: Boolean(connector) && debouncedTerm.length >= 2,
    gcTime: 5 * 60 * 1000,
  });

  const qualityProfiles = qualityProfilesQuery.data ?? [];
  const rootFolders = rootFoldersQuery.data ?? [];
  const searchResults = searchQuery.data ?? [];

  useEffect(() => {
    prefillAppliedRef.current = false;
  }, [prefillTmdbId]);

  useEffect(() => {
    if (prefillAppliedRef.current) {
      return;
    }

    if (searchResults.length === 0) {
      return;
    }

    if (prefillTmdbId === undefined) {
      return;
    }

    const match = searchResults.find((movie) => movie.tmdbId === prefillTmdbId);
    if (match) {
      setSelectedMovie(match);
      prefillAppliedRef.current = true;
    }
  }, [prefillTmdbId, searchResults]);

  useEffect(() => {
    if (!selectedMovie) {
      return;
    }
    setValue('monitored', selectedMovie.monitored ?? true);
    const availability = selectedMovie.minimumAvailability ?? 'released';
    setValue('minimumAvailability', availability, { shouldValidate: true });
  }, [selectedMovie, setValue]);

  useEffect(() => {
    if (!qualityProfiles.length) {
      return;
    }
    if (selectedMovie?.qualityProfileId && selectedMovie.qualityProfileId !== watchedQualityProfileId) {
      setValue('qualityProfileId', selectedMovie.qualityProfileId, { shouldValidate: true });
      return;
    }
    if (!watchedQualityProfileId) {
      setValue('qualityProfileId', qualityProfiles[0]!.id, { shouldValidate: true });
    }
  }, [qualityProfiles, selectedMovie, setValue, watchedQualityProfileId]);

  useEffect(() => {
    if (!rootFolders.length) {
      return;
    }
    if (!watchedRootFolderPath) {
      setValue('rootFolderPath', rootFolders[0]!.path, { shouldValidate: true });
    }
  }, [rootFolders, setValue, watchedRootFolderPath]);

  const addMovieMutation = useMutation<Movie, Error, AddMovieRequest>({
    mutationKey: queryKeys.radarr.moviesList(serviceKey),
    mutationFn: async (request: AddMovieRequest) => {
      const radarr = ensureConnector();
      return radarr.add(request);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.radarr.moviesList(serviceKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.radarr.queue(serviceKey) }),
      ]);
    },
  });

  const canSubmit = Boolean(selectedMovie?.tmdbId) && Boolean(watchedQualityProfileId) && Boolean(watchedRootFolderPath);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        container: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.lg,
          paddingTop: spacing.xs
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        },
        scrollContent: {
          paddingBottom: spacing.xl,
          gap: spacing.lg,
        },
        title: {
          marginBottom: spacing.sm,
          textAlign: 'center',
        },
        searchInput: {
          marginTop: spacing.sm,
        },
        resultsContainer: {
          gap: spacing.md,
        },
        resultCard: {
          borderRadius: 16,
        },
        selectedResult: {
          borderWidth: 2,
          borderColor: theme.colors.primary,
        },
        helperText: {
          marginTop: spacing.xs,
        },
        section: {
          gap: spacing.sm,
        },
        sectionTitle: {
          color: theme.colors.onSurface,
        },
        radioItem: {
          paddingVertical: spacing.xs,
        },
        footer: {
          marginTop: spacing.lg,
        },
        errorHelper: {
          color: theme.colors.error,
        },
      }),
    [theme.colors.background, theme.colors.error, theme.colors.onSurface, theme.colors.primary],
  );

  const handleSelectMovie = useCallback((movie: Movie) => {
    setSelectedMovie(movie);
  }, []);

  const onSubmit = useCallback(
    async (values: AddMovieFormValues) => {
      if (!selectedMovie) {
        Alert.alert('Select a movie', 'Choose a movie from the search results before adding.');
        return;
      }

      if (!selectedMovie.tmdbId) {
        Alert.alert('Missing TMDb ID', 'The selected movie is missing a TMDb identifier and cannot be added automatically.');
        return;
      }

      const payload: AddMovieRequest = {
        title: selectedMovie.title,
        tmdbId: selectedMovie.tmdbId,
        year: selectedMovie.year,
        titleSlug: selectedMovie.titleSlug,
        qualityProfileId: values.qualityProfileId,
        rootFolderPath: values.rootFolderPath,
        monitored: values.monitored,
        minimumAvailability: values.minimumAvailability,
        tags: selectedMovie.tags,
        searchOnAdd: values.searchOnAdd,
        searchForMovie: values.searchOnAdd,
        images: selectedMovie.images,
        path: selectedMovie.path,
      };

      try {
        const createdMovie = await addMovieMutation.mutateAsync(payload);
        router.replace({
          pathname: '/(auth)/radarr/[serviceId]/movies/[id]',
          params: {
            serviceId: serviceKey,
            id: String(createdMovie.id),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to add movie at this time.';
        Alert.alert('Add movie failed', message);
      }
    },
    [addMovieMutation, router, selectedMovie, serviceKey],
  );

  if (!serviceId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          <EmptyState
            title="Missing service information"
            description="We could not determine which Radarr service to use. Return to the Radarr library and try again."
            actionLabel="Go back"
            onActionPress={() => router.back()}
            icon="alert-circle-outline"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!connector) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          <EmptyState
            title="Radarr service unavailable"
            description="We couldn't find a configured Radarr connector for this service. Add the service again from settings."
            actionLabel="Go back"
            onActionPress={() => router.back()}
            icon="alert-circle-outline"
          />
        </View>
      </SafeAreaView>
    );
  }

  const searchHelperMessage = debouncedTerm.length < 2
    ? 'Enter at least 2 characters to search Radarr.'
    : undefined;

  const addErrorMessage = addMovieMutation.error instanceof Error
    ? addMovieMutation.error.message
    : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Button mode="contained-tonal" onPress={() => router.back()} accessibilityLabel="Go back">
            Back
          </Button>
          {searchQuery.isFetching ? (
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Searching…
            </Text>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              Search Radarr
            </Text>
            <TextInput
              mode="outlined"
              placeholder="Search for a movie"
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={styles.searchInput}
              autoCorrect={false}
              right={searchTerm ? <TextInput.Icon icon="close" onPress={() => setSearchTerm('')} /> : undefined}
            />
            {searchHelperMessage ? (
              <HelperText type="info" style={styles.helperText}>
                {searchHelperMessage}
              </HelperText>
            ) : null}
            {searchQuery.isError ? (
              <HelperText type="error" style={[styles.helperText, styles.errorHelper]}>
                Unable to search Radarr right now. Please try again.
              </HelperText>
            ) : null}
          </View>

          <View style={styles.resultsContainer}>
            {searchQuery.isLoading ? (
              <ActivityIndicator animating color={theme.colors.primary} />
            ) : null}
            {!searchQuery.isLoading && !searchQuery.isFetching && debouncedTerm.length >= 2 && !searchResults.length ? (
              <HelperText type="info" style={styles.helperText}>
                No movies found for your search.
              </HelperText>
            ) : null}
            {searchResults.map((movie: Movie) => {
              const isSelected = selectedMovie?.id === movie.id;
              return (
                <MediaCard
                  key={movie.id}
                  id={movie.id}
                  title={movie.title}
                  year={movie.year}
                  status={movie.status}
                  posterUri={movie.posterUrl}
                  monitored={movie.monitored}
                  type="movie"
                  onPress={() => handleSelectMovie(movie)}
                  style={[styles.resultCard, isSelected ? styles.selectedResult : null]}
                />
              );
            })}
          </View>

          {selectedMovie ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Selected Movie
              </Text>
              <MediaCard
                id={selectedMovie.id}
                title={selectedMovie.title}
                year={selectedMovie.year}
                status={selectedMovie.status}
                posterUri={selectedMovie.posterUrl}
                monitored={selectedMovie.monitored}
                type="movie"
              />
            </View>
          ) : null}

          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Quality Profile
            </Text>
            {qualityProfilesQuery.isLoading ? (
              <ActivityIndicator animating color={theme.colors.primary} />
            ) : qualityProfilesQuery.isError ? (
              <HelperText type="error" style={[styles.helperText, styles.errorHelper]}>
                Failed to load quality profiles. This may be due to corrupted custom formats in Radarr. Please check your Radarr quality profiles and custom formats, then try again.
              </HelperText>
            ) : qualityProfiles.length ? (
              <Controller<AddMovieFormValues, 'qualityProfileId'>
                control={control}
                name="qualityProfileId"
                render={({ field }: { field: ControllerRenderProps<AddMovieFormValues, 'qualityProfileId'> }) => (
                  <List.Section>
                    {qualityProfiles.map((profile: QualityProfile) => (
                      <List.Item
                        key={profile.id}
                        title={profile.name}
                        left={() => <RadioButton value={String(profile.id)} status={field.value === profile.id ? 'checked' : 'unchecked'} />}
                        onPress={() => field.onChange(profile.id)}
                        style={styles.radioItem}
                      />
                    ))}
                  </List.Section>
                )}
              />
            ) : (
              <HelperText type="error" style={[styles.helperText, styles.errorHelper]}>
                No quality profiles found. Add at least one quality profile in Radarr.
              </HelperText>
            )}
            {errors.qualityProfileId ? (
              <HelperText type="error" style={[styles.helperText, styles.errorHelper]}>
                {errors.qualityProfileId.message}
              </HelperText>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Root Folder
            </Text>
            {rootFoldersQuery.isLoading ? (
              <ActivityIndicator animating color={theme.colors.primary} />
            ) : rootFolders.length ? (
              <Controller<AddMovieFormValues, 'rootFolderPath'>
                control={control}
                name="rootFolderPath"
                render={({ field }: { field: ControllerRenderProps<AddMovieFormValues, 'rootFolderPath'> }) => (
                  <List.Section>
                    {rootFolders.map((folder: RootFolder) => (
                      <List.Item
                        key={folder.id}
                        title={folder.path}
                        description={rootFolderDescription(folder)}
                        left={() => <RadioButton value={folder.path} status={field.value === folder.path ? 'checked' : 'unchecked'} />}
                        onPress={() => field.onChange(folder.path)}
                        style={styles.radioItem}
                      />
                    ))}
                  </List.Section>
                )}
              />
            ) : (
              <HelperText type="error" style={[styles.helperText, styles.errorHelper]}>
                No root folders found. Configure at least one root folder in Radarr.
              </HelperText>
            )}
            {errors.rootFolderPath ? (
              <HelperText type="error" style={[styles.helperText, styles.errorHelper]}>
                {errors.rootFolderPath.message}
              </HelperText>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Options
            </Text>
            <Controller<AddMovieFormValues, 'monitored'>
              control={control}
              name="monitored"
              render={({ field }: { field: ControllerRenderProps<AddMovieFormValues, 'monitored'> }) => (
                <List.Item
                  title="Monitor movie"
                  description="Monitor the movie for availability and future upgrades."
                  right={() => (
                    <Switch value={field.value} onValueChange={field.onChange} accessibilityLabel="Toggle monitored" />
                  )}
                />
              )}
            />
            <Controller<AddMovieFormValues, 'searchOnAdd'>
              control={control}
              name="searchOnAdd"
              render={({ field }: { field: ControllerRenderProps<AddMovieFormValues, 'searchOnAdd'> }) => (
                <List.Item
                  title="Search immediately"
                  description="Start searching for the movie right after adding."
                  right={() => (
                    <Switch value={field.value} onValueChange={field.onChange} accessibilityLabel="Toggle search immediately" />
                  )}
                />
              )}
            />
          </View>

          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Minimum Availability
            </Text>
            <Controller<AddMovieFormValues, 'minimumAvailability'>
              control={control}
              name="minimumAvailability"
              render={({ field }: { field: ControllerRenderProps<AddMovieFormValues, 'minimumAvailability'> }) => (
                <List.Section>
                  {availabilityOptions.map((option) => (
                    <List.Item
                      key={option.value}
                      title={option.label}
                      left={() => <RadioButton value={option.value} status={field.value === option.value ? 'checked' : 'unchecked'} />}
                      onPress={() => field.onChange(option.value)}
                      style={styles.radioItem}
                    />
                  ))}
                </List.Section>
              )}
            />
            {errors.minimumAvailability ? (
              <HelperText type="error" style={[styles.helperText, styles.errorHelper]}>
                {errors.minimumAvailability.message}
              </HelperText>
            ) : null}
          </View>

          {addErrorMessage ? (
            <HelperText type="error" style={[styles.helperText, styles.errorHelper]}>
              {addErrorMessage}
            </HelperText>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            disabled={!canSubmit || addMovieMutation.isPending}
            loading={addMovieMutation.isPending}
          >
            Add Movie
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default RadarrAddMovieScreen;
