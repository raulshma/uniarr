import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Linking,
  Image as RNImage,
  Pressable,
  Modal,
} from "react-native";
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

  const { anime, isLoading, isError, refetch } =
    useJikanAnimeDetails(validMalId);

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
        statNumber: {
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
        primaryCard: {
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 12,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
        infoCard: {
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 12,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
        cardTitle: {
          color: theme.colors.onSurface,
          marginBottom: spacing.sm,
          fontWeight: "600",
        },
        statsOverview: {
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 12,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
        detailedStats: {
          gap: spacing.md,
        },
        statRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          gap: spacing.md,
        },
        episodesList: {
          gap: spacing.sm,
        },
        episodeHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.85)",
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.md,
        },
        modalImage: {
          width: "100%",
          height: "100%",
        },
      }),
    [theme],
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(
    undefined,
  );

  // modal state for fullscreen image (no pan/zoom)

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
  const genres = (anime?.genres ?? [])
    .map((genre) => genre.name)
    .filter(Boolean);
  const themes = (anime?.themes ?? [])
    .map((themeItem) => themeItem.name)
    .filter(Boolean);
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <DetailHero
        posterUri={posterUri}
        backdropUri={backdropUri}
        onBack={() => router.back()}
        onMal={openOnMal}
      >
        <View style={styles.content}>
          {/* Primary Information Card */}
          <View style={styles.primaryCard}>
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
          </View>

          {/* Synopsis Section */}
          {anime?.synopsis ? (
            <View style={styles.infoCard}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Synopsis
              </Text>
              <Text variant="bodyLarge" style={styles.body}>
                {anime.synopsis}
              </Text>
            </View>
          ) : null}

          {/* Quick Stats Overview */}
          {anime?.statistics && (
            <View style={styles.statsOverview}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Quick Stats
              </Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text variant="headlineSmall" style={styles.statNumber}>
                    {anime && typeof anime.score === "number"
                      ? anime.score.toFixed(1)
                      : "N/A"}
                  </Text>
                  <Text variant="labelMedium" style={styles.statLabel}>
                    Score
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text variant="headlineSmall" style={styles.statNumber}>
                    {anime && typeof anime.rank === "number"
                      ? `#${anime.rank}`
                      : "N/A"}
                  </Text>
                  <Text variant="labelMedium" style={styles.statLabel}>
                    Rank
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text variant="headlineSmall" style={styles.statNumber}>
                    {anime && typeof anime.popularity === "number"
                      ? `#${anime.popularity}`
                      : "N/A"}
                  </Text>
                  <Text variant="labelMedium" style={styles.statLabel}>
                    Popularity
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text variant="headlineSmall" style={styles.statNumber}>
                    {anime && typeof anime.members === "number"
                      ? anime.members.toLocaleString()
                      : "N/A"}
                  </Text>
                  <Text variant="labelMedium" style={styles.statLabel}>
                    Members
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Tags and Categories */}
          {(tags.length || (anime?.studios?.length ?? 0) > 0) && (
            <View style={styles.infoCard}>
              {tags.length ? (
                <View style={styles.section}>
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    Tags
                  </Text>
                  <View style={styles.metaRow}>
                    {tags.map((tag) => (
                      <Chip
                        key={tag}
                        style={styles.chip}
                        textStyle={styles.chipText}
                      >
                        {tag}
                      </Chip>
                    ))}
                  </View>
                </View>
              ) : null}

              {anime?.studios?.length ? (
                <View style={styles.section}>
                  <Text variant="titleMedium" style={styles.cardTitle}>
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
            </View>
          )}

          {/* Detailed Statistics */}
          {anime?.statistics && (
            <View style={styles.infoCard}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Community Stats
              </Text>
              <View style={styles.detailedStats}>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text variant="headlineSmall" style={styles.statValue}>
                      {anime &&
                      anime.statistics &&
                      typeof anime.statistics.watching === "number"
                        ? anime.statistics.watching.toLocaleString()
                        : "0"}
                    </Text>
                    <Text variant="labelMedium" style={styles.statLabel}>
                      Currently Watching
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="headlineSmall" style={styles.statValue}>
                      {anime &&
                      anime.statistics &&
                      typeof anime.statistics.completed === "number"
                        ? anime.statistics.completed.toLocaleString()
                        : "0"}
                    </Text>
                    <Text variant="labelMedium" style={styles.statLabel}>
                      Completed
                    </Text>
                  </View>
                </View>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text variant="headlineSmall" style={styles.statValue}>
                      {anime &&
                      anime.statistics &&
                      typeof anime.statistics.on_hold === "number"
                        ? anime.statistics.on_hold.toLocaleString()
                        : "0"}
                    </Text>
                    <Text variant="labelMedium" style={styles.statLabel}>
                      On Hold
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="headlineSmall" style={styles.statValue}>
                      {anime &&
                      anime.statistics &&
                      typeof anime.statistics.dropped === "number"
                        ? anime.statistics.dropped.toLocaleString()
                        : "0"}
                    </Text>
                    <Text variant="labelMedium" style={styles.statLabel}>
                      Dropped
                    </Text>
                  </View>
                </View>
                {anime &&
                  anime.statistics &&
                  typeof (anime.statistics as Record<string, unknown>)[
                    "favorites"
                  ] === "number" && (
                    <View style={styles.statRow}>
                      <View style={styles.statItem}>
                        <Text variant="headlineSmall" style={styles.statValue}>
                          {typeof (anime.statistics as Record<string, unknown>)[
                            "favorites"
                          ] === "number"
                            ? (
                                (anime.statistics as Record<string, unknown>)[
                                  "favorites"
                                ] as number
                              ).toLocaleString()
                            : "0"}
                        </Text>
                        <Text variant="labelMedium" style={styles.statLabel}>
                          Favorited
                        </Text>
                      </View>
                    </View>
                  )}
              </View>
            </View>
          )}

          {/* Episodes Section */}
          {anime?.episodes && anime.episodes.length > 0 ? (
            <View style={styles.infoCard}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Episodes ({anime && anime.episodes ? anime.episodes.length : 0})
              </Text>
              <View style={styles.episodesList}>
                {anime.episodes.slice(0, 8).map((episode) => (
                  <View key={episode.mal_id} style={styles.episodeItem}>
                    <View style={styles.episodeHeader}>
                      <Text variant="bodyMedium" style={styles.episodeTitle}>
                        {episode.title}
                      </Text>
                      <Text variant="labelSmall" style={styles.episodeMeta}>
                        #{episode.episode_id}
                      </Text>
                    </View>
                    {episode.duration && (
                      <Text variant="labelSmall" style={styles.episodeMeta}>
                        {episode.duration}
                      </Text>
                    )}
                  </View>
                ))}
                {anime && anime.episodes && anime.episodes.length > 8 && (
                  <Text variant="labelMedium" style={styles.showMore}>
                    + {anime && anime.episodes ? anime.episodes.length - 8 : 0}{" "}
                    more episodes
                  </Text>
                )}
              </View>
            </View>
          ) : null}

          {/* Pictures Gallery */}
          {anime && anime.pictures && anime.pictures.length > 0 ? (
            <View style={styles.infoCard}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Gallery
              </Text>
              <View style={styles.picturesContainer}>
                {anime && anime.pictures
                  ? anime.pictures.slice(0, 6).map((picture, index) => {
                      const uri =
                        picture.jpg?.large_image_url ??
                        picture.jpg?.image_url ??
                        undefined;
                      return (
                        <Pressable
                          key={index}
                          style={styles.pictureItem}
                          onPress={() => {
                            if (uri) {
                              setSelectedImage(uri);
                              setModalVisible(true);
                            }
                          }}
                        >
                          <RNImage
                            source={{ uri }}
                            style={styles.pictureImage}
                            resizeMode="cover"
                          />
                        </Pressable>
                      );
                    })
                  : null}
              </View>
            </View>
          ) : null}

          {/* Fullscreen image modal */}
          <Modal
            visible={modalVisible}
            transparent
            onRequestClose={() => setModalVisible(false)}
          >
            <Modal
              visible={modalVisible}
              transparent
              onRequestClose={() => setModalVisible(false)}
            >
              <Pressable
                style={styles.modalOverlay}
                onPress={() => setModalVisible(false)}
              >
                {selectedImage ? (
                  <RNImage
                    source={{ uri: selectedImage }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                ) : null}
              </Pressable>
            </Modal>
          </Modal>

          {/* Related Content */}
          {anime && anime.relations && anime.relations.length > 0 ? (
            <View style={styles.infoCard}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Related Content
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
                          if (entry.mal_id && entry.type === "anime") {
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

          {/* Recommendations */}
          {anime?.recommendations && anime.recommendations.length > 0 ? (
            <View style={styles.infoCard}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Recommended For You
              </Text>
              <View style={styles.metaRow}>
                {anime.recommendations.slice(0, 8).map((rec, idx) => {
                  // `entry` may be an array of two entries or a single object depending on the API shape
                  const entry = Array.isArray(rec.entry)
                    ? (rec.entry[1] ?? rec.entry[0])
                    : rec.entry;
                  const malId = entry?.mal_id ?? entry?.malId ?? undefined;
                  const name =
                    entry?.name ??
                    entry?.title ??
                    entry?.title_english ??
                    "Untitled";
                  return (
                    <Chip
                      key={`${malId ?? idx}-${name}`}
                      mode="outlined"
                      onPress={() => {
                        if (malId && entry?.type === "anime") {
                          router.push(`/anime-hub/${malId}`);
                        }
                      }}
                    >
                      <Text style={styles.metaText}>{name}</Text>
                    </Chip>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Streaming Platforms */}
          {anime?.streaming && anime.streaming.length > 0 ? (
            <View style={styles.infoCard}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Available On
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

          {/* Additional Information */}
          {(anime?.background ||
            (anime?.external && anime.external.length > 0)) && (
            <View style={styles.infoCard}>
              {anime?.background ? (
                <View style={styles.section}>
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    Background
                  </Text>
                  <Text variant="bodyLarge" style={styles.body}>
                    {anime.background}
                  </Text>
                </View>
              ) : null}

              {anime?.external && anime.external.length > 0 ? (
                <View style={styles.section}>
                  <Text variant="titleMedium" style={styles.cardTitle}>
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
            </View>
          )}

          {/* Reviews Section */}
          {anime?.reviews && anime.reviews.length > 0 ? (
            <View style={styles.infoCard}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Community Reviews
              </Text>
              {anime.reviews.slice(0, 3).map((review) => (
                <View key={review.mal_id} style={styles.reviewItem}>
                  <Text variant="bodyMedium" style={styles.reviewContent}>
                    {review.content
                      ? `${review.content.substring(0, 200)}...`
                      : (review as any)?.review
                        ? `${(review as any).review.substring(0, 200)}...`
                        : ""}
                  </Text>
                  <Text variant="labelSmall" style={styles.reviewAuthor}>
                    - {review.user?.username || "Anonymous"}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </DetailHero>
    </SafeAreaView>
  );
};

export default AnimeHubDetailScreen;
