import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { Image, ImageBackground } from "expo-image";
import { Text, Button } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import type { DiscoverMediaItem } from "@/models/discover.types";
import { spacing } from "@/theme/spacing";
import { useThumbhash } from "@/hooks/useThumbhash";

const { width, height } = Dimensions.get("window");

interface DiscoverQueueItemProps {
  item: DiscoverMediaItem;
  onAdd: (item: DiscoverMediaItem) => void;
  onDetails?: (item: DiscoverMediaItem) => void;
}

const DiscoverQueueItem: React.FC<DiscoverQueueItemProps> = ({
  item,
  onAdd,
  onDetails,
}) => {
  const styles = StyleSheet.create({
    container: {
      width,
      height,
      justifyContent: "flex-end",
    },
    background: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.3)",
    },
    content: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl * 2,
      paddingTop: 60, // Space for status bar and back button
    },
    posterContainer: {
      alignItems: "center",
      marginBottom: spacing.xl,
      elevation: 8,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    poster: {
      width: width * 0.55,
      height: width * 0.55 * 1.5,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.2)",
    },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: "#FFFFFF",
      textAlign: "center",
      marginBottom: spacing.sm,
      textShadowColor: "rgba(0,0,0,0.8)",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    subtitle: {
      fontSize: 18,
      color: "rgba(255,255,255,0.9)",
      textAlign: "center",
      marginBottom: spacing.md,
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    overview: {
      fontSize: 16,
      color: "rgba(255,255,255,0.95)",
      textAlign: "center",
      lineHeight: 24,
      marginBottom: spacing.xl,
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    buttons: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.lg,
      marginTop: spacing.md,
    },
    button: {
      flex: 1,
      maxWidth: 140,
      borderRadius: 8,
    },
  });

  const backdropUrl = item.backdropUrl || item.posterUrl;
  const posterUrl = item.posterUrl;

  // Use thumbhash hooks for placeholders
  const { thumbhash: backdropThumbhash } = useThumbhash(backdropUrl, {
    autoGenerate: true,
    generateDelay: 100,
  });
  const { thumbhash: posterThumbhash } = useThumbhash(posterUrl, {
    autoGenerate: true,
    generateDelay: 100,
  });

  return (
    <View style={styles.container}>
      {backdropUrl && (
        <ImageBackground
          source={backdropUrl}
          style={styles.background}
          blurRadius={1}
          contentFit="cover"
          cachePolicy="memory-disk"
          placeholder={backdropThumbhash}
          placeholderContentFit="cover"
        >
          <View style={styles.overlay} />
        </ImageBackground>
      )}
      <LinearGradient
        colors={[
          "rgba(0,0,0,0.1)",
          "rgba(0,0,0,0.3)",
          "rgba(0,0,0,0.6)",
          "rgba(0,0,0,0.85)",
        ]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.content}>
        {posterUrl && (
          <View style={styles.posterContainer}>
            <Image
              source={{ uri: posterUrl }}
              style={styles.poster}
              contentFit="cover"
              cachePolicy="memory-disk"
              placeholder={posterThumbhash}
              placeholderContentFit="cover"
            />
          </View>
        )}
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>
          {item.year ? `${item.year}` : ""}
          {item.rating ? ` • ${item.rating.toFixed(1)}/10` : ""}
        </Text>
        {item.overview && (
          <Text style={styles.overview} numberOfLines={4}>
            {item.overview}
          </Text>
        )}
        <View style={styles.buttons}>
          <Button
            mode="contained"
            onPress={() => onAdd(item)}
            style={styles.button}
          >
            Add
          </Button>
          {onDetails && (
            <Button
              mode="outlined"
              onPress={() => onDetails(item)}
              style={styles.button}
            >
              Details
            </Button>
          )}
        </View>
      </View>
    </View>
  );
};

export default DiscoverQueueItem;
