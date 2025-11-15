import React, { memo, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AIMessageCard } from "./AIMessageCard";
import { Text, useTheme } from "react-native-paper";
import type { MD3Theme } from "react-native-paper/lib/typescript/types";

import type { Message } from "@/models/chat.types";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type ChatMessageProps = {
  message: Message;
  onLongPress?: () => void;
  onAddToRadarr?: (msg: Message) => void;
  onShowCast?: (msg: Message) => void;
};

const STREAMING_TICK_MS = 450;

const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  message,
  onLongPress,
  onAddToRadarr,
  onShowCast,
}) => {
  const theme = useTheme<MD3Theme>();
  const isUser = message.role === "user";
  const [indicatorDots, setIndicatorDots] = useState(".");

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
          marginVertical: 6,
          paddingHorizontal: 16,
          gap: 12,
          alignItems: "flex-end",
        },
        avatarContainer: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isUser
            ? theme.colors.primary
            : theme.colors.surfaceVariant,
        },
        bubbleContainer: {
          maxWidth: "75%",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 20,
          backgroundColor: isUser
            ? theme.colors.primary
            : theme.colors.surfaceVariant,
        },
        messageText: {
          color: isUser
            ? theme.colors.onPrimary
            : theme.colors.onSurfaceVariant,
          fontSize: 15,
          lineHeight: 20,
          fontWeight: "400",
        },
        errorText: {
          marginTop: 6,
          fontSize: 12,
          color: isUser ? theme.colors.onPrimary : theme.colors.error,
          fontWeight: "500",
        },
        timestamp: {
          marginTop: 4,
          fontSize: 12,
          color: isUser
            ? "rgba(255,255,255,0.6)"
            : theme.colors.onSurfaceVariant,
        },
        streaming: {
          marginTop: 4,
          fontSize: 12,
          color: isUser
            ? "rgba(255,255,255,0.8)"
            : theme.colors.onSurfaceVariant,
        },
        content: {
          flex: 1,
          flexDirection: "column",
          alignItems: isUser ? "flex-end" : "flex-start",
        },
        cardWrapper: {
          marginTop: 6,
          maxWidth: "75%",
          alignSelf: isUser ? "flex-end" : "flex-start",
        },
      }),
    [
      isUser,
      theme.colors.primary,
      theme.colors.surfaceVariant,
      theme.colors.onPrimary,
      theme.colors.onSurfaceVariant,
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
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <MaterialCommunityIcons
          name={isUser ? "account" : "robot-happy"}
          size={18}
          color={
            isUser ? theme.colors.onPrimary : theme.colors.onSurfaceVariant
          }
        />
      </View>

      <View style={styles.content}>
        <View style={styles.bubbleContainer}>
          <Text style={styles.messageText}>{message.text}</Text>
          {message.error ? (
            <Text style={styles.errorText}>Error: {message.error}</Text>
          ) : null}
          {message.isStreaming ? (
            <Text style={styles.streaming}>Typing{indicatorDots}</Text>
          ) : null}
          {timestampLabel && !message.isStreaming ? (
            <Text style={styles.timestamp}>{timestampLabel}</Text>
          ) : null}
        </View>

        {/* Render optional rich card (templates like movie/article cards) */}
        {message.metadata?.card ? (
          <View style={styles.cardWrapper}>
            <AIMessageCard
              message={message}
              onAddToRadarr={() => {
                onAddToRadarr?.(message);
              }}
              onShowCast={() => onShowCast?.(message)}
              onFindSimilar={() => {}}
            />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

export const ChatMessage = memo(ChatMessageComponent);
