import React, { useRef, useMemo } from "react";
import {
  View,
  Animated,
  Pressable,
  StyleSheet,
  ImageBackground,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import type { JellyfinItem } from "@/models/jellyfin.types";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import { WatchStatusBadge } from "@/components/jellyfin/WatchStatusBadge";
import { buildPosterUri } from "app/(auth)/jellyfin/[serviceId]/utils/jellyfinHelpers";

interface JellyfinMasonryGridProps {
  items: JellyfinItem[];
  connector: JellyfinConnector | undefined;
  onOpenItem: (itemId?: string) => void;
  onPlayItem: (item: JellyfinItem, resumeTicks?: number | null) => void;
  onQuickView?: (
    item: JellyfinItem,
    layout: {
      x: number;
      y: number;
      width: number;
      height: number;
      pageX: number;
      pageY: number;
    },
  ) => void;
}

export const JellyfinMasonryGrid: React.FC<JellyfinMasonryGridProps> = ({
  items,
  connector,
  onOpenItem,
  onPlayItem,
  onQuickView,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollY = useRef(new Animated.Value(0)).current;

  const secondColumnTranslateY = scrollY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.2],
  });

  // Split items into two columns with varying heights
  const { leftColumn, rightColumn } = useMemo(() => {
    const left: { item: JellyfinItem; height: number }[] = [];
    const right: { item: JellyfinItem; height: number }[] = [];

    items.forEach((item, index) => {
      // Vary heights between 200-350 for visual interest
      const heights = [200, 250, 300, 220, 280, 320, 240, 260];
      const height = heights[index % heights.length] ?? 250;

      if (index % 2 === 0) {
        left.push({ item, height });
      } else {
        right.push({ item, height });
      }
    });

    return { leftColumn: left, rightColumn: right };
  }, [items]);

  return (
    <Animated.ScrollView
      showsVerticalScrollIndicator={false}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true },
      )}
      scrollEventThrottle={16}
      style={styles.container}
    >
      <View style={styles.gridContainer}>
        {/* First column - normal scroll */}
        <View style={styles.column}>
          {leftColumn.map(({ item, height }, index) => (
            <MasonryItem
              key={`left-${item.Id || index}`}
              item={item}
              height={height}
              connector={connector}
              onOpenItem={onOpenItem}
              onPlayItem={onPlayItem}
              onQuickView={onQuickView}
            />
          ))}
        </View>

        {/* Second column - parallax effect */}
        <Animated.View
          style={[
            styles.column,
            { transform: [{ translateY: secondColumnTranslateY }] },
          ]}
        >
          {rightColumn.map(({ item, height }, index) => (
            <MasonryItem
              key={`right-${item.Id || index}`}
              item={item}
              height={height}
              connector={connector}
              onOpenItem={onOpenItem}
              onPlayItem={onPlayItem}
              onQuickView={onQuickView}
            />
          ))}
        </Animated.View>
      </View>
    </Animated.ScrollView>
  );
};

interface MasonryItemProps {
  item: JellyfinItem;
  height: number;
  connector: JellyfinConnector | undefined;
  onOpenItem: (itemId?: string) => void;
  onPlayItem: (item: JellyfinItem, resumeTicks?: number | null) => void;
  onQuickView?: (
    item: JellyfinItem,
    layout: {
      x: number;
      y: number;
      width: number;
      height: number;
      pageX: number;
      pageY: number;
    },
  ) => void;
}

const MasonryItem: React.FC<MasonryItemProps> = ({
  item,
  height,
  connector,
  onOpenItem,
  onPlayItem,
  onQuickView,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const itemRef = React.useRef<View>(null);

  const posterUri = buildPosterUri(connector, item, 480, undefined);
  const isPlayable =
    item.Type === "Movie" ||
    item.Type === "Episode" ||
    item.Type === "Video" ||
    item.MediaType === "Video";

  const handleLongPress = () => {
    if (onQuickView) {
      itemRef.current?.measure((x, y, width, height, pageX, pageY) => {
        onQuickView(item, { x, y, width, height, pageX, pageY });
      });
    }
  };

  return (
    <Pressable
      ref={itemRef}
      onPress={() => onOpenItem(item.Id)}
      onLongPress={handleLongPress}
      style={styles.itemContainer}
    >
      <ImageBackground
        source={{ uri: posterUri }}
        style={[styles.imageBackground, { height }]}
        imageStyle={styles.imageStyle}
      >
        <WatchStatusBadge
          userData={item.UserData}
          position="top-right"
          showProgressBar={true}
        />

        {isPlayable && (
          <Pressable
            style={styles.playOverlay}
            onPress={(event) => {
              event.stopPropagation?.();
              onPlayItem(item, item.UserData?.PlaybackPositionTicks ?? null);
            }}
          >
            <View style={styles.playButton}>
              <MaterialCommunityIcons
                name="play"
                size={24}
                color={theme.colors.onPrimary}
              />
            </View>
          </Pressable>
        )}

        <LinearGradient
          style={styles.gradient}
          colors={["transparent", "rgba(0, 0, 0, 0.7)"]}
        >
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.Name ?? "Untitled"}
          </Text>
          {item.ProductionYear && (
            <Text style={styles.itemYear}>{item.ProductionYear}</Text>
          )}
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    gridContainer: {
      flexDirection: "row",
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    column: {
      flex: 1,
      paddingHorizontal: spacing.xs,
    },
    itemContainer: {
      marginBottom: spacing.sm,
    },
    imageBackground: {
      width: "100%",
      overflow: "hidden",
      justifyContent: "flex-end",
    },
    imageStyle: {
      borderRadius: 16,
    },
    gradient: {
      padding: spacing.md,
      alignItems: "flex-start",
      justifyContent: "flex-end",
    },
    itemTitle: {
      color: "#FFFFFF",
      fontWeight: "bold",
      fontSize: 16,
    },
    itemYear: {
      color: "rgba(255, 255, 255, 0.8)",
      fontSize: 12,
      marginTop: spacing.xs,
    },
    playOverlay: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: [{ translateX: -22 }, { translateY: -22 }],
      zIndex: 2,
    },
    playButton: {
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: 22,
      padding: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      width: 44,
      height: 44,
    },
  });
