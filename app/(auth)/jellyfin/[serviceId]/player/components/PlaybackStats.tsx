/**
 * Playback Statistics Overlay
 * Shows detailed playback information for debugging and monitoring
 */

import { View, StyleSheet } from "react-native";
import { Text, Surface } from "react-native-paper";
import { spacing } from "@/theme/spacing";
import {
  useJellyfinPlayerStore,
  selectShowPlaybackStats,
  selectPlaybackRate,
  selectPlayerVolume,
  selectPlayerBrightness,
} from "@/store/jellyfinPlayerStore";

interface PlaybackStatsProps {
  currentTime: number;
  duration: number;
  bufferedPosition: number;
  resolution?: string;
  bitrate?: number;
  codec?: string;
  fps?: number;
  droppedFrames?: number;
  audioTrack?: string;
  subtitleTrack?: string;
}

export const PlaybackStats = ({
  currentTime,
  duration,
  bufferedPosition,
  resolution,
  bitrate,
  codec,
  fps,
  droppedFrames,
  audioTrack,
  subtitleTrack,
}: PlaybackStatsProps) => {
  const visible = useJellyfinPlayerStore(selectShowPlaybackStats);
  const playbackRate = useJellyfinPlayerStore(selectPlaybackRate);
  const volume = useJellyfinPlayerStore(selectPlayerVolume);
  const brightness = useJellyfinPlayerStore(selectPlayerBrightness);

  if (!visible) return null;
  const formatBytes = (bytes?: number) => {
    if (!bytes) return "N/A";
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} Mbps`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const bufferHealth = bufferedPosition - currentTime;

  return (
    <Surface style={styles.container} elevation={2}>
      <Text variant="labelSmall" style={styles.title}>
        Playback Statistics
      </Text>

      <View style={styles.row}>
        <Text style={styles.label}>Time:</Text>
        <Text style={styles.value}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Buffer:</Text>
        <Text style={styles.value}>{bufferHealth.toFixed(1)}s</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Speed:</Text>
        <Text style={styles.value}>{playbackRate}x</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Volume:</Text>
        <Text style={styles.value}>{Math.round(volume * 100)}%</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Brightness:</Text>
        <Text style={styles.value}>{Math.round(brightness * 100)}%</Text>
      </View>

      {resolution && (
        <View style={styles.row}>
          <Text style={styles.label}>Resolution:</Text>
          <Text style={styles.value}>{resolution}</Text>
        </View>
      )}

      {bitrate && (
        <View style={styles.row}>
          <Text style={styles.label}>Bitrate:</Text>
          <Text style={styles.value}>{formatBytes(bitrate)}</Text>
        </View>
      )}

      {codec && (
        <View style={styles.row}>
          <Text style={styles.label}>Codec:</Text>
          <Text style={styles.value}>{codec}</Text>
        </View>
      )}

      {fps && (
        <View style={styles.row}>
          <Text style={styles.label}>FPS:</Text>
          <Text style={styles.value}>{fps}</Text>
        </View>
      )}

      {droppedFrames !== undefined && (
        <View style={styles.row}>
          <Text style={styles.label}>Dropped:</Text>
          <Text style={styles.value}>{droppedFrames} frames</Text>
        </View>
      )}

      {audioTrack && (
        <View style={styles.row}>
          <Text style={styles.label}>Audio:</Text>
          <Text style={styles.value} numberOfLines={1}>
            {audioTrack}
          </Text>
        </View>
      )}

      {subtitleTrack && (
        <View style={styles.row}>
          <Text style={styles.label}>Subtitle:</Text>
          <Text style={styles.value} numberOfLines={1}>
            {subtitleTrack}
          </Text>
        </View>
      )}
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    right: spacing.md,
    padding: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 8,
    minWidth: 200,
    maxWidth: 300,
  },
  title: {
    color: "white",
    fontWeight: "bold",
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  label: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginRight: spacing.sm,
  },
  value: {
    color: "white",
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
});
