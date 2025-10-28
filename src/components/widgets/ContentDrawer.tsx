import React from "react";
import { View, StyleSheet, Linking } from "react-native";
import { Text, Button, useTheme, ActivityIndicator } from "react-native-paper";
import BottomDrawer from "@/components/common/BottomDrawer";
import SettingsGroup from "@/components/common/SettingsGroup";
import SettingsListItem from "@/components/common/SettingsListItem";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useHaptics } from "@/hooks/useHaptics";
import { borderRadius } from "@/constants/sizes";

export interface ContentMetadata {
  score?: number;
  author?: string;
  date?: string;
  comments?: number;
  source?: string;
}

interface ContentDrawerProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  content?: string;
  metadata: ContentMetadata;
  actionUrl: string;
  actionLabel?: string;
  loading?: boolean;
  maxHeight?: string | number;
}

const ContentDrawer: React.FC<ContentDrawerProps> = ({
  visible,
  onDismiss,
  title,
  content,
  metadata,
  actionUrl,
  actionLabel = "Open in Browser",
  loading = false,
  maxHeight = "80%",
}) => {
  const theme = useTheme<AppTheme>();
  const { onPress } = useHaptics();

  const handleOpenAction = async () => {
    onPress();
    // Validate that the URL is not empty
    if (!actionUrl || actionUrl.trim().length === 0) {
      console.warn("ContentDrawer: Empty action URL");
      return;
    }
    try {
      await Linking.openURL(actionUrl);
    } catch (error) {
      console.warn("Failed to open URL", error);
    }
  };

  return (
    <BottomDrawer
      visible={visible}
      onDismiss={onDismiss}
      title={title}
      maxHeight={maxHeight}
      closeOnBackdropPress={true}
    >
      <View style={styles.contentContainer}>
        {/* Metadata Section - Using SettingsGroup and SettingsListItem */}
        {(metadata.score !== undefined ||
          metadata.author ||
          metadata.comments !== undefined ||
          metadata.date ||
          metadata.source) && (
          <SettingsGroup>
            {metadata.score !== undefined && (
              <SettingsListItem
                title="Score"
                trailing={
                  <Text
                    style={{ color: theme.colors.primary, fontWeight: "600" }}
                  >
                    {metadata.score.toLocaleString()}
                  </Text>
                }
                groupPosition={metadata.author ? "top" : "single"}
              />
            )}

            {metadata.author && (
              <SettingsListItem
                title="Author"
                trailing={
                  <Text style={{ color: theme.colors.onSurface }}>
                    {metadata.author}
                  </Text>
                }
                groupPosition={metadata.score !== undefined ? "middle" : "top"}
              />
            )}

            {metadata.comments !== undefined && (
              <SettingsListItem
                title="Comments"
                trailing={
                  <Text style={{ color: theme.colors.onSurface }}>
                    {metadata.comments}
                  </Text>
                }
                groupPosition={metadata.author ? "middle" : "top"}
              />
            )}

            {metadata.date && (
              <SettingsListItem
                title="Date"
                trailing={
                  <Text style={{ color: theme.colors.onSurface }}>
                    {metadata.date}
                  </Text>
                }
                groupPosition={
                  metadata.author || metadata.comments !== undefined
                    ? "middle"
                    : "top"
                }
              />
            )}

            {metadata.source && (
              <SettingsListItem
                title="Source"
                trailing={
                  <Text style={{ color: theme.colors.onSurface }}>
                    {metadata.source}
                  </Text>
                }
                groupPosition="bottom"
              />
            )}
          </SettingsGroup>
        )}

        {/* Content Section */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text
              variant="bodySmall"
              style={{
                marginTop: spacing.md,
                color: theme.colors.onSurfaceVariant,
              }}
            >
              Loading content...
            </Text>
          </View>
        ) : content ? (
          <View
            style={[
              styles.contentSection,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <Text
              style={{
                color: theme.colors.onSurface,
                lineHeight: 22,
              }}
            >
              {content}
            </Text>
          </View>
        ) : null}

        {/* Action Button */}
        <View style={styles.actionButtonContainer}>
          <Button
            mode="contained"
            onPress={handleOpenAction}
            style={{ borderRadius: borderRadius.md }}
          >
            {actionLabel}
          </Button>
        </View>
      </View>
    </BottomDrawer>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  contentSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
  },
  loadingContainer: {
    minHeight: 100,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  actionButtonContainer: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
});

export default ContentDrawer;
