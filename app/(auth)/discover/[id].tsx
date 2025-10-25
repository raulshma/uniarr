import React, { useCallback, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Text,
  useTheme,
  Portal,
  Dialog,
  RadioButton,
  Chip,
} from "react-native-paper";
import { Button } from "@/components/common/Button";
import { alert } from "@/services/dialogService";
import DetailHero from "@/components/media/DetailHero/DetailHero";
import MediaPoster from "@/components/media/MediaPoster/MediaPoster";
import { useJellyseerrMediaCredits } from "@/hooks/useJellyseerrMediaCredits";
import { useUnifiedDiscover } from "@/hooks/useUnifiedDiscover";
import { useCheckInLibrary } from "@/hooks/useCheckInLibrary";
import { useDiscoverReleases } from "@/hooks/useDiscoverReleases";
import type { AppTheme } from "@/constants/theme";
import { buildProfileUrl } from "@/utils/tmdb.utils";
import { useTmdbDetails, getDeviceRegion } from "@/hooks/tmdb/useTmdbDetails";
import RatingsOverview from "@/components/media/RatingsOverview";
import { spacing } from "@/theme/spacing";
import { avatarSizes } from "@/constants/sizes";
import RelatedItems from "@/components/discover/RelatedItems";
import { YouTubePlayer } from "@/components/media/VideoPlayer";
import DetailPageSkeleton from "@/components/discover/DetailPageSkeleton";

