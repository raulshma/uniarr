import React, { useMemo } from "react";
import { StyleSheet, View, Linking, Image as RNImage } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Chip, Text, useTheme } from "react-native-paper";

import DetailHero from "@/components/media/DetailHero/DetailHero";
import { EmptyState } from "@/components/common/EmptyState";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useJikanAnimeDetails } from "@/hooks/useJikanAnimeDetails";
import type { JikanTrailer } from "@/models/jikan.types";

const AnimeHubDetailScreen: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const params = useLocalSearchParams<{ malId?: string }>();
  const malId = Number.parseInt(params.malId ?? "", 10);
  const validMalId = Number.isFinite(malId) && malId > 0 ? malId : undefined;

  const { anime, isLoading, isError, refetch } = useJikanAnimeDetails(validMalId);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        content: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xl,
          gap: spacing.lg,
        },
        section: {
          gap: spacing.sm,
        },
        metaRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
        },
        chip: {
          backgroundColor: theme.colors.secondaryContainer,
        },
        chipText: {
          color: theme.colors.onSecondaryContainer,
        },
        headline: {
          color: theme.colors.onSurface,
          fontWeight: "700",
        },
        body: {
          color: theme.colors.onSurfaceVariant,
          lineHeight: 22,
        },
        metaText: {
          color: theme.colors.onSurface,
        },
        loading: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.colors.background,
        },
        statsContainer: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.md,
        },
        statItem: {
          flex: 1,
          minWidth: 120,
          alignItems: "center",
          padding: spacing.sm,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 8,
        },
        statLabel: {
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.xs,
        },
        statValue: {
          color: theme.colors.onSurface,
          fontWeight: "600",
        },
        relationType: {
          color: theme.colors.primary,
          marginBottom: spacing.xs,
          textTransform: "capitalize",
        },
        loadingAdditional: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.md,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 8,
          marginBottom: spacing.md,
        },
        loadingText: {
          color: theme.colors.onSurfaceVariant,
          marginLeft: spacing.sm,
        },
        relationGroup: {
          marginBottom: spacing.md,
        },
        reviewItem: {
          marginBottom: spacing.md,
          padding: spacing.sm,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 8,
        },
        reviewContent: {
          color: theme.colors.onSurface,
          lineHeight: 20,
          marginBottom: spacing.xs,
        },
        reviewAuthor: {
          color: theme.colors.onSurfaceVariant,
          fontStyle: "italic",
        },
        picturesContainer: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
        },
        pictureItem: {
          width: "30%",
          aspectRatio: 16 / 9,
          borderRadius: 8,
          overflow: "hidden",
        },
        pictureImage: {
          width: "100%",
          height: "100%",
        },
        episodeItem: {
          marginBottom: spacing.sm,
          padding: spacing.sm,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 8,
        },
        episodeTitle: {
          color: theme.colors.onSurface,
          marginBottom: spacing.xs,
        },
        episodeMeta: {
          color: theme.colors.onSurfaceVariant,
        },
        showMore: {
          color: theme.colors.primary,
          textAlign: "center",
          marginTop: spacing.sm,
        },
        statsGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
        },
        statCard: {
          flex: 1,
          minWidth: 80,
          alignItems: "center",
          padding: spacing.sm,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 8,
        },
        statNumber: {
          color: theme.colors.primary,
          fontWeight: "700",
        },
      }),
    [theme]
  );

  const openOnMal = async () => {
    if (validMalId) {
      const url = `https://myanimelist.net/anime/${validMalId}`;
      await Linking.openURL(url);
    }
  };

  if (isLoading && !anime) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <ActivityIndicator animating color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!validMalId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <ActivityIndicator animating color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if ((isError || !anime) && !isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Failed to load"
          description="We couldn't load this title from MyAnimeList."
          actionLabel="Retry"
          onActionPress={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  const posterUri =
    anime?.images?.jpg?.large_image_url ??
    anime?.images?.jpg?.image_url ??
    undefined;
  const backdropUri = (() => {
    const trailer = anime?.trailer as JikanTrailer | undefined;
    if (!trailer) return undefined;
    const images = trailer.images;
    if (images && typeof images === "object") {
      return images.maximum_image_url ?? images.large_image_url ?? undefined;
    }
    return undefined;
  })();
  const genres = (anime?.genres ?? []).map((genre) => genre.name).filter(Boolean);
  const themes = (anime?.themes ?? []).map((themeItem) => themeItem.name).filter(Boolean);
  const demographics = (anime?.demographics ?? [])
    .map((item) => item.name)
    .filter(Boolean);
  const tags = [...genres, ...themes, ...demographics];

  const metaItems = [
    anime?.type,
    anime?.episodes ? `${anime.episodes} episodes` : undefined,
    anime?.duration ?? undefined,
    anime?.status ?? undefined,
    anime?.score ? `${anime.score.toFixed(1)} rating` : undefined,
    anime?.rank ? `Rank #${anime.rank}` : undefined,
  ].filter(Boolean);

  // Show loading for additional data while main data is loaded
  const isLoadingAdditional = isLoading && anime;

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <DetailHero
        posterUri={posterUri}
        backdropUri={backdropUri}
        onBack={() => router.back()}
        onMal={openOnMal}
      >
        <View style={styles.content}>
          <View style={styles.section}>
            <Text variant="headlineLarge" style={styles.headline}>
              {anime?.title ?? "Untitled"}
            </Text>
            {anime?.title_english && anime.title_english !== anime.title ? (
              <Text variant="titleMedium" style={styles.body}>
                {anime.title_english}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              {metaItems.map((item) => (
                <Chip key={item} compact mode="outlined">
                  <Text style={styles.metaText}>{item}</Text>
                </Chip>
              ))}
            </View>
          </View>

          {/* Loading indicator for additional data */}
          {isLoadingAdditional && (
            <View style={styles.loadingAdditional}>
              <ActivityIndicator animating size="small" color={theme.colors.primary} />
              <Text variant="bodyMedium" style={styles.loadingText}>
                Loading additional information...
              </Text>
            </View>
          )}

          {anime?.synopsis ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.headline}>
                Synopsis
              </Text>
              <Text variant="bodyLarge" style={styles.body}>
                {anime.synopsis}
              </Text>
            </View>
          ) : null}

          {tags.length ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.headline}>
                Tags
              </Text>
              <View style={styles.metaRow}>
                {tags.map((tag) => (
                  <Chip key={tag} style={styles.chip} textStyle={styles.chipText}>
                    {tag}
                  </Chip>
                ))}
              </View>
            </View>
          ) : null}

          {anime?.studios?.length ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.headline}>
                Studios
              </Text>
              <View style={styles.metaRow}>
                {anime.studios
                  .map((studio) => studio.name)
                  .filter(Boolean)
                  .map((name) => (
                    <Chip key={name} mode="outlined">
                      <Text style={styles.metaText}>{name}</Text>
                    </Chip>
                  ))}
              </View>
            </View>
          ) : null}

          {/* Related Anime/Manga Section */}
          {anime?.relations && anime.relations.length > 0 ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.headline}>
                Related Entries
              </Text>
              {anime.relations.map((relation) => (
                <View key={relation.relation} style={styles.relationGroup}>
                  <Text variant="labelMedium" style={styles.relationType}>
                    {relation.relation}
                  </Text>
                  <View style={styles.metaRow}>
                    {relation.entry?.map((entry) => (
                      <Chip
                        key={`${entry.mal_id}-${entry.name}`}
                        mode="outlined"
                        onPress={() => {
                          if (entry.mal_id && entry.type === 'anime') {
                            router.push(`/anime-hub/${entry.mal_id}`);
                          }
                        }}
                      >
                        <Text style={styles.metaText}>{entry.name}</Text>
                      </Chip>
                    )) || []}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Background Information Section */}
          {anime?.background ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.headline}>
                Background
              </Text>
              <Text variant="bodyLarge" style={styles.body}>
                {anime.background}
              </Text>
            </View>
          ) : null}

          {/* External Links Section */}
          {anime?.external && anime.external.length > 0 ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.headline}>
                External Links
              </Text>
              <View style={styles.metaRow}>
                {anime.external.map((link) => (
                  <Chip
                    key={`${link.name}-${link.url}`}
                    mode="outlined"
                    onPress={() => {
                      if (link.url) {
                        Linking.openURL(link.url);
                      }
                    }}
                  >
                    <Text style={styles.metaText}>{link.name}</Text>
                  </Chip>
                ))}
              </View>
            </View>
          ) : null}

          {/* Recommendations Section */}
          {anime?.recommendations && anime.recommendations.length > 0 ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.headline}>
                Recommendations
              </Text>
              <View style={styles.metaRow}>
                {anime.recommendations.slice(0, 10).map((rec) => (
                  <Chip
                    key={`${rec.entry?.mal_id}-${rec.entry?.name}`}
                    mode="outlined"
                    onPress={() => {
                      if (rec.entry?.mal_id && rec.entry.type === 'anime') {
                        router.push(`/anime-hub/${rec.entry.mal_id}`);
                      }
                    }}
                  >
                    <Text style={styles.metaText}>{rec.entry?.name}</Text>
                  </Chip>
                ))}
              </View>
            </View>
          ) : null}

          {/* Reviews Section */}
          {anime?.reviews && anime.reviews.length > 0 ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.headline}>
                Reviews
              </Text>
              {anime.reviews.slice(0, 3).map((review) => (
                <View key={review.mal_id} style={styles.reviewItem}>
                  <Text variant="bodyMedium" style={styles.reviewContent}>
                    {review.content ? `${review.content.substring(0, 200)}...` : ''}
                  </Text>
                  <Text variant="labelSmall" style={styles.reviewAuthor}>
                    - {review.user?.username || 'Anonymous'}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Pictures Section */}
          {anime?.pictures && anime.pictures.length > 0 ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.headline}>
                Pictures
              </Text>
              <View style={styles.picturesContainer}>
                {anime.pictures.slice(0, 6).map((picture, index) => (
                  <View key={index} style={styles.pictureItem}>
                    <RNImage
                      source={{ uri: picture.jpg?.large_image_url ?? picture.jpg?.image_url ?? undefined }}
                      style={styles.pictureImage}
                      resizeMode="cover"
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Episodes Section */}
          {anime?.episodes && anime.episodes.length > 0 ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.headline}>
                Episodes ({anime.episodes.length})
              </Text>
              {anime.episodes.slice(0, 5).map((episode) => (
                <View key={episode.mal_id} style={styles.episodeItem}>
                  <Text variant="bodyMedium" style={styles.episodeTitle}>
                    {episode.title}
                  </Text>
                  <Text variant="labelSmall" style={styles.episodeMeta}>
                    Episode {episode.episode_id} • {episode.duration}
                  </Text>
                </View>
              ))}
              {anime.episodes.length > 5 && (
                <Text variant="labelMedium" style={styles.showMore}>
                  + {anime.episodes.length - 5} more episodes
                </Text>
              )}
            </View>
          ) : null}

          {/* Statistics Section */}
          {anime?.statistics ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.headline}>
                Statistics
              </Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text variant="headlineSmall" style={styles.statNumber}>
                    {(anime.statistics.watching || 0).toLocaleString()}
                  </Text>
                  <Text variant="labelMedium" style={styles.statLabel}>
                    Watching
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text variant="headlineSmall" style={styles.statNumber}>
                    {(anime.statistics.completed || 0).toLocaleString()}
                  </Text>
                  <Text variant="labelMedium" style={styles.statLabel}>
                    Completed
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text variant="headlineSmall" style={styles.statNumber}>
                    {(anime.statistics.on_hold || 0).toLocaleString()}
                  </Text>
                  <Text variant="labelMedium" style={styles.statLabel}>
                    On Hold
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text variant="headlineSmall" style={styles.statNumber}>
                    {(anime.statistics.dropped || 0).toLocaleString()}
                  </Text>
                  <Text variant="labelMedium" style={styles.statLabel}>
                    Dropped
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Streaming Section */}
          {anime?.streaming && anime.streaming.length > 0 ? (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.headline}>
                Streaming
              </Text>
              <View style={styles.metaRow}>
                {anime.streaming.map((stream) => (
                  <Chip
                    key={`${stream.name}-${stream.url}`}
                    mode="outlined"
                    onPress={() => {
                      if (stream.url) {
                        Linking.openURL(stream.url);
                      }
                    }}
                  >
                    <Text style={styles.metaText}>{stream.name}</Text>
                  </Chip>
                ))}
              </View>
            </View>
          ) : null}

        </View>
      </DetailHero>
    </SafeAreaView>
  );
};

export default AnimeHubDetailScreen;
