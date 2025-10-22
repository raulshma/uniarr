import React from "react";
import { StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import { Button } from "@/components/common/Button";

export type FullscreenErrorProps = {
  title: string;
  message?: string;
  onRetry?: () => void;
  onGoBack?: () => void;
  retryLabel?: string;
  goBackLabel?: string;
  testID?: string;
};

const FullscreenError: React.FC<FullscreenErrorProps> = ({
  title,
  message,
  onRetry,
  onGoBack,
  retryLabel = "Retry",
  goBackLabel = "Go Back",
  testID = "fullscreen-error",
}) => {
  const theme = useTheme<AppTheme>();

  return (
    <View
      style={[styles.container, { backgroundColor: "rgba(0,0,0,0.85)" }]}
      accessibilityRole="alert"
      testID={testID}
    >
      <View style={styles.contentCard}>
        <View style={styles.errorIcon}>
          <Icon
            source="alert-circle-outline"
            size={64}
            color={theme.colors.error}
          />
        </View>
        <Text
          variant="headlineMedium"
          style={[styles.title, { color: theme.colors.onErrorContainer }]}
        >
          {title}
        </Text>
        {message ? (
          <Text
            variant="bodyLarge"
            style={[styles.message, { color: theme.colors.onErrorContainer }]}
          >
            {message}
          </Text>
        ) : null}
        <View style={styles.buttonContainer}>
          {onRetry ? (
            <Button
              mode="contained"
              onPress={onRetry}
              style={styles.button}
              buttonColor={theme.colors.error}
            >
              {retryLabel}
            </Button>
          ) : null}
          {onGoBack ? (
            <Button
              mode="outlined"
              onPress={onGoBack}
              style={[styles.button, styles.secondaryButton]}
              textColor={theme.colors.onErrorContainer}
            >
              {goBackLabel}
            </Button>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default FullscreenError;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 24,
  },
  contentCard: {
    backgroundColor: "rgba(30, 30, 30, 0.95)",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  errorIcon: {
    marginBottom: 16,
  },
  title: {
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "600",
  },
  message: {
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
  },
  button: {
    width: "100%",
  },
  secondaryButton: {
    borderColor: "rgba(255,255,255,0.3)",
  },
});
