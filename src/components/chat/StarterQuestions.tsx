import React, { memo, useMemo } from "react";
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { Text, useTheme } from "react-native-paper";
import type { MD3Theme } from "react-native-paper/lib/typescript/types";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export type StarterQuestionsProps = {
  questions: string[];
  onSelectQuestion: (question: string) => void;
  title?: string;
};

const StarterQuestionsComponent: React.FC<StarterQuestionsProps> = ({
  questions,
  onSelectQuestion,
  title = "Media AI",
}) => {
  const theme = useTheme<MD3Theme>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingHorizontal: 16,
          paddingVertical: 24,
          justifyContent: "center",
        },
        header: {
          alignItems: "center",
          marginBottom: 32,
        },
        title: {
          fontSize: 24,
          fontWeight: "700",
          color: theme.colors.onBackground,
          marginBottom: 8,
          letterSpacing: -0.5,
        },
        subtitle: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          lineHeight: 20,
        },
        list: {
          flexGrow: 0,
        },
        suggestionCard: {
          marginHorizontal: 0,
          marginBottom: 12,
          paddingHorizontal: 16,
          paddingVertical: 16,
          borderRadius: 14,
          backgroundColor: theme.colors.surfaceVariant,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        },
        iconContainer: {
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: theme.colors.primary,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        },
        textContainer: {
          flex: 1,
          justifyContent: "center",
        },
        suggestionText: {
          fontSize: 15,
          fontWeight: "500",
          color: theme.colors.onSurfaceVariant,
          lineHeight: 20,
        },
      }),
    [
      theme.colors.onBackground,
      theme.colors.onSurfaceVariant,
      theme.colors.surfaceVariant,
      theme.colors.primary,
    ],
  );

  const getIconForQuestion = (
    question: string,
  ): keyof typeof MaterialCommunityIcons.glyphMap => {
    const lowerQuestion = question.toLowerCase();
    if (lowerQuestion.includes("trending")) return "trending-up";
    if (lowerQuestion.includes("cast") || lowerQuestion.includes("actor"))
      return "account-multiple";
    if (lowerQuestion.includes("similar")) return "shape-plus";
    if (lowerQuestion.includes("radarr") || lowerQuestion.includes("add"))
      return "plus-circle";
    if (lowerQuestion.includes("release")) return "calendar";
    if (lowerQuestion.includes("popular")) return "fire";
    if (lowerQuestion.includes("top")) return "crown";
    return "chat-outline";
  };

  if (!questions.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          Ask me about your media infrastructure or get started with a
          suggestion below.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 0 }}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {questions.map((question) => (
          <Pressable
            key={question}
            style={({ pressed }) => [
              styles.suggestionCard,
              {
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => onSelectQuestion(question)}
            accessibilityRole="button"
          >
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name={getIconForQuestion(question)}
                size={20}
                color={theme.colors.onPrimary}
              />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.suggestionText}>{question}</Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

export const StarterQuestions = memo(StarterQuestionsComponent);
