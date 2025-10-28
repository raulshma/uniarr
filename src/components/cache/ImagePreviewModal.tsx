import {
  Modal,
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { useTheme, Text, IconButton, Button } from "react-native-paper";
import { useState, useEffect, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";

interface ImagePreviewModalProps {
  visible: boolean;
  imageUri: string;
  fileName: string;
  fileSize: string;
  imageDimensions?: { width: number; height: number };
  onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  imageUri,
  fileName,
  fileSize,
  imageDimensions,
  onClose,
}) => {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [currentUriIndex, setCurrentUriIndex] = useState(0);

  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;

  // Generate multiple URI variants to try
  const uriVariants = useMemo(() => {
    if (!imageUri) return [];

    const variants = new Set<string>();

    // Original URI
    variants.add(imageUri);

    // Try different formats
    let uri = imageUri;

    if (uri.startsWith("file://")) {
      // Remove file:// prefix
      const withoutPrefix = uri.replace("file://", "");
      variants.add(withoutPrefix);

      // Also try with double slash
      variants.add(uri.replace("file://", "file:///"));
    } else if (uri.startsWith("/") && !uri.startsWith("file://")) {
      // Add file:// prefix
      variants.add(`file://${uri}`);
      variants.add(`file:/${uri}`);
    } else if (uri.includes("cache/")) {
      // Try various cache file formats
      if (!uri.startsWith("file://")) {
        variants.add(`file://${uri}`);
      }
      if (uri.startsWith("file://")) {
        variants.add(uri.replace("file://", ""));
      }
    }

    console.log("Generated URI variants:", Array.from(variants));
    return Array.from(variants);
  }, [imageUri]);

  // Use the current URI variant
  const currentUri = uriVariants[currentUriIndex] || imageUri;

  useEffect(() => {
    if (visible) {
      setImageLoading(true);
      setImageError(false);
      setDebugInfo(
        `Trying variant ${currentUriIndex + 1}/${uriVariants.length}: ${currentUri.substring(0, 100)}${currentUri.length > 100 ? "..." : ""}`,
      );

      // Add a timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        if (imageLoading) {
          // Try next URI variant if available
          if (currentUriIndex < uriVariants.length - 1) {
            console.log("Trying next URI variant...");
            setCurrentUriIndex((prev) => prev + 1);
          } else {
            setImageLoading(false);
            setImageError(true);
            setDebugInfo(
              `Failed to load image from ${uriVariants.length} variant(s). The image may be inaccessible, expired, or require special authentication.`,
            );
          }
        }
      }, 3000); // Reduced timeout from 5s to 3s per variant

      return () => clearTimeout(timeout);
    } else {
      // Reset when modal closes
      setCurrentUriIndex(0);
    }
  }, [visible, imageLoading, currentUriIndex, uriVariants.length, currentUri]);

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
      paddingTop: 80, // Account for header
      paddingBottom: 120, // Account for bottom actions
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

  const handleImageLoad = () => {
    console.log("Image loaded successfully");
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = (error: any) => {
    console.error("Image loading error:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    setImageLoading(false);
    setImageError(true);
    setDebugInfo(`Error: ${error?.message || "Unknown error"}`);
  };

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
          {debugInfo && (
            <Text
              style={{
                color: theme.colors.onSurfaceVariant,
                fontSize: 12,
                marginTop: spacing.sm,
                textAlign: "center",
              }}
            >
              {debugInfo}
            </Text>
          )}
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
          <Text style={styles.errorText}>
            Unable to load this image. The file may be corrupted or in an
            unsupported format.
          </Text>
          {debugInfo && (
            <Text
              style={{
                color: theme.colors.onSurfaceVariant,
                fontSize: 12,
                marginTop: spacing.sm,
              }}
            >
              Debug: {debugInfo}
            </Text>
          )}
          {currentUriIndex < uriVariants.length - 1 && (
            <Button
              mode="outlined"
              onPress={() => {
                setCurrentUriIndex((prev) => prev + 1);
                setImageLoading(true);
                setImageError(false);
              }}
              style={{ marginTop: spacing.md }}
            >
              Try Next Format
            </Button>
          )}
          <Button
            mode="text"
            onPress={() => {
              setCurrentUriIndex(0);
              setImageLoading(true);
              setImageError(false);
            }}
            style={{ marginTop: spacing.sm }}
          >
            Retry
          </Button>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={() => {
          // Allow tap to dismiss or zoom functionality could be added here
        }}
        activeOpacity={1}
      >
        <Image
          source={{ uri: currentUri }}
          style={styles.image}
          contentFit="contain"
          onLoad={handleImageLoad}
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
      <View style={styles.modalContainer}>
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
                Dimensions: {imageDimensions.width} × {imageDimensions.height}px
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
      </View>
    </Modal>
  );
};

export default ImagePreviewModal;
