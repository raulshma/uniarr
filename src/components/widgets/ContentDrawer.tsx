import React from "react";
import { View, StyleSheet, Linking } from "react-native";
import { Text, Button, useTheme, ActivityIndicator } from "react-native-paper";
import BottomDrawer from "@/components/common/BottomDrawer";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useHaptics } from "@/hooks/useHaptics";

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
        {/* Metadata Section */}
        <View
          style={[
            styles.metadataSection,
            { borderBottomColor: theme.colors.outlineVariant },
          ]}
        >
          {metadata.score !== undefined && (
            <View style={styles.metadataRow}>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Score
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.primary, fontWeight: "600" }}
              >
                {metadata.score.toLocaleString()}
              </Text>
            </View>
          )}

          {metadata.author && (
            <View style={styles.metadataRow}>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Author
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurface }}
              >
                {metadata.author}
              </Text>
            </View>
          )}

          {metadata.comments !== undefined && (
            <View style={styles.metadataRow}>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Comments
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurface }}
              >
                {metadata.comments}
              </Text>
            </View>
          )}

          {metadata.date && (
            <View style={styles.metadataRow}>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Date
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurface }}
              >
                {metadata.date}
              </Text>
            </View>
          )}

          {metadata.source && (
            <View style={styles.metadataRow}>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Source
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurface }}
              >
                {metadata.source}
              </Text>
            </View>
          )}
        </View>

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
          <View style={styles.contentSection}>
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurface,
                lineHeight: 22,
              }}
            >
              {content}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyContentContainer}>
            <Text
              variant="bodySmall"
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
              }}
            >
              No content available
            </Text>
          </View>
        )}

        {/* Action Button */}
        <View style={styles.actionButtonContainer}>
          <Button
            mode="contained"
            onPress={handleOpenAction}
            style={{ borderRadius: 8 }}
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
  },
  metadataSection: {
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  metadataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  contentSection: {
    marginVertical: spacing.md,
    paddingVertical: spacing.sm,
  },
  loadingContainer: {
    minHeight: 100,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  emptyContentContainer: {
    minHeight: 60,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  actionButtonContainer: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});

export default ContentDrawer;
