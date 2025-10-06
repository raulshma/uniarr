import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Icon, Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '@/constants/theme';
import { imageCacheService } from '@/services/image/ImageCacheService';

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
  size = 'medium',
  aspectRatio = DEFAULT_ASPECT_RATIO,
  borderRadius = DEFAULT_RADIUS,
  style,
  onPress,
  accessibilityLabel,
  showPlaceholderLabel = false,
}) => {
  const theme = useTheme<AppTheme>();
  const [isLoading, setIsLoading] = useState(Boolean(uri));
  const [hasError, setHasError] = useState(false);
  const [resolvedUri, setResolvedUri] = useState<string | undefined>(uri);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Animation values
  const blurOpacity = useRef(new Animated.Value(1)).current;
  const imageOpacity = useRef(new Animated.Value(0)).current;

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
        setImageLoaded(false);
        // Reset animation values
        blurOpacity.setValue(1);
        imageOpacity.setValue(0);
      }

      try {
        const localUri = await imageCacheService.resolveUri(uri);
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

  const width = useMemo(() => (typeof size === 'number' ? size : sizeMap[size]), [size]);
  const height = useMemo(() => Math.round(width / aspectRatio), [width, aspectRatio]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setImageLoaded(true);
    
    // Animate blur fade out and image fade in
    Animated.parallel([
      Animated.timing(blurOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        width,
        height,
        borderRadius,
        backgroundColor: theme.colors.surfaceVariant,
      },
      style,
    ] as StyleProp<ViewStyle>,
    [width, height, borderRadius, style, theme.colors.surfaceVariant],
  );

  const isFallback = hasError || !resolvedUri;

  const content = isFallback ? (
    <View style={[styles.fallback, { borderRadius }]}>
      <Icon source="image-off-outline" size={32} color={theme.colors.onSurfaceVariant} />
      {showPlaceholderLabel ? (
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          No artwork
        </Text>
      ) : null}
    </View>
  ) : (
    <>
      {/* Blurred placeholder */}
      {isLoading && (
        <Animated.View style={[styles.blurContainer, { borderRadius, opacity: blurOpacity }]}>
          <BlurView
            intensity={20}
            tint="light"
            style={[StyleSheet.absoluteFillObject, { borderRadius }]}
          >
            <View style={[styles.blurContent, { borderRadius }]}>
              <Icon source="image-outline" size={24} color={theme.colors.onSurfaceVariant} />
            </View>
          </BlurView>
        </Animated.View>
      )}
      
      {/* Actual image */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: imageOpacity }]}>
        <Image
          source={{ uri: resolvedUri }}
          style={[StyleSheet.absoluteFillObject, { borderRadius }]}
          accessibilityLabel={accessibilityLabel}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={0} // Disable expo-image transition since we're handling it manually
          onLoadEnd={handleImageLoad}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
            // Reset animations on error
            blurOpacity.setValue(0);
            imageOpacity.setValue(0);
          }}
        />
      </Animated.View>
    </>
  );


  const effectiveLabel = accessibilityLabel ?? (isFallback ? 'Media artwork unavailable' : 'Media artwork');

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
    <View style={containerStyle} accessibilityRole="image" accessibilityLabel={effectiveLabel}>
      {content}
    </View>
  );
};

export default MediaPoster;

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  blurContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
