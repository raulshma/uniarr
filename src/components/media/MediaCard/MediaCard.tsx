import React, { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { Chip, Text, useTheme } from "react-native-paper";

import { Card } from "@/components/common/Card";
import type { AppTheme } from "@/constants/theme";
import { MediaPoster } from "@/components/media/MediaPoster";

export type MediaKind = "series" | "movie";

export type MediaDownloadStatus =
  | "missing"
  | "queued"
  | "downloading"
  | "available"
  | "unknown";

export type MediaCardProps = {
  id: number | string;
  title: string;
  year?: number;
  status?: string;
  subtitle?: string;
  monitored?: boolean;
  downloadStatus?: MediaDownloadStatus;
  posterUri?: string;
  type: MediaKind;
  footer?: React.ReactNode;
  statusBadge?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const downloadStatusConfig: Record<
  MediaDownloadStatus,
  {
    label: string;
    tone: "primary" | "error" | "secondary" | "tertiary" | "outline";
  }
> = {
  available: { label: "Available", tone: "secondary" },
  downloading: { label: "Downloading", tone: "primary" },
  queued: { label: "Queued", tone: "tertiary" },
  missing: { label: "Missing", tone: "error" },
  unknown: { label: "Unknown", tone: "outline" },
};

const MediaCard: React.FC<MediaCardProps> = ({
  title,
  year,
  status,
  subtitle,
  monitored,
  downloadStatus,
  posterUri,
  type,
  footer,
  statusBadge,
  onPress,
  onLongPress,
  style,
  testID,
}) => {
  const theme = useTheme<AppTheme>();

  const secondaryLine = useMemo(() => {
    const meta: string[] = [];
    if (typeof year === "number") {
      meta.push(String(year));
    }
    if (typeof status === "string") {
      meta.push(status);
    }
    if (typeof subtitle === "string") {
      meta.push(subtitle);
    }
    return meta.join(" • ");
  }, [status, subtitle, year]);

  const monitoredChip = useMemo(() => {
    if (monitored === undefined) {
      return null;
    }

    const label = monitored ? "Monitored" : "Not monitored";
    const backgroundColor = monitored
      ? theme.colors.primaryContainer
      : theme.colors.surfaceVariant;
    const textColor = monitored
      ? theme.colors.onPrimaryContainer
      : theme.colors.onSurfaceVariant;

    return (
      <Chip
        compact
        mode="flat"
        style={[styles.chip, { backgroundColor }]}
        textStyle={{ color: textColor }}
      >
        {label}
      </Chip>
    );
  }, [monitored, theme]);

  const downloadChip = useMemo(() => {
    if (!downloadStatus) {
      return null;
    }

    const { label, tone } = downloadStatusConfig[downloadStatus];

    const toneColorMap: Record<
      typeof tone,
      { background: string; text: string; border?: string }
    > = {
      primary: {
        background: theme.colors.primaryContainer,
        text: theme.colors.onPrimaryContainer,
      },
      secondary: {
        background: theme.colors.secondaryContainer,
        text: theme.colors.onSecondaryContainer,
      },
      tertiary: {
        background: theme.colors.tertiaryContainer,
        text: theme.colors.onTertiaryContainer,
      },
      error: {
        background: theme.colors.errorContainer,
        text: theme.colors.onErrorContainer,
      },
      outline: {
        background: theme.colors.surfaceVariant,
        text: theme.colors.onSurfaceVariant,
      },
    };

    const colors = toneColorMap[tone];

    return (
      <Chip
        compact
        mode="flat"
        style={[styles.chip, { backgroundColor: colors.background }]}
        textStyle={{ color: colors.text }}
      >
        {label}
      </Chip>
    );
  }, [downloadStatus, theme]);

  const secondaryText =
    secondaryLine || (type === "series" ? "Series" : "Movie");

  return (
    <Card
      onPress={onPress}
      onLongPress={onLongPress}
      contentPadding="sm"
      style={style}
      testID={testID}
    >
      <View style={styles.root}>
        <MediaPoster
          uri={posterUri}
          size="small"
          borderRadius={12}
          showPlaceholderLabel={true}
          style={{ marginRight: theme.custom.spacing.md }}
        />
        <View style={styles.meta}>
          <Text
            variant="titleMedium"
            numberOfLines={2}
            style={[styles.title, { color: theme.colors.onSurface }]}
          >
            {typeof title === "string" ? title : "Unknown Title"}
          </Text>
          <Text
            variant="bodyMedium"
            numberOfLines={2}
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            {secondaryText}
          </Text>
          <View style={styles.badges}>
            {statusBadge}
            {monitoredChip}
            {downloadChip}
          </View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Card>
  );
};

export default MediaCard;

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  meta: {
    flex: 1,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 8,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  chip: {
    marginRight: 6,
    marginTop: 4,
  },
  footer: {
    marginTop: 12,
  },
});
