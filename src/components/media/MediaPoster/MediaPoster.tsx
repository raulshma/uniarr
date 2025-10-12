import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { AppTheme } from "@/constants/theme";
import { imageCacheService } from "@/services/image/ImageCacheService";
import { PixelRatio } from 'react-native';

const sizeMap = {
  small: 96,
  medium: 128,
  large: 160,
} as const;

export type MediaPosterSize = keyof typeof sizeMap;

export type MediaPosterProps = {
  uri?: string;
  size?: MediaPosterSize | number;
  aspectRatio?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  showPlaceholderLabel?: boolean;
};

const DEFAULT_ASPECT_RATIO = 2 / 3;
const DEFAULT_RADIUS = 12;

const MediaPoster: React.FC<MediaPosterProps> = ({
  uri,
  size = "medium",
  aspectRatio = DEFAULT_ASPECT_RATIO,
  borderRadius,
  style,
  onPress,
  accessibilityLabel,
  showPlaceholderLabel = false,
}) => {
  const theme = useTheme<AppTheme>();

  // Use theme's poster style configuration if borderRadius is not explicitly provided
  const effectiveBorderRadius =
    borderRadius ??
    theme.custom.config?.posterStyle.borderRadius ??
    DEFAULT_RADIUS;
  const [isLoading, setIsLoading] = useState(Boolean(uri));
  const [hasError, setHasError] = useState(false);
  const [resolvedUri, setResolvedUri] = useState<string | undefined>(uri);

  useEffect(() => {
    let isMounted = true;

    const resolve = async () => {
      if (!uri) {
        if (isMounted) {
          setResolvedUri(undefined);
          setIsLoading(false);
          setHasError(false);
        }
        return;
      }

      if (isMounted) {
        setIsLoading(true);
        setHasError(false);
        setResolvedUri(undefined);
      }

      try {
        // Request a sized thumbnail matching the rendered size * device DPR
        const dpr = PixelRatio.get();
        const reqWidth = Math.round(width * dpr);
        const reqHeight = Math.round(height * dpr);
        const localUri = await imageCacheService.resolveForSize(uri, width, height);
        if (isMounted) {
          setResolvedUri(localUri);
        }
      } catch (error) {
        if (isMounted) {
          setResolvedUri(uri);
        }
      }
    };

    void resolve();

    return () => {
      isMounted = false;
    };
  }, [uri]);

  const width = useMemo(
    () => (typeof size === "number" ? size : sizeMap[size]),
    [size]
  );
  const height = useMemo(
    () => Math.round(width / aspectRatio),
    [width, aspectRatio]
  );

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const containerStyle = useMemo(
    () =>
      [
        styles.container,
        {
          width,
          height,
          borderRadius: effectiveBorderRadius,
          backgroundColor: theme.colors.surfaceVariant,
          // Apply shadow styling from theme configuration
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.custom.config?.posterStyle.shadowOpacity ?? 0.3,
          shadowRadius: theme.custom.config?.posterStyle.shadowRadius ?? 4,
          elevation: 5,
        },
        style,
      ] as StyleProp<ViewStyle>,
    [
      width,
      height,
      effectiveBorderRadius,
      style,
      theme.colors.surfaceVariant,
      theme.colors.shadow,
      theme.custom.config?.posterStyle.shadowOpacity,
      theme.custom.config?.posterStyle.shadowRadius,
    ]
  );

  const isFallback = hasError || !resolvedUri;

  const content = isFallback ? (
    <View style={[styles.fallback, { borderRadius: effectiveBorderRadius }]}>
      <MaterialCommunityIcons
        name="image-off-outline"
        size={32}
        color={theme.colors.onSurfaceVariant}
      />
      {showPlaceholderLabel ? (
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          No artwork
        </Text>
      ) : null}
    </View>
  ) : (
    <Image
      source={{ uri: resolvedUri }}
      // Use stored thumbhash as a placeholder when available. Expo Image accepts
      // placeholder as an object or a string; providing the thumbhash string
      // directly will render a compact placeholder until the real image loads.
      placeholder={resolvedUri ? imageCacheService.getThumbhash(resolvedUri) ?? undefined : undefined}
      style={[
        StyleSheet.absoluteFillObject,
        { borderRadius: effectiveBorderRadius },
      ]}
      accessibilityLabel={accessibilityLabel}
      cachePolicy="memory-disk"
      contentFit="cover"
      transition={0}
      onLoad={handleImageLoad}
      onLoadEnd={handleImageLoad}
      onError={() => {
        setIsLoading(false);
        setHasError(true);
      }}
    />
  );

  const effectiveLabel =
    accessibilityLabel ??
    (isFallback ? "Media artwork unavailable" : "Media artwork");

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="imagebutton"
        accessibilityLabel={effectiveLabel}
      >
        <View style={containerStyle} pointerEvents="none">
          {content}
        </View>
      </Pressable>
    );
  }

  return (
    <View
      style={containerStyle}
      accessibilityRole="image"
      accessibilityLabel={effectiveLabel}
    >
      {content}
    </View>
  );
};

export default MediaPoster;

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
});
