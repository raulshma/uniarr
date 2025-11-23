import React, { useState, useRef } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Card,
  Divider,
  ActivityIndicator,
  Switch,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { useTheme } from "@/hooks/useTheme";
import { useConversationalAIConfigStore } from "@/store/conversationalAIConfigStore";
import { StreamingService } from "@/services/ai/streaming/StreamingService";
import { logger } from "@/services/logger/LoggerService";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const DebugStreamingScreen: React.FC = () => {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [useSSE, setUseSSE] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamingService = StreamingService.getInstance();

  // Get current config - use individual selectors to avoid re-render loops
  const provider = useConversationalAIConfigStore(
    (state) => state.selectedProvider,
  );
  const model = useConversationalAIConfigStore((state) => state.selectedModel);
  const keyId = useConversationalAIConfigStore((state) => state.selectedKeyId);

  const config = { provider, model, keyId };
  const hasValidConfig = provider !== null && model !== null && keyId !== null;

  const addMessage = (role: "user" | "assistant", content: string) => {
    setMessages((prev) => [...prev, { role, content, timestamp: new Date() }]);
  };

  const updateLastMessage = (content: string) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      const lastMsg = updated[updated.length - 1];
      if (lastMsg) {
        updated[updated.length - 1] = {
          ...lastMsg,
          content,
        };
      }
      return updated;
    });
  };

  const sendMessage = async (userMessage: string, method: "sse" | "fetch") => {
    try {
      setIsStreaming(true);
      setError(null);

      // Add user message
      addMessage("user", userMessage);

      // Get API key
      const currentConfig = useConversationalAIConfigStore
        .getState()
        .getConfig();

      void logger.debug(`Debug streaming (${method}) - config check`, {
        provider: currentConfig.provider,
        model: currentConfig.model,
        keyId: currentConfig.keyId,
      });

      if (
        !currentConfig.provider ||
        !currentConfig.model ||
        !currentConfig.keyId
      ) {
        throw new Error(
          `No AI configured. Please configure AI in Settings > Conversational AI. Current config: ${JSON.stringify(currentConfig)}`,
        );
      }

      // Add empty assistant message that will be updated
      addMessage("assistant", "");

      // Prepare messages for API
      const apiMessages = messages
        .concat([
          {
            role: "user" as const,
            content: userMessage,
            timestamp: new Date(),
          },
        ])
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      // Create abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      let fullResponse = "";

      // Use the StreamingService
      await streamingService.stream(
        {
          provider: currentConfig.provider,
          model: currentConfig.model,
          keyId: currentConfig.keyId,
          messages: apiMessages,
        },
        {
          method,
          signal: abortController.signal,
          onChunk: (chunk) => {
            fullResponse += chunk;
            updateLastMessage(fullResponse);
          },
          onComplete: (text) => {
            setIsStreaming(false);
            void logger.info(`${method.toUpperCase()} stream completed`, {
              responseLength: text.length,
            });
          },
          onError: (err) => {
            setError(err.message);
            setIsStreaming(false);
            void logger.error(`Failed to stream with ${method}`, {
              error: err.message,
            });
          },
        },
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setIsStreaming(false);
      void logger.error(`Failed to send message with ${method}`, {
        error: errorMessage,
      });
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isStreaming) return;

    const message = inputText.trim();
    setInputText("");

    await sendMessage(message, useSSE ? "sse" : "fetch");
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Debug Streaming",
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerTintColor: theme.colors.onSurface,
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["bottom"]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={100}
        >
          <View style={styles.content}>
            {/* Config Status */}
            <Card style={styles.controlCard}>
              <Card.Content>
                <Text variant="titleSmall" style={styles.configTitle}>
                  Configuration
                </Text>
                <Text variant="bodySmall" style={styles.configText}>
                  Provider: {config.provider || "Not set"}
                </Text>
                <Text variant="bodySmall" style={styles.configText}>
                  Model: {config.model || "Not set"}
                </Text>
                <Text variant="bodySmall" style={styles.configText}>
                  Key ID: {config.keyId || "Not set"}
                </Text>
                {!hasValidConfig && (
                  <Text
                    variant="bodySmall"
                    style={[styles.configText, { color: theme.colors.error }]}
                  >
                    ⚠️ Please configure AI in Settings first
                  </Text>
                )}
              </Card.Content>
            </Card>

            {/* Controls */}
            <Card style={styles.controlCard}>
              <Card.Content>
                <View style={styles.switchRow}>
                  <Text variant="bodyMedium">Use SSE (EventSource)</Text>
                  <Switch
                    value={useSSE}
                    onValueChange={setUseSSE}
                    disabled={isStreaming}
                  />
                </View>
                <Text variant="bodySmall" style={styles.hint}>
                  {useSSE
                    ? "Using StreamingService with SSE (react-native-sse)"
                    : "Using StreamingService with Fetch (ReadableStream)"}
                </Text>
                <Divider style={styles.divider} />
                <View style={styles.buttonRow}>
                  <Button
                    mode="outlined"
                    onPress={handleClear}
                    disabled={isStreaming}
                  >
                    Clear
                  </Button>
                  {isStreaming && (
                    <Button mode="contained" onPress={handleStop}>
                      Stop
                    </Button>
                  )}
                </View>
              </Card.Content>
            </Card>

            {/* Error Display */}
            {error && (
              <Card
                style={[
                  styles.errorCard,
                  { backgroundColor: theme.colors.errorContainer },
                ]}
              >
                <Card.Content>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onErrorContainer }}
                  >
                    Error: {error}
                  </Text>
                </Card.Content>
              </Card>
            )}

            {/* Messages */}
            <ScrollView
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
            >
              {messages.map((msg, index) => (
                <Card
                  key={index}
                  style={[
                    styles.messageCard,
                    msg.role === "user"
                      ? { backgroundColor: theme.colors.primaryContainer }
                      : { backgroundColor: theme.colors.secondaryContainer },
                  ]}
                >
                  <Card.Content>
                    <Text
                      variant="labelSmall"
                      style={[
                        styles.messageRole,
                        msg.role === "user"
                          ? { color: theme.colors.onPrimaryContainer }
                          : { color: theme.colors.onSecondaryContainer },
                      ]}
                    >
                      {msg.role.toUpperCase()}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={
                        msg.role === "user"
                          ? { color: theme.colors.onPrimaryContainer }
                          : { color: theme.colors.onSecondaryContainer }
                      }
                    >
                      {msg.content ||
                        (isStreaming && index === messages.length - 1
                          ? "..."
                          : "")}
                    </Text>
                  </Card.Content>
                </Card>
              ))}
              {isStreaming && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" />
                  <Text variant="bodySmall" style={styles.loadingText}>
                    Streaming...
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                mode="outlined"
                placeholder="Type a message..."
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                disabled={isStreaming}
                multiline
                style={styles.input}
                right={
                  <TextInput.Icon
                    icon="send"
                    onPress={handleSend}
                    disabled={!inputText.trim() || isStreaming}
                  />
                }
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  controlCard: {
    marginBottom: 16,
  },
  configTitle: {
    marginBottom: 8,
    fontWeight: "bold",
  },
  configText: {
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hint: {
    marginTop: 4,
    opacity: 0.7,
  },
  divider: {
    marginVertical: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  errorCard: {
    marginBottom: 16,
  },
  messagesContainer: {
    flex: 1,
    marginBottom: 16,
  },
  messagesContent: {
    gap: 12,
  },
  messageCard: {
    elevation: 2,
  },
  messageRole: {
    marginBottom: 4,
    fontWeight: "bold",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  loadingText: {
    opacity: 0.7,
  },
  inputContainer: {
    paddingTop: 8,
  },
  input: {
    maxHeight: 120,
  },
});

export default DebugStreamingScreen;
