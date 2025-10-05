import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { AddSeriesRequest, QualityProfile, RootFolder, Series } from '@/models/media.types';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import type { SonarrConnector } from '@/connectors/implementations/SonarrConnector';
import { queryKeys } from '@/hooks/queryKeys';
import { spacing } from '@/theme/spacing';

const searchDebounceMs = 400;

const addSeriesSchema = z.object({
  qualityProfileId: z.number().int().min(1, 'Select a quality profile'),
  rootFolderPath: z.string().min(1, 'Select a root folder'),
  monitored: z.boolean(),
  searchForMissingEpisodes: z.boolean(),
  seasonFolder: z.boolean(),
});

type AddSeriesFormValues = z.infer<typeof addSeriesSchema>;

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

const buildTitleSlug = (series: Series): string | undefined => {
  if (series.titleSlug) {
    return series.titleSlug;
  }
  if (series.cleanTitle) {
    return series.cleanTitle;
  }
  return series.title.replace(/\s+/g, '-').toLowerCase();
};

const SonarrAddSeriesScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const queryClient = useQueryClient();
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();
  const serviceKey = serviceId ?? '';

  const manager = useMemo(() => ConnectorManager.getInstance(), []);
  const connector = useMemo(() => {
    const instance = manager.getConnector(serviceKey);
    if (!instance || instance.config.type !== 'sonarr') {
      return undefined;
    }
    return instance as SonarrConnector;
  }, [manager, serviceKey]);

  const ensureConnector = useCallback(() => {
    if (!connector) {
      throw new Error(`Sonarr connector not registered for service ${serviceKey}.`);
    }
    return connector;
  }, [connector, serviceKey]);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<Series | undefined>(undefined);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddSeriesFormValues>({
    resolver: zodResolver(addSeriesSchema),
    defaultValues: {
      qualityProfileId: undefined,
      rootFolderPath: '',
      monitored: true,
      searchForMissingEpisodes: true,
      seasonFolder: true,
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
      setSelectedSeries(undefined);
    }
  }, [debouncedTerm]);

  const qualityProfilesQuery = useQuery<QualityProfile[]>({
    queryKey: queryKeys.sonarr.qualityProfiles(serviceKey),
    queryFn: async () => ensureConnector().getQualityProfiles(),
    enabled: Boolean(connector),
    staleTime: 30 * 60 * 1000,
  });

  const rootFoldersQuery = useQuery<RootFolder[]>({
    queryKey: queryKeys.sonarr.rootFolders(serviceKey),
    queryFn: async () => ensureConnector().getRootFolders(),
    enabled: Boolean(connector),
    staleTime: 10 * 60 * 1000,
  });

  const searchQuery = useQuery<Series[]>({
    queryKey: queryKeys.sonarr.search(serviceKey, debouncedTerm, undefined),
    queryFn: async () => ensureConnector().search(debouncedTerm),
    enabled: Boolean(connector) && debouncedTerm.length >= 2,
    gcTime: 5 * 60 * 1000,
  });

  const qualityProfiles = qualityProfilesQuery.data ?? [];
  const rootFolders = rootFoldersQuery.data ?? [];
  const searchResults = searchQuery.data ?? [];

  useEffect(() => {
    if (!selectedSeries) {
      return;
    }
    setValue('monitored', selectedSeries.monitored ?? true);
    setValue('seasonFolder', selectedSeries.seasonFolder ?? true);
  }, [selectedSeries, setValue]);

  useEffect(() => {
    if (!qualityProfiles.length) {
      return;
    }
    if (selectedSeries?.qualityProfileId && selectedSeries.qualityProfileId !== watchedQualityProfileId) {
      setValue('qualityProfileId', selectedSeries.qualityProfileId, { shouldValidate: true });
      return;
    }
    if (!watchedQualityProfileId) {
      setValue('qualityProfileId', qualityProfiles[0]!.id, { shouldValidate: true });
    }
  }, [qualityProfiles, selectedSeries, setValue, watchedQualityProfileId]);

  useEffect(() => {
    if (!rootFolders.length) {
      return;
    }
    if (!watchedRootFolderPath) {
      setValue('rootFolderPath', rootFolders[0]!.path, { shouldValidate: true });
    }
  }, [rootFolders, setValue, watchedRootFolderPath]);

  const addSeriesMutation = useMutation<Series, Error, AddSeriesRequest>({
    mutationKey: queryKeys.sonarr.seriesList(serviceKey),
    mutationFn: async (request: AddSeriesRequest) => {
      const sonarr = ensureConnector();
      return sonarr.add(request);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sonarr.seriesList(serviceKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sonarr.queue(serviceKey) }),
      ]);
    },
  });

  const canSubmit = Boolean(selectedSeries) && Boolean(watchedQualityProfileId) && Boolean(watchedRootFolderPath);

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
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.md,
        },
        scrollContent: {
          paddingBottom: spacing.xl,
          gap: spacing.lg,
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

  const handleSelectSeries = useCallback((series: Series) => {
    setSelectedSeries(series);
  }, []);

  const onSubmit = useCallback(
    async (values: AddSeriesFormValues) => {
      if (!selectedSeries) {
        Alert.alert('Select a series', 'Choose a series from the search results before adding.');
        return;
      }

      const payload: AddSeriesRequest = {
        title: selectedSeries.title,
        titleSlug: buildTitleSlug(selectedSeries),
        tvdbId: selectedSeries.tvdbId,
        tmdbId: selectedSeries.tmdbId,
        qualityProfileId: values.qualityProfileId,
        rootFolderPath: values.rootFolderPath,
        monitored: values.monitored,
        seasonFolder: values.seasonFolder,
        tags: selectedSeries.tags,
        searchNow: values.searchForMissingEpisodes,
        addOptions: {
          searchForMissingEpisodes: values.searchForMissingEpisodes,
          monitor: values.monitored ? 'all' : 'none',
        },
      };

      try {
        const createdSeries = await addSeriesMutation.mutateAsync(payload);
        router.replace({
          pathname: '/(auth)/sonarr/[serviceId]/series/[id]',
          params: {
            serviceId: serviceKey,
            id: String(createdSeries.id),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to add series at this time.';
        Alert.alert('Add series failed', message);
      }
    },
    [addSeriesMutation, router, selectedSeries, serviceKey],
  );

  if (!serviceId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          <EmptyState
            title="Missing service information"
            description="We could not determine which Sonarr service to use. Return to the Sonarr library and try again."
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
            title="Sonarr service unavailable"
            description="We couldn't find a configured Sonarr connector for this service. Add the service again from settings."
            actionLabel="Go back"
            onActionPress={() => router.back()}
            icon="alert-circle-outline"
          />
        </View>
      </SafeAreaView>
    );
  }

  const searchHelperMessage = debouncedTerm.length < 2
    ? 'Enter at least 2 characters to search Sonarr.'
    : undefined;

  const addErrorMessage = addSeriesMutation.error instanceof Error
    ? addSeriesMutation.error.message
    : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Button mode="text" onPress={() => router.back()} accessibilityLabel="Go back">
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
              Search Sonarr
            </Text>
            <TextInput
              mode="outlined"
              placeholder="Search for a series"
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
                Unable to search Sonarr right now. Please try again.
              </HelperText>
            ) : null}
          </View>

          <View style={styles.resultsContainer}>
            {searchQuery.isLoading ? (
              <ActivityIndicator animating color={theme.colors.primary} />
            ) : null}
            {!searchQuery.isLoading && !searchQuery.isFetching && debouncedTerm.length >= 2 && !searchResults.length ? (
              <HelperText type="info" style={styles.helperText}>
                No series found for your search.
              </HelperText>
            ) : null}
            {searchResults.map((series: Series) => {
              const isSelected = selectedSeries?.id === series.id;
              return (
                <MediaCard
                  key={series.id}
                  id={series.id}
                  title={series.title}
                  year={series.year}
                  status={series.status}
                  posterUri={series.posterUrl}
                  monitored={series.monitored}
                  type="series"
                  onPress={() => handleSelectSeries(series)}
                  style={[styles.resultCard, isSelected ? styles.selectedResult : null]}
                />
              );
            })}
          </View>

          {selectedSeries ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Selected Series
              </Text>
              <MediaCard
                id={selectedSeries.id}
                title={selectedSeries.title}
                year={selectedSeries.year}
                status={selectedSeries.status}
                posterUri={selectedSeries.posterUrl}
                monitored={selectedSeries.monitored}
                type="series"
              />
            </View>
          ) : null}

          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Quality Profile
            </Text>
            {qualityProfilesQuery.isLoading ? (
              <ActivityIndicator animating color={theme.colors.primary} />
            ) : qualityProfiles.length ? (
              <Controller<AddSeriesFormValues, 'qualityProfileId'>
                control={control}
                name="qualityProfileId"
                render={({ field }: { field: ControllerRenderProps<AddSeriesFormValues, 'qualityProfileId'> }) => (
                  <RadioButton.Group
                    onValueChange={(value: string) => field.onChange(Number(value))}
                    value={field.value ? String(field.value) : ''}
                  >
                    <List.Section>
                      {qualityProfiles.map((profile: QualityProfile) => (
                        <RadioButton.Item
                          key={profile.id}
                          value={String(profile.id)}
                          label={profile.name}
                          style={styles.radioItem}
                          status={field.value === profile.id ? 'checked' : 'unchecked'}
                        />
                      ))}
                    </List.Section>
                  </RadioButton.Group>
                )}
              />
            ) : (
              <HelperText type="error" style={[styles.helperText, styles.errorHelper]}>
                No quality profiles found. Add at least one quality profile in Sonarr.
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
              <Controller<AddSeriesFormValues, 'rootFolderPath'>
                control={control}
                name="rootFolderPath"
                render={({ field }: { field: ControllerRenderProps<AddSeriesFormValues, 'rootFolderPath'> }) => (
                  <RadioButton.Group onValueChange={(value: string) => field.onChange(value)} value={field.value}>
                    <List.Section>
                      {rootFolders.map((folder: RootFolder) => (
                        <RadioButton.Item
                          key={folder.id}
                          value={folder.path}
                          label={folder.path}
                          style={styles.radioItem}
                          status={field.value === folder.path ? 'checked' : 'unchecked'}
                        />
                      ))}
                    </List.Section>
                  </RadioButton.Group>
                )}
              />
            ) : (
              <HelperText type="error" style={[styles.helperText, styles.errorHelper]}>
                No root folders found. Configure at least one root folder in Sonarr.
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
            <Controller<AddSeriesFormValues, 'monitored'>
              control={control}
              name="monitored"
              render={({ field }: { field: ControllerRenderProps<AddSeriesFormValues, 'monitored'> }) => (
                <List.Item
                  title="Monitor series"
                  description="Keep the series monitored for new or missing episodes."
                  right={() => (
                    <Switch value={field.value} onValueChange={field.onChange} accessibilityLabel="Toggle monitored" />
                  )}
                />
              )}
            />
            <Controller<AddSeriesFormValues, 'seasonFolder'>
              control={control}
              name="seasonFolder"
              render={({ field }: { field: ControllerRenderProps<AddSeriesFormValues, 'seasonFolder'> }) => (
                <List.Item
                  title="Create season folders"
                  description="Organise episodes into season-specific folders."
                  right={() => (
                    <Switch value={field.value} onValueChange={field.onChange} accessibilityLabel="Toggle season folders" />
                  )}
                />
              )}
            />
            <Controller<AddSeriesFormValues, 'searchForMissingEpisodes'>
              control={control}
              name="searchForMissingEpisodes"
              render={({ field }: { field: ControllerRenderProps<AddSeriesFormValues, 'searchForMissingEpisodes'> }) => (
                <List.Item
                  title="Search immediately"
                  description="Start searching for missing episodes right after adding."
                  right={() => (
                    <Switch value={field.value} onValueChange={field.onChange} accessibilityLabel="Toggle search immediately" />
                  )}
                />
              )}
            />
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
            disabled={!canSubmit || addSeriesMutation.isPending}
            loading={addSeriesMutation.isPending}
          >
            Add Series
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SonarrAddSeriesScreen;
