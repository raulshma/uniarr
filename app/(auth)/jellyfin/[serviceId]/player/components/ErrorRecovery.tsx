/**
 * Error Recovery Component
 * Handles playback errors with retry logic and user feedback
 */

import { View, StyleSheet } from "react-native";
import { Text, Button, Surface, ActivityIndicator } from "react-native-paper";
import { spacing } from "@/theme/spacing";
import {
  useJellyfinPlayerStore,
  selectError,
  selectRetryCount,
} from "@/store/jellyfinPlayerStore";

interface ErrorRecoveryProps {
  maxRetries?: number;
  onRetry: () => void;
  onSwitchSource?: () => void;
  onGoBack: () => void;
  isRetrying?: boolean;
}

export const ErrorRecovery = ({
  maxRetries = 3,
  onRetry,
  onSwitchSource,
  onGoBack,
  isRetrying = false,
}: ErrorRecoveryProps) => {
  const error = useJellyfinPlayerStore(selectError);
  const retryCount = useJellyfinPlayerStore(selectRetryCount);

  if (!error) return null;

  const canRetry = retryCount < maxRetries;
  const errorMessage = error.message || "An unknown error occurred";

  return (
    <View style={styles.container}>
      <Surface style={styles.content} elevation={4}>
        <Text variant="headlineSmall" style={styles.title}>
          Playback Error
        </Text>

        <Text variant="bodyMedium" style={styles.message}>
          {errorMessage}
        </Text>

        {retryCount > 0 && (
          <Text variant="bodySmall" style={styles.retryInfo}>
            Retry attempt {retryCount} of {maxRetries}
          </Text>
        )}

        {isRetrying ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text variant="bodyMedium" style={styles.loadingText}>
              Retrying...
            </Text>
          </View>
        ) : (
          <View style={styles.buttons}>
            {canRetry && (
              <Button
                mode="contained"
                onPress={onRetry}
                style={styles.button}
                icon="refresh"
              >
                Retry
              </Button>
            )}

            {onSwitchSource && (
              <Button
                mode="outlined"
                onPress={onSwitchSource}
                style={styles.button}
                icon="swap-horizontal"
              >
                Switch Source
              </Button>
            )}

            <Button
              mode="text"
              onPress={onGoBack}
              style={styles.button}
              icon="arrow-left"
            >
              Go Back
            </Button>
          </View>
        )}

        <View style={styles.tips}>
          <Text variant="labelSmall" style={styles.tipsTitle}>
            Troubleshooting Tips:
          </Text>
          <Text variant="bodySmall" style={styles.tip}>
            • Check your internet connection
          </Text>
          <Text variant="bodySmall" style={styles.tip}>
            • Verify Jellyfin server is accessible
          </Text>
          <Text variant="bodySmall" style={styles.tip}>
            • Try switching between stream and download
          </Text>
          <Text variant="bodySmall" style={styles.tip}>
            • Restart the app if issues persist
          </Text>
        </View>
      </Surface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  content: {
    backgroundColor: "rgba(30,30,30,0.95)",
    padding: spacing.xl,
    borderRadius: 16,
    maxWidth: 500,
    width: "100%",
  },
  title: {
    color: "#ff6b6b",
    fontWeight: "bold",
    marginBottom: spacing.md,
    textAlign: "center",
  },
  message: {
    color: "white",
    marginBottom: spacing.md,
    textAlign: "center",
  },
  retryInfo: {
    color: "rgba(255,255,255,0.6)",
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  loadingText: {
    color: "white",
    marginTop: spacing.md,
  },
  buttons: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  button: {
    width: "100%",
  },
  tips: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: spacing.md,
    borderRadius: 8,
  },
  tipsTitle: {
    color: "white",
    fontWeight: "bold",
    marginBottom: spacing.xs,
  },
  tip: {
    color: "rgba(255,255,255,0.7)",
    marginVertical: 2,
  },
});
