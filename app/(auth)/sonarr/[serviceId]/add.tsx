import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { alert } from "@/services/dialogService";
import {
  HelperText,
  List,
  RadioButton,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { UniArrLoader } from "@/components/common";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Controller,
  useForm,
  type ControllerRenderProps,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { MediaCard } from "@/components/media/MediaCard";
import type { AppTheme } from "@/constants/theme";
import type {
  AddSeriesRequest,
  QualityProfile,
  RootFolder,
  Series,
} from "@/models/media.types";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import { queryKeys } from "@/hooks/queryKeys";
import { spacing } from "@/theme/spacing";
import { secureStorage } from "@/services/storage/SecureStorage";

const searchDebounceMs = 400;

const addSeriesSchema = z.object({
  qualityProfileId: z.number().int().min(1, "Select a quality profile"),
  rootFolderPath: z.string().min(1, "Select a root folder"),
  monitored: z.boolean(),
  searchForMissingEpisodes: z.boolean(),
  seasonFolder: z.boolean(),
});

type AddSeriesFormValues = z.infer<typeof addSeriesSchema>;

const buildTitleSlug = (series: Series): string | undefined => {
  if (series.titleSlug) {
    return series.titleSlug;
  }
  if (series.cleanTitle) {
    return series.cleanTitle;
  }
  return series.title.replace(/\s+/g, "-").toLowerCase();
};

const SonarrAddSeriesScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const queryClient = useQueryClient();
  const {
    serviceId,
    query: initialQueryParam,
    tmdbId: tmdbIdParam,
    tvdbId: tvdbIdParam,
  } = useLocalSearchParams<{
    serviceId?: string;
    query?: string;
    tmdbId?: string;
    tvdbId?: string;
  }>();
  const serviceKey = serviceId ?? "";
  const initialQuery =
    typeof initialQueryParam === "string" ? initialQueryParam.trim() : "";

  const parseNumberParam = (value?: string): number | undefined => {
    if (!value) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const prefillTmdbId = parseNumberParam(tmdbIdParam);
  const prefillTvdbId = parseNumberParam(tvdbIdParam);

  const manager = useMemo(() => ConnectorManager.getInstance(), []);
  const connector = useMemo(() => {
    const instance = manager.getConnector(serviceKey);
    if (!instance || instance.config.type !== "sonarr") {
      return undefined;
    }
    return instance as SonarrConnector;
  }, [manager, serviceKey]);

  const ensureConnector = useCallback(() => {
    if (!connector) {
      throw new Error(
        `Sonarr connector not registered for service ${serviceKey}.`,
      );
    }
    return connector;
  }, [connector, serviceKey]);

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [debouncedTerm, setDebouncedTerm] = useState(initialQuery);
  const [selectedSeries, setSelectedSeries] = useState<Series | undefined>(
    undefined,
  );
  const prefillAppliedRef = useRef(false);

  useEffect(() => {
    if (!initialQuery) {
      return;
    }

    setSearchTerm((current) =>
      current.trim().length === 0 ? initialQuery : current,
    );
    setDebouncedTerm((current) =>
      current.trim().length === 0 ? initialQuery : current,
    );
  }, [initialQuery]);

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
      rootFolderPath: "",
      monitored: true,
      searchForMissingEpisodes: true,
      seasonFolder: true,
    },
    mode: "onChange",
  });

  const watchedQualityProfileId = watch("qualityProfileId");
  const watchedRootFolderPath = watch("rootFolderPath");

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

  const serviceConfigQuery = useQuery({
    queryKey: queryKeys.services.config(serviceKey),
    queryFn: async () => {
      const configs = await secureStorage.getServiceConfigs();
      return configs.find((c) => c.id === serviceKey);
    },
    enabled: Boolean(serviceKey),
    staleTime: 5 * 60 * 1000,
  });

  const qualityProfiles = useMemo(
    () => qualityProfilesQuery.data ?? [],
    [qualityProfilesQuery.data],
  );
  const rootFolders = useMemo(
    () => rootFoldersQuery.data ?? [],
    [rootFoldersQuery.data],
  );
  const searchResults = useMemo(
    () => searchQuery.data ?? [],
    [searchQuery.data],
  );
  const serviceConfig = useMemo(
    () => serviceConfigQuery.data,
    [serviceConfigQuery.data],
  );

  useEffect(() => {
    prefillAppliedRef.current = false;
  }, [prefillTmdbId, prefillTvdbId]);

  useEffect(() => {
    if (prefillAppliedRef.current) {
      return;
    }

    if (searchResults.length === 0) {
      return;
    }

    if (prefillTmdbId === undefined && prefillTvdbId === undefined) {
      return;
    }

    const match = searchResults.find((series) => {
      if (prefillTmdbId !== undefined && series.tmdbId === prefillTmdbId) {
        return true;
      }
      if (prefillTvdbId !== undefined && series.tvdbId === prefillTvdbId) {
        return true;
      }
      return false;
    });

    if (match) {
      setSelectedSeries(match);
      prefillAppliedRef.current = true;
    }
  }, [prefillTmdbId, prefillTvdbId, searchResults]);

  useEffect(() => {
    if (!selectedSeries) {
      return;
    }
    setValue("monitored", selectedSeries.monitored ?? true);
    setValue("seasonFolder", selectedSeries.seasonFolder ?? true);
  }, [selectedSeries, setValue]);

  useEffect(() => {
    if (!qualityProfiles.length) {
      return;
    }
    if (
      selectedSeries?.qualityProfileId &&
      selectedSeries.qualityProfileId !== watchedQualityProfileId
    ) {
      setValue("qualityProfileId", selectedSeries.qualityProfileId, {
        shouldValidate: true,
      });
      return;
    }
    if (!watchedQualityProfileId) {
      // Use service default if available, otherwise first available
      const defaultProfileId = serviceConfig?.defaultProfileId;
      const profileToUse = defaultProfileId
        ? qualityProfiles.find((p) => p.id === defaultProfileId)?.id
        : qualityProfiles[0]!.id;
      if (profileToUse !== undefined) {
        setValue("qualityProfileId", profileToUse, {
          shouldValidate: true,
        });
      }
    }
  }, [
    qualityProfiles,
    selectedSeries,
    setValue,
    watchedQualityProfileId,
    serviceConfig,
  ]);

  useEffect(() => {
    if (!rootFolders.length) {
      return;
    }
    if (!watchedRootFolderPath) {
      // Use service default if available, otherwise first available
      const defaultRootPath = serviceConfig?.defaultRootFolderPath;
      const folderToUse = defaultRootPath
        ? rootFolders.find((f) => f.path === defaultRootPath)?.path
        : rootFolders[0]!.path;
      if (folderToUse !== undefined) {
        setValue("rootFolderPath", folderToUse, {
          shouldValidate: true,
        });
      }
    }
  }, [rootFolders, setValue, watchedRootFolderPath, serviceConfig]);

  const addSeriesMutation = useMutation<Series, Error, AddSeriesRequest>({
    mutationKey: queryKeys.sonarr.seriesList(serviceKey),
    mutationFn: async (request: AddSeriesRequest) => {
      const sonarr = ensureConnector();
      return sonarr.add(request);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.seriesList(serviceKey),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.sonarr.queue(serviceKey),
        }),
      ]);
    },
  });

  const canSubmit =
    Boolean(selectedSeries) &&
    Boolean(watchedQualityProfileId) &&
    Boolean(watchedRootFolderPath);

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
          paddingTop: spacing.xs,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.md,
        },
        scrollContent: {
          paddingBottom: spacing.xl,
          gap: spacing.lg,
        },
        title: {
          marginBottom: spacing.sm,
          textAlign: "center",
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
    [
      theme.colors.background,
      theme.colors.error,
      theme.colors.onSurface,
      theme.colors.primary,
    ],
  );

  const handleSelectSeries = useCallback((series: Series) => {
    setSelectedSeries(series);
  }, []);

  const onSubmit = useCallback(
    async (values: AddSeriesFormValues) => {
      if (!selectedSeries) {
        alert(
          "Select a series",
          "Choose a series from the search results before adding.",
        );
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
          monitor: values.monitored ? "all" : "none",
        },
      };

      try {
        const createdSeries = await addSeriesMutation.mutateAsync(payload);
        router.replace({
          pathname: "/(auth)/sonarr/[serviceId]/series/[id]",
          params: {
            serviceId: serviceKey,
            id: String(createdSeries.id),
          },
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to add series at this time.";
        alert("Add series failed", message);
      }
    },
    [addSeriesMutation, router, selectedSeries, serviceKey],
  );

  if (!serviceId) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
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
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
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

  const searchHelperMessage =
    debouncedTerm.length < 2
      ? "Enter at least 2 characters to search Sonarr."
      : undefined;

  const addErrorMessage =
    addSeriesMutation.error instanceof Error
      ? addSeriesMutation.error.message
      : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Button
            mode="contained-tonal"
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            Back
          </Button>
          {searchQuery.isFetching ? (
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Searching…
            </Text>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <TextInput
              mode="outlined"
              placeholder="Search for a series"
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={styles.searchInput}
              autoCorrect={false}
              right={
                searchTerm ? (
                  <TextInput.Icon
                    icon="close"
                    onPress={() => setSearchTerm("")}
                  />
                ) : undefined
              }
            />
            {searchHelperMessage ? (
              <HelperText type="info" style={styles.helperText}>
                {searchHelperMessage}
              </HelperText>
            ) : null}
            {searchQuery.isError ? (
              <HelperText
                type="error"
                style={[styles.helperText, styles.errorHelper]}
              >
                Unable to search Sonarr right now. Please try again.
              </HelperText>
            ) : null}
          </View>

          <View style={styles.resultsContainer}>
            {searchQuery.isLoading ? <UniArrLoader size={60} centered /> : null}
            {!searchQuery.isLoading &&
            !searchQuery.isFetching &&
            debouncedTerm.length >= 2 &&
            !searchResults.length ? (
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
                  style={[
                    styles.resultCard,
                    isSelected ? styles.selectedResult : null,
                  ]}
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
              <UniArrLoader size={60} centered />
            ) : qualityProfilesQuery.isError ? (
              <HelperText
                type="error"
                style={[styles.helperText, styles.errorHelper]}
              >
                Failed to load quality profiles. This may be due to corrupted
                custom formats in Sonarr. Please check your Sonarr quality
                profiles and custom formats, then try again.
              </HelperText>
            ) : qualityProfiles.length ? (
              <Controller<AddSeriesFormValues, "qualityProfileId">
                control={control}
                name="qualityProfileId"
                render={({
                  field,
                }: {
                  field: ControllerRenderProps<
                    AddSeriesFormValues,
                    "qualityProfileId"
                  >;
                }) => (
                  <RadioButton.Group
                    onValueChange={(value: string) =>
                      field.onChange(Number(value))
                    }
                    value={field.value ? String(field.value) : ""}
                  >
                    <List.Section>
                      {qualityProfiles.map((profile: QualityProfile) => (
                        <RadioButton.Item
                          key={profile.id}
                          value={String(profile.id)}
                          label={profile.name}
                          style={styles.radioItem}
                          status={
                            field.value === profile.id ? "checked" : "unchecked"
                          }
                        />
                      ))}
                    </List.Section>
                  </RadioButton.Group>
                )}
              />
            ) : (
              <HelperText
                type="error"
                style={[styles.helperText, styles.errorHelper]}
              >
                No quality profiles found. Add at least one quality profile in
                Sonarr.
              </HelperText>
            )}
            {errors.qualityProfileId ? (
              <HelperText
                type="error"
                style={[styles.helperText, styles.errorHelper]}
              >
                {errors.qualityProfileId.message}
              </HelperText>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Root Folder
            </Text>
            {rootFoldersQuery.isLoading ? (
              <UniArrLoader size={60} centered />
            ) : rootFolders.length ? (
              <Controller<AddSeriesFormValues, "rootFolderPath">
                control={control}
                name="rootFolderPath"
                render={({
                  field,
                }: {
                  field: ControllerRenderProps<
                    AddSeriesFormValues,
                    "rootFolderPath"
                  >;
                }) => (
                  <RadioButton.Group
                    onValueChange={(value: string) => field.onChange(value)}
                    value={field.value}
                  >
                    <List.Section>
                      {rootFolders.map((folder: RootFolder) => (
                        <RadioButton.Item
                          key={folder.id}
                          value={folder.path}
                          label={folder.path}
                          style={styles.radioItem}
                          status={
                            field.value === folder.path
                              ? "checked"
                              : "unchecked"
                          }
                        />
                      ))}
                    </List.Section>
                  </RadioButton.Group>
                )}
              />
            ) : (
              <HelperText
                type="error"
                style={[styles.helperText, styles.errorHelper]}
              >
                No root folders found. Configure at least one root folder in
                Sonarr.
              </HelperText>
            )}
            {errors.rootFolderPath ? (
              <HelperText
                type="error"
                style={[styles.helperText, styles.errorHelper]}
              >
                {errors.rootFolderPath.message}
              </HelperText>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Options
            </Text>
            <Controller<AddSeriesFormValues, "monitored">
              control={control}
              name="monitored"
              render={({
                field,
              }: {
                field: ControllerRenderProps<AddSeriesFormValues, "monitored">;
              }) => (
                <List.Item
                  title="Monitor series"
                  description="Keep the series monitored for new or missing episodes."
                  right={() => (
                    <Switch
                      value={field.value}
                      onValueChange={field.onChange}
                      accessibilityLabel="Toggle monitored"
                    />
                  )}
                />
              )}
            />
            <Controller<AddSeriesFormValues, "seasonFolder">
              control={control}
              name="seasonFolder"
              render={({
                field,
              }: {
                field: ControllerRenderProps<
                  AddSeriesFormValues,
                  "seasonFolder"
                >;
              }) => (
                <List.Item
                  title="Create season folders"
                  description="Organise episodes into season-specific folders."
                  right={() => (
                    <Switch
                      value={field.value}
                      onValueChange={field.onChange}
                      accessibilityLabel="Toggle season folders"
                    />
                  )}
                />
              )}
            />
            <Controller<AddSeriesFormValues, "searchForMissingEpisodes">
              control={control}
              name="searchForMissingEpisodes"
              render={({
                field,
              }: {
                field: ControllerRenderProps<
                  AddSeriesFormValues,
                  "searchForMissingEpisodes"
                >;
              }) => (
                <List.Item
                  title="Search immediately"
                  description="Start searching for missing episodes right after adding."
                  right={() => (
                    <Switch
                      value={field.value}
                      onValueChange={field.onChange}
                      accessibilityLabel="Toggle search immediately"
                    />
                  )}
                />
              )}
            />
          </View>

          {addErrorMessage ? (
            <HelperText
              type="error"
              style={[styles.helperText, styles.errorHelper]}
            >
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
