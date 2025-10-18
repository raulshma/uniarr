import React, { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View, Pressable } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import { MediaPoster } from "@/components/media/MediaPoster";

export type MovieListItemProps = {
  id: number | string;
  title: string;
  year?: number;
  runtime?: number;
  sizeOnDisk?: number;
  status?: string;
  subtitle?: string;
  monitored?: boolean;
  downloadStatus?:
    | "missing"
    | "queued"
    | "downloading"
    | "available"
    | "unknown";
  posterUri?: string;
  genres?: string[];
  studio?: string;
  statistics?: {
    percentAvailable?: number;
    sizeOnDisk?: number;
  };
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const formatRuntime = (runtime?: number): string | undefined => {
  if (!runtime) {
    return undefined;
  }

  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;

  return hours > 0
    ? `${hours}h ${minutes.toString().padStart(2, "0")}m`
    : `${minutes}m`;
};

const formatByteSize = (bytes?: number): string | undefined => {
  if (bytes === undefined || bytes === null) {
    return undefined;
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const precision = index === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[index]}`;
};

const getStatusIndicator = (
  downloadStatus?: string,
  percentAvailable?: number,
  hasFile?: boolean,
) => {
  if (hasFile && percentAvailable === 100) {
    return "available";
  }

  if (percentAvailable && percentAvailable > 0 && percentAvailable < 100) {
    return "downloading";
  }

  if (downloadStatus === "downloading" || downloadStatus === "queued") {
    return "downloading";
  }

  if (downloadStatus === "missing") {
    return "missing";
  }

  return "unknown";
};

const MovieListItem: React.FC<MovieListItemProps> = ({
  title,
  year,
  runtime,
  sizeOnDisk,
  status,
  subtitle,
  monitored,
  downloadStatus,
  posterUri,
  genres,
  studio,
  statistics,
  onPress,
  style,
  testID,
}) => {
  const theme = useTheme<AppTheme>();

  const formattedRuntime = useMemo(() => formatRuntime(runtime), [runtime]);
  const formattedSize = useMemo(
    () => formatByteSize(sizeOnDisk || statistics?.sizeOnDisk),
    [sizeOnDisk, statistics?.sizeOnDisk],
  );
  const percentAvailable = statistics?.percentAvailable;

  const metadataParts: string[] = [];

  if (formattedRuntime) {
    metadataParts.push(formattedRuntime);
  }

  if (formattedSize) {
    metadataParts.push(formattedSize);
  }

  if (genres && Array.isArray(genres) && genres.length > 0) {
    const validGenres = genres.filter(
      (genre): genre is string => typeof genre === "string",
    );
    if (validGenres.length > 0) {
      metadataParts.push(validGenres.slice(0, 2).join(", "));
    }
  }

  if (typeof studio === "string") {
    metadataParts.push(studio);
  }

  const metadata = metadataParts.join(" • ");

  const statusIndicator = getStatusIndicator(downloadStatus, percentAvailable);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: theme.custom.spacing.sm,
          paddingHorizontal: theme.custom.spacing.md,
          borderRadius: 12,
          marginVertical: 2,
        },
        poster: {
          marginRight: theme.custom.spacing.md,
        },
        content: {
          flex: 1,
        },
        titleRow: {
          flexDirection: "row",
          alignItems: "baseline",
          marginBottom: 4,
        },
        title: {
          color: theme.colors.onSurface,
          flex: 1,
        },
        year: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 14,
          marginLeft: theme.custom.spacing.xs,
        },
        metadata: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 12,
        },
        statusIndicator: {
          position: "absolute",
          top: 4,
          right: 4,
          backgroundColor:
            statusIndicator === "downloading"
              ? theme.colors.primary
              : theme.colors.surfaceVariant,
          borderRadius: 8,
          paddingHorizontal: 6,
          paddingVertical: 2,
          minWidth: 36,
          alignItems: "center",
        },
        statusText: {
          color:
            statusIndicator === "downloading"
              ? theme.colors.onPrimary
              : theme.colors.onSurfaceVariant,
          fontSize: 10,
          fontWeight: "500",
        },
        chevron: {
          marginLeft: theme.custom.spacing.sm,
        },
      }),
    [theme, statusIndicator],
  );

  const renderStatusIndicator = () => {
    if (statusIndicator === "available") {
      return null; // No indicator for available movies
    }

    if (
      statusIndicator === "downloading" &&
      typeof percentAvailable === "number"
    ) {
      return (
        <View style={styles.statusIndicator}>
          <Text style={styles.statusText}>{percentAvailable}%</Text>
        </View>
      );
    }

    if (statusIndicator === "missing") {
      return (
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: theme.colors.errorContainer },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: theme.colors.onErrorContainer },
            ]}
          >
            Missing
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.root, style, pressed && { opacity: 0.8 }]}
      testID={testID}
    >
      <View style={{ position: "relative" }}>
        <MediaPoster
          uri={posterUri}
          size="small"
          borderRadius={8}
          showPlaceholderLabel={false}
          style={styles.poster}
        />
        {renderStatusIndicator()}
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
            {typeof title === "string" ? title : "Unknown Title"}
          </Text>
          {typeof year === "number" && (
            <Text variant="bodyMedium" style={styles.year}>
              {year}
            </Text>
          )}
        </View>
        {metadata && (
          <Text variant="bodySmall" style={styles.metadata} numberOfLines={1}>
            {metadata}
          </Text>
        )}
      </View>
      <IconButton
        icon="chevron-right"
        size={20}
        iconColor={theme.colors.onSurfaceVariant}
        style={styles.chevron}
      />
    </Pressable>
  );
};

export default MovieListItem;
