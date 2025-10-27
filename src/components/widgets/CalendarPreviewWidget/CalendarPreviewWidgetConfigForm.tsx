import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { Widget } from "@/services/widgets/WidgetService";

type CalendarPreviewWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const CalendarPreviewWidgetConfigForm: React.FC<
  CalendarPreviewWidgetConfigFormProps
> = ({ widget }) => (
  <View style={styles.container}>
    <Text variant="titleMedium" style={styles.title}>
      {widget.title}
    </Text>
    <Text variant="bodyMedium" style={styles.description}>
      The calendar preview mirrors your Sonarr and Radarr release data.
    </Text>
    <Text variant="bodySmall" style={styles.helper}>
      Configuration options are planned, but not available yet.
      {"\n"}
      Releases will automatically appear as they are scheduled.
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingVertical: 16,
  },
  title: {
    fontWeight: "600",
  },
  description: {
    opacity: 0.8,
  },
  helper: {
    opacity: 0.6,
  },
});

export default CalendarPreviewWidgetConfigForm;
