import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  useWindowDimensions,
  Animated,
} from "react-native";
import { Text, useTheme, IconButton } from "react-native-paper";
import { FlashList } from "@shopify/flash-list";
import { useQueries } from "@tanstack/react-query";

import MediaPoster from "@/components/media/MediaPoster/MediaPoster";
import type {
  JellyfinLatestItem,
  JellyfinLibraryView,
} from "@/models/jellyfin.types";
import { queryKeys } from "@/hooks/queryKeys";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { spacing } from "@/theme/spacing";
import type { AppTheme } from "@/constants/theme";
import DownloadButton from "@/components/downloads/DownloadButton";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CategoryType = "movies" | "series" | "anime";

interface CategoryDef {
  type: CategoryType;
  label: string;
  libraryId: string;
}

interface LatestMediaSectionProps {
  serviceId: string;
  libraries: JellyfinLibraryView[];
  onOpenItem: (itemId: string) => void;
}

const STACK_OFFSET = 10;
const STACK_SCALE_STEP = 0.05;
const MAX_STACK_VISIBLE = 3;
const STAGGER_DELAY = 50;

interface AnimatedStackProps {
  category: CategoryDef;
  stackIndex: number;
  dataMap: Record<CategoryType, JellyfinLatestItem[]>;
  posterWidth: number;
  posterHeight: number;
  serviceId: string;
  onExpand: (type: CategoryType) => void;
  styles: ReturnType<typeof createStyles>;
}

const AnimatedStack: React.FC<AnimatedStackProps> = ({
  category,
  stackIndex,
  dataMap,
  posterWidth,
  posterHeight,
  serviceId,
  onExpand,
  styles,
}) => {
  const items = dataMap[category.type] || [];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: stackIndex * STAGGER_DELAY * 2,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: stackIndex * STAGGER_DELAY * 2,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim, stackIndex]);

  if (items.length === 0) return null;

  const stackItems = items.slice(0, MAX_STACK_VISIBLE).reverse();

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <Pressable
        style={[styles.stackContainer, { width: posterWidth }]}
        onPress={() => onExpand(category.type)}
      >
        <Text variant="titleMedium" style={styles.stackLabel}>
          {category.label}
        </Text>
        <View
          style={[
            styles.stackContent,
            {
              width: posterWidth,
              height: posterHeight + MAX_STACK_VISIBLE * STACK_OFFSET,
            },
          ]}
        >
          {stackItems.map((item, index) => {
            const reverseIndex = stackItems.length - 1 - index;
            const scale = 1 - reverseIndex * STACK_SCALE_STEP;
            const translateY = reverseIndex * STACK_OFFSET;
            const opacity = 1 - reverseIndex * 0.2;

            const connector = manager.getConnector(serviceId) as
              | JellyfinConnector
              | undefined;
            const posterUri = connector?.getImageUrl(item.Id!, "Primary", {
              width: 300,
            });

            return (
              <View
                key={item.Id}
                style={[
                  styles.stackCard,
                  {
                    transform: [{ scale }, { translateY }],
                    zIndex: index,
                    opacity,
                    width: posterWidth,
                    height: posterHeight,
                  },
                ]}
              >
                <MediaPoster
                  uri={posterUri}
                  size={posterWidth}
                  borderRadius={12}
                />
              </View>
            );
          })}
        </View>
      </Pressable>
    </Animated.View>
  );
};

interface AnimatedListItemProps {
  item: JellyfinLatestItem;
  index: number;
  serviceId: string;
  onOpenItem: (itemId: string) => void;
  styles: ReturnType<typeof createStyles>;
}

