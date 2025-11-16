import React, { memo } from "react";
import { StyleSheet, View, Image } from "react-native";
import { Text, Chip } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

interface MediaDetails {
  title: string;
  year?: number;
  overview?: string;
  posterUrl?: string;
  backdropUrl?: string;
  genres?: string[];
  rating?: number;
  runtime?: number;
  cast?: string[];
  director?: string;
  availability?: {
    service: string;
    available: boolean;
    quality?: string;
  }[];
}

type MediaDetailsCardProps = {
  details: MediaDetails;
};

const MediaDetailsCardComponent: React.FC<MediaDetailsCardProps> = ({
  details,
}) => {
  const theme = useTheme();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 12,
      overflow: "hidden",
      marginVertical: 8,
    },
    backdrop: {
      width: "100%",
      height: 150,
      backgroundColor: theme.colors.surface,
    },
    content: {
      padding: 16,
      gap: 12,
    },
    posterRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: -60,
    },
    poster: {
      width: 80,
      height: 120,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
    },
    titleContainer: {
      flex: 1,
      justifyContent: "flex-end",
      paddingBottom: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    year: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    ratingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    ratingContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    ratingText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.onSurface,
    },
    runtime: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    genresContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    overview: {
      fontSize: 14,
      color: theme.colors.onSurface,
      lineHeight: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.onSurfaceVariant,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    castText: {
      fontSize: 14,
      color: theme.colors.onSurface,
      lineHeight: 20,
    },
    availabilityContainer: {
      gap: 8,
    },
    availabilityItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
    },
    availabilityIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    availabilityText: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.onSurface,
    },
    qualityBadge: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.primary,
    },
  });

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      {details.backdropUrl ? (
        <Image
          source={{ uri: details.backdropUrl }}
          style={styles.backdrop}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.backdrop} />
      )}

      <View style={styles.content}>
        {/* Poster and Title */}
        <View style={styles.posterRow}>
          {details.posterUrl ? (
            <Image
              source={{ uri: details.posterUrl }}
              style={styles.poster}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.poster} />
          )}
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={2}>
              {details.title}
            </Text>
            {details.year ? (
              <Text style={styles.year}>{details.year}</Text>
            ) : null}
          </View>
        </View>

        {/* Rating and Runtime */}
        {details.rating || details.runtime ? (
          <View style={styles.ratingRow}>
            {details.rating ? (
              <View style={styles.ratingContainer}>
                <MaterialCommunityIcons
                  name="star"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.ratingText}>
                  {details.rating.toFixed(1)}
                </Text>
              </View>
            ) : null}
            {details.runtime ? (
              <Text style={styles.runtime}>
                • {formatRuntime(details.runtime)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Genres */}
        {details.genres && details.genres.length > 0 ? (
          <View style={styles.genresContainer}>
            {details.genres.map((genre, index) => (
              <Chip
                key={index}
                mode="outlined"
                compact
                style={{ height: 28 }}
                textStyle={{ fontSize: 12 }}
              >
                {genre}
              </Chip>
            ))}
          </View>
        ) : null}

        {/* Overview */}
        {details.overview ? (
          <View>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.overview} numberOfLines={4}>
              {details.overview}
            </Text>
          </View>
        ) : null}

        {/* Cast */}
        {details.cast && details.cast.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Cast</Text>
            <Text style={styles.castText} numberOfLines={2}>
              {details.cast.join(", ")}
            </Text>
          </View>
        ) : null}

        {/* Director */}
        {details.director ? (
          <View>
            <Text style={styles.sectionTitle}>Director</Text>
            <Text style={styles.castText}>{details.director}</Text>
          </View>
        ) : null}

        {/* Availability */}
        {details.availability && details.availability.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Availability</Text>
            <View style={styles.availabilityContainer}>
              {details.availability.map((item, index) => (
                <View key={index} style={styles.availabilityItem}>
                  <View
                    style={[
                      styles.availabilityIcon,
                      {
                        backgroundColor: item.available
                          ? `${theme.colors.primary}20`
                          : `${theme.colors.onSurfaceVariant}20`,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.available ? "check" : "close"}
                      size={14}
                      color={
                        item.available
                          ? theme.colors.primary
                          : theme.colors.onSurfaceVariant
                      }
                    />
                  </View>
                  <Text style={styles.availabilityText}>{item.service}</Text>
                  {item.quality ? (
                    <Text style={styles.qualityBadge}>{item.quality}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export const MediaDetailsCard = memo(MediaDetailsCardComponent);
