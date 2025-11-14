import React, { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { IconButton, useTheme } from "react-native-paper";
import type { MD3Theme } from "react-native-paper/lib/typescript/types";

type ChatInputProps = {
  onSendMessage: (text: string) => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  allowVoice?: boolean;
  onVoicePress?: () => void;
};

const MAX_MESSAGE_LENGTH = 500;

const ChatInputComponent: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading = false,
  isStreaming = false,
  placeholder = "Ask about your media infrastructure...",
  allowVoice = true,
  onVoicePress,
}) => {
  const theme = useTheme<MD3Theme>();
  const [text, setText] = useState("");

  const isInteractionLocked = isLoading || isStreaming;
  const isSendDisabled = isInteractionLocked || text.trim().length === 0;

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || isSendDisabled) {
      return;
    }

    onSendMessage(trimmed);
    setText("");
  }, [isSendDisabled, onSendMessage, text]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          alignItems: "flex-end",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.outline,
          backgroundColor: theme.colors.surface,
        },
        inputContainer: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 24,
          backgroundColor: theme.colors.surfaceVariant,
          paddingHorizontal: 12,
          paddingVertical: 2,
          marginRight: 8,
        },
        input: {
          flex: 1,
          paddingVertical: 10,
          paddingHorizontal: 4,
          color: theme.colors.onSurface,
          fontSize: 15,
          maxHeight: 120,
        },
        sendButton: {
          justifyContent: "center",
          alignItems: "center",
          opacity: isSendDisabled ? 0.5 : 1,
        },
      }),
    [
      isSendDisabled,
      theme.colors.onSurface,
      theme.colors.outline,
      theme.colors.surface,
      theme.colors.surfaceVariant,
    ],
  );

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          editable={!isInteractionLocked}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
      </View>

      {allowVoice ? (
        <IconButton
          icon="microphone"
          iconColor={theme.colors.primary}
          size={24}
          disabled={isLoading || isStreaming}
          onPress={onVoicePress}
          accessibilityLabel="Start voice input"
        />
      ) : null}

      <Pressable
        style={styles.sendButton}
        disabled={isSendDisabled}
        onPress={handleSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
      >
        {isStreaming ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <IconButton
            icon="send"
            iconColor={theme.colors.primary}
            size={24}
            disabled={isSendDisabled}
          />
        )}
      </Pressable>
    </View>
  );
};

export const ChatInput = memo(ChatInputComponent);
