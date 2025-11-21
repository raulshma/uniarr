import React from "react";
import { StyleSheet } from "react-native";
import { Dialog, Portal, Button, Text } from "react-native-paper";

interface ResumePlaybackDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onResume: () => void;
  onStartFromBeginning: () => void;
  itemTitle?: string | null;
  playedPercentage?: number | null;
  positionTicks?: number | null;
}

const formatTime = (ticks?: number | null): string => {
  if (!ticks || ticks <= 0) return "0:00";

  const totalSeconds = Math.floor(ticks / 10_000_000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const ResumePlaybackDialog: React.FC<ResumePlaybackDialogProps> = ({
  visible,
  onDismiss,
  onResume,
  onStartFromBeginning,
  itemTitle,
  playedPercentage,
  positionTicks,
}) => {
  const timeString = formatTime(positionTicks);
  const percentString = playedPercentage
    ? `${Math.round(playedPercentage)}%`
    : "";

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Resume Playback?</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">
            {itemTitle
              ? `"${itemTitle}" has been partially watched.`
              : "This item has been partially watched."}
          </Text>
          {(timeString || percentString) && (
            <Text variant="bodySmall" style={styles.progressText}>
              {timeString && `Position: ${timeString}`}
              {timeString && percentString && " • "}
              {percentString && `Progress: ${percentString}`}
            </Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onStartFromBeginning}>Start from beginning</Button>
          <Button mode="contained" onPress={onResume}>
            Resume
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 400,
    alignSelf: "center",
  },
  progressText: {
    marginTop: 8,
    opacity: 0.7,
  },
});
