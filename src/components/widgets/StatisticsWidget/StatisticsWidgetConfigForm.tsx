import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { Widget } from "@/services/widgets/WidgetService";

type StatisticsWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const StatisticsWidgetConfigForm: React.FC<StatisticsWidgetConfigFormProps> = ({
  widget,
}) => (
  <View style={styles.container}>
    <Text variant="titleMedium" style={styles.title}>
      {widget.title}
    </Text>
    <Text variant="bodyMedium" style={styles.description}>
      Statistics are calculated automatically from your connected libraries.
    </Text>
    <Text variant="bodySmall" style={styles.helper}>
      Additional filters aren&apos;t available yet.
      {"\n"}
      Toggle the widget on the previous screen to hide or show it.
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

export default StatisticsWidgetConfigForm;
