import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  FlatList,
  ImageBackground,
} from "react-native";
import {
  Text,
  IconButton,
  useTheme,
  ActivityIndicator,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { useHaptics } from "@/hooks/useHaptics";
import { createCalendarNavigation } from "@/utils/navigation.utils";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import { getComponentElevation } from "@/constants/elevation";
import { CalendarService } from "@/services/calendar/CalendarService";

type UpcomingReleaseItem = {
  id: string;
  title: string;
  type: "movie" | "episode";
  releaseDate: string;
  posterUri?: string;
  show?: string;
  season?: number;
  episode?: number;
  monitored?: boolean;
};

interface CalendarPreviewWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

const CalendarPreviewWidget: React.FC<CalendarPreviewWidgetProps> = ({
  widget,
  onRefresh,
  onEdit,
}) => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const { onPress } = useHaptics();
  const calendarNavigation = createCalendarNavigation();
  const [upcomingReleases, setUpcomingReleases] = useState<
    UpcomingReleaseItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cardWidth = 140;
  const cardHeight = 260;
  const posterHeight = 180;

  const loadUpcomingReleases = useCallback(async () => {
    try {
      // Try to get cached data first
      const cachedData = await widgetService.getWidgetData<
        UpcomingReleaseItem[]
      >(widget.id);
      if (cachedData) {
        setUpcomingReleases(cachedData);
        setLoading(false);
        setError(null);
        // Don't return, continue to fetch fresh data in background
      } else {
        // Only show loading if no cached data
        setLoading(true);
      }

      // Fetch fresh data
      const freshData = await fetchUpcomingReleases();
      setUpcomingReleases(freshData);
      setError(null);

      // Cache the data for 15 minutes
      await widgetService.setWidgetData(widget.id, freshData, 15 * 60 * 1000);
    } catch (err) {
      console.error("Failed to load upcoming releases:", err);
      setError("Failed to load upcoming releases");
    } finally {
      setLoading(false);
    }
  }, [widget.id]);
  useEffect(() => {
    loadUpcomingReleases();
  }, [loadUpcomingReleases]);

  const fetchUpcomingReleases = async (): Promise<UpcomingReleaseItem[]> => {
    try {
      const calendarService = CalendarService.getInstance();

      // Set filters for upcoming releases (next 30 days)
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 30);

      const filters = {
        mediaTypes: ["movie", "episode"] as ["movie", "episode"],
        statuses: ["upcoming"] as ["upcoming"],
        services: [],
        serviceTypes: ["sonarr", "radarr"] as ["sonarr", "radarr"],
        monitoredStatus: "monitored" as const,
        dateRange: {
          start: today.toISOString().split("T")[0]!,
          end: endDate.toISOString().split("T")[0]!,
        },
      };

      const releases = await calendarService.getReleases(filters);

      // Map to our format and limit
      if (releases && releases.length > 0) {
        return releases.slice(0, 8).map((release) => ({
          id: release.id,
          title:
            release.type === "episode"
              ? release.seriesTitle || release.title
              : release.title,
          type: release.type as "movie" | "episode",
          releaseDate: release.releaseDate,
          posterUri: release.posterUrl,
          show: release.type === "episode" ? release.seriesTitle : undefined,
          season: release.seasonNumber,
          episode: release.episodeNumber,
          monitored: release.monitored,
        }));
      }

      return [];
    } catch (error) {
      console.error("Failed to fetch upcoming releases:", error);
      return [];
    }
  };

  const handleItemPress = useCallback(
    (item: UpcomingReleaseItem) => {
      onPress();
      // Navigate to calendar page with the specific date
      // The calendar will automatically focus on the date when it loads
      calendarNavigation.navigateToCalendar(router, item.releaseDate);
    },
    [onPress, router, calendarNavigation],
  );

  const handleRefresh = useCallback(() => {
    onPress();
    loadUpcomingReleases();
  }, [onPress, loadUpcomingReleases]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  };

  const getTimeToRelease = useCallback((dateString: string) => {
    const releaseDate = new Date(dateString);
    const now = new Date();
    const diffMs = releaseDate.getTime() - now.getTime();

    if (diffMs < 0) return "Released";

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays === 0) {
      if (diffHours === 0) {
        if (diffMinutes <= 1) return "In 1 min";
        return `In ${diffMinutes} min`;
      }
      if (diffHours === 1) {
        return remainingMinutes > 0 ? `In 1h ${remainingMinutes}m` : "In 1h";
      }
      return remainingMinutes > 0
        ? `In ${diffHours}h ${remainingMinutes}m`
        : `In ${diffHours}h`;
    }
    if (diffDays === 1) return "Tomorrow";
    if (diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays <= 30) return `In ${Math.floor(diffDays / 7)} weeks`;
    return `In ${Math.floor(diffDays / 30)} months`;
  }, []);

  const getReleaseDisplay = useCallback(
    (dateString: string) => {
      const releaseDate = new Date(dateString);
      const now = new Date();
      const diffMs = releaseDate.getTime() - now.getTime();

      if (diffMs < 0) return formatDate(dateString);

      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      // For releases today, show only the time to release
      if (diffDays === 0) {
        return getTimeToRelease(dateString);
      }

      // For other releases, show the date
      return formatDate(dateString);
    },
    [getTimeToRelease],
  );

  const getCardSubtitle = useCallback((item: UpcomingReleaseItem) => {
    if (item.type === "episode") {
      return `S${item.season}:E${item.episode}`;
    }
    return "Movie";
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
        },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.lg,
        },
        headerTitle: {
          fontSize: 20,
          fontWeight: "700",
          color: theme.colors.onBackground,
          letterSpacing: -0.5,
        },
        actions: {
          flexDirection: "row",
          gap: spacing.xs,
        },
        content: {
          flex: 1,
        },
        cardList: {
          paddingRight: spacing.md,
        },
        card: {
          backgroundColor: theme.colors.surface,
          borderRadius: borderRadius.lg,
          marginRight: spacing.md,
          ...getComponentElevation("widgetCard", theme),
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          overflow: "hidden",
        },
        posterContainer: {
          width: "100%",
          height: posterHeight,
        },
        poster: {
          width: "100%",
          height: "100%",
        },
        posterImage: {
          borderRadius: borderRadius.sm,
        },
        overlay: {
          flex: 1,
          justifyContent: "flex-end",
          padding: spacing.sm,
        },
        dateBadge: {
          backgroundColor: theme.colors.primary,
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.xs,
          alignSelf: "flex-start",
          marginBottom: spacing.sm,
        },
        dateText: {
          fontSize: 11,
          fontWeight: "600",
          color: theme.colors.onPrimary,
        },
        cardContent: {
          padding: spacing.sm,
          flex: 1,
        },
        title: {
          fontSize: 14,
          fontWeight: "600",
          color: theme.colors.onSurface,
          marginBottom: spacing.xs,
        },
        subtitle: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
        },
        emptyState: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: spacing.xl,
        },
        emptyIcon: {
          marginBottom: spacing.md,
        },
        emptyText: {
          fontSize: 16,
          fontWeight: "500",
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
        },
        errorText: {
          fontSize: 14,
          color: theme.colors.error,
          textAlign: "center",
          paddingVertical: spacing.md,
        },
        loadingState: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: spacing.xl,
        },
      }),
    [theme],
  );

  const renderReleaseCard = useCallback(
    ({ item }: { item: UpcomingReleaseItem }) => (
      <TouchableOpacity
        style={[styles.card, { width: cardWidth, height: cardHeight }]}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.posterContainer}>
          <ImageBackground
            source={{ uri: item.posterUri }}
            style={styles.poster}
            imageStyle={styles.posterImage}
          >
            <View style={styles.overlay}>
              <View style={styles.dateBadge}>
                <Text style={styles.dateText}>
                  {getReleaseDisplay(item.releaseDate)}
                </Text>
              </View>
            </View>
          </ImageBackground>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.title} numberOfLines={2}>
            {item.type === "episode" ? item.show : item.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {getCardSubtitle(item)}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [
      cardWidth,
      cardHeight,
      handleItemPress,
      getReleaseDisplay,
      getCardSubtitle,
      styles,
    ],
  );

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Upcoming Releases</Text>
          <View style={styles.actions}>
            <IconButton
              icon="refresh"
              size={20}
              iconColor={theme.colors.primary}
              onPress={handleRefresh}
            />
            {onEdit && (
              <IconButton
                icon="cog"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={onEdit}
              />
            )}
          </View>
        </View>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Upcoming Releases</Text>
        </View>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (upcomingReleases.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Upcoming Releases</Text>
          <View style={styles.actions}>
            <IconButton
              icon="refresh"
              size={20}
              iconColor={theme.colors.primary}
              onPress={handleRefresh}
            />
            {onEdit && (
              <IconButton
                icon="cog"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={onEdit}
              />
            )}
          </View>
        </View>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="calendar-outline"
            size={48}
            color={theme.colors.onSurfaceVariant}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyText}>No upcoming releases</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Upcoming Releases</Text>
        <View style={styles.actions}>
          <IconButton
            icon="refresh"
            size={20}
            iconColor={theme.colors.primary}
            onPress={handleRefresh}
          />
          {onEdit && (
            <IconButton
              icon="cog"
              size={20}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={onEdit}
            />
          )}
        </View>
      </View>

      <View style={styles.content}>
        <FlatList
          data={upcomingReleases}
          renderItem={renderReleaseCard}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardList}
          snapToInterval={cardWidth + spacing.md}
          decelerationRate="fast"
          snapToAlignment="start"
        />
      </View>
    </View>
  );
};

export default CalendarPreviewWidget;
