import React, { useEffect, useState, useCallback } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { useTheme, Text, IconButton, Button } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import { logger } from "@/services/logger/LoggerService";

interface ImageViewerProps {
  visible: boolean;
  imageUri: string;
  fileName: string;
  fileSize: string;
  imageDimensions?: { width: number; height: number };
  onClose: () => void;
}

const SWIPE_DISMISS_THRESHOLD = 100;
const AnimatedView = Animated.createAnimatedComponent(View);

const ImageViewer: React.FC<ImageViewerProps> = ({
  visible,
  imageUri,
  fileName,
  fileSize,
  imageDimensions,
  onClose,
}) => {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [resolvedUri, setResolvedUri] = useState<string>("");

  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;

  // Gesture and animation state
  const translateY = useSharedValue(0);

  // Initialize when modal becomes visible
  useEffect(() => {
    if (!visible || !imageUri) {
      return;
    }

    setImageLoading(true);
    setImageError(false);
    setErrorMessage("");
    translateY.value = 0;
    setResolvedUri(imageUri);
  }, [visible, imageUri, translateY]);

  // Handle image load success
  const handleImageLoadEnd = useCallback(() => {
    setImageLoading(false);
    setImageError(false);
    logger.debug("ImageViewer: Image loaded successfully", {
      uri: resolvedUri,
      fileName,
    });
  }, [resolvedUri, fileName]);

  // Handle image load error
  const handleImageError = useCallback(
    (error: any) => {
      setImageLoading(false);
      setImageError(true);

      const errorMsg = error?.message || "Unknown error";
      const errorDetail = {
        originalUri: imageUri,
        resolvedUri,
        fileName,
        error: errorMsg,
      };

      logger.error("ImageViewer: Failed to load image", errorDetail);
      setErrorMessage(`Failed to load image: ${fileName} (${imageUri})`);
    },
    [imageUri, resolvedUri, fileName],
  );

  // Swipe gesture handler
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // Only allow swipe down
      if (e.velocityY > 0 || e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > SWIPE_DISMISS_THRESHOLD) {
        // Swiped down far enough, close modal
        runOnJS(onClose)();
      } else {
        // Not enough, snap back to top
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const styles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.elevation.level3,
    },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.9)",
      justifyContent: "center",
      alignItems: "center",
    },
    headerContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: "rgba(0,0,0,0.8)",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
      paddingTop: (insets?.top || 0) + spacing.sm,
    },
    headerContent: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    headerText: {
      flex: 1,
      color: theme.colors.onSurface,
      fontSize: 16,
      fontWeight: "500",
    },
    fileInfo: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
      marginTop: 2,
    },
    imageContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingTop: 80,
      paddingBottom: 120,
    },
    image: {
      maxWidth: screenWidth - spacing.md * 2,
      maxHeight: screenHeight - 200,
      borderRadius: borderRadius.md,
      backgroundColor: theme.colors.surfaceVariant,
    },
    loadingContainer: {
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    loadingText: {
      color: theme.colors.onSurface,
      fontSize: 16,
      marginTop: spacing.sm,
    },
    errorContainer: {
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 16,
      textAlign: "center",
      marginTop: spacing.sm,
    },
    bottomActions: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.8)",
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      paddingBottom: (insets?.bottom || 0) + spacing.sm,
    },
    dimensionsText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    closeButton: {
      alignSelf: "center",
    },
  });

  const renderContent = () => {
    if (imageLoading) {
      return (
        <View style={styles.loadingContainer}>
          <IconButton
            icon="image-outline"
            size={64}
            iconColor={theme.colors.onSurfaceVariant}
          />
          <Text style={styles.loadingText}>Loading image...</Text>
        </View>
      );
    }

    if (imageError) {
      return (
        <View style={styles.errorContainer}>
          <IconButton
            icon="image-broken-variant"
            size={64}
            iconColor={theme.colors.error}
          />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={() => {
          // Tap to dismiss
          onClose();
        }}
        activeOpacity={1}
      >
        <Image
          source={{ uri: resolvedUri }}
          style={styles.image}
          contentFit="contain"
          onLoadEnd={handleImageLoadEnd}
          onError={handleImageError}
          placeholder="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
          placeholderContentFit="contain"
          transition={300}
          cachePolicy="memory-disk"
          blurRadius={0}
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <GestureDetector gesture={pan}>
        <AnimatedView style={[styles.modalContainer, animatedStyle]}>
          <View style={styles.overlay}>
            {/* Header */}
            <View style={styles.headerContainer}>
              <View style={styles.headerContent}>
                <IconButton
                  icon="close"
                  size={24}
                  iconColor={theme.colors.onSurface}
                  onPress={onClose}
                />
                <View style={{ flex: 1, marginLeft: spacing.xs }}>
                  <Text style={styles.headerText} numberOfLines={1}>
                    {fileName}
                  </Text>
                  <Text style={styles.fileInfo} numberOfLines={1}>
                    {fileSize}
                  </Text>
                </View>
              </View>
            </View>

            {/* Image Content */}
            {renderContent()}

            {/* Bottom Actions */}
            <View style={styles.bottomActions}>
              {imageDimensions && (
                <Text style={styles.dimensionsText}>
                  Dimensions: {imageDimensions.width} × {imageDimensions.height}
                  px
                </Text>
              )}
              <Button
                mode="outlined"
                onPress={onClose}
                style={styles.closeButton}
                textColor={theme.colors.onSurface}
              >
                Close
              </Button>
            </View>
          </View>
        </AnimatedView>
      </GestureDetector>
    </Modal>
  );
};

export default ImageViewer;
