import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
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
      }),
    [theme]
  );

  if (!validMalId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Anime not found"
          description="We were unable to determine which title to open."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (isLoading && !anime) {
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <DetailHero
        posterUri={posterUri}
        backdropUri={backdropUri}
        onBack={() => router.back()}
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
        </View>
      </DetailHero>
    </SafeAreaView>
  );
};

export default AnimeHubDetailScreen;
