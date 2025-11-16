import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme, IconButton } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";

import { TabHeader } from "@/components/common/TabHeader";

import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRowSkeleton } from "@/components/common/Skeleton";
import {
  AnimatedListItem,
  AnimatedSection,
  AnimatedScrollView,
} from "@/components/common/AnimatedComponents";
// MediaCard intentionally not used here; kept import removed to avoid lint warnings
import {
  useRecentlyAdded,
  type RecentlyAddedItem,
} from "@/hooks/useRecentlyAdded";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import { shouldAnimateLayout } from "@/utils/animations.utils";

const RecentlyAddedScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();

  const { recentlyAdded, isLoading, isError, error, refetch } =
    useRecentlyAdded();
  // MediaCard intentionally not used here; import was removed to avoid lint warnings

  const animationsEnabled = shouldAnimateLayout(isLoading, false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        listContent: {
          flex: 1,
        },
        listContentContainer: {
          paddingHorizontal: spacing.xs,
          paddingBottom: 80,
        },
        mediaItem: {
          backgroundColor: theme.colors.surface,
          marginVertical: spacing.xs,
          borderRadius: borderRadius.xxxl,
        },
        mediaContent: {
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.xs,
        },
        mediaIcon: {
          width: 48,
          height: 48,
          borderRadius: borderRadius.xxxl,
          backgroundColor: theme.colors.surfaceVariant,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing.md,
        },
        mediaInfo: {
          flex: 1,
        },
        mediaTitle: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          lineHeight: theme.custom.typography.titleMedium.lineHeight,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
          marginBottom: spacing.xxs,
        },
        mediaSubtitle: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          lineHeight: theme.custom.typography.bodyMedium.lineHeight,
          letterSpacing: theme.custom.typography.bodyMedium.letterSpacing,
          fontWeight: theme.custom.typography.bodyMedium.fontWeight as any,
        },
        mediaArrow: {
          color: theme.colors.outline,
        },
        emptyContainer: {
          flexGrow: 1,
          paddingTop: spacing.xl,
        },
      }),
    [theme],
  );

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const extractMediaId = useCallback(
    (id: string, type: "series" | "movie"): number => {
      const prefix = type === "series" ? "sonarr-" : "radarr-";
      const mediaId = id.replace(prefix, "");
      return Number(mediaId);
    },
    [],
  );

  const handleMediaPress = useCallback(
    (item: RecentlyAddedItem) => {
      const mediaId = extractMediaId(item.id, item.type);

      // Navigate to detail pages
      switch (item.type) {
        case "series":
          router.push({
            pathname: "/(auth)/sonarr/[serviceId]/series/[id]",
            params: { serviceId: item.serviceId, id: mediaId },
          });
          break;
        case "movie":
          router.push({
            pathname: "/(auth)/radarr/[serviceId]/movies/[id]",
            params: { serviceId: item.serviceId, id: mediaId },
          });
          break;
      }
    },
    [router, extractMediaId],
  );

  const getMediaIcon = (type: "series" | "movie") => {
    return type === "series" ? "television-classic" : "movie-open";
  };

  const renderMediaItem = useCallback(
    ({ item, index }: { item: RecentlyAddedItem; index: number }) => (
      <AnimatedListItem
        index={index}
        totalItems={recentlyAdded.items.length}
        animated={animationsEnabled}
      >
        <Card
          variant="custom"
          style={styles.mediaItem}
          onPress={() => handleMediaPress(item)}
        >
          <View style={styles.mediaContent}>
            <View style={styles.mediaIcon}>
              <IconButton
                icon={getMediaIcon(item.type)}
                size={24}
                iconColor={theme.colors.primary}
              />
            </View>
            <View style={styles.mediaInfo}>
              <Text style={styles.mediaTitle}>{item.title}</Text>
              <Text style={styles.mediaSubtitle}>
                {item.type === "series" ? "TV Series" : "Movie"} • Added{" "}
                {formatRelativeTime(new Date(item.addedDate))} •{" "}
                {item.serviceName}
              </Text>
            </View>
            <IconButton
              icon="chevron-right"
              size={20}
              iconColor={theme.colors.outline}
            />
          </View>
        </Card>
      </AnimatedListItem>
    ),
    [
      handleMediaPress,
      styles,
      theme,
      recentlyAdded.items.length,
      animationsEnabled,
    ],
  );

  const formatRelativeTime = (input: Date): string => {
    const diffMs = Date.now() - input.getTime();
    if (diffMs < 0) {
      return "Just now";
    }

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) {
      return "Just now";
    }
    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);
    if (days < 7) {
      return `${days}d ago`;
    }

    const weeks = Math.floor(days / 7);
    if (weeks < 5) {
      return `${weeks}w ago`;
    }

    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  };

  const listEmptyComponent = useMemo(() => {
    if (isError) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load recently added content.";

      return (
        <EmptyState
          title="Failed to load recently added"
          description={message}
          actionLabel="Retry"
          onActionPress={handleRefresh}
        />
      );
    }

    return (
      <EmptyState
        title="No recently added content"
        description="No movies or TV series have been recently added to your services."
      />
    );
  }, [error, handleRefresh, isError]);

  if (isLoading && recentlyAdded.items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <TabHeader showBackButton={true} onBackPress={() => router.back()} />
        <AnimatedScrollView
          style={styles.listContent}
          contentContainerStyle={styles.listContentContainer}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <AnimatedListItem
              key={index}
              index={index}
              totalItems={6}
              style={{ marginBottom: spacing.sm }}
              animated={animationsEnabled}
            >
              <ListRowSkeleton />
            </AnimatedListItem>
          ))}
        </AnimatedScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <TabHeader showBackButton={true} onBackPress={() => router.back()} />

      <FlashList<RecentlyAddedItem>
        data={recentlyAdded.items}
        keyExtractor={(item: RecentlyAddedItem) => item.id}
        renderItem={({
          item,
          index,
        }: {
          item: RecentlyAddedItem;
          index: number;
        }) => renderMediaItem({ item, index })}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          <AnimatedSection
            style={styles.emptyContainer}
            delay={100}
            animated={animationsEnabled}
          >
            {listEmptyComponent}
          </AnimatedSection>
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
};

export default RecentlyAddedScreen;