const DiscoverItemDetails = () => {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? "";
  const theme = useTheme<AppTheme>();
  const router = useRouter();

  const { sections, services } = useUnifiedDiscover();

  const item = useMemo(() => {
    // First try to find by exact ID match
    for (const section of sections) {
      const found = section.items.find((i) => i.id === id);
      if (found) return found;
    }

    // If not found, try to find by TMDB ID or source ID
    for (const section of sections) {
      const found = section.items.find(
        (i) =>
          (i.tmdbId && `movie-${i.tmdbId}` === id) ||
          (i.tmdbId && `series-${i.tmdbId}` === id) ||
          (i.sourceId && `${i.mediaType}-${i.sourceId}` === id),
      );
      if (found) return found;
    }

    return undefined;
  }, [sections, id]);

  const tmdbDetailsQuery = useTmdbDetails(
    item?.mediaType === "series" ? "tv" : "movie",
    item?.tmdbId ?? null,
    { enabled: !!item?.tmdbId },
  );

  // Check if item is already in the user's library (lazy check on detail view mount)
  const inLibraryQuery = useCheckInLibrary({
    tmdbId: item?.tmdbId,
    tvdbId: item?.tvdbId,
    sourceId: item?.sourceId,
    mediaType: item?.mediaType ?? "movie",
    enabled: !!item,
  });

  const [dialogVisible, setDialogVisible] = React.useState(false);
  const [selectedServiceId, setSelectedServiceId] = React.useState<string>("");
  const [showReleases, setShowReleases] = useState(false);

  // Fetch releases on-demand when user expands the releases section
  const releasesQuery = useDiscoverReleases(
    item?.mediaType === "series" ? "series" : "movie",
    showReleases && item?.tmdbId ? item.tmdbId : undefined,
    {
      preferQuality: true,
      minSeeders: 0,
      tvdbId: showReleases && item?.tvdbId ? item.tvdbId : undefined,
      imdbId: showReleases && item?.imdbId ? item.imdbId : undefined,
      title: showReleases && item?.title ? item.title : undefined,
      year: showReleases && item?.year ? item.year : undefined,
    },
  );

  const openServicePicker = useCallback(() => {
    if (!item) return;

    // If item is already in library, offer to open it instead
    if (inLibraryQuery.foundServices.length > 0) {
      const found = inLibraryQuery.foundServices[0];
      if (found) {
        void alert(
          "Already in Library",
          `This ${item.mediaType === "series" ? "series" : "movie"} is already in ${found.name}.`,
        );
      }
      return;
    }

    const options =
      item.mediaType === "series" ? services.sonarr : services.radarr;
    if (!options || options.length === 0) {
      // Show an alert advising user to add a service first
      void alert(
        "No services available",
        `Add a ${
          item.mediaType === "series" ? "Sonarr" : "Radarr"
        } service first to add this title.`,
      );
      return;
    }

    if (options.length === 1) {
      // Only one service configured — navigate directly with prefilled params
      const serviceId = options[0]!.id;
      const params: Record<string, string> = { serviceId, query: item.title };
      if (item.tmdbId) params.tmdbId = String(item.tmdbId);
      if (item.tvdbId) params.tvdbId = String(item.tvdbId);
      if (item.mediaType === "series") {
        router.push({ pathname: "/(auth)/sonarr/[serviceId]/add", params });
      } else {
        router.push({ pathname: "/(auth)/radarr/[serviceId]/add", params });
      }
      return;
    }

    // Multiple services — open picker dialog and preselect first option
    setSelectedServiceId((current) => {
      if (current && options.some((s) => s.id === current)) return current;
      return options[0]!.id ?? "";
    });
    setDialogVisible(true);
  }, [item, router, services, inLibraryQuery.foundServices]);

  const handleRelatedPress = useCallback(
    (relatedId: string) => {
      router.push(`/(auth)/discover/${relatedId}`);
    },
    [router],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: { flex: 1, backgroundColor: theme.colors.background },
        content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
        synopsis: { marginBottom: spacing.lg },
        castRow: {
          flexDirection: "row",
          gap: spacing.xs,
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        addButton: { marginVertical: spacing.lg },
      }),
    [theme.colors.background],
  );

  if (!item) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <View style={{ padding: spacing.lg }}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
            Item not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <DetailHero
        posterUri={item.posterUrl}
        backdropUri={item.backdropUrl}
        onBack={() => router.back()}
      >
        {tmdbDetailsQuery.isLoading && !tmdbDetailsQuery.data ? (
          <ScrollView contentContainerStyle={styles.content}>
            <DetailPageSkeleton />
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                marginBottom: spacing.sm,
                justifyContent: "space-between",
              }}
            >
              <Text
                variant="headlineLarge"
                style={{
                  color: theme.colors.onSurface,
                  fontWeight: "700",
                  flex: 1,
                }}
              >
                {item.title}
              </Text>
              {inLibraryQuery.foundServices.length > 0 && (
                <Chip
                  icon="check-circle"
                  mode="outlined"
                  style={{ borderColor: theme.colors.primary }}
                  textStyle={{ color: theme.colors.primary }}
                >
                  In Library
                </Chip>
              )}
            </View>

            {item.overview ? (
              <View style={styles.synopsis}>
                <Text
                  variant="bodyLarge"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    lineHeight: 22,
                  }}
                >
                  {item.overview}
                </Text>
              </View>
            ) : null}

            {tmdbDetailsQuery.data?.details?.genres &&
            tmdbDetailsQuery.data.details.genres.length > 0 ? (
              <View style={{ marginBottom: spacing.lg }}>
                <Text
                  variant="titleMedium"
                  style={{
                    color: theme.colors.onSurface,
                    fontWeight: "700",
                    marginBottom: spacing.xs,
                  }}
                >
                  Genres
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {tmdbDetailsQuery.data.details.genres
                    .map((g) => g.name)
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </View>
            ) : null}

            {/* Cast */}
            <CastRow item={item} tmdbDetailsData={tmdbDetailsQuery.data} />

            {/* Ratings */}
            <RatingsOverview rating={item.rating} votes={item.voteCount} />

            {/* Release Date & Runtime */}
            <ReleaseMetadata item={item} tmdbDetails={tmdbDetailsQuery.data} />

            {/* Trailer */}
            {tmdbDetailsQuery.data?.videos?.results &&
            tmdbDetailsQuery.data.videos.results.length > 0 ? (
              <View style={{ marginBottom: spacing.lg }}>
                <YouTubePlayer
                  videoKey={
                    tmdbDetailsQuery.data.videos.results.find(
                      (v: any) =>
                        v.site?.toLowerCase() === "youtube" &&
                        v.type?.toLowerCase() === "trailer",
                    )?.key
                  }
                />
              </View>
            ) : null}

            {/* Watch Providers */}
            <WatchProvidersSection
              watchProvidersData={
                tmdbDetailsQuery.data?.watchProviders?.results as any
              }
            />

            {/* Sources / Releases */}
            <ReleasesList
              isLoading={releasesQuery.isLoading}
              isOpen={showReleases}
              onToggle={() => setShowReleases(!showReleases)}
              releases={releasesQuery.data ?? []}
            />

            <Button
              mode="contained"
              onPress={openServicePicker}
              disabled={inLibraryQuery.isLoading}
              style={styles.addButton}
            >
              {inLibraryQuery.isLoading
                ? "Checking..."
                : inLibraryQuery.foundServices.length > 0
                  ? "Already in Library"
                  : "Add to Library"}
            </Button>

            {/* Related Items */}
            <RelatedItems
              currentId={item.id}
              onPress={(id: string) => handleRelatedPress(id)}
            />
          </ScrollView>
        )}
      </DetailHero>
      <Portal>
        <Dialog
          visible={dialogVisible}
          onDismiss={() => setDialogVisible(false)}
        >
          <Dialog.Title>Add to service</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: spacing.sm }}>
              Choose where to add{" "}
              <Text style={{ fontWeight: "600" }}>{item.title}</Text>
            </Text>
            <RadioButton.Group
              onValueChange={(v) => setSelectedServiceId(v)}
              value={selectedServiceId}
            >
              {(item.mediaType === "series"
                ? services.sonarr
                : services.radarr
              ).map((service) => (
                <RadioButton.Item
                  key={service.id}
                  value={service.id}
                  label={service.name}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={() => {
                if (!selectedServiceId) return;
                const params: Record<string, string> = {
                  serviceId: selectedServiceId,
                  query: item.title,
                };
                if (item.tmdbId) params.tmdbId = String(item.tmdbId);
                if (item.tvdbId) params.tvdbId = String(item.tvdbId);
                if (item.mediaType === "series") {
                  router.push({
                    pathname: "/(auth)/sonarr/[serviceId]/add",
                    params,
                  });
                } else {
                  router.push({
                    pathname: "/(auth)/radarr/[serviceId]/add",
                    params,
                  });
                }
                setDialogVisible(false);
              }}
            >
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default DiscoverItemDetails;

const CastRow: React.FC<{
  item: import("@/models/discover.types").DiscoverMediaItem;
  tmdbDetailsData: ReturnType<typeof useTmdbDetails>["data"];
}> = ({ item, tmdbDetailsData }) => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();

  // Use centralized size tokens for consistent avatar sizing
  const AVATAR_SIZE = avatarSizes.lg;
  const MAX_VISIBLE = 5; // show up to 5 avatars, then a +N badge
  const OVERLAP = Math.round(AVATAR_SIZE * 0.35);

  // Fetch credits from Jellyseerr for Jellyseerr items
  const jellyseerrCreditsQuery = useJellyseerrMediaCredits(
    item.sourceServiceId!,
    item.mediaType === "series" ? "tv" : "movie",
    item.sourceId!,
  );

  // Use TMDB details data passed from parent
  const tmdbCast = useMemo(() => {
    const rawCast = tmdbDetailsData?.credits?.cast;
    if (!Array.isArray(rawCast)) {
      return [];
    }

    return rawCast.slice(0, MAX_VISIBLE).map((person) => ({
      id: person.id,
      name:
        typeof person.name === "string"
          ? person.name
          : (person.original_name ?? "Unknown"),
      profilePath:
        typeof person.profile_path === "string"
          ? person.profile_path
          : undefined,
    }));
  }, [tmdbDetailsData?.credits?.cast]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        avatars: { flexDirection: "row", alignItems: "center" },
        avatar: {
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: AVATAR_SIZE / 2,
          overflow: "hidden",
        },
        moreBadge: {
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: AVATAR_SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [AVATAR_SIZE],
  );

  // Use either Jellyseerr or TMDB cast data
  const shouldFetchJellyseerrCredits =
    item.source === "jellyseerr" && item.sourceServiceId && item.sourceId;
  const cast = shouldFetchJellyseerrCredits
    ? (jellyseerrCreditsQuery?.data ?? [])
    : (tmdbCast ?? []);

  const openPersonDetails = (personId?: number, name?: string) => {
    if (personId) {
      router.push({
        pathname: "/(auth)/person/[personId]",
        params: { personId: String(personId) },
      });
    } else if (name) {
      // Fallback to search if no person ID is available
      router.push({ pathname: "/(auth)/search", params: { query: name } });
    }
  };

  if (!cast.length) {
    return (
      <View style={styles.row}>
        <Text
          variant="titleMedium"
          style={{ color: theme.colors.onSurface, fontWeight: "700" }}
        >
          Cast
        </Text>
        <View style={{ flex: 1 }} />
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          No cast information
        </Text>
      </View>
    );
  }

  const visibleCast = cast.slice(0, MAX_VISIBLE);
  const extras = Math.max(0, cast.length - MAX_VISIBLE);

  // Helper to get the profile image URL based on the source
  const getProfileImageUrl = (person: any): string | undefined => {
    // For Jellyseerr cast: profileUrl is already a full URL
    if ("profileUrl" in person && person.profileUrl) {
      return person.profileUrl;
    }
    // For TMDB cast: profilePath needs to be converted to full URL
    if ("profilePath" in person && person.profilePath) {
      return buildProfileUrl(person.profilePath);
    }
    return undefined;
  };

  return (
    <View style={styles.row}>
      <Text
        variant="titleMedium"
        style={{ color: theme.colors.onSurface, fontWeight: "700" }}
      >
        Cast
      </Text>
      <View style={{ flex: 1 }} />

      <View style={styles.avatars} accessibilityRole="list">
        {visibleCast.map((person, idx) => (
          <Pressable
            key={String(person.id ?? person.name ?? idx)}
            accessibilityRole="button"
            accessibilityLabel={
              person.name
                ? `View details for ${person.name}`
                : "View cast member details"
            }
            onPress={() => openPersonDetails(person.id, person.name)}
            style={{ marginLeft: idx === 0 ? 0 : -OVERLAP, zIndex: idx + 1 }}
          >
            <MediaPoster
              uri={getProfileImageUrl(person)}
              size={AVATAR_SIZE}
              aspectRatio={1}
              borderRadius={AVATAR_SIZE / 2}
              style={[
                styles.avatar,
                {
                  borderWidth: 2,
                  borderColor: theme.colors.onPrimaryContainer,
                  backgroundColor: theme.colors.onPrimaryContainer,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                  elevation: 6,
                },
              ]}
            />
          </Pressable>
        ))}

        {extras > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${extras} more cast members`}
            onPress={() =>
              router.push(
                `/(auth)/search?query=${encodeURIComponent(item.title)}`,
              )
            }
            style={{ marginLeft: -OVERLAP, zIndex: visibleCast.length + 1 }}
          >
            <View
              style={[
                styles.moreBadge,
                {
                  backgroundColor: theme.colors.onPrimaryContainer,
                  borderWidth: 2,
                  borderColor: theme.colors.primary,
                  shadowColor: theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                  elevation: 6,
                },
              ]}
            >
              <Text
                variant="labelLarge"
                style={{ color: theme.colors.primary, fontWeight: "700" }}
              >
                {`+${extras}`}
              </Text>
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const ReleaseMetadata: React.FC<{
  item: import("@/models/discover.types").DiscoverMediaItem;
  tmdbDetails: ReturnType<typeof useTmdbDetails>["data"];
}> = ({ item, tmdbDetails }) => {
  const theme = useTheme<AppTheme>();

  const runtime = useMemo(() => {
    if (item.mediaType === "series") {
      const tvRuntime = (tmdbDetails?.details as any)?.episode_run_time?.[0];
      return tvRuntime ? `${tvRuntime}m/ep` : undefined;
    }
    const movieRuntime = (tmdbDetails?.details as any)?.runtime;
    return movieRuntime ? `${movieRuntime}m` : undefined;
  }, [tmdbDetails, item.mediaType]);

  const releaseYear = useMemo(
    () =>
      item.releaseDate ? new Date(item.releaseDate).getFullYear() : item.year,
    [item.releaseDate, item.year],
  );

  if (!runtime && !releaseYear) return null;

  return (
    <View
      style={{
        marginBottom: spacing.lg,
        flexDirection: "row",
        gap: spacing.md,
      }}
    >
      {releaseYear && (
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {releaseYear}
        </Text>
      )}
      {runtime && (
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {runtime}
        </Text>
      )}
    </View>
  );
};

const WatchProvidersSection: React.FC<{
  watchProvidersData?: any;
}> = ({ watchProvidersData }) => {
  const theme = useTheme<AppTheme>();

  if (!watchProvidersData || typeof watchProvidersData !== "object") {
    return null;
  }

  // Get device region and try fallback chain: device region -> US -> any available
  const region = getDeviceRegion();
  let regionData = watchProvidersData[region];

  if (!regionData) {
    // Fallback to US if device region not available
    regionData = watchProvidersData["US"];
  }

  if (!regionData) {
    // Try to find any available region
    const availableRegion = Object.keys(watchProvidersData).find(
      (k) => watchProvidersData[k]?.flatrate?.length > 0,
    );
    if (availableRegion) {
      regionData = watchProvidersData[availableRegion];
    }
  }

  if (!regionData || !Array.isArray(regionData?.flatrate)) {
    return null;
  }

  const providers = regionData.flatrate.slice(0, 5);

  if (providers.length === 0) {
    return null;
  }

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text
        variant="titleMedium"
        style={{
          color: theme.colors.onSurface,
          fontWeight: "700",
          marginBottom: spacing.xs,
        }}
      >
        Available On
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}>
        {providers.map((provider: any) => (
          <Chip key={provider.provider_id} icon="play-circle-outline">
            {provider.provider_name}
          </Chip>
        ))}
      </View>
    </View>
  );
};

const ReleasesList: React.FC<{
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
  releases: import("@/models/discover.types").NormalizedRelease[];
}> = ({ isLoading, isOpen, onToggle, releases }) => {
  const theme = useTheme<AppTheme>();

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Pressable
        onPress={onToggle}
        style={{
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          backgroundColor: theme.colors.surface,
          borderRadius: 8,
          marginBottom: isOpen ? spacing.md : 0,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            variant="titleMedium"
            style={{
              color: theme.colors.onSurface,
              fontWeight: "700",
            }}
          >
            Release Sources
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {isLoading ? "Loading..." : isOpen ? "▼" : "▶"}
          </Text>
        </View>
      </Pressable>

      {isOpen && (
        <View style={{ marginTop: spacing.md }}>
          {isLoading ? (
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                paddingVertical: spacing.lg,
              }}
            >
              Searching available sources...
            </Text>
          ) : releases.length === 0 ? (
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                paddingVertical: spacing.lg,
              }}
            >
              No releases found
            </Text>
          ) : (
            releases
              .slice(0, 10)
              .map((release, idx) => (
                <ReleaseCard
                  key={`${release.sourceConnector}-${idx}`}
                  release={release}
                />
              ))
          )}
        </View>
      )}
    </View>
  );
};

const ReleaseCard: React.FC<{
  release: import("@/models/discover.types").NormalizedRelease;
}> = ({ release }) => {
  const theme = useTheme<AppTheme>();

  const sizeInGB = useMemo(
    () =>
      release.size
        ? (release.size / (1024 * 1024 * 1024)).toFixed(2)
        : undefined,
    [release.size],
  );

  const handleOpenMagnet = async () => {
    if (release.magnetUrl) {
      try {
        const canOpen = await Linking.canOpenURL(release.magnetUrl);
        if (canOpen) {
          await Linking.openURL(release.magnetUrl);
        }
      } catch (error) {
        console.warn("Failed to open magnet link:", error);
      }
    } else if (release.downloadUrl) {
      try {
        const canOpen = await Linking.canOpenURL(release.downloadUrl);
        if (canOpen) {
          await Linking.openURL(release.downloadUrl);
        }
      } catch (error) {
        console.warn("Failed to open download link:", error);
      }
    }
  };

  return (
    <View
      style={{
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: theme.colors.surfaceVariant,
        borderRadius: 8,
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ marginBottom: spacing.xs }}>
        <Text
          variant="labelLarge"
          style={{ color: theme.colors.onSurface, fontWeight: "600" }}
          numberOfLines={2}
        >
          {release.title}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: spacing.xs,
          flexWrap: "wrap",
          marginBottom: spacing.xs,
        }}
      >
        {release.quality?.name && (
          <Chip mode="outlined" compact>
            {release.quality.name}
          </Chip>
        )}
        {release.indexer && (
          <Chip mode="outlined" compact>
            {release.indexer}
          </Chip>
        )}
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: spacing.xs,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          {release.seeders !== null && (
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              📤 {release.seeders}
            </Text>
          )}
          {release.size && (
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {sizeInGB}GB
            </Text>
          )}
        </View>
        {(release.magnetUrl || release.downloadUrl) && (
          <Button mode="outlined" compact onPress={handleOpenMagnet}>
            Open
          </Button>
        )}
      </View>
    </View>
  );
};
