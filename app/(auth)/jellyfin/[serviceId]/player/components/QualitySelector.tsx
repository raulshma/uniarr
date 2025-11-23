/**
 * Quality Selector Component
 * Allows users to select video quality for streaming
 */

import { View, StyleSheet, ScrollView } from "react-native";
import { Text, RadioButton, Surface } from "react-native-paper";
import { spacing } from "@/theme/spacing";
import {
  useJellyfinPlayerStore,
  selectQualityMenuVisible,
  selectSelectedQuality,
  selectSetSelectedQuality,
} from "@/store/jellyfinPlayerStore";

export interface QualityOption {
  id: string;
  label: string;
  bitrate?: number;
  resolution?: string;
}

interface QualitySelectorProps {
  options: QualityOption[];
}

export const QualitySelector = ({ options }: QualitySelectorProps) => {
  const visible = useJellyfinPlayerStore(selectQualityMenuVisible);
  const selected = useJellyfinPlayerStore(selectSelectedQuality);
  const setSelected = useJellyfinPlayerStore(selectSetSelectedQuality);

  if (!visible) return null;

  return (
    <Surface style={styles.container} elevation={3}>
      <Text variant="titleSmall" style={styles.title}>
        Video Quality
      </Text>
      <ScrollView style={styles.scrollView}>
        <RadioButton.Group onValueChange={setSelected} value={selected}>
          {options.map((option) => (
            <View key={option.id} style={styles.option}>
              <RadioButton.Item
                label={option.label}
                value={option.id}
                labelStyle={styles.optionLabel}
              />
              {option.resolution && (
                <Text variant="bodySmall" style={styles.optionDetail}>
                  {option.resolution}
                  {option.bitrate &&
                    ` • ${(option.bitrate / 1000000).toFixed(1)} Mbps`}
                </Text>
              )}
            </View>
          ))}
        </RadioButton.Group>
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
    minWidth: 250,
    maxHeight: 400,
  },
  title: {
    color: "white",
    fontWeight: "bold",
    marginBottom: spacing.sm,
  },
  scrollView: {
    maxHeight: 300,
  },
  option: {
    marginVertical: spacing.xs,
  },
  optionLabel: {
    color: "white",
  },
  optionDetail: {
    color: "rgba(255,255,255,0.6)",
    marginLeft: spacing.xl + spacing.md,
    marginTop: -spacing.xs,
  },
});
