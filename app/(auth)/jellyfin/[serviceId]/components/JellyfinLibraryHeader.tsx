import React, { useMemo } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import {
  Text,
  IconButton,
  Searchbar,
  Chip,
  useTheme,
} from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import type { CollectionSegmentKey } from "../hooks/useJellyfinLibraryState";
import { collectionSegments } from "../hooks/useJellyfinLibraryData";
import type { JellyfinLibraryView } from "@/models/jellyfin.types";

interface JellyfinLibraryHeaderProps {
  serviceName: string;
  activeSegment: CollectionSegmentKey;
  selectedLibraryId: string | null;
  searchTerm: string;
  librariesForActiveSegment: JellyfinLibraryView[];
  onNavigateBack: () => void;
  onOpenSettings: () => void;
  onOpenNowPlaying: () => void;
  onSegmentChange: (segment: CollectionSegmentKey) => void;
  onLibraryChange: (libraryId: string | null) => void;
  onSearchChange: (text: string) => void;
}

export const JellyfinLibraryHeader: React.FC<JellyfinLibraryHeaderProps> = ({
  serviceName,
  activeSegment,
  selectedLibraryId,
  searchTerm,
  librariesForActiveSegment,
  onNavigateBack,
  onOpenSettings,
  onOpenNowPlaying,
  onSegmentChange,
  onLibraryChange,
  onSearchChange,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.headerContainer}>
      <View style={styles.toolbar}>
        <IconButton
          icon="arrow-left"
          accessibilityLabel="Go back"
          onPress={onNavigateBack}
        />
        <View style={styles.toolbarTitleGroup}>
          <Text variant="titleLarge" style={styles.toolbarTitle}>
            Jellyfin Library
          </Text>
          <Text variant="bodySmall" style={styles.toolbarSubtitle}>
            {serviceName}
          </Text>
        </View>
        <View>
          <View style={styles.toolbarActions}>
            <IconButton
              icon="play-circle-outline"
              accessibilityLabel="Open now playing"
              onPress={onOpenNowPlaying}
            />
            <IconButton
              icon="cog"
              accessibilityLabel="Edit service"
              onPress={onOpenSettings}
            />
          </View>
        </View>
      </View>

      {librariesForActiveSegment.length > 1 ? (
        <View>
          <View style={styles.libraryChipsRow}>
            {librariesForActiveSegment.map((library, i) => (
              <Chip
                key={library.Id ?? String(i)}
                mode={selectedLibraryId === library.Id ? "flat" : "outlined"}
                selected={selectedLibraryId === library.Id}
                onPress={() => onLibraryChange(library.Id ?? null)}
                style={styles.libraryChip}
              >
                {library.Name}
              </Chip>
            ))}
          </View>
        </View>
      ) : null}

      <View>
        <Searchbar
          placeholder="Search for movies, shows, or music"
          value={searchTerm}
          onChangeText={onSearchChange}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          accessibilityLabel="Search library"
        />
      </View>

      <View style={styles.segmentRow}>
        {collectionSegments.map((segment) => {
          const isActive = activeSegment === segment.key;
          return (
            <Pressable
              key={segment.key}
              onPress={() => onSegmentChange(segment.key)}
              style={({ pressed }) => [
                styles.segmentItem,
                pressed && styles.segmentPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  isActive && styles.segmentLabelActive,
                ]}
              >
                {segment.label}
              </Text>
              <View
                style={[
                  styles.segmentIndicator,
                  isActive && styles.segmentIndicatorActive,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    headerContainer: {
      gap: spacing.md,
      paddingBottom: spacing.sm,
    },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    toolbarTitleGroup: {
      flex: 1,
      marginHorizontal: spacing.xs,
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg,
      alignItems: "center",
    },
    toolbarTitle: {
      color: theme.colors.onSurface,
      fontWeight: "600",
    },
    toolbarSubtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    toolbarActions: {
      flexDirection: "row",
      alignItems: "center",
    },
    searchBar: {
      borderRadius: 24,
      backgroundColor: theme.colors.surface,
    },
    searchInput: {
      fontSize: 16,
      color: theme.colors.onSurface,
    },
    segmentRow: {
      flexDirection: "row",
      gap: spacing.md,
      alignItems: "center",
    },
    segmentItem: {
      alignItems: "center",
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    segmentPressed: {
      opacity: 0.85,
    },
    segmentLabel: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: "600",
    },
    segmentLabelActive: {
      color: theme.colors.primary,
    },
    segmentIndicator: {
      height: 3,
      width: "100%",
      borderRadius: 3,
      marginTop: spacing.xs,
      backgroundColor: "transparent",
    },
    segmentIndicatorActive: {
      backgroundColor: theme.colors.primary,
    },
    libraryChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    libraryChip: {
      borderRadius: 20,
    },
  });
