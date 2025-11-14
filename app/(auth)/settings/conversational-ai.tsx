import React, { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { GiftedChat, type IMessage } from "react-native-gifted-chat";
import { ActivityIndicator, Text, useTheme, Button } from "react-native-paper";
import type { MD3Theme } from "react-native-paper/lib/typescript/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ChatErrorBoundary } from "@/components/chat/ChatErrorBoundary";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { StarterQuestions } from "@/components/chat/StarterQuestions";
import { useConversationalAI } from "@/hooks/useConversationalAI";
import type { Message } from "@/models/chat.types";
import { AIProviderManager } from "@/services/ai/core/AIProviderManager";

const USER_ID = "user";
const ASSISTANT_ID = "assistant";

const ConversationalAIScreen: React.FC = () => {
  const theme = useTheme<MD3Theme>();
  const router = useRouter();
  const providerManager = AIProviderManager.getInstance();
  const [hasAIProvider, setHasAIProvider] = useState(true);

  // Check if AI provider is configured
  useEffect(() => {
    let isMounted = true;

    const updateProviderState = () => {
      if (!isMounted) {
        return;
      }
      setHasAIProvider(Boolean(providerManager.getActiveProvider()));
    };

    updateProviderState();
    const unsubscribe = providerManager.subscribe(updateProviderState);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [providerManager]);

  const {
    messages,
    isLoading,
    isStreaming,
    error,
    starterQuestions,
    sendMessage,
    isReady,
  } = useConversationalAI();

  const [showStarters, setShowStarters] = useState(() => messages.length === 0);

  useEffect(() => {
    if (messages.length === 0) {
      setShowStarters(true);
    }
  }, [messages.length]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        loadingState: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        },
        loadingText: {
          fontSize: 16,
          color: theme.colors.onSurfaceVariant,
        },
        chatWrapper: {
          flex: 1,
        },
        errorBanner: {
          backgroundColor: theme.colors.errorContainer,
          paddingVertical: 8,
          paddingHorizontal: 16,
        },
        errorText: {
          color: theme.colors.onErrorContainer,
          fontSize: 13,
        },
        startersWrapper: {
          flex: 1,
        },
        setupContainer: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 16,
        },
        setupText: {
          fontSize: 16,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
        },
        setupButton: {
          marginTop: 16,
        },
      }),
    [
      theme.colors.background,
      theme.colors.errorContainer,
      theme.colors.onErrorContainer,
      theme.colors.onSurfaceVariant,
    ],
  );

  const messageLookup = useMemo(() => {
    const lookup = new Map<string, Message>();
    messages.forEach((msg) => {
      lookup.set(msg.id, msg);
    });
    return lookup;
  }, [messages]);

  const giftedMessages = useMemo<IMessage[]>(() => {
    return messages
      .map((msg) => ({
        _id: msg.id,
        text: msg.text,
        createdAt: msg.timestamp,
        user: {
          _id: msg.role === "user" ? USER_ID : ASSISTANT_ID,
          name: msg.role === "user" ? "You" : "UniArr Assistant",
        },
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [messages]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        return;
      }

      setShowStarters(false);
      await sendMessage(text);
    },
    [sendMessage],
  );

  const handleSelectStarter = useCallback(
    async (question: string) => {
      setShowStarters(false);
      await sendMessage(question);
    },
    [sendMessage],
  );

  const renderMessage = useCallback(
    ({ currentMessage }: { currentMessage?: IMessage }) => {
      if (!currentMessage) {
        return <></>;
      }

      const sourceMessage = messageLookup.get(String(currentMessage._id));
      if (!sourceMessage) {
        return <></>;
      }

      return <ChatMessage message={sourceMessage} />;
    },
    [messageLookup],
  );

  // Show setup message if no AI provider is configured
  if (!hasAIProvider) {
    return (
      <ChatErrorBoundary>
        <SafeAreaView style={styles.container}>
          <View style={styles.setupContainer}>
            <Text variant="headlineSmall" style={{ textAlign: "center" }}>
              AI Not Configured
            </Text>
            <Text style={styles.setupText}>
              To use the conversational AI assistant, you need to configure an
              AI provider first.
            </Text>
            <Button
              mode="contained"
              onPress={() => {
                router.push("/(auth)/settings/byok/ai-settings");
              }}
              style={styles.setupButton}
            >
              Configure AI Provider
            </Button>
          </View>
        </SafeAreaView>
      </ChatErrorBoundary>
    );
  }

  if (!isReady) {
    return (
      <ChatErrorBoundary>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>
              Initializing conversational AI…
            </Text>
            <Text style={{ ...styles.loadingText, fontSize: 12, marginTop: 8 }}>
              (This may take a moment while checking AI provider configuration)
            </Text>
          </View>
        </SafeAreaView>
      </ChatErrorBoundary>
    );
  }

  return (
    <ChatErrorBoundary>
      <SafeAreaView style={styles.container}>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        ) : null}

        <View style={styles.chatWrapper}>
          {messages.length === 0 && showStarters ? (
            <View style={styles.startersWrapper}>
              <StarterQuestions
                questions={starterQuestions}
                onSelectQuestion={handleSelectStarter}
              />
            </View>
          ) : (
            <>
              <GiftedChat
                messages={giftedMessages}
                onSend={(giftedPayload) => {
                  if (giftedPayload[0]) {
                    void handleSendMessage(giftedPayload[0].text);
                  }
                }}
                user={{
                  _id: USER_ID,
                  name: "You",
                }}
                renderInputToolbar={() => <></>}
                renderAvatar={() => <></>}
                renderMessage={renderMessage}
                isLoadingEarlier={isLoading || isStreaming}
                alignTop
                keyboardShouldPersistTaps="handled"
              />
              {Platform.OS === "android" && (
                <KeyboardAvoidingView behavior="padding" />
              )}
            </>
          )}
        </View>

        <ChatInput
          onSendMessage={(text) => {
            void handleSendMessage(text);
          }}
          isLoading={isLoading}
          isStreaming={isStreaming}
        />
      </SafeAreaView>
    </ChatErrorBoundary>
  );
};

export default ConversationalAIScreen;
