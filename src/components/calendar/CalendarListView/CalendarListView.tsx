import React, { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { FlashList } from "@shopify/flash-list";
import type { ListRenderItemInfo } from "@shopify/flash-list";

import type { AppTheme } from "@/constants/theme";
import type { MediaRelease } from "@/models/calendar.types";
import { MediaReleaseCard } from "../MediaReleaseCard";

export type CalendarListViewProps = {
  releases: MediaRelease[];
  onReleasePress?: (releaseId: string) => void;
  style?: StyleProp<ViewStyle>;
};

const CalendarListView: React.FC<CalendarListViewProps> = ({
  releases,
  onReleasePress,
  style,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    content: {
      padding: theme.custom.spacing.md,
    },
    section: {
      marginBottom: theme.custom.spacing.lg,
    },
    sectionTitle: {
      fontSize: theme.custom.typography.titleLarge.fontSize,
      fontFamily: theme.custom.typography.titleLarge.fontFamily,
      fontWeight: theme.custom.typography.titleLarge.fontWeight as any,
      lineHeight: theme.custom.typography.titleLarge.lineHeight,
      letterSpacing: theme.custom.typography.titleLarge.letterSpacing,
      color: theme.colors.onSurface,
      marginBottom: theme.custom.spacing.md,
    },
    releasesList: {
      gap: theme.custom.spacing.sm,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: theme.custom.spacing.xl,
    },
    emptyText: {
      fontSize: theme.custom.typography.bodyLarge.fontSize,
      fontFamily: theme.custom.typography.bodyLarge.fontFamily,
      fontWeight: theme.custom.typography.bodyLarge.fontWeight as any,
      lineHeight: theme.custom.typography.bodyLarge.lineHeight,
      letterSpacing: theme.custom.typography.bodyLarge.letterSpacing,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
    },
  });

  const releasesByDate = useMemo(() => {
    const grouped: { [date: string]: MediaRelease[] } = {};

    releases.forEach((release) => {
      if (!grouped[release.releaseDate]) {
        grouped[release.releaseDate] = [];
      }
      grouped[release.releaseDate]?.push(release);
    });

    // Sort releases within each date by title
    Object.keys(grouped).forEach((date) => {
      grouped[date]?.sort((a, b) => a.title.localeCompare(b.title));
    });

    // Sort dates
    const sortedDates = Object.keys(grouped).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );

    return sortedDates.map((date) => ({
      date,
      releases: grouped[date] || [],
    }));
  }, [releases]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let relativeDate: string;
    if (diffDays === 0) relativeDate = "Today";
    else if (diffDays === 1) relativeDate = "Tomorrow";
    else if (diffDays === -1) relativeDate = "Yesterday";
    else if (diffDays > 0) relativeDate = `In ${diffDays} days`;
    else if (diffDays < 0) relativeDate = `${Math.abs(diffDays)} days ago`;
    else relativeDate = date.toLocaleDateString();

    const fullDate = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    return { relativeDate, fullDate };
  };

  const renderDateSection = ({
    item,
    index,
  }: ListRenderItemInfo<{ date: string; releases: MediaRelease[] }>) => {
    const { relativeDate, fullDate } = formatDate(item.date);

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {relativeDate} • {fullDate}
        </Text>
        <View style={styles.releasesList}>
          {item.releases.map((release) => (
            <MediaReleaseCard
              key={release.id}
              release={release}
              onPress={() => onReleasePress?.(release.id)}
              animated={false}
            />
          ))}
        </View>
      </View>
    );
  };

  if (releases.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.content}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No releases found</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <FlashList
        data={releasesByDate}
        renderItem={renderDateSection}
        keyExtractor={(item) => item.date}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        scrollEventThrottle={16}
      />
    </View>
  );
};

export default CalendarListView;