const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  item,
  index,
  serviceId,
  onOpenItem,
  styles,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * STAGGER_DELAY,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: index * STAGGER_DELAY,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const connector = manager.getConnector(serviceId) as
    | JellyfinConnector
    | undefined;
  const posterUri = connector?.getImageUrl(item.Id!, "Primary", {
    width: 300,
  });

  return (
    <Animated.View
      style={[
        styles.listItem,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Pressable onPress={() => onOpenItem(item.Id!)}>
        <MediaPoster uri={posterUri} size={120} borderRadius={12} />
      </Pressable>
      <Text numberOfLines={1} variant="bodySmall" style={styles.itemTitle}>
        {item.Name}
      </Text>
      {connector && (
        <View style={styles.downloadOverlay}>
          <DownloadButton
            serviceConfig={connector.config}
            contentId={item.Id!}
            size="small"
            variant="icon"
            onDownloadStart={() => {}}
            onDownloadError={() => {}}
          />
        </View>
      )}
    </Animated.View>
  );
};

const LatestMediaSection: React.FC<LatestMediaSectionProps> = ({
  serviceId,
  libraries,
  onOpenItem,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width: windowWidth } = useWindowDimensions();
  const [expandedType, setExpandedType] = useState<CategoryType | null>(null);

  // Calculate dynamic poster size based on screen width to fit 3 columns
  // (Screen width - padding - gaps) / 3
  const posterWidth = useMemo(() => {
    const availableWidth = windowWidth - spacing.lg * 2 - spacing.md * 2;
    return Math.floor(availableWidth / 3.8);
  }, [windowWidth]);

  const posterHeight = Math.round(posterWidth * 1.5);

  const categories = useMemo(() => {
    const cats: CategoryDef[] = [];

    // Helper to find library
    const findLib = (
      predicate: (l: JellyfinLibraryView) => boolean,
    ): JellyfinLibraryView | undefined => libraries.find(predicate);

    // Anime - look for name containing "anime"
    const animeLib = findLib(
      (l) => l.Name?.toLowerCase().includes("anime") ?? false,
    );
    if (animeLib) {
      cats.push({ type: "anime", label: "Anime", libraryId: animeLib.Id! });
    }

    // Movies - type 'movies', exclude if used for Anime
    const movieLib = findLib(
      (l) =>
        l.CollectionType === "movies" && (!animeLib || l.Id !== animeLib.Id),
    );
    if (movieLib) {
      cats.push({ type: "movies", label: "Movies", libraryId: movieLib.Id! });
    }

    // Series - type 'tvshows', exclude if used for Anime
    const seriesLib = findLib(
      (l) =>
        l.CollectionType === "tvshows" && (!animeLib || l.Id !== animeLib.Id),
    );
    if (seriesLib) {
      cats.push({ type: "series", label: "Series", libraryId: seriesLib.Id! });
    }

    return cats;
  }, [libraries]);

  const manager = useMemo(() => ConnectorManager.getInstance(), []);

  const queries = useQueries({
    queries: categories.map((cat) => ({
      queryKey: queryKeys.jellyfin.latest(serviceId, cat.libraryId, {
        limit: 10,
      }),
      queryFn: async () => {
        const connector = manager.getConnector(serviceId) as
          | JellyfinConnector
          | undefined;
        if (!connector) return [];
        return connector.getLatestItems(cat.libraryId, 10);
      },
      staleTime: 5 * 60 * 1000,
    })),
  });

  const dataMap = useMemo(() => {
    const map: Record<CategoryType, JellyfinLatestItem[]> = {
      movies: [],
      series: [],
      anime: [],
    };
    categories.forEach((cat, index) => {
      const data = queries[index]?.data ?? [];
      if (data) {
        map[cat.type] = data;
      }
    });
    return map;
  }, [categories, queries]);

  const handleExpand = (type: CategoryType) => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    setExpandedType(type);
  };

  const handleCollapse = () => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    setExpandedType(null);
  };

  const renderExpanded = () => {
    if (!expandedType) return null;
    const category = categories.find((c) => c.type === expandedType);
    if (!category) return null;

    const items = dataMap[expandedType] || [];

    return (
      <View style={styles.expandedContainer}>
        <View style={styles.expandedHeader}>
          <Text variant="titleLarge" style={styles.expandedTitle}>
            {category.label}
          </Text>
          <IconButton icon="close" onPress={handleCollapse} />
        </View>
        <FlashList
          data={items}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          estimatedItemSize={140}
          renderItem={({
            item,
            index,
          }: {
            item: JellyfinLatestItem;
            index: number;
          }) => (
            <AnimatedListItem
              item={item}
              index={index}
              serviceId={serviceId}
              onOpenItem={onOpenItem}
              styles={styles}
            />
          )}
        />
      </View>
    );
  };

  if (categories.length === 0) return null;

  // Check if we have any data
  const hasData = categories.some((c) => (dataMap[c.type]?.length ?? 0) > 0);
  if (!hasData) return null;

  return (
    <View style={styles.container}>
      {!expandedType ? (
        <View>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Recently Added
          </Text>
          <View style={styles.stacksRow}>
            {categories.map((cat, index) => (
              <AnimatedStack
                key={cat.type}
                category={cat}
                stackIndex={index}
                dataMap={dataMap}
                posterWidth={posterWidth}
                posterHeight={posterHeight}
                serviceId={serviceId}
                onExpand={handleExpand}
                styles={styles}
              />
            ))}
          </View>
        </View>
      ) : (
        renderExpanded()
      )}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.none,
    },
    sectionTitle: {
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.md,
      fontWeight: "200",
    },
    stacksRow: {
      flexDirection: "row",
      justifyContent: "space-around", // or flex-start with gap
      paddingHorizontal: spacing.none,
      gap: spacing.md,
    },
    stackContainer: {
      alignItems: "center",
      // width removed, controlled by dynamic style
    },
    stackContent: {
      // height/width removed, controlled by dynamic style
      alignItems: "center",
      justifyContent: "flex-start",
      position: "relative",
      marginTop: spacing.sm,
    },
    stackCard: {
      position: "absolute",
      top: 0,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    stackLabel: {
      fontWeight: "600",
      textAlign: "center",
    },
    expandedContainer: {
      //
    },
    expandedHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    expandedTitle: {
      fontWeight: "600",
    },
    listContent: {
      paddingHorizontal: spacing.lg,
    },
    listItem: {
      marginRight: spacing.md,
      width: 100,
    },
    itemTitle: {
      marginTop: spacing.xs,
      textAlign: "center",
    },
    downloadOverlay: {
      position: "absolute",
      top: 4,
      right: 4,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      borderRadius: 12,
    },
  });

export default LatestMediaSection;
