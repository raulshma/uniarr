import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { Widget } from "@/services/widgets/WidgetService";

type HackerNewsWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const HackerNewsWidgetConfigForm: React.FC<HackerNewsWidgetConfigFormProps> = ({
  widget,
}) => (
  <View style={styles.container}>
    <Text variant="titleMedium" style={styles.title}>
      {widget.title}
    </Text>
    <Text variant="bodyMedium" style={styles.description}>
      The widget pulls the selected Hacker News feed directly from the API.
    </Text>
    <Text variant="bodySmall" style={styles.helper}>
      Feed selection controls are coming soon.
      {"\n"}
      For now, enable or disable the widget from the list.
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

export default HackerNewsWidgetConfigForm;
