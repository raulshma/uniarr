import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ScrollView, View, StyleSheet, Linking } from "react-native";
import {
  Button,
  Card,
  Chip,
  Text,
  useTheme,
  ActivityIndicator,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { MediaPoster } from "@/components/media/MediaPoster";
import { EmptyState } from "@/components/common/EmptyState";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useJellyseerrMediaDetails } from "@/hooks/useJellyseerrMediaDetails";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";

const JellyseerrMediaDetailScreen: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    serviceId: rawServiceId,
    mediaType: rawMediaType,
    mediaId: rawMediaId,
  } = useLocalSearchParams<{
    serviceId?: string;
    mediaType?: string;
    mediaId?: string;
  }>();

  const serviceId = typeof rawServiceId === "string" ? rawServiceId : "";
  const mediaType =
    rawMediaType === "movie" || rawMediaType === "tv"
      ? rawMediaType
      : undefined;
  const mediaId = Number.parseInt(
    typeof rawMediaId === "string" ? rawMediaId : "",
    10
  );

  const { data, isLoading, isError, refetch } = useJellyseerrMediaDetails(
    serviceId,
    mediaType ?? "movie",
    mediaId
  );

  const connector = useMemo(() => {
    const c = ConnectorManager.getInstance().getConnector(serviceId) as
      | JellyseerrConnector
      | undefined;
    return c && c.config.type === "jellyseerr" ? c : undefined;
  }, [serviceId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        container: {
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: spacing.lg,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.md,
        },
        posterContainer: {
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        titleContainer: {
          alignItems: "center",
          marginBottom: spacing.md,
        },
        card: {
          backgroundColor: theme.colors.elevation.level1,
          borderRadius: 12,
          marginBottom: spacing.lg,
        },
        cardContent: {
          padding: spacing.md,
        },
        detailRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.sm,
        },
        label: {
          color: theme.colors.onSurfaceVariant,
        },
        value: {
          color: theme.colors.onSurface,
          fontWeight: "600",
        },
        genresContainer: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.xs,
          marginTop: spacing.sm,
        },
        buttonsContainer: {
          flexDirection: "row",
          gap: spacing.sm,
          marginTop: spacing.lg,
        },
      }),
    [theme, insets]
  );

  const openInJellyseerr = async () => {
    if (!connector || !mediaType || !mediaId) return;
    const path = connector.getMediaDetailUrl(mediaId, mediaType);
    const base = connector.config.url.replace(/\/$/, "");
    await Linking.openURL(`${base}${path}`);
  };

  const openExternalUrl = async () => {
    if (data?.externalUrl) {
      await Linking.openURL(data.externalUrl);
    }
  };

  if (!serviceId || !mediaType || !Number.isFinite(mediaId)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <EmptyState
            title="Invalid media reference"
            description="Missing or invalid service, media type, or media id."
            actionLabel="Go back"
            onActionPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { justifyContent: "center" }]}>
          <ActivityIndicator animating />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <EmptyState
            title="Failed to load media"
            description="We couldn't load details from Jellyseerr."
            actionLabel="Retry"
            onActionPress={() => void refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Animated.View
          style={styles.header}
          entering={FadeInDown.delay(200).springify()}
        >
          <Button mode="text" onPress={() => router.back()}>
            Back
          </Button>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        >
          {/* Poster */}
          <Animated.View
            style={styles.posterContainer}
            entering={FadeIn.delay(400)}
          >
            <MediaPoster uri={data.posterUrl} size="large" borderRadius={12} />
          </Animated.View>

          {/* Title and Basic Info */}
          <Animated.View
            style={styles.titleContainer}
            entering={FadeIn.delay(500)}
          >
            <Text
              variant="headlineLarge"
              style={{
                color: theme.colors.onSurface,
                fontWeight: "bold",
                textAlign: "center",
              }}
            >
              {data.title ?? "Unknown Title"}
            </Text>
            {data.originalTitle && data.originalTitle !== data.title ? (
              <Text
                variant="titleMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: "center",
                }}
              >
                {data.originalTitle}
              </Text>
            ) : null}
            {data.tagline ? (
              <Text
                variant="bodyLarge"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: "center",
                  fontStyle: "italic",
                  marginTop: spacing.xs,
                }}
              >
                "{data.tagline}"
              </Text>
            ) : null}
          </Animated.View>

          {/* Overview */}
          {data.overview ? (
            <Animated.View entering={FadeIn.delay(600)}>
              <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  <Text
                    variant="bodyLarge"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      lineHeight: 24,
                    }}
                  >
                    {data.overview}
                  </Text>
                </Card.Content>
              </Card>
            </Animated.View>
          ) : null}

          {/* Media Details */}
          <Animated.View entering={FadeIn.delay(700)}>
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.detailRow}>
                  <Text variant="labelMedium" style={styles.label}>
                    Type
                  </Text>
                  <Text variant="bodyLarge" style={styles.value}>
                    {mediaType === "movie" ? "Movie" : "TV Series"}
                  </Text>
                </View>
                {data.releaseDate ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Release Date
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {new Date(data.releaseDate).getFullYear()}
                    </Text>
                  </View>
                ) : data.firstAirDate ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      First Air Date
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {new Date(data.firstAirDate).getFullYear()}
                    </Text>
                  </View>
                ) : null}
                {data.runtime ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Runtime
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {data.runtime} min
                    </Text>
                  </View>
                ) : null}
                {data.rating ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Rating
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {data.rating.toFixed(1)}/10
                    </Text>
                  </View>
                ) : null}
                {data.voteCount ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Votes
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {data.voteCount.toLocaleString()}
                    </Text>
                  </View>
                ) : null}
                {data.popularity ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Popularity
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {data.popularity.toFixed(1)}
                    </Text>
                  </View>
                ) : null}
                {data.network ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Network
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {data.network}
                    </Text>
                  </View>
                ) : null}
                {data.certification ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Certification
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {data.certification}
                    </Text>
                  </View>
                ) : null}
                {data.status ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Status
                    </Text>
                    <Chip
                      mode="flat"
                      style={{ backgroundColor: theme.colors.primaryContainer }}
                    >
                      {data.status}
                    </Chip>
                  </View>
                ) : null}
                {data.studios?.length ? (
                  <View style={styles.detailRow}>
                    <Text variant="labelMedium" style={styles.label}>
                      Studios
                    </Text>
                    <Text variant="bodyLarge" style={styles.value}>
                      {data.studios.join(", ")}
                    </Text>
                  </View>
                ) : null}
              </Card.Content>
            </Card>
          </Animated.View>

          {/* Genres */}
          {data.genres?.length ? (
            <Animated.View entering={FadeIn.delay(800)}>
              <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  <Text
                    variant="titleMedium"
                    style={{
                      color: theme.colors.onSurface,
                      marginBottom: spacing.sm,
                    }}
                  >
                    Genres
                  </Text>
                  <View style={styles.genresContainer}>
                    {data.genres.map((genre) => (
                      <Chip
                        key={genre}
                        mode="outlined"
                        style={{ borderColor: theme.colors.outline }}
                      >
                        {genre}
                      </Chip>
                    ))}
                  </View>
                </Card.Content>
              </Card>
            </Animated.View>
          ) : null}

          {/* Alternate Titles */}
          {data.alternateTitles?.length ? (
            <Animated.View entering={FadeIn.delay(900)}>
              <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  <Text
                    variant="titleMedium"
                    style={{
                      color: theme.colors.onSurface,
                      marginBottom: spacing.sm,
                    }}
                  >
                    Also Known As
                  </Text>
                  {data.alternateTitles.map((title, index) => (
                    <Text
                      key={index}
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {title}
                    </Text>
                  ))}
                </Card.Content>
              </Card>
            </Animated.View>
          ) : null}

          {/* Seasons for TV */}
          {mediaType === "tv" && data.seasons?.length ? (
            <Animated.View entering={FadeIn.delay(1000)}>
              <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  <Text
                    variant="titleMedium"
                    style={{
                      color: theme.colors.onSurface,
                      marginBottom: spacing.sm,
                    }}
                  >
                    Seasons
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {data.seasons.length} season
                    {data.seasons.length !== 1 ? "s" : ""}
                  </Text>
                </Card.Content>
              </Card>
            </Animated.View>
          ) : null}

          {/* Action Buttons */}
          <Animated.View
            style={styles.buttonsContainer}
            entering={FadeIn.delay(1100)}
          >
            <Button
              mode="contained"
              onPress={openInJellyseerr}
              style={{ flex: 1 }}
            >
              Open in Jellyseerr
            </Button>
            {data.externalUrl ? (
              <Button
                mode="outlined"
                onPress={openExternalUrl}
                style={{ flex: 1 }}
              >
                External Link
              </Button>
            ) : null}
          </Animated.View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default JellyseerrMediaDetailScreen;
