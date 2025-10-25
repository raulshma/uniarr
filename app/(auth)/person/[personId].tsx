import { useMemo } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useTheme, Card, Chip, Appbar } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { AppTheme } from "@/constants/theme";
import { usePersonDetails } from "@/hooks/tmdb/usePersonDetails";
import { buildProfileUrl, buildPosterUrl } from "@/utils/tmdb.utils";
import MediaPoster from "@/components/media/MediaPoster/MediaPoster";
import { AnimatedListItem } from "@/components/common/AnimatedComponents";
import { spacing } from "@/theme/spacing";
import { useTmdbKey } from "@/hooks/useTmdbKey";

const PersonDetails = () => {
  const params = useLocalSearchParams<{ personId?: string }>();
  const personId = params.personId ? parseInt(params.personId, 10) : null;
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const { apiKey: tmdbKey, isLoading: isKeyLoading } = useTmdbKey();

  const personQuery = usePersonDetails(personId, {
    enabled: Boolean(personId && tmdbKey),
    includeCredits: true,
    includeImages: true,
    includeExternalIds: true,
  });

  const person = personQuery.data;

  // Process credits for display - move these hooks before conditional returns
  const processedMovieCredits = useMemo(() => {
    if (!person?.movieCredits?.cast) return [];
    const uniqueCredits = person.movieCredits.cast
      .filter((credit) => credit.release_date)
      .reduce(
        (acc, credit) => {
          if (!acc.some((c) => c.id === credit.id)) {
            acc.push(credit);
          }
          return acc;
        },
        [] as typeof person.movieCredits.cast,
      )
      .sort((a, b) => {
        const dateA = new Date(a.release_date!).getTime();
        const dateB = new Date(b.release_date!).getTime();
        return dateB - dateA; // Most recent first
      })
      .slice(0, 20); // Limit to 20 most recent
    return uniqueCredits;
  }, [person]);

  const processedTvCredits = useMemo(() => {
    if (!person?.tvCredits?.cast) return [];
    const uniqueCredits = person.tvCredits.cast
      .filter((credit) => credit.first_air_date)
      .reduce(
        (acc, credit) => {
          if (!acc.some((c) => c.id === credit.id)) {
            acc.push(credit);
          }
          return acc;
        },
        [] as typeof person.tvCredits.cast,
      )
      .sort((a, b) => {
        const dateA = new Date(a.first_air_date!).getTime();
        const dateB = new Date(b.first_air_date!).getTime();
        return dateB - dateA; // Most recent first
      })
      .slice(0, 20); // Limit to 20 most recent
    return uniqueCredits;
  }, [person]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Exclude top inset on the SafeAreaView so the Appbar sits flush under the
        // status bar. The Appbar component already accounts for appropriate heights.
        safeArea: { flex: 1, backgroundColor: theme.colors.background },
        header: {
          backgroundColor: theme.colors.surface,
        },
        headerTitle: {
          fontSize: 16,
          fontWeight: "600",
        },
        content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
        profileHeader: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: spacing.lg,
          marginBottom: spacing.xl,
        },
        profileContainer: {
          alignItems: "center",
          paddingTop: spacing.md,
        },
        profileImage: {
          width: 120,
          height: 120,
          borderRadius: 60,
          marginBottom: spacing.md,
        },
        infoContainer: {
          flex: 1,
        },
        name: {
          color: theme.colors.onSurface,
          fontWeight: "700",
          marginBottom: spacing.xs,
        },
        department: {
          color: theme.colors.onSurfaceVariant,
          fontStyle: "italic",
          marginBottom: spacing.sm,
        },
        biography: {
          color: theme.colors.onSurfaceVariant,
          lineHeight: 22,
          marginBottom: spacing.lg,
        },
        sectionTitle: {
          color: theme.colors.onSurface,
          fontWeight: "600",
          marginBottom: spacing.md,
          fontSize: 18,
        },
        creditsSection: {
          marginBottom: spacing.xl,
        },
        creditRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: spacing.sm,
          gap: spacing.md,
        },
        creditPoster: {
          width: 60,
          height: 90,
          borderRadius: 8,
        },
        creditInfo: {
          flex: 1,
        },
        creditTitle: {
          color: theme.colors.onSurface,
          fontWeight: "500",
          marginBottom: spacing.xs,
        },
        creditRole: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 14,
        },
        creditYear: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 14,
          fontStyle: "italic",
        },
        emptyState: {
          alignItems: "center",
          paddingVertical: spacing.xl,
        },
        chip: {
          marginRight: spacing.sm,
          marginBottom: spacing.sm,
        },
        detailsCard: {
          padding: spacing.md,
          marginBottom: spacing.lg,
        },
        detailRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: spacing.xs,
        },
        detailLabel: {
          color: theme.colors.onSurfaceVariant,
          fontWeight: "500",
        },
        detailValue: {
          color: theme.colors.onSurface,
          flex: 1,
          textAlign: "right",
        },
        loadingContainer: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        },
      }),
    [theme],
  );

  if (!tmdbKey) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="key-outline"
            size={48}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="titleMedium"
            style={{
              color: theme.colors.onSurfaceVariant,
              marginTop: spacing.md,
              textAlign: "center",
            }}
          >
            TMDB API key required
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              color: theme.colors.onSurfaceVariant,
              marginTop: spacing.sm,
              textAlign: "center",
              paddingHorizontal: spacing.lg,
            }}
          >
            Configure your TMDB API key in settings to view actor details.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isKeyLoading || personQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Loading actor details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (personQuery.isError || !person) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="account-off-outline"
            size={48}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="titleMedium"
            style={{
              color: theme.colors.onSurfaceVariant,
              marginTop: spacing.md,
              textAlign: "center",
            }}
          >
            Actor not found
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              color: theme.colors.onSurfaceVariant,
              marginTop: spacing.sm,
              textAlign: "center",
              paddingHorizontal: spacing.lg,
            }}
          >
            {personQuery.error?.message || "Unable to load actor details."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { details } = person;

  const handleMediaPress = (mediaType: "movie" | "tv", id: number) => {
    router.push(`/(auth)/discover/tmdb/${mediaType}/${id}`);
  };

  const formatBirthday = (date?: string | null): string => {
    if (!date) return "Unknown";
    try {
      const d = new Date(date);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return date;
    }
  };

  const getAge = (
    birthday?: string | null,
    deathday?: string | null,
  ): number | null => {
    if (!birthday) return null;
    try {
      const birth = new Date(birthday);
      const death = deathday ? new Date(deathday) : new Date();
      const age = death.getFullYear() - birth.getFullYear();
      const monthDiff = death.getMonth() - birth.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && death.getDate() < birth.getDate())
      ) {
        return age - 1;
      }
      return age;
    } catch {
      return null;
    }
  };

  const getGenderText = (gender?: number | null) => {
    switch (gender) {
      case 1:
        return "Female";
      case 2:
        return "Male";
      case 0:
      default:
        return "Unknown";
    }
  };

  return (
    // Exclude the top edge so we don't get an extra spacer under the status bar.
    // The edges prop is handled by react-native-safe-area-context.
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <Appbar.Header mode="small" elevated={false} style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content
          title={details.name || "Actor Details"}
          titleStyle={styles.headerTitle}
        />
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header with profile image and basic info */}
        <View style={styles.profileHeader}>
          <View style={styles.profileContainer}>
            <MediaPoster
              uri={buildProfileUrl(details.profile_path)}
              size={120}
              aspectRatio={1}
              borderRadius={60}
              style={styles.profileImage}
            />
          </View>
          <View style={styles.infoContainer}>
            <Text variant="headlineLarge" style={styles.name}>
              {details.name || "Unknown Actor"}
            </Text>
            {details.known_for_department && (
              <Text variant="titleMedium" style={styles.department}>
                {details.known_for_department}
              </Text>
            )}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                marginTop: spacing.sm,
              }}
            >
              {details.birthday && (
                <Chip mode="outlined" style={styles.chip}>
                  Born {formatBirthday(details.birthday as string | null)}
                </Chip>
              )}
              {(details.deathday as string | null | undefined) && (
                <Chip mode="outlined" style={styles.chip}>
                  Died {formatBirthday(details.deathday as string | null)}
                </Chip>
              )}
              {details.place_of_birth && (
                <Chip mode="outlined" style={styles.chip}>
                  {details.place_of_birth}
                </Chip>
              )}
            </View>
          </View>
        </View>

        {/* Biography */}
        {details.biography && (
          <View>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Biography
            </Text>
            <Text variant="bodyLarge" style={styles.biography}>
              {details.biography}
            </Text>
          </View>
        )}

        {/* Personal Details */}
        <Card style={styles.detailsCard}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Personal Details
          </Text>
          {details.birthday && (
            <View style={styles.detailRow}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                Age
              </Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {getAge(
                  details.birthday as string | null,
                  details.deathday as string | null | undefined,
                )}{" "}
                years
              </Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text variant="bodyMedium" style={styles.detailLabel}>
              Gender
            </Text>
            <Text variant="bodyMedium" style={styles.detailValue}>
              {getGenderText(details.gender)}
            </Text>
          </View>
          {details.popularity && (
            <View style={styles.detailRow}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                Popularity
              </Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {details.popularity.toFixed(1)}
              </Text>
            </View>
          )}
          {person.externalIds?.imdb_id && (
            <View style={styles.detailRow}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                IMDb ID
              </Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {person.externalIds.imdb_id}
              </Text>
            </View>
          )}
        </Card>

        {/* Movie Credits */}
        {processedMovieCredits.length > 0 && (
          <View style={styles.creditsSection}>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Movies
            </Text>
            {processedMovieCredits.map((credit, index) => (
              <AnimatedListItem key={`movie-${credit.id}`} index={index}>
                <Pressable
                  onPress={() => handleMediaPress("movie", credit.id)}
                  style={styles.creditRow}
                >
                  <MediaPoster
                    uri={buildPosterUrl(credit.poster_path)}
                    size={60}
                    aspectRatio={2 / 3}
                    borderRadius={8}
                    style={styles.creditPoster}
                  />
                  <View style={styles.creditInfo}>
                    <Text variant="bodyLarge" style={styles.creditTitle}>
                      {credit.title || "Unknown Movie"}
                    </Text>
                    <Text variant="bodyMedium" style={styles.creditRole}>
                      {credit.character || "Actor"}
                    </Text>
                    <Text variant="bodySmall" style={styles.creditYear}>
                      {new Date(credit.release_date!).getFullYear()}
                    </Text>
                  </View>
                </Pressable>
              </AnimatedListItem>
            ))}
          </View>
        )}

        {/* TV Credits */}
        {processedTvCredits.length > 0 && (
          <View style={styles.creditsSection}>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              TV Shows
            </Text>
            {processedTvCredits.map((credit, index) => (
              <AnimatedListItem key={`tv-${credit.id}`} index={index}>
                <Pressable
                  onPress={() => handleMediaPress("tv", credit.id)}
                  style={styles.creditRow}
                >
                  <MediaPoster
                    uri={buildPosterUrl(credit.poster_path)}
                    size={60}
                    aspectRatio={2 / 3}
                    borderRadius={8}
                    style={styles.creditPoster}
                  />
                  <View style={styles.creditInfo}>
                    <Text variant="bodyLarge" style={styles.creditTitle}>
                      {credit.name || "Unknown TV Show"}
                    </Text>
                    <Text variant="bodyMedium" style={styles.creditRole}>
                      {credit.character || "Actor"}
                    </Text>
                    <Text variant="bodySmall" style={styles.creditYear}>
                      {new Date(credit.first_air_date!).getFullYear()}
                      {credit.episode_count &&
                        ` (${credit.episode_count} episodes)`}
                    </Text>
                  </View>
                </Pressable>
              </AnimatedListItem>
            ))}
          </View>
        )}

        {/* Empty state if no credits */}
        {processedMovieCredits.length === 0 &&
          processedTvCredits.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="filmstrip-off"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="titleMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginTop: spacing.md,
                }}
              >
                No filmography available
              </Text>
            </View>
          )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default PersonDetails;
