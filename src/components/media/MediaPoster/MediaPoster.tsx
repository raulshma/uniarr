import React, { useMemo, useState, useCallback, useRef } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { Text, useTheme, TouchableRipple } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { AppTheme } from "@/constants/theme";
import { imageCacheService } from "@/services/image/ImageCacheService";
import { useThumbhash } from "@/hooks/useThumbhash";
import { posterSizes, aspectRatios, borderRadius } from "@/constants/sizes";
import { getComponentElevation } from "@/constants/elevation";

const sizeMap = {
  small: posterSizes.md,
  medium: posterSizes.lg,
  large: posterSizes.xl,
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

const DEFAULT_ASPECT_RATIO = aspectRatios.poster;
const DEFAULT_RADIUS = borderRadius.lg;

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

  // Optimized: use ref to avoid recreation on each render
  const fadeAnimRef = useRef(new Animated.Value(0));
  const fadeAnim = fadeAnimRef.current;

  // Consolidated state to reduce re-renders
  const [imageState, setImageState] = useState({
    loaded: false,
    loading: Boolean(uri),
    error: false,
    resolvedUri: uri,
  });

  // Memoize expensive calculations
  const effectiveBorderRadius = useMemo(
    () =>
      borderRadius ??
      theme.custom.config?.posterStyle.borderRadius ??
      DEFAULT_RADIUS,
    [borderRadius, theme.custom.config?.posterStyle.borderRadius],
  );

  const dimensions = useMemo(() => {
    const widthValue = typeof size === "number" ? size : sizeMap[size];
    const heightValue = Math.round(widthValue / aspectRatio);
    return { width: widthValue, height: heightValue };
  }, [size, aspectRatio]);

  // Removed debug logging - use React DevTools Profiler instead

  // URI resolution: use Image component's native caching
  // Track when URI changes to reset state
  const prevUriRef = useRef<string | undefined>(uri);
  const isUriChanged = prevUriRef.current !== uri;

  if (isUriChanged) {
    prevUriRef.current = uri;
    if (!uri) {
      setImageState({
        loaded: false,
        loading: false,
        error: false,
        resolvedUri: undefined,
      });
      fadeAnim.setValue(0);
    } else {
      // Mark as loading to show thumbhash placeholder if available
      setImageState((prev) => ({
        ...prev,
        loading: true,
        error: false,
        resolvedUri: uri,
      }));
    }
  }

  // Use the thumbhash hook with reduced delay for better UX
  // Called after URI tracking to ensure state consistency
  const { thumbhash } = useThumbhash(uri, {
    autoGenerate: true,
    generateDelay: priority === "high" ? 0 : 50, // No delay for high priority (list items)
  });

  // Preload image on demand - moved to Image component onLoad
  const shouldPrefetch = preload && uri && !imageState.resolvedUri;
  if (shouldPrefetch) {
    // Fire-and-forget prefetch without blocking render
    void imageCacheService.prefetch(uri);
  }

  const handleImageLoad = useCallback(() => {
    setImageState((prev) => ({ ...prev, loaded: true, loading: false }));

    if (progressiveLoading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [progressiveLoading, fadeAnim]);

  const handleError = useCallback(() => {
    setImageState((prev) => ({
      ...prev,
      loaded: false,
      loading: false,
      error: true,
    }));
  }, []);

  // Optimized container style calculation
  const containerStyle = useMemo(
    () =>
      [
        styles.container,
        {
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: effectiveBorderRadius,
          backgroundColor: theme.colors.surfaceVariant,
          // Apply shadow styling from theme configuration
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.custom.config?.posterStyle.shadowOpacity ?? 0.3,
          shadowRadius: theme.custom.config?.posterStyle.shadowRadius ?? 4,
          ...getComponentElevation("poster", theme),
        },
        style,
      ] as StyleProp<ViewStyle>,
    [dimensions, effectiveBorderRadius, style, theme],
  );

  const isFallback = imageState.error || !imageState.resolvedUri;
  const showLoadingPlaceholder = imageState.loading && !thumbhash;

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
      {/* Show thumbhash placeholder with blur effect - only show when we have a valid URI and not loaded */}
      {thumbhash && !imageState.loaded && imageState.resolvedUri && (
        <Image
          source={{ uri: imageState.resolvedUri }}
          placeholder={thumbhash}
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: effectiveBorderRadius },
          ]}
          blurRadius={progressiveLoading ? 6 : 0} // Slightly reduced blur for performance
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
          source={{ uri: imageState.resolvedUri }}
          placeholder={thumbhash}
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: effectiveBorderRadius },
          ]}
          accessibilityLabel={accessibilityLabel}
          cachePolicy="memory-disk"
          contentFit="cover"
          priority={priority}
          transition={progressiveLoading ? 250 : 0} // Slightly reduced for snappier feel
          onLoad={handleImageLoad}
          onLoadEnd={handleImageLoad}
          onError={handleError}
          // Only render when we have a valid resolved URI to prevent flickering
          key={imageState.resolvedUri || "placeholder"}
        />
      </Animated.View>
    </>
  );

  const effectiveLabel =
    accessibilityLabel ??
    (isFallback ? "Media artwork unavailable" : "Media artwork");

  if (onPress) {
    return (
      <TouchableRipple
        onPress={onPress}
        borderless={false}
        accessibilityRole="imagebutton"
      >
        <View style={containerStyle} pointerEvents="box-none">
          {content}
          {overlay && <View pointerEvents="auto">{overlay}</View>}
        </View>
      </TouchableRipple>
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

export default React.memo(MediaPoster);

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
