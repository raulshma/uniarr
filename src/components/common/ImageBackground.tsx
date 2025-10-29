import React, { useMemo } from "react";
import { Image } from "expo-image";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  SharedValue,
} from "react-native-reanimated";
import type { AppTheme } from "@/constants/theme";

interface ImageBackgroundProps {
  theme: AppTheme;
  imageUri?: string;
  blurRadius?: number;
  opacity?: number;
  scrollY?: SharedValue<number>;
}

// Default background image - using a TMDB discover backdrop or fallback
const DEFAULT_BACKGROUND_URI =
  "https://image.tmdb.org/t/p/original/vPTNgY9YWZtMGHDGAtrv3WjqXzX.jpg";

const ImageBackground = React.memo(
  ({
    theme,
    imageUri = DEFAULT_BACKGROUND_URI,
    blurRadius = theme.dark ? 25 : 20,
    opacity = theme.dark ? 0.6 : 0.8,
    scrollY,
  }: ImageBackgroundProps) => {
    const { width, height } = useWindowDimensions();

    const styles = useMemo(
      () =>
        StyleSheet.create({
          background: {
            ...StyleSheet.absoluteFillObject,
          },
          image: {
            width: width,
            height: height * 3, // Make image much taller to ensure full coverage during parallax
            opacity,
            top: -height, // Position to cover area above and below visible screen
          },
        }),
      [width, height, opacity],
    );

    const animatedStyle = useAnimatedStyle(() => {
      if (!scrollY) return {};

      // Parallax effect: background moves at 0.3x speed of scroll
      // The image is already positioned with top: -height, so we just need to translate
      const translateY = scrollY.value * 0.3;

      return {
        transform: [{ translateY }],
      };
    }, [scrollY]);

    const AnimatedImage = Animated.createAnimatedComponent(Image);

    return (
      <AnimatedImage
        style={[styles.image, animatedStyle]}
        source={{ uri: imageUri }}
        contentFit="cover"
        blurRadius={blurRadius}
        cachePolicy="memory-disk"
        priority="low"
        placeholder={{
          blurhash:
            "|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[",
        }}
        transition={500}
      />
    );
  },
);

ImageBackground.displayName = "ImageBackground";

export default ImageBackground;
