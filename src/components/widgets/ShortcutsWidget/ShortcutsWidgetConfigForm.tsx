import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { Widget } from "@/services/widgets/WidgetService";

type ShortcutsWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const ShortcutsWidgetConfigForm: React.FC<ShortcutsWidgetConfigFormProps> = ({
  widget,
}) => {
  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.title}>
        {widget.title}
      </Text>
      <Text variant="bodyMedium" style={styles.description}>
        Shortcut management is coming soon.
      </Text>
      <Text variant="bodySmall" style={styles.helper}>
        Existing shortcuts remain available.
        {"\n"}
        Watch for an upcoming update that adds a full editor here.
      </Text>
    </View>
  );
};

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

export default ShortcutsWidgetConfigForm;
