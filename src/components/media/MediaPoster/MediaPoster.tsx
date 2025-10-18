import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { AppTheme } from "@/constants/theme";
import { imageCacheService } from "@/services/image/ImageCacheService";
import { useThumbhash } from "@/hooks/useThumbhash";

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
  overlay?: React.ReactNode;
  /**
   * Enable progressive loading with blur-up effect
   * @default true
   */
  progressiveLoading?: boolean;
  /**
   * Preload image when component mounts
   * @default false
   */
  preload?: boolean;
  /**
   * Priority for loading (affects expo-image priority)
   * @default 'normal'
   */
  priority?: "low" | "normal" | "high";
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
  overlay,
  progressiveLoading = true,
  preload = false,
  priority = "normal",
}) => {
  const theme = useTheme<AppTheme>();

  // Animation value for progressive loading
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Use theme's poster style configuration if borderRadius is not explicitly provided
  const effectiveBorderRadius =
    borderRadius ??
    theme.custom.config?.posterStyle.borderRadius ??
    DEFAULT_RADIUS;
  const width = useMemo(
    () => (typeof size === "number" ? size : sizeMap[size]),
    [size],
  );
  const height = useMemo(
    () => Math.round(width / aspectRatio),
    [width, aspectRatio],
  );

  const [isLoading, setIsLoading] = useState(Boolean(uri));
  const [hasError, setHasError] = useState(false);
  const [resolvedUri, setResolvedUri] = useState<string | undefined>(uri);

  // Use the new thumbhash hook for clean thumbhash management
  const { thumbhash } = useThumbhash(uri, {
    autoGenerate: true,
    generateDelay: 100, // Small delay to not block initial render
  });

  // Preload image if requested
  useEffect(() => {
    if (preload && uri && !resolvedUri) {
      void imageCacheService.prefetch(uri);
    }
  }, [preload, uri, resolvedUri]);

  useEffect(() => {
    let isMounted = true;

    const resolve = async () => {
      if (!uri) {
        if (isMounted) {
          setResolvedUri(undefined);
          setIsLoading(false);
          setHasError(false);
          setImageLoaded(false);
          fadeAnim.setValue(0);
        }
        return;
      }

      if (isMounted) {
        setIsLoading(true);
        setHasError(false);
        setResolvedUri(undefined);
        setImageLoaded(false);
        fadeAnim.setValue(0);
      }

      try {
        // Request a sized thumbnail matching the rendered size * device DPR
        const localUri = await imageCacheService.resolveForSize(
          uri,
          width,
          height,
        );
        if (isMounted) {
          setResolvedUri(localUri);
        }
      } catch {
        if (isMounted) {
          setResolvedUri(uri);
        }
      }
    };

    void resolve();

    return () => {
      isMounted = false;
    };
  }, [uri, width, height, fadeAnim]);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    setImageLoaded(true);

    if (progressiveLoading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [progressiveLoading, fadeAnim]);

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
    ],
  );

  const isFallback = hasError || !resolvedUri;
  const showLoadingPlaceholder = isLoading && !thumbhash;

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
  ) : showLoadingPlaceholder ? (
    <View
      style={[
        styles.loadingPlaceholder,
        { borderRadius: effectiveBorderRadius },
      ]}
    >
      <MaterialCommunityIcons
        name="image-outline"
        size={32}
        color={theme.colors.onSurfaceVariant}
        opacity={0.5}
      />
    </View>
  ) : (
    <>
      {/* Show thumbhash placeholder with blur effect */}
      {thumbhash && !imageLoaded && (
        <Image
          source={{ uri: resolvedUri }}
          placeholder={thumbhash}
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: effectiveBorderRadius },
          ]}
          blurRadius={progressiveLoading ? 8 : 0}
          cachePolicy="memory-disk"
          contentFit="cover"
        />
      )}

      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: effectiveBorderRadius,
            opacity: progressiveLoading ? fadeAnim : 1,
          },
        ]}
      >
        <Image
          source={{ uri: resolvedUri }}
          // Use stored thumbhash as a placeholder when available. Expo Image accepts
          // placeholder as an object with thumbhash property for proper rendering.
          placeholder={thumbhash}
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: effectiveBorderRadius },
          ]}
          accessibilityLabel={accessibilityLabel}
          cachePolicy="memory-disk"
          contentFit="cover"
          priority={priority}
          transition={progressiveLoading ? 300 : 0}
          onLoad={handleImageLoad}
          onLoadEnd={handleImageLoad}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
      </Animated.View>
    </>
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
          {overlay}
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
      {overlay}
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
  loadingPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
});
