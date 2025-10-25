import React, { useState, useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  Portal,
  RadioButton,
  Text,
  useTheme,
} from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import type {
  LibraryFilters,
  FilterMetadata,
} from "@/store/libraryFilterStore";
import { spacing } from "@/theme/spacing";

interface LibraryFilterModalProps {
  visible: boolean;
  filters: LibraryFilters;
  metadata?: FilterMetadata;
  onDismiss: () => void;
  onApply: (filters: LibraryFilters) => void;
  onReset: () => void;
}

export const LibraryFilterModal: React.FC<LibraryFilterModalProps> = ({
  visible,
  filters,
  metadata,
  onDismiss,
  onApply,
  onReset,
}) => {
  const theme = useTheme<AppTheme>();

  // Local state to manage filter selections
  const [selectedTags, setSelectedTags] = useState<number[]>(filters.tags);
  const [selectedQualityProfile, setSelectedQualityProfile] = useState<
    number | undefined
  >(filters.qualityProfileId);
  const [selectedMonitored, setSelectedMonitored] = useState<
    boolean | undefined
  >(filters.monitored);

  // Sync local state when filters prop changes
  React.useEffect(() => {
    setSelectedTags(filters.tags);
    setSelectedQualityProfile(filters.qualityProfileId);
    setSelectedMonitored(filters.monitored);
  }, [filters]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        dialog: {
          backgroundColor: theme.colors.surface,
          maxHeight: "90%",
        },
        content: {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        },
        section: {
          marginBottom: spacing.xl,
        },
        sectionTitle: {
          color: theme.colors.onSurface,
          fontWeight: "bold",
          marginBottom: spacing.sm,
        },
        tagChip: {
          marginRight: spacing.sm,
          marginBottom: spacing.sm,
        },
        radioItem: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: spacing.xs,
        },
        radioLabel: {
          flex: 1,
          color: theme.colors.onSurface,
        },
        actions: {
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        },
      }),
    [theme],
  );

  const handleToggleTag = useCallback((tagId: number) => {
    setSelectedTags((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  }, []);

  const handleApply = useCallback(() => {
    onApply({
      tags: selectedTags,
      qualityProfileId: selectedQualityProfile,
      monitored: selectedMonitored,
    });
    onDismiss();
  }, [
    selectedTags,
    selectedQualityProfile,
    selectedMonitored,
    onApply,
    onDismiss,
  ]);

  const handleReset = useCallback(() => {
    setSelectedTags([]);
    setSelectedQualityProfile(undefined);
    setSelectedMonitored(undefined);
    onReset();
  }, [onReset]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Filter Library</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView style={styles.content}>
            {/* Tags Section */}
            {metadata?.tags && metadata.tags.length > 0 && (
              <View style={styles.section}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Tags
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {metadata.tags.map((tag) => (
                    <Chip
                      key={tag.id}
                      selected={selectedTags.includes(tag.id)}
                      onPress={() => handleToggleTag(tag.id)}
                      style={styles.tagChip}
                      mode="flat"
                    >
                      {tag.label}
                    </Chip>
                  ))}
                </View>
              </View>
            )}

            {/* Quality Profile Section */}
            {metadata?.qualityProfiles &&
              metadata.qualityProfiles.length > 0 && (
                <View style={styles.section}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Quality Profile
                  </Text>
                  <RadioButton.Group
                    onValueChange={(value) =>
                      setSelectedQualityProfile(
                        value === "all" ? undefined : Number(value),
                      )
                    }
                    value={selectedQualityProfile?.toString() ?? "all"}
                  >
                    <View style={styles.radioItem}>
                      <RadioButton.Android value="all" />
                      <Text style={styles.radioLabel}>All</Text>
                    </View>
                    {metadata.qualityProfiles.map((profile) => (
                      <View key={profile.id} style={styles.radioItem}>
                        <RadioButton.Android value={profile.id.toString()} />
                        <Text style={styles.radioLabel}>{profile.name}</Text>
                      </View>
                    ))}
                  </RadioButton.Group>
                </View>
              )}

            {/* Monitored Status Section */}
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Monitored Status
              </Text>
              <RadioButton.Group
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedMonitored(undefined);
                  } else if (value === "monitored") {
                    setSelectedMonitored(true);
                  } else {
                    setSelectedMonitored(false);
                  }
                }}
                value={
                  selectedMonitored === undefined
                    ? "all"
                    : selectedMonitored
                      ? "monitored"
                      : "unmonitored"
                }
              >
                <View style={styles.radioItem}>
                  <RadioButton.Android value="all" />
                  <Text style={styles.radioLabel}>All</Text>
                </View>
                <View style={styles.radioItem}>
                  <RadioButton.Android value="monitored" />
                  <Text style={styles.radioLabel}>Monitored Only</Text>
                </View>
                <View style={styles.radioItem}>
                  <RadioButton.Android value="unmonitored" />
                  <Text style={styles.radioLabel}>Unmonitored Only</Text>
                </View>
              </RadioButton.Group>
            </View>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={styles.actions}>
          <Button onPress={handleReset} mode="text">
            Reset
          </Button>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button onPress={onDismiss} mode="text">
              Cancel
            </Button>
            <Button onPress={handleApply} mode="contained">
              Apply
            </Button>
          </View>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};
