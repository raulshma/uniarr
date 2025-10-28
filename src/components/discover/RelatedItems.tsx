import React, { useMemo, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { Text, useTheme } from "react-native-paper";
import MediaPoster from "@/components/media/MediaPoster/MediaPoster";
import type { DiscoverMediaItem } from "@/models/discover.types";
import { spacing } from "@/theme/spacing";
import { useUnifiedDiscover } from "@/hooks/useUnifiedDiscover";

type Props = {
  currentId: string;
  onPress?: (id: string) => void;
  relatedItems?: DiscoverMediaItem[];
  isLoadingRelated?: boolean;
};

const RelatedItems: React.FC<Props> = ({
  currentId,
  onPress,
  relatedItems,
  isLoadingRelated = false,
}) => {
  const theme = useTheme();
  const { sections } = useUnifiedDiscover();

  const related = useMemo(() => {
    // If real related items are provided, use them (take first 8)
    if (relatedItems && relatedItems.length > 0) {
      return relatedItems.slice(0, 8);
    }

    // Naive related logic: find items from same section or those with same year/mediaType
    const all = sections.flatMap((s) => s.items || []);
    const current = all.find((i) => i.id === currentId);
    if (!current) return [] as DiscoverMediaItem[];

    const candidates = all.filter((i) => i.id !== currentId);
    // Score by same mediaType, then by year closeness
    const scored = candidates
      .map((c) => {
        let score = 0;
        if (c.mediaType === current.mediaType) score += 10;
        if (c.year && current.year)
          score += Math.max(
            0,
            5 - Math.abs((c.year || 0) - (current.year || 0)),
          );
        return { item: c, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((s) => s.item)
      .slice(0, 8);

    return scored;
  }, [sections, currentId, relatedItems]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { marginTop: spacing.lg },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.sm,
        },
        title: { color: theme.colors.onSurface, fontWeight: "700" },
        list: { paddingRight: spacing.md },
        card: { width: 120, marginRight: spacing.md },
        cardTitle: { color: theme.colors.onSurface, marginTop: spacing.xs },
      }),
    [theme],
  );

  const renderItem = useCallback(
    ({ item }: { item: DiscoverMediaItem }) => (
      <Pressable
        onPress={() => onPress?.(item.id)}
        style={styles.card}
        accessibilityRole="button"
      >
        <MediaPoster uri={item.posterUrl} size={120} borderRadius={12} />
        <Text numberOfLines={1} style={styles.cardTitle} variant="bodySmall">
          {item.title}
        </Text>
      </Pressable>
    ),
    [onPress, styles.card, styles.cardTitle],
  );

  if (!related.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>
          Related Items
        </Text>
      </View>
      <FlatList
        horizontal
        data={related}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

export default RelatedItems;
