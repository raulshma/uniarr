import React, { useMemo } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import {
  Text,
  List,
  useTheme,
  Surface,
  IconButton,
  Chip,
  TouchableRipple,
} from "react-native-paper";
import type { MD3Theme } from "react-native-paper/lib/typescript/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  onClose: () => void;
}

export const AssistantMenuContent: React.FC<Props> = ({ onClose }) => {
  const theme = useTheme<MD3Theme>();
  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // ScrollView wrapper must be allowed to stretch to the available
        // height so the inner content can scroll. Move width/height to the
        // scroll container and keep content container focused on padding.
        container: {
          width: 300,
          height: "100%",
        },
        content: {
          backgroundColor: theme.colors.surface,
          paddingVertical: 8,
          paddingHorizontal: 12,
        },
        safePaddingTop: {
          paddingTop: 8,
          paddingBottom: insets.bottom + 12,
        },
        hero: {
          borderRadius: 12,
          overflow: "hidden",
          padding: 14,
          marginBottom: 12,
        },
        heroTitleRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        heroTitle: {
          fontWeight: "700",
        },
        heroSubtitle: {
          marginTop: 8,
          marginBottom: 6,
        },
        suggestionRow: {
          marginTop: 10,
          flexDirection: "column",
          gap: 8,
        },
        suggestionButton: {
          borderRadius: 12,
          paddingHorizontal: 10,
          paddingVertical: 12,
          alignItems: "flex-start",
        },
        menuSection: {
          marginTop: 10,
        },
        menuItemWrapper: {
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 8,
        },
        menuItem: {
          paddingVertical: 12,
          paddingHorizontal: 8,
        },
      }),
    [theme.colors.surface, insets.bottom],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, styles.safePaddingTop]}
      keyboardShouldPersistTaps="handled"
      overScrollMode="always"
      showsVerticalScrollIndicator={true}
    >
      <Surface
        style={[styles.hero, { backgroundColor: theme.colors.surfaceVariant }]}
        elevation={2}
      >
        <View style={styles.heroTitleRow}>
          <Text variant="headlineSmall" style={styles.heroTitle}>
            Media AI
          </Text>
          <IconButton
            icon="close"
            onPress={() => onClose()}
            accessibilityLabel="Close assistant menu"
          />
        </View>

        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          Ask me about your media infrastructure or get started with a
          suggestion below.
        </Text>

        <View style={styles.suggestionRow}>
          {[
            "Hello! How can you help me?",
            "What can you do?",
            "Tell me something interesting",
            "Show me trending movies",
          ].map((text) => (
            <TouchableRipple
              key={text}
              style={styles.suggestionButton}
              borderless={true}
              onPress={() => onClose()}
              accessibilityLabel={text}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Chip
                  icon="help"
                  style={{ backgroundColor: theme.colors.primary, height: 36 }}
                  textStyle={{ color: theme.colors.onPrimary }}
                >
                  ?
                </Chip>
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.onSurface }}
                >
                  {text}
                </Text>
              </View>
            </TouchableRipple>
          ))}
        </View>
      </Surface>

      <View style={styles.menuSection}>
        <Text variant="titleMedium" style={{ marginBottom: 8 }}>
          Menu
        </Text>
        <View>
          {[
            { title: "Chat History", icon: "history" },
            { title: "Saved Prompts", icon: "bookmark" },
            { title: "Settings", icon: "cog" },
            { title: "Help", icon: "help-circle" },
          ].map((item) => (
            <View key={item.title} style={styles.menuItemWrapper}>
              <TouchableRipple
                onPress={() => onClose()}
                rippleColor={theme.colors.primary + "22"}
                accessibilityRole="button"
              >
                <View
                  style={[
                    styles.menuItem,
                    { backgroundColor: theme.colors.surface },
                  ]}
                >
                  <List.Icon icon={item.icon} color={theme.colors.primary} />
                  <Text variant="titleSmall" style={{ marginLeft: 4 }}>
                    {item.title}
                  </Text>
                </View>
              </TouchableRipple>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

export default AssistantMenuContent;
