import React from "react";
import { View, StyleSheet, Linking } from "react-native";
import { Text, Button, useTheme } from "react-native-paper";
import { Image } from "expo-image";
import { UniArrLoader } from "@/components/common";
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
  metadata?: ContentMetadata;
  actionUrl?: string;
  actionLabel?: string;
  loading?: boolean;
  maxHeight?: string | number;
  customContent?: React.ReactNode;
  showMetadata?: boolean;
  showActionButton?: boolean;
  imageUrl?: string; // Add image URL prop
}

const ContentDrawer: React.FC<ContentDrawerProps> = ({
  visible,
  onDismiss,
  title,
  content,
  metadata = {},
  actionUrl,
  actionLabel = "Open in Browser",
  loading = false,
  maxHeight = "80%",
  customContent,
  showMetadata = true,
  showActionButton = true,
  imageUrl,
}) => {
  // Calculate max image height based on screen dimensions
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
        {/* Full-Width Image Section */}
        {imageUrl && (
          <View style={styles.fullWidthImageContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.fullWidthArticleImage}
              contentFit="cover"
              placeholder="data:image/svg+xml,%3Csvg %3E%3Crect width='100' height='100' fill='%23e2e8f0'/%3E%3C/svg%3E"
              transition={300}
            />
          </View>
        )}

        {/* Inline Metadata Section */}
        {showMetadata && (metadata.source || metadata.date) && (
          <View style={styles.inlineMetadataSection}>
            {metadata.source && (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {metadata.source}
              </Text>
            )}
            {metadata.date && (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {metadata.date}
              </Text>
            )}
          </View>
        )}

        {/* Extended Metadata Section */}
        {showMetadata &&
          (metadata.score !== undefined ||
            metadata.author ||
            metadata.comments !== undefined) && (
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
                  groupPosition={
                    metadata.score !== undefined ? "middle" : "top"
                  }
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
                  groupPosition={metadata.author ? "bottom" : "single"}
                />
              )}
            </SettingsGroup>
          )}

        {/* Content Section */}
        {customContent ? (
          customContent
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <UniArrLoader size={80} />
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
              style={[styles.contentText, { color: theme.colors.onSurface }]}
              selectable={true}
              allowFontScaling={true}
            >
              {content}
            </Text>
          </View>
        ) : null}

        {/* Action Button */}
        {showActionButton && actionUrl ? (
          <View style={styles.actionButtonContainer}>
            <Button
              mode="contained"
              onPress={handleOpenAction}
              style={{ borderRadius: borderRadius.md }}
            >
              {actionLabel}
            </Button>
          </View>
        ) : null}
      </View>
    </BottomDrawer>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  fullWidthImageContainer: {
    width: "100%",
    height: 200,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    marginHorizontal: spacing.none,
    marginTop: spacing.xs,
  },
  fullWidthArticleImage: {
    width: "100%",
    height: "100%",
  },
  inlineMetadataSection: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  contentSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.2,
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
