import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, IconButton } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/hooks/useTheme";

export default function ThinkingModal() {
  const router = useRouter();
  const { thinking } = useLocalSearchParams<{ thinking: string }>();
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outlineVariant,
        },
        headerTitle: {
          flex: 1,
          fontSize: 18,
          fontWeight: "600",
          color: theme.colors.onBackground,
        },
        contentContainer: {
          flex: 1,
          padding: 16,
        },
        thinkingText: {
          fontSize: 14,
          lineHeight: 20,
          color: theme.colors.onBackground,
          fontFamily: "monospace",
        },
        emptyState: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 16,
        },
        emptyStateText: {
          fontSize: 16,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
        },
      }),
    [theme],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Extended Thinking</Text>
        <IconButton icon="close" size={24} onPress={() => router.back()} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.contentContainer}
        contentContainerStyle={!thinking ? styles.emptyState : undefined}
      >
        {thinking ? (
          <Text style={styles.thinkingText}>{thinking}</Text>
        ) : (
          <Text style={styles.emptyStateText}>
            No thinking content available for this response.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
