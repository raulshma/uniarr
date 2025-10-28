import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

interface WidgetConfigFormScaffoldProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

const WidgetConfigFormScaffold: React.FC<WidgetConfigFormScaffoldProps> = ({
  title,
  description,
  children,
}) => (
  <View style={styles.container}>
    <Text variant="titleLarge" style={styles.title}>
      {title}
    </Text>
    {description ? (
      <Text variant="bodyMedium" style={styles.description}>
        {description}
      </Text>
    ) : null}
    <View style={styles.content}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  title: {
    fontWeight: "600",
  },
  description: {
    opacity: 0.7,
  },
  content: {
    gap: 20,
  },
});

export default WidgetConfigFormScaffold;
