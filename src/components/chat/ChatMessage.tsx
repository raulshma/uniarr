import React, { memo, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AIMessageCard } from "./AIMessageCard";
import { Text, IconButton } from "react-native-paper";
import { useConversationalAIStore } from "@/store/conversationalAIStore";
import { formatResponseTime, formatTokens } from "@/utils/formatting.utils";
import AppMarkdown from "@/components/markdown/AppMarkdown";
import { useRouter } from "expo-router";

import type { Message } from "@/models/chat.types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

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
  const theme = useTheme();
  const router = useRouter();
  const isUser = message.role === "user";
  const [indicatorDots, setIndicatorDots] = useState(".");
  const chatTextSize = useConversationalAIStore((s) => s.config.chatTextSize);

  const handleShowThinking = () => {
    if (message.metadata?.thinking) {
      router.push({
        pathname: "/(auth)/chat/thinking-modal",
        params: { thinking: message.metadata.thinking },
      });
    }
  };

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
          maxWidth: "100%",
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
          fontSize:
            chatTextSize === "extra-small"
              ? 10
              : chatTextSize === "small"
                ? 13
                : chatTextSize === "large"
                  ? 18
                  : 15,
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
        metadataText: {
          marginTop: 2,
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
      chatTextSize,
    ],
  );

  const showTokenCount = useConversationalAIStore(
    (s) => s.config.showTokenCount,
  );

  // Use the app typography base to derive a relative scale so markdown
  // text matches the message text size set in the chat settings.
  const markdownFontScale = useMemo(() => {
    const baseMarkdownFont =
      // prefer bodyLarge as the base for general markdown body text
      (theme.custom.typography.bodyLarge?.fontSize as number) ?? 16;

    const messageFontSize =
      chatTextSize === "extra-small"
        ? 10
        : chatTextSize === "small"
          ? 13
          : chatTextSize === "large"
            ? 18
            : 15;

    return messageFontSize / baseMarkdownFont;
  }, [chatTextSize, theme.custom.typography.bodyLarge?.fontSize]);

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
          {isUser ? (
            <Text style={styles.messageText}>{message.text}</Text>
          ) : (
            <AppMarkdown
              value={message.text}
              flatListProps={{
                scrollEnabled: false,
                nestedScrollEnabled: false,
              }}
              fontScale={markdownFontScale}
            />
          )}
          {message.error ? (
            <Text style={styles.errorText}>Error: {message.error}</Text>
          ) : null}
          {message.isStreaming ? (
            <Text style={styles.streaming}>Typing{indicatorDots}</Text>
          ) : null}

          {/* Tool Invocations */}
          {message.toolInvocations && message.toolInvocations.length > 0 ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              {message.toolInvocations.map((invocation) => (
                <View
                  key={invocation.toolCallId}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    borderRadius: 8,
                    backgroundColor: isUser
                      ? "rgba(255,255,255,0.1)"
                      : theme.colors.surface,
                  }}
                >
                  <MaterialCommunityIcons
                    name={
                      invocation.state === "completed"
                        ? "check-circle"
                        : invocation.state === "failed"
                          ? "alert-circle"
                          : invocation.state === "executing"
                            ? "loading"
                            : "clock-outline"
                    }
                    size={14}
                    color={
                      invocation.state === "completed"
                        ? theme.colors.primary
                        : invocation.state === "failed"
                          ? theme.colors.error
                          : isUser
                            ? "rgba(255,255,255,0.7)"
                            : theme.colors.onSurfaceVariant
                    }
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      color: isUser
                        ? "rgba(255,255,255,0.8)"
                        : theme.colors.onSurfaceVariant,
                      fontWeight: "500",
                    }}
                  >
                    {invocation.state === "executing"
                      ? `🔧 ${invocation.toolName}...`
                      : invocation.state === "completed"
                        ? `✓ ${invocation.toolName}`
                        : invocation.state === "failed"
                          ? `✗ ${invocation.toolName}`
                          : invocation.toolName}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-start",
              alignItems: "center",
              gap: theme.custom.spacing.xs,
            }}
          >
            {timestampLabel && !message.isStreaming ? (
              <Text style={styles.timestamp}>{timestampLabel}</Text>
            ) : null}
            {showTokenCount &&
            !message.isStreaming &&
            (message.metadata?.duration !== undefined ||
              message.metadata?.tokens !== undefined) ? (
              <Text style={styles.metadataText}>
                {message.metadata?.duration !== undefined
                  ? `${formatResponseTime(message.metadata?.duration)} `
                  : ""}
                {message.metadata?.tokens !== undefined
                  ? ` • ${formatTokens(message.metadata?.tokens)} tokens`
                  : ""}
              </Text>
            ) : null}
            {!isUser && message.metadata?.thinking && !message.isStreaming ? (
              <IconButton
                icon="lightbulb-on"
                size={16}
                onPress={handleShowThinking}
                style={{ margin: 0 }}
              />
            ) : null}
          </View>
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
