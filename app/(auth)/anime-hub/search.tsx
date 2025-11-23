import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, StyleSheet, FlatList, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Text, useTheme, IconButton } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";

import { JikanClient } from "@/services/jikan/JikanClient";
import { AnimeCard } from "@/components/anime";
import MediaCardSkeleton from "@/components/common/SkeletonLoader/MediaCardSkeleton";
import { AnimatedListItem } from "@/components/common/AnimatedComponents";
import { SearchFilterSheet } from "@/components/anime/SearchFilterSheet";
import { spacing } from "@/theme/spacing";
import type { AppTheme } from "@/constants/theme";
import type { JikanAnime, JikanSearchAnimeQuery } from "@/models/jikan.types";

const SearchScreen = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [filters, setFilters] = useState<Partial<JikanSearchAnimeQuery>>({
    sfw: true,
  });

  // Debounce search
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["jikan", "search", debouncedQuery, filters],
    queryFn: async () => {
      if (
        (!debouncedQuery || debouncedQuery.length < 3) &&
        Object.keys(filters).length === 1 &&
        filters.sfw
      )
        return [];

      const searchParams: JikanSearchAnimeQuery = {
        ...filters,
        q: debouncedQuery,
        limit: 20,
      };

      const response = await JikanClient.searchAnime(searchParams);
      return response.data || [];
    },
    enabled: debouncedQuery.length >= 3 || Object.keys(filters).length > 1,
  });

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleClear = useCallback(() => {
    setQuery("");
    inputRef.current?.focus();
  }, []);

  const handleApplyFilters = useCallback(
    (newFilters: Partial<JikanSearchAnimeQuery>) => {
      setFilters(newFilters);
    },
    [],
  );

  const handleCardPress = useCallback(
    (item: JikanAnime) => {
      if (!item.mal_id) return;
      router.push({
        pathname: "/(auth)/anime-hub/[malId]",
        params: { malId: item.mal_id.toString() },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: JikanAnime; index: number }) => {
      const posterUrl =
        item.images?.jpg?.large_image_url ??
        item.images?.jpg?.image_url ??
        undefined;

      return (
        <AnimatedListItem index={index} style={styles.gridItem}>
          <AnimeCard
            id={item.mal_id ?? 0}
            title={item.title_english ?? item.title ?? "Untitled"}
            posterUrl={posterUrl}
            rating={item.score ?? undefined}
            onPress={() => handleCardPress(item)}
            width={160}
          />
        </AnimatedListItem>
      );
    },
    [handleCardPress],
  );

  const activeFilterCount = Object.keys(filters).filter(
    (k) => k !== "sfw" && k !== "q",
  ).length;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={handleBack} size={24} />
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <IconButton icon="magnify" size={20} style={{ margin: 0 }} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: theme.colors.onSurface }]}
            placeholder="Search anime..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <IconButton
              icon="close-circle"
              size={16}
              onPress={handleClear}
              style={{ margin: 0 }}
            />
          )}
        </View>
        <View>
          <IconButton
            icon="filter-variant"
            onPress={() => setFilterSheetVisible(true)}
            iconColor={activeFilterCount > 0 ? theme.colors.primary : undefined}
          />
          {activeFilterCount > 0 && (
            <View
              style={[styles.badge, { backgroundColor: theme.colors.primary }]}
            >
              <Text
                style={[styles.badgeText, { color: theme.colors.onPrimary }]}
              >
                {activeFilterCount}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.grid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={styles.gridItem}>
                  <MediaCardSkeleton size="large" borderRadius={24} />
                </View>
              ))}
            </View>
          </View>
        ) : isError ? (
          <View style={styles.centerContainer}>
            <Text style={{ color: theme.colors.error }}>
              Failed to load results
            </Text>
            <IconButton icon="refresh" onPress={() => refetch()} />
          </View>
        ) : data && data.length > 0 ? (
          <FlatList
            data={data}
            renderItem={renderItem}
            keyExtractor={(item) =>
              item.mal_id?.toString() ?? Math.random().toString()
            }
            numColumns={2}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          />
        ) : debouncedQuery.length >= 3 || activeFilterCount > 0 ? (
          <View style={styles.centerContainer}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              No results found
            </Text>
          </View>
        ) : (
          <View style={styles.centerContainer}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              Type at least 3 characters to search
            </Text>
          </View>
        )}
      </View>

      <SearchFilterSheet
        visible={filterSheetVisible}
        onDismiss={() => setFilterSheetVisible(false)}
        onApply={handleApplyFilters}
        currentFilters={filters}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 24,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: spacing.xs,
    height: "100%",
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  gridItem: {
    width: "48%",
    marginBottom: spacing.sm,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    padding: spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "bold",
  },
});

export default SearchScreen;
