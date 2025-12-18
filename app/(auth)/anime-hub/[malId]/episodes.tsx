import React, { useMemo, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useTheme, IconButton } from "react-native-paper";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { JikanClient } from "@/services/jikan/JikanClient";
import { EmptyState } from "@/components/common/EmptyState";

type AnimeEpisode = {
  mal_id?: number;
  title?: string;
  episode_id?: number;
  duration?: string;
  aired?: string | null;
  filler?: boolean;
  recap?: boolean;
};

const AnimeEpisodesScreen: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const params = useLocalSearchParams<{ malId?: string }>();
  const malId = Number.parseInt(params.malId ?? "", 10);
  const validMalId = Number.isFinite(malId) && malId > 0 ? malId : undefined;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["anime", validMalId, "episodes", "paginated"],
    queryFn: async ({ pageParam = 1 }) => {
      if (!validMalId) throw new Error("Invalid ID");
      return JikanClient.getAnimeEpisodesPaginated(validMalId, pageParam);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.pagination.has_next_page) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: !!validMalId,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.surfaceVariant,
        },
        headerTitle: {
          flex: 1,
          fontWeight: "700",
          marginLeft: spacing.sm,
        },
        listContent: {
          padding: spacing.md,
        },
        episodeItem: {
          marginBottom: spacing.sm,
          padding: spacing.sm,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 8,
        },
        episodeHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.xs,
        },
        episodeTitle: {
          flex: 1,
          fontWeight: "600",
          marginRight: spacing.sm,
        },
        episodeNumber: {
          color: theme.colors.primary,
          fontWeight: "bold",
        },
        metaRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          marginTop: 4,
        },
        metaText: {
          color: theme.colors.onSurfaceVariant,
        },
        badge: {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          backgroundColor: theme.colors.secondaryContainer,
        },
        badgeText: {
          fontSize: 10,
          color: theme.colors.onSecondaryContainer,
          fontWeight: "bold",
        },
        footer: {
          paddingVertical: spacing.md,
          alignItems: "center",
        },
      }),
    [theme],
  );

  const episodes = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) ?? [];
  }, [data]);

  const renderItem = useCallback(
    ({ item }: { item: AnimeEpisode }) => {
      const date = item.aired ? new Date(item.aired).toLocaleDateString() : "";
      return (
        <View style={styles.episodeItem}>
          <View style={styles.episodeHeader}>
            <Text variant="bodyLarge" style={styles.episodeTitle}>
              {item.title || `Episode ${item.episode_id}`}
            </Text>
            <Text variant="labelLarge" style={styles.episodeNumber}>
              #{item.episode_id}
            </Text>
          </View>

          <View style={styles.metaRow}>
            {item.duration ? (
               <Text variant="labelSmall" style={styles.metaText}>
                {item.duration}
              </Text>
            ) : null}
             {date ? (
               <Text variant="labelSmall" style={styles.metaText}>
                {date}
              </Text>
            ) : null}

            {item.filler && (
              <View style={[styles.badge, { backgroundColor: theme.colors.errorContainer }]}>
                <Text style={[styles.badgeText, { color: theme.colors.onErrorContainer }]}>FILLER</Text>
              </View>
            )}
            {item.recap && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>RECAP</Text>
              </View>
            )}
          </View>
        </View>
      );
    },
    [styles, theme],
  );

  const renderFooter = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      );
    }
    return <View style={{ height: spacing.xl }} />;
  }, [isFetchingNextPage, styles.footer, theme.colors.primary]);

  if (!validMalId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => router.back()} />
          <Text variant="titleLarge" style={styles.headerTitle}>
            Episodes
          </Text>
        </View>
        <EmptyState
          title="Invalid Anime"
          description="Could not load episodes for this anime."
          actionLabel="Go Back"
          onActionPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => router.back()} />
        <Text variant="titleLarge" style={styles.headerTitle}>
          All Episodes
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : isError ? (
        <EmptyState
          title="Error loading episodes"
          description="Failed to fetch the episode list."
          actionLabel="Retry"
          onActionPress={() => refetch()}
        />
      ) : (
        <FlashList
          data={episodes}
          renderItem={renderItem}
          estimatedItemSize={80}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={renderFooter}
          keyExtractor={(item: any, index: number) => `${item.mal_id}-${item.episode_id}-${index}`}
        />
      )}
    </SafeAreaView>
  );
};

export default AnimeEpisodesScreen;
