import React, { memo, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import type { MD3Theme } from "react-native-paper/lib/typescript/types";

import type { Message } from "@/models/chat.types";

type ChatMessageProps = {
  message: Message;
  onLongPress?: () => void;
};

const STREAMING_TICK_MS = 450;

const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  message,
  onLongPress,
}) => {
  const theme = useTheme<MD3Theme>();
  const isUser = message.role === "user";
  const [indicatorDots, setIndicatorDots] = useState("...");

  useEffect(() => {
    if (!message.isStreaming) {
      return undefined;
    }

    setIndicatorDots(".");
    const intervalId = setInterval(() => {
      setIndicatorDots((prev) => {
        switch (prev.length) {
          case 1:
            return "..";
          case 2:
            return "...";
          default:
            return ".";
        }
      });
    }, STREAMING_TICK_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [message.isStreaming]);

  const timestampLabel = useMemo(() => {
    try {
      return message.timestamp.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [message.timestamp]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: isUser ? "row-reverse" : "row",
          marginVertical: 8,
          paddingHorizontal: 12,
          justifyContent: isUser ? "flex-end" : "flex-start",
        },
        bubble: {
          maxWidth: "85%",
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 16,
          backgroundColor: isUser
            ? theme.colors.primary
            : theme.colors.surfaceVariant,
        },
        messageText: {
          color: isUser ? theme.colors.onPrimary : theme.colors.onSurface,
          fontSize: 15,
          lineHeight: 22,
        },
        errorText: {
          marginTop: 4,
          fontSize: 12,
          color: theme.colors.error,
        },
        timestamp: {
          marginTop: 4,
          fontSize: 11,
          color: theme.colors.onSurfaceVariant,
        },
        streaming: {
          marginTop: 4,
          fontSize: 12,
          fontStyle: "italic",
          color: theme.colors.primary,
        },
      }),
    [
      isUser,
      theme.colors.onPrimary,
      theme.colors.onSurface,
      theme.colors.onSurfaceVariant,
      theme.colors.primary,
      theme.colors.surfaceVariant,
      theme.colors.error,
    ],
  );

  return (
    <Pressable
      accessibilityRole="text"
      style={styles.container}
      onLongPress={onLongPress}
      delayLongPress={500}
    >
      <View style={styles.bubble}>
        <Text style={styles.messageText}>{message.text}</Text>

        {message.error ? (
          <Text style={styles.errorText}>Error: {message.error}</Text>
        ) : null}

        {message.isStreaming ? (
          <Text style={styles.streaming}>Typing{indicatorDots}</Text>
        ) : null}

        {timestampLabel ? (
          <Text style={styles.timestamp}>{timestampLabel}</Text>
        ) : null}
      </View>
    </Pressable>
  );
};

export const ChatMessage = memo(ChatMessageComponent);
