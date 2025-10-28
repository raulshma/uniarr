import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { Widget } from "@/services/widgets/WidgetService";

type DownloadProgressWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const DownloadProgressWidgetConfigForm: React.FC<
  DownloadProgressWidgetConfigFormProps
> = ({ widget }) => (
  <View style={styles.container}>
    <Text variant="titleMedium" style={styles.title}>
      {widget.title}
    </Text>
    <Text variant="bodyMedium" style={styles.description}>
      This widget shows active downloads detected from your connected services.
    </Text>
    <Text variant="bodySmall" style={styles.helper}>
      No additional configuration is required right now.
      {"\n"}
      Enable or disable the widget from the widgets list.
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

export default DownloadProgressWidgetConfigForm;
