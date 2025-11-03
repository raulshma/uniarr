import React, { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ImageBackground from "./ImageBackground";
import BlurEdge from "./BlurEdge";
import type { AppTheme } from "@/constants/theme";

interface AnimatedSkiaBackgroundProps {
  theme: AppTheme;
  children?: React.ReactNode;
  bottomBlur?: boolean;
  imageUri?: string;
  scrollY?: SharedValue<number>;
}

const AnimatedSkiaBackground = React.memo(
  ({
    theme,
    children,
    bottomBlur = false,
    imageUri,
    scrollY,
  }: AnimatedSkiaBackgroundProps) => {
    const edgeHeight = useRef(60).current;
    const insets = useSafeAreaInsets();

    const styles = useMemo(
      () =>
        StyleSheet.create({
          wrapper: {
            ...StyleSheet.absoluteFillObject,
          },
          blur: {
            position: "absolute" as const,
            left: 0,
            right: 0,
          },
          top: {
            top: 0,
          },
          bottom: {
            bottom: 0,
          },
        }),
      [],
    );

    return (
      <View style={styles.wrapper}>
        <BlurEdge
          height={edgeHeight + insets.top}
          colors={["#FFFFFF90", "#FFFFFF00"]}
          start={{ x: 0, y: 0 + insets.top }}
          end={{ x: 0, y: edgeHeight + insets.top }}
          style={StyleSheet.compose(styles.blur, styles.top)}
          theme={theme}
        />

        {children}

        <BlurEdge
          enabled={bottomBlur}
          height={edgeHeight}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: edgeHeight }}
          colors={["#FFFFFF00", "#FFFFFF80"]}
          style={StyleSheet.compose(styles.blur, styles.bottom)}
          theme={theme}
        />

        <ImageBackground theme={theme} imageUri={imageUri} scrollY={scrollY} />
      </View>
    );
  },
);

AnimatedSkiaBackground.displayName = "AnimatedSkiaBackground";

export default AnimatedSkiaBackground;
