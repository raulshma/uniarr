import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { alert } from "@/services/dialogService";
import {
  HelperText,
  List,
  RadioButton,
  Text,
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
import type { AppTheme } from "@/constants/theme";
import type { QualityProfile, RootFolder } from "@/models/media.types";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import { queryKeys } from "@/hooks/queryKeys";
import { spacing } from "@/theme/spacing";
import { secureStorage } from "@/services/storage/SecureStorage";

const radarrSettingsSchema = z.object({
  defaultProfileId: z.number().int().optional(),
  defaultRootFolderPath: z.string().optional(),
});

type RadarrSettingsFormValues = z.infer<typeof radarrSettingsSchema>;

const formatByteSize = (bytes?: number): string | undefined => {
  if (bytes === undefined || bytes === null) {
    return undefined;
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
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
    parts.push(folder.accessible ? "Accessible" : "Unavailable");
  }
  const sizeLabel = formatByteSize(folder.freeSpace);
  if (sizeLabel) {
    parts.push(`${sizeLabel} free`);
  }
  return parts.length ? parts.join(" • ") : undefined;
};

const RadarrSettingsScreen = () => {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const queryClient = useQueryClient();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();

  const manager = useMemo(() => ConnectorManager.getInstance(), []);
  const connector = useMemo(() => {
    if (!serviceId) return undefined;
    const instance = manager.getConnector(serviceId);
    if (!instance || instance.config.type !== "radarr") {
      return undefined;
    }
    return instance as RadarrConnector;
  }, [manager, serviceId]);

  const ensureConnector = useCallback(() => {
    if (!connector) {
      throw new Error(
        `Radarr connector not registered for service ${serviceId}.`,
      );
    }
    return connector;
  }, [connector, serviceId]);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RadarrSettingsFormValues>({
    resolver: zodResolver(radarrSettingsSchema),
    defaultValues: {
      defaultProfileId: undefined,
      defaultRootFolderPath: "",
    },
    mode: "onChange",
  });

  const qualityProfilesQuery = useQuery<QualityProfile[]>({
    queryKey: queryKeys.radarr.qualityProfiles(serviceId!),
    queryFn: async () => ensureConnector().getQualityProfiles(),
    enabled: Boolean(connector),
    staleTime: 30 * 60 * 1000,
  });

  const rootFoldersQuery = useQuery<RootFolder[]>({
    queryKey: queryKeys.radarr.rootFolders(serviceId!),
    queryFn: async () => ensureConnector().getRootFolders(),
    enabled: Boolean(connector),
    staleTime: 10 * 60 * 1000,
  });

  const qualityProfiles = useMemo(
    () => qualityProfilesQuery.data ?? [],
    [qualityProfilesQuery.data],
  );
  const rootFolders = useMemo(
    () => rootFoldersQuery.data ?? [],
    [rootFoldersQuery.data],
  );

  // Load current defaults
  useEffect(() => {
    const loadDefaults = async () => {
      if (!serviceId) return;
      try {
        const configs = await secureStorage.getServiceConfigs();
        const config = configs.find((c) => c.id === serviceId);
        if (config) {
          setValue("defaultProfileId", config.defaultProfileId);
          setValue("defaultRootFolderPath", config.defaultRootFolderPath);
        }
      } catch (error) {
        console.warn("Failed to load service defaults", error);
      }
    };
    void loadDefaults();
  }, [serviceId, setValue]);

  const saveSettingsMutation = useMutation<
    void,
    Error,
    RadarrSettingsFormValues
  >({
    mutationFn: async (values: RadarrSettingsFormValues) => {
      if (!serviceId) return;
      const config = await secureStorage.getServiceConfig(serviceId);
      if (config) {
        const updatedConfig = {
          ...config,
          defaultProfileId: values.defaultProfileId,
          defaultRootFolderPath: values.defaultRootFolderPath,
          updatedAt: new Date(),
        };
        await secureStorage.saveServiceConfig(updatedConfig);
        // Update the connector manager
        const manager = ConnectorManager.getInstance();
        await manager.addConnector(updatedConfig);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.services.overview,
      });
      alert("Success", "Radarr settings saved successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      alert(
        "Error",
        `Failed to save settings: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    },
  });

  const canSubmit = Boolean(serviceId);

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
    [theme.colors.background, theme.colors.error, theme.colors.onSurface],
  );

  const onSubmit = useCallback(
    async (values: RadarrSettingsFormValues) => {
      await saveSettingsMutation.mutateAsync(values);
    },
    [saveSettingsMutation],
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
            description="We could not determine which Radarr service to configure."
            actionLabel="Go back"
            onActionPress={() => router.back()}
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
            title="Radarr service unavailable"
            description="We couldn't find a configured Radarr connector for this service."
            actionLabel="Go back"
            onActionPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

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
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurface }}
            >
              Radarr Default Settings
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Configure default quality profile and root folder for new movies.
            </Text>
          </View>

          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Default Quality Profile
            </Text>
            {qualityProfilesQuery.isLoading ? (
              <UniArrLoader size={60} centered />
            ) : qualityProfilesQuery.isError ? (
              <HelperText
                type="error"
                style={[styles.helperText, styles.errorHelper]}
              >
                Failed to load quality profiles. This may be due to corrupted
                custom formats in Radarr. Please check your Radarr quality
                profiles and custom formats, then try again.
              </HelperText>
            ) : qualityProfiles.length ? (
              <Controller<RadarrSettingsFormValues, "defaultProfileId">
                control={control}
                name="defaultProfileId"
                render={({
                  field,
                }: {
                  field: ControllerRenderProps<
                    RadarrSettingsFormValues,
                    "defaultProfileId"
                  >;
                }) => (
                  <List.Section>
                    <List.Item
                      title="None (choose manually)"
                      left={() => (
                        <RadioButton
                          value=""
                          status={
                            field.value === undefined ? "checked" : "unchecked"
                          }
                        />
                      )}
                      onPress={() => field.onChange(undefined)}
                      style={styles.radioItem}
                    />
                    {qualityProfiles.map((profile: QualityProfile) => (
                      <List.Item
                        key={profile.id}
                        title={profile.name}
                        left={() => (
                          <RadioButton
                            value={String(profile.id)}
                            status={
                              field.value === profile.id
                                ? "checked"
                                : "unchecked"
                            }
                          />
                        )}
                        onPress={() => field.onChange(profile.id)}
                        style={styles.radioItem}
                      />
                    ))}
                  </List.Section>
                )}
              />
            ) : (
              <HelperText
                type="error"
                style={[styles.helperText, styles.errorHelper]}
              >
                No quality profiles found. Add at least one quality profile in
                Radarr.
              </HelperText>
            )}
            {errors.defaultProfileId ? (
              <HelperText
                type="error"
                style={[styles.helperText, styles.errorHelper]}
              >
                {errors.defaultProfileId.message}
              </HelperText>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Default Root Folder
            </Text>
            {rootFoldersQuery.isLoading ? (
              <UniArrLoader size={60} centered />
            ) : rootFolders.length ? (
              <Controller<RadarrSettingsFormValues, "defaultRootFolderPath">
                control={control}
                name="defaultRootFolderPath"
                render={({
                  field,
                }: {
                  field: ControllerRenderProps<
                    RadarrSettingsFormValues,
                    "defaultRootFolderPath"
                  >;
                }) => (
                  <List.Section>
                    <List.Item
                      title="None (choose manually)"
                      left={() => (
                        <RadioButton
                          value=""
                          status={!field.value ? "checked" : "unchecked"}
                        />
                      )}
                      onPress={() => field.onChange("")}
                      style={styles.radioItem}
                    />
                    {rootFolders.map((folder: RootFolder) => (
                      <List.Item
                        key={folder.id}
                        title={folder.path}
                        description={rootFolderDescription(folder)}
                        left={() => (
                          <RadioButton
                            value={folder.path}
                            status={
                              field.value === folder.path
                                ? "checked"
                                : "unchecked"
                            }
                          />
                        )}
                        onPress={() => field.onChange(folder.path)}
                        style={styles.radioItem}
                      />
                    ))}
                  </List.Section>
                )}
              />
            ) : (
              <HelperText
                type="error"
                style={[styles.helperText, styles.errorHelper]}
              >
                No root folders found. Configure at least one root folder in
                Radarr.
              </HelperText>
            )}
            {errors.defaultRootFolderPath ? (
              <HelperText
                type="error"
                style={[styles.helperText, styles.errorHelper]}
              >
                {errors.defaultRootFolderPath.message}
              </HelperText>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            disabled={!canSubmit || saveSettingsMutation.isPending}
            loading={saveSettingsMutation.isPending}
          >
            Save Settings
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default RadarrSettingsScreen;
