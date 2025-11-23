/**
 * Player Settings Panel
 * Advanced settings for customizing player behavior
 */

import { View, StyleSheet, ScrollView } from "react-native";
import { Text, Switch, Surface, Divider } from "react-native-paper";
import { spacing } from "@/theme/spacing";
import {
  useJellyfinPlayerStore,
  selectGesturesEnabled,
  selectSetGesturesEnabled,
  selectAutoPlayNextEpisode,
  selectSetAutoPlayNextEpisode,
  selectSkipIntroEnabled,
  selectSetSkipIntroEnabled,
  selectPipEnabled,
  selectSetPipEnabled,
  selectShowPlaybackStats,
  selectSetShowPlaybackStats,
} from "@/store/jellyfinPlayerStore";

export const PlayerSettings = () => {
  const gesturesEnabled = useJellyfinPlayerStore(selectGesturesEnabled);
  const setGesturesEnabled = useJellyfinPlayerStore(selectSetGesturesEnabled);
  const autoPlayNextEpisode = useJellyfinPlayerStore(selectAutoPlayNextEpisode);
  const setAutoPlayNextEpisode = useJellyfinPlayerStore(
    selectSetAutoPlayNextEpisode,
  );
  const skipIntroEnabled = useJellyfinPlayerStore(selectSkipIntroEnabled);
  const setSkipIntroEnabled = useJellyfinPlayerStore(selectSetSkipIntroEnabled);
  const pipEnabled = useJellyfinPlayerStore(selectPipEnabled);
  const setPipEnabled = useJellyfinPlayerStore(selectSetPipEnabled);
  const showPlaybackStats = useJellyfinPlayerStore(selectShowPlaybackStats);
  const setShowPlaybackStats = useJellyfinPlayerStore(
    selectSetShowPlaybackStats,
  );

  return (
    <Surface style={styles.container} elevation={3}>
      <Text variant="titleMedium" style={styles.title}>
        Player Settings
      </Text>

      <ScrollView style={styles.scrollView}>
        <View style={styles.setting}>
          <View style={styles.settingInfo}>
            <Text variant="bodyMedium" style={styles.settingLabel}>
              Gesture Controls
            </Text>
            <Text variant="bodySmall" style={styles.settingDescription}>
              Swipe to seek, adjust volume and brightness
            </Text>
          </View>
          <Switch value={gesturesEnabled} onValueChange={setGesturesEnabled} />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.setting}>
          <View style={styles.settingInfo}>
            <Text variant="bodyMedium" style={styles.settingLabel}>
              Auto-Play Next Episode
            </Text>
            <Text variant="bodySmall" style={styles.settingDescription}>
              Automatically play next episode after countdown
            </Text>
          </View>
          <Switch
            value={autoPlayNextEpisode}
            onValueChange={setAutoPlayNextEpisode}
          />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.setting}>
          <View style={styles.settingInfo}>
            <Text variant="bodyMedium" style={styles.settingLabel}>
              Skip Intro
            </Text>
            <Text variant="bodySmall" style={styles.settingDescription}>
              Show button to skip opening credits
            </Text>
          </View>
          <Switch
            value={skipIntroEnabled}
            onValueChange={setSkipIntroEnabled}
          />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.setting}>
          <View style={styles.settingInfo}>
            <Text variant="bodyMedium" style={styles.settingLabel}>
              Picture-in-Picture
            </Text>
            <Text variant="bodySmall" style={styles.settingDescription}>
              Continue watching in a floating window
            </Text>
          </View>
          <Switch value={pipEnabled} onValueChange={setPipEnabled} />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.setting}>
          <View style={styles.settingInfo}>
            <Text variant="bodyMedium" style={styles.settingLabel}>
              Playback Statistics
            </Text>
            <Text variant="bodySmall" style={styles.settingDescription}>
              Show detailed playback information
            </Text>
          </View>
          <Switch
            value={showPlaybackStats}
            onValueChange={setShowPlaybackStats}
          />
        </View>
      </ScrollView>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    right: spacing.md,
    backgroundColor: "rgba(30,30,30,0.95)",
    borderRadius: 12,
    padding: spacing.md,
    minWidth: 320,
    maxHeight: 500,
  },
  title: {
    color: "white",
    fontWeight: "bold",
    marginBottom: spacing.md,
  },
  scrollView: {
    maxHeight: 400,
  },
  setting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    color: "white",
    fontWeight: "500",
    marginBottom: spacing.xs,
  },
  settingDescription: {
    color: "rgba(255,255,255,0.6)",
  },
  divider: {
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: spacing.xs,
  },
});
