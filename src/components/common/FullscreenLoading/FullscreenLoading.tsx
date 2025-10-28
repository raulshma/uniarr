import React from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { ActivityIndicator, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";

export type FullscreenLoadingProps = {
  message?: string;
  testID?: string;
};

const FullscreenLoading: React.FC<FullscreenLoadingProps> = ({
  message = "Loading...",
  testID = "fullscreen-loading",
}) => {
  const theme = useTheme<AppTheme>();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[styles.container, { backgroundColor: "rgba(0,0,0,0.9)" }]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      testID={testID}
    >
      <Animated.View
        entering={ZoomIn.duration(300).delay(100)}
        style={styles.spinner}
      >
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
          animating
        />
      </Animated.View>
      {message ? (
        <Animated.Text
          entering={FadeIn.duration(300).delay(200)}
          style={[styles.message, { color: "rgba(255,255,255,0.9)" }]}
        >
          {message}
        </Animated.Text>
      ) : null}
    </Animated.View>
  );
};

export default FullscreenLoading;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "500",
    maxWidth: "80%",
  },
});
