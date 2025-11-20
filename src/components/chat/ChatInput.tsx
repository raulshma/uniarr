import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  Animated,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";

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
  placeholder = "Ask about movies, shows.",
  allowVoice = true,
  onVoicePress,
}) => {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const sendScale = useRef(new Animated.Value(1)).current;
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

  const handlePressIn = useCallback(() => {
    Animated.spring(sendScale, {
      toValue: 0.9,
      tension: 250,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [sendScale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(sendScale, {
      toValue: 1.05,
      tension: 300,
      friction: 4,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(sendScale, {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }).start();
    });
  }, [sendScale]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingVertical: 12,
          paddingBottom: 16,
        },
        container: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        },
        inputShell: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 30,
          backgroundColor: theme.colors.surface,
          paddingHorizontal: 6,
          paddingVertical: 6,
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.05)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        },
        input: {
          flex: 1,
          paddingVertical: 12,
          paddingHorizontal: 12,
          color: theme.colors.onSurface,
          fontSize: 16,
          minHeight: 44,
        },
        utilityButton: {
          width: 34,
          height: 34,
          borderRadius: theme.custom.spacing.sm,
          marginRight: theme.custom.spacing.xs,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.outline,
        },
        sendButton: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.primary,
          borderWidth: 0,
        },
        sendButtonDisabled: {
          opacity: 0.5,
        },
      }),
    [theme],
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.inputShell}>
          <TextInput
            ref={inputRef}
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
            keyboardType="default"
            returnKeyType="send"
            returnKeyLabel="Send"
            textAlignVertical="center"
            underlineColorAndroid="transparent"
          />

          {allowVoice ? (
            <Pressable
              style={styles.utilityButton}
              onPress={onVoicePress}
              disabled={isLoading || isStreaming}
              accessibilityLabel="Start voice input"
            >
              <MaterialCommunityIcons
                name="microphone"
                size={20}
                color={
                  isLoading || isStreaming
                    ? theme.colors.onSurfaceVariant
                    : theme.colors.primary
                }
              />
            </Pressable>
          ) : null}
        </View>

        <Animated.View style={{ transform: [{ scale: sendScale }] }}>
          <Pressable
            style={[
              styles.sendButton,
              isSendDisabled && styles.sendButtonDisabled,
            ]}
            disabled={isSendDisabled}
            onPress={handleSend}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {isStreaming ? (
              <ActivityIndicator size="small" color={theme.colors.onPrimary} />
            ) : (
              <MaterialCommunityIcons
                name="send"
                size={20}
                color={theme.colors.onPrimary}
              />
            )}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
};

export const ChatInput = memo(ChatInputComponent);
