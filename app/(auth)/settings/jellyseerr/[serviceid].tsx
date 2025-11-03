import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Text,
  List,
  RadioButton,
  HelperText,
  useTheme,
} from "react-native-paper";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { ServiceConfig } from "@/models/service.types";

import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { UniArrLoader } from "@/components/common";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import { secureStorage } from "@/services/storage/SecureStorage";
import { alert } from "@/services/dialogService";
import { queryKeys } from "@/hooks/queryKeys";

const jellySettingsSchema = z.object({
  // mapping string(serverId) -> defaults
  jellyseerrTargetDefaults: z
    .record(
      z.string(),
      z.object({
        profileId: z.number().int().optional(),
        rootFolderPath: z.string().optional(),
      }),
    )
    .optional(),
});

type JellySettingsFormValues = z.infer<typeof jellySettingsSchema>;

const JellyseerrSettingsScreen = () => {
  const { serviceid } = useLocalSearchParams<{ serviceid: string }>();
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const queryClient = useQueryClient();

  const manager = useMemo(() => ConnectorManager.getInstance(), []);
  const connector = useMemo(() => {
    if (!serviceid) return undefined;
    const c = manager.getConnector(serviceid);
    if (!c || (c as any).config?.type !== "jellyseerr") return undefined;
    return c as JellyseerrConnector;
  }, [manager, serviceid]);

  const { handleSubmit, setValue } = useForm<JellySettingsFormValues>({
    resolver: zodResolver(jellySettingsSchema),
    defaultValues: { jellyseerrTargetDefaults: {} },
    mode: "onChange",
  });

  const [loadingTargets, setLoadingTargets] = useState(true);
  const [targetsByMedia, setTargetsByMedia] = useState<Record<string, any[]>>(
    {},
  );
  const [profilesByTarget, setProfilesByTarget] = useState<
    Record<string, any[]>
  >({});
  const [rootFoldersByTarget, setRootFoldersByTarget] = useState<
    Record<string, any[]>
  >({});

  // local state for selected defaults
  const [localDefaults, setLocalDefaults] = useState<
    Record<string, { profileId?: number; rootFolderPath?: string }>
  >({});

  useEffect(() => {
    const load = async () => {
      if (!connector || !serviceid) return;
      setLoadingTargets(true);
      try {
        // Load existing config defaults
        const cfg = await secureStorage.getServiceConfig(serviceid);
        if (cfg && cfg.jellyseerrTargetDefaults) {
          setLocalDefaults(cfg.jellyseerrTargetDefaults);
          setValue("jellyseerrTargetDefaults", cfg.jellyseerrTargetDefaults);
        }
        const mediaTypes: ("tv" | "movie")[] = ["tv", "movie"];
        // For both media types (tv/movie) fetch configured servers
        const byMedia: Record<string, any[]> = {};
        const pByT: Record<string, any[]> = {};
        const rByT: Record<string, any[]> = {};

        await Promise.all(
          mediaTypes.map(async (m) => {
            try {
              const servers = (await connector.getServers(m)) || [];
              // Filter valid servers
              const valid = Array.isArray(servers)
                ? servers.filter(
                    (s) => s && s.id !== undefined && s.id !== null,
                  )
                : [];

              byMedia[m] = valid;

              // For each target server fetch profiles/rootFolders
              await Promise.all(
                valid.map(async (s: any) => {
                  const serverId = Number(s.id);
                  try {
                    const { profiles, rootFolders } =
                      await connector.getProfiles(serverId, m);
                    pByT[`${m}-${serverId}`] = profiles ?? [];
                    rByT[`${m}-${serverId}`] = rootFolders ?? [];
                  } catch (err) {
                    console.warn(
                      "Failed to load profiles/rootFolders for target",
                      m,
                      serverId,
                      err,
                    );
                    pByT[`${m}-${serverId}`] = [];
                    rByT[`${m}-${serverId}`] = [];
                  }
                }),
              );
            } catch (err) {
              console.warn(
                "Failed to load Jellyseerr servers for media",
                m,
                err,
              );
              byMedia[m] = [];
            }
          }),
        );

        setTargetsByMedia(byMedia);
        setProfilesByTarget(pByT);
        setRootFoldersByTarget(rByT);
      } catch (error) {
        console.warn("Failed to load jellyseerr targets", error);
        void alert("Error", "Failed to load Jellyseerr target settings.");
      } finally {
        setLoadingTargets(false);
      }
    };

    void load();
  }, [connector, serviceid, setValue]);

  const saveMutation = useMutation<void, Error, JellySettingsFormValues>({
    mutationFn: async (values) => {
      if (!serviceid) return;
      const config = await secureStorage.getServiceConfig(serviceid);
      if (!config) throw new Error("Service not found");
      const updated: ServiceConfig = {
        ...config,
        jellyseerrTargetDefaults: (values.jellyseerrTargetDefaults ??
          {}) as Record<
          string,
          { profileId?: number; rootFolderPath?: string }
        >,
        updatedAt: new Date(),
      } as unknown as ServiceConfig;

      await secureStorage.saveServiceConfig(updated);
      // Update connector manager runtime
      const mgr = ConnectorManager.getInstance();
      await mgr.addConnector(updated);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.services.overview,
      });
      alert("Success", "Jellyseerr target defaults saved", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (err) => {
      alert(
        "Error",
        `Failed to save settings: ${err instanceof Error ? err.message : String(err)}`,
      );
    },
  });

  const onSubmit = useCallback(async () => {
    await saveMutation.mutateAsync({ jellyseerrTargetDefaults: localDefaults });
  }, [localDefaults, saveMutation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: { flex: 1, backgroundColor: theme.colors.background },
        container: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.lg,
          paddingTop: spacing.xs,
        },
        header: { marginBottom: spacing.md },
        section: { gap: spacing.sm, marginBottom: spacing.md },
        sectionTitle: { color: theme.colors.onSurface },
        radioItem: { paddingVertical: spacing.xs },
        footer: { marginTop: spacing.lg },
      }),
    [theme.colors.background, theme.colors.onSurface],
  );

  if (!serviceid) {
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
            description="No Jellyseerr service specified."
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
            title="Jellyseerr unavailable"
            description="We couldn't find a configured Jellyseerr connector for this service."
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

        <ScrollView contentContainerStyle={{ gap: spacing.lg }}>
          <View>
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurface }}
            >
              Jellyseerr Target Defaults
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Configure per-target defaults (quality/profile and root folder)
              for downstream servers exposed by this Jellyseerr instance.
            </Text>
          </View>

          {loadingTargets ? (
            <UniArrLoader centered size={60} />
          ) : Object.keys(targetsByMedia).length === 0 ||
            Object.values(targetsByMedia).every((arr) => arr.length === 0) ? (
            <HelperText type="info">
              No downstream targets found for this Jellyseerr service.
            </HelperText>
          ) : (
            Object.entries(targetsByMedia).map(([mediaType, servers]) => (
              <View key={mediaType} style={styles.section}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  {mediaType === "tv" ? "TV Targets" : "Movie Targets"}
                </Text>
                {servers.map((s: any) => {
                  const serverKey = `${mediaType}-${Number(s.id)}`;
                  const profiles = profilesByTarget[serverKey] ?? [];
                  const rootFolders = rootFoldersByTarget[serverKey] ?? [];
                  const current = localDefaults[String(s.id)] ?? {};

                  return (
                    <View key={serverKey} style={{ marginBottom: spacing.md }}>
                      <Text
                        variant="titleSmall"
                        style={{ marginBottom: spacing.xs }}
                      >
                        {s.name}
                      </Text>

                      <Text
                        variant="bodySmall"
                        style={{ marginBottom: spacing.xs }}
                      >
                        Default Profile
                      </Text>
                      {profiles.length === 0 ? (
                        <HelperText type="info">
                          No profiles available for this target.
                        </HelperText>
                      ) : (
                        <RadioButton.Group
                          onValueChange={(value) => {
                            const num = Number(value);
                            setLocalDefaults((prev) => ({
                              ...prev,
                              [String(s.id)]: {
                                ...(prev[String(s.id)] ?? {}),
                                profileId: Number.isFinite(num)
                                  ? num
                                  : undefined,
                              },
                            }));
                          }}
                          value={
                            current.profileId ? String(current.profileId) : ""
                          }
                        >
                          <List.Section>
                            <List.Item
                              title="None (choose manually)"
                              left={() => (
                                <RadioButton
                                  value=""
                                  status={
                                    !current.profileId ? "checked" : "unchecked"
                                  }
                                />
                              )}
                              onPress={() =>
                                setLocalDefaults((prev) => ({
                                  ...prev,
                                  [String(s.id)]: {
                                    ...(prev[String(s.id)] ?? {}),
                                    profileId: undefined,
                                  },
                                }))
                              }
                            />
                            {profiles.map((p: any) => (
                              <List.Item
                                key={p.id}
                                title={p.name}
                                left={() => (
                                  <RadioButton
                                    value={String(p.id)}
                                    status={
                                      current.profileId === p.id
                                        ? "checked"
                                        : "unchecked"
                                    }
                                  />
                                )}
                                onPress={() =>
                                  setLocalDefaults((prev) => ({
                                    ...prev,
                                    [String(s.id)]: {
                                      ...(prev[String(s.id)] ?? {}),
                                      profileId: p.id,
                                    },
                                  }))
                                }
                              />
                            ))}
                          </List.Section>
                        </RadioButton.Group>
                      )}

                      <Text
                        variant="bodySmall"
                        style={{
                          marginTop: spacing.sm,
                          marginBottom: spacing.xs,
                        }}
                      >
                        Default Root Folder
                      </Text>
                      {rootFolders.length === 0 ? (
                        <HelperText type="info">
                          No root folders available for this target.
                        </HelperText>
                      ) : (
                        <RadioButton.Group
                          onValueChange={(value) => {
                            setLocalDefaults((prev) => ({
                              ...prev,
                              [String(s.id)]: {
                                ...(prev[String(s.id)] ?? {}),
                                rootFolderPath: value || undefined,
                              },
                            }));
                          }}
                          value={current.rootFolderPath ?? ""}
                        >
                          <List.Section>
                            <List.Item
                              title="None (choose manually)"
                              left={() => (
                                <RadioButton
                                  value=""
                                  status={
                                    !current.rootFolderPath
                                      ? "checked"
                                      : "unchecked"
                                  }
                                />
                              )}
                              onPress={() =>
                                setLocalDefaults((prev) => ({
                                  ...prev,
                                  [String(s.id)]: {
                                    ...(prev[String(s.id)] ?? {}),
                                    rootFolderPath: undefined,
                                  },
                                }))
                              }
                            />
                            {rootFolders.map((r: any) => (
                              <List.Item
                                key={r.path}
                                title={r.path}
                                description={
                                  r.freeSpace
                                    ? `${(r.freeSpace / (1024 * 1024 * 1024)).toFixed(2)} GB free`
                                    : undefined
                                }
                                left={() => (
                                  <RadioButton
                                    value={r.path}
                                    status={
                                      current.rootFolderPath === r.path
                                        ? "checked"
                                        : "unchecked"
                                    }
                                  />
                                )}
                                onPress={() =>
                                  setLocalDefaults((prev) => ({
                                    ...prev,
                                    [String(s.id)]: {
                                      ...(prev[String(s.id)] ?? {}),
                                      rootFolderPath: r.path,
                                    },
                                  }))
                                }
                              />
                            ))}
                          </List.Section>
                        </RadioButton.Group>
                      )}
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={saveMutation.isPending}
            disabled={saveMutation.isPending}
          >
            Save Settings
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default JellyseerrSettingsScreen;
