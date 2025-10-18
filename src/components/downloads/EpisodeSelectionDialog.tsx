import React, { useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import {
  Dialog,
  Button,
  Text,
  Checkbox,
  Chip,
  Divider,
  useTheme,
} from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import type { JellyfinItem } from "@/models/jellyfin.types";

interface EpisodeSelectionDialogProps {
  visible: boolean;
  episodes: JellyfinItem[];
  title: string;
  onConfirm: (selectedEpisodeIds: string[]) => void;
  onDismiss: () => void;
}

/**
 * Dialog for selecting episodes from a TV series for download
 */
const EpisodeSelectionDialog: React.FC<EpisodeSelectionDialogProps> = ({
  visible,
  episodes,
  title,
  onConfirm,
  onDismiss,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedSeasons, setSelectedSeasons] = useState<Set<number>>(
    new Set(),
  );

  // Group episodes by season
  const episodesBySeason = useMemo(() => {
    const grouped: Record<number, JellyfinItem[]> = {};

    episodes.forEach((episode) => {
      const season = episode.ParentIndexNumber ?? 0;
      if (!grouped[season]) {
        grouped[season] = [];
      }
      grouped[season].push(episode);
    });

    // Sort seasons and episodes within each season
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .reduce(
        (acc, season) => {
          const seasonEpisodes = grouped[season];
          if (seasonEpisodes) {
            acc[season] = seasonEpisodes.sort(
              (a, b) => (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0),
            );
          }
          return acc;
        },
        {} as Record<number, JellyfinItem[]>,
      );
  }, [episodes]);

  const seasons = Object.keys(episodesBySeason).map(Number);

  // Handle selecting all episodes in a season
  const handleSelectSeason = (season: number) => {
    const seasonEpisodes = episodesBySeason[season] || [];
    const newSelected = new Set(selectedEpisodeIds);
    const newSeasonSelected = new Set(selectedSeasons);

    if (selectedSeasons.has(season)) {
      // Deselect season
      seasonEpisodes.forEach((ep) => {
        newSelected.delete(ep.Id || "");
      });
      newSeasonSelected.delete(season);
    } else {
      // Select season
      seasonEpisodes.forEach((ep) => {
        newSelected.add(ep.Id || "");
      });
      newSeasonSelected.add(season);
    }

    setSelectedEpisodeIds(newSelected);
    setSelectedSeasons(newSeasonSelected);
  };

  // Handle toggling individual episode
  const handleToggleEpisode = (episodeId: string, season: number) => {
    const newSelected = new Set(selectedEpisodeIds);
    const newSeasonSelected = new Set(selectedSeasons);
    const seasonEpisodes = episodesBySeason[season] || [];

    if (newSelected.has(episodeId)) {
      newSelected.delete(episodeId);
    } else {
      newSelected.add(episodeId);
    }

    // Update season selection state based on individual episodes
    const allSeasonEpisodesSelected = seasonEpisodes.every((ep) =>
      newSelected.has(ep.Id || ""),
    );

    if (allSeasonEpisodesSelected) {
      newSeasonSelected.add(season);
    } else {
      newSeasonSelected.delete(season);
    }

    setSelectedEpisodeIds(newSelected);
    setSelectedSeasons(newSeasonSelected);
  };

  // Handle confirm
  const handleConfirm = () => {
    if (selectedEpisodeIds.size === 0) {
      return;
    }

    onConfirm(Array.from(selectedEpisodeIds));
  };

  const episodeCount = selectedEpisodeIds.size;

  return (
    <Dialog visible={visible} onDismiss={onDismiss}>
      <Dialog.Title>Select Episodes to Download</Dialog.Title>

      <Dialog.ScrollArea>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text variant="bodyMedium" style={styles.seriesTitle}>
            {title}
          </Text>

          {seasons.length === 0 ? (
            <Text variant="bodySmall" style={styles.emptyText}>
              No episodes available
            </Text>
          ) : (
            seasons.map((season: number) => {
              const seasonEpisodes = episodesBySeason[season] || [];
              const selectedInSeason = seasonEpisodes.filter((ep) =>
                selectedEpisodeIds.has(ep.Id || ""),
              ).length;
              const allSelectedInSeason =
                selectedInSeason === seasonEpisodes.length;
              const someSelectedInSeason =
                selectedInSeason > 0 && !allSelectedInSeason;

              return (
                <View key={season}>
                  <Pressable
                    onPress={() => handleSelectSeason(season)}
                    style={styles.seasonHeader}
                  >
                    <Checkbox
                      status={
                        allSelectedInSeason
                          ? "checked"
                          : someSelectedInSeason
                            ? "indeterminate"
                            : "unchecked"
                      }
                      onPress={() => handleSelectSeason(season)}
                    />
                    <Text variant="titleSmall" style={styles.seasonTitle}>
                      Season {season}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={[
                        styles.seasonCount,
                        {
                          color: theme.colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {selectedInSeason}/{seasonEpisodes.length}
                    </Text>
                  </Pressable>

                  {seasonEpisodes.map((episode) => {
                    const isSelected = selectedEpisodeIds.has(episode.Id || "");
                    const episodeNum = episode.IndexNumber ?? 0;
                    const episodeTitle = episode.Name || "Untitled";

                    return (
                      <Pressable
                        key={episode.Id}
                        onPress={() =>
                          handleToggleEpisode(episode.Id || "", season)
                        }
                        style={[
                          styles.episodeItem,
                          isSelected && styles.episodeItemSelected,
                        ]}
                      >
                        <Checkbox
                          status={isSelected ? "checked" : "unchecked"}
                          onPress={() =>
                            handleToggleEpisode(episode.Id || "", season)
                          }
                        />
                        <View style={styles.episodeInfo}>
                          <Text
                            variant="bodyMedium"
                            style={styles.episodeLabel}
                          >
                            E{episodeNum.toString().padStart(2, "0")} -{" "}
                            {episodeTitle}
                          </Text>
                          {episode.RunTimeTicks && (
                            <Text
                              variant="bodySmall"
                              style={[
                                styles.episodeDuration,
                                {
                                  color: theme.colors.onSurfaceVariant,
                                },
                              ]}
                            >
                              {Math.floor(episode.RunTimeTicks / 600_000_000)}{" "}
                              min
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}

                  <Divider style={styles.seasonDivider} />
                </View>
              );
            })
          )}
        </ScrollView>
      </Dialog.ScrollArea>

      <View style={styles.footer}>
        {episodeCount > 0 && (
          <Chip icon="check" style={styles.selectedChip}>
            {episodeCount} episode{episodeCount !== 1 ? "s" : ""} selected
          </Chip>
        )}
      </View>

      <Dialog.Actions>
        <Button onPress={onDismiss}>Cancel</Button>
        <Button
          onPress={handleConfirm}
          disabled={episodeCount === 0}
          mode="contained"
        >
          Download
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    seriesTitle: {
      fontWeight: "600",
      marginBottom: spacing.md,
      color: theme.colors.onSurface,
    },
    emptyText: {
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      paddingVertical: spacing.lg,
    },
    seasonHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      marginVertical: spacing.xs,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
    },
    seasonTitle: {
      flex: 1,
      marginLeft: spacing.sm,
      fontWeight: "600",
      color: theme.colors.onSurface,
    },
    seasonCount: {
      marginRight: spacing.sm,
      fontWeight: "500",
    },
    episodeItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginLeft: spacing.lg,
      borderRadius: 6,
    },
    episodeItemSelected: {
      backgroundColor: theme.colors.primaryContainer,
    },
    episodeInfo: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    episodeLabel: {
      fontWeight: "500",
      color: theme.colors.onSurface,
    },
    episodeDuration: {
      marginTop: spacing.xs / 2,
      fontSize: 12,
    },
    seasonDivider: {
      marginVertical: spacing.md,
    },
    footer: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    selectedChip: {
      marginBottom: spacing.sm,
    },
  });

export default EpisodeSelectionDialog;
