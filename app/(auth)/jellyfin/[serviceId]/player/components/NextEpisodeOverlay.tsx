/**
 * Next Episode Overlay
 * Shows countdown and next episode info before auto-playing
 */

import { View, StyleSheet, Pressable } from "react-native";
import { Text, Button, Surface } from "react-native-paper";
import { spacing } from "@/theme/spacing";
import {
  useJellyfinPlayerStore,
  selectNextEpisodeCountdown,
} from "@/store/jellyfinPlayerStore";

interface NextEpisodeOverlayProps {
  nextEpisodeTitle?: string;
  nextEpisodeNumber?: string;
  onPlayNow: () => void;
  onCancel: () => void;
}

export const NextEpisodeOverlay = ({
  nextEpisodeTitle,
  nextEpisodeNumber,
  onPlayNow,
  onCancel,
}: NextEpisodeOverlayProps) => {
  const countdown = useJellyfinPlayerStore(selectNextEpisodeCountdown);

  if (countdown === null) return null;

  return (
    <View style={styles.container}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <Surface style={styles.content} elevation={4}>
        <Text variant="titleMedium" style={styles.title}>
          Next Episode
        </Text>

        {nextEpisodeNumber && (
          <Text variant="labelLarge" style={styles.episodeNumber}>
            {nextEpisodeNumber}
          </Text>
        )}

        {nextEpisodeTitle && (
          <Text variant="bodyMedium" style={styles.episodeTitle}>
            {nextEpisodeTitle}
          </Text>
        )}

        <Text variant="bodyLarge" style={styles.countdown}>
          Playing in {countdown}s
        </Text>

        <View style={styles.buttons}>
          <Button mode="outlined" onPress={onCancel} style={styles.button}>
            Cancel
          </Button>
          <Button mode="contained" onPress={onPlayNow} style={styles.button}>
            Play Now
          </Button>
        </View>
      </Surface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  content: {
    backgroundColor: "rgba(30,30,30,0.95)",
    padding: spacing.xl,
    borderRadius: 12,
    minWidth: 300,
    maxWidth: 400,
    alignItems: "center",
  },
  title: {
    color: "white",
    fontWeight: "bold",
    marginBottom: spacing.sm,
  },
  episodeNumber: {
    color: "rgba(255,255,255,0.7)",
    marginBottom: spacing.xs,
  },
  episodeTitle: {
    color: "white",
    textAlign: "center",
    marginBottom: spacing.md,
  },
  countdown: {
    color: "white",
    fontWeight: "bold",
    fontSize: 24,
    marginBottom: spacing.lg,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  button: {
    minWidth: 120,
  },
});
