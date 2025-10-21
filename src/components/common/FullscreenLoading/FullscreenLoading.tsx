import React from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";

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
    <View
      style={[styles.container, { backgroundColor: "rgba(0,0,0,0.9)" }]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      testID={testID}
    >
      <ActivityIndicator
        size="large"
        color={theme.colors.primary}
        animating
        style={styles.spinner}
      />
      {message ? (
        <Text
          style={[styles.message, { color: "rgba(255,255,255,0.9)" }]}
          variant="headlineSmall"
        >
          {message}
        </Text>
      ) : null}
    </View>
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
