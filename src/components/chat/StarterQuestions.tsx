import React, { memo, useMemo, useEffect, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Animated,
} from "react-native";
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
          alignSelf: "stretch",
          width: "100%",
        },
        iconContainer: {
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: theme.colors.primary,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginRight: 14,
        },
        textContainer: {
          flex: 1,
          justifyContent: "center",
          flexShrink: 1,
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

  const animations = useRef<
    { opacity: Animated.Value; scale: Animated.Value }[]
  >([]);

  useEffect(() => {
    animations.current = questions.map(() => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.95),
    }));

    questions.forEach((_, index) => {
      if (index < animations.current.length) {
        const timeoutId = setTimeout(() => {
          Animated.parallel([
            Animated.spring(animations.current[index]!.scale, {
              toValue: 1,
              tension: 300,
              friction: 6,
              useNativeDriver: true,
            }),
            Animated.timing(animations.current[index]!.opacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
          ]).start();
        }, index * 80);

        return () => clearTimeout(timeoutId);
      }
    });

    return () => {
      animations.current.forEach(({ opacity, scale }) => {
        opacity.resetAnimation();
        scale.resetAnimation();
      });
    };
  }, [questions]);

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
        {questions.map((question, index) =>
          index < animations.current.length ? (
            <Pressable
              key={question}
              onPress={() => onSelectQuestion(question)}
              accessibilityRole="button"
              accessible={true}
              testID={`starter-question-${index}`}
              accessibilityLabel={question}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={({ pressed }) => [
                styles.suggestionCard,
                {
                  width: "100%",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Animated.View
                style={{
                  opacity: animations.current[index]!.opacity,
                  transform: [{ scale: animations.current[index]!.scale }],
                  flexDirection: "row",
                  alignItems: "center",
                  width: "100%",
                }}
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
              </Animated.View>
            </Pressable>
          ) : (
            <Pressable
              key={question}
              onPress={() => onSelectQuestion(question)}
              accessibilityRole="button"
              accessible={true}
              testID={`starter-question-${index}`}
              accessibilityLabel={question}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={({ pressed }) => [
                styles.suggestionCard,
                {
                  width: "100%",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
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
          ),
        )}
      </ScrollView>
    </View>
  );
};

export const StarterQuestions = memo(StarterQuestionsComponent);
