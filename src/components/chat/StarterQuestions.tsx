import React, { memo, useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Chip, Text, useTheme } from "react-native-paper";
import type { MD3Theme } from "react-native-paper/lib/typescript/types";

export type StarterQuestionsProps = {
  questions: string[];
  onSelectQuestion: (question: string) => void;
};

const StarterQuestionsComponent: React.FC<StarterQuestionsProps> = ({
  questions,
  onSelectQuestion,
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
          marginBottom: 24,
        },
        title: {
          fontSize: 20,
          fontWeight: "600",
          color: theme.colors.onSurface,
          marginBottom: 8,
        },
        subtitle: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
        },
        list: {
          flexGrow: 0,
        },
        chip: {
          marginBottom: 12,
          marginHorizontal: 8,
        },
      }),
    [theme.colors.onSurface, theme.colors.onSurfaceVariant],
  );

  if (!questions.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>UniArr Assistant</Text>
        <Text style={styles.subtitle}>
          Ask me about your media infrastructure or get started with a
          suggestion below.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 8 }}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {questions.map((question) => (
          <Chip
            key={question}
            mode="outlined"
            onPress={() => onSelectQuestion(question)}
            style={styles.chip}
            icon="message-question"
          >
            {question}
          </Chip>
        ))}
      </ScrollView>
    </View>
  );
};

export const StarterQuestions = memo(StarterQuestionsComponent);
