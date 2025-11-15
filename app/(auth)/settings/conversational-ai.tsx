import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { GiftedChat, type IMessage } from "react-native-gifted-chat";
import {
  ActivityIndicator,
  Text,
  Button,
  Switch,
  Divider,
  Snackbar,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ChatErrorBoundary } from "@/components/chat/ChatErrorBoundary";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { StarterQuestions } from "@/components/chat/StarterQuestions";
import { useDialog } from "@/components/common";
import BottomDrawer, { DrawerItem } from "@/components/common/BottomDrawer";
import { useConversationalAI } from "@/hooks/useConversationalAI";
import { useUnifiedDiscover } from "@/hooks/useUnifiedDiscover";
import type { Message } from "@/models/chat.types";
import { AIProviderManager } from "@/services/ai/core/AIProviderManager";
import {
  useConnectorsStore,
  selectGetConnector,
  selectGetConnectorsByType,
} from "@/store/connectorsStore";
import { NAVIGATION_ROUTES } from "@/utils/navigation.utils";
import {
  selectSessions,
  selectCurrentSessionId,
} from "@/store/conversationalAISelectors";
import { useConversationalAIStore } from "@/store/conversationalAIStore";
import {
  useConversationalAIConfigStore,
  selectConversationalAIHasValidConfig,
} from "@/store/conversationalAIConfigStore";
import { useTheme } from "@/hooks/useTheme";

const USER_ID = "user";
const ASSISTANT_ID = "assistant";

const ConversationalAIScreen: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const providerManager = AIProviderManager.getInstance();
  const dialog = useDialog();
  const [hasAIProvider, setHasAIProvider] = useState(true);
  const [healthUnhealthy, setHealthUnhealthy] = useState(false);

  // Check if conversational AI has valid config (provider, model, keyId)
  const hasValidConversationalAIConfig = useConversationalAIConfigStore(
    selectConversationalAIHasValidConfig,
  );

  // Dialog states
  const [conversationDrawerVisible, setConversationDrawerVisible] =
    useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // Use separate selector calls to avoid infinite loops
  // Get sessions Map and derive active sessions to avoid array creation issues
  const allSessions = useConversationalAIStore(selectSessions);
  const currentSessionId = useConversationalAIStore(selectCurrentSessionId);

  const activeSessions = useMemo(() => {
    return Array.from(allSessions.values())
      .filter((session) => !session.archived)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [allSessions]);

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
    createNewConversation,
    deleteConversation,
    loadConversation,
  } = useConversationalAI();

  const getConnector = useConnectorsStore(selectGetConnector);
  const getConnectorsByType = useConnectorsStore(selectGetConnectorsByType);
  // (radarr services will be looked up lazily when performing add operations)

  const discover = useUnifiedDiscover();
  const addMessageToStore = useConversationalAIStore((s) => s.addMessage);
  const enableStreamingPref = useConversationalAIStore(
    (s) => s.config.enableStreaming,
  );

  const updateConversationalConfig = useConversationalAIStore(
    (s) => s.updateConfig,
  );

  useEffect(() => {
    if (isReady || !hasAIProvider) {
      setHealthUnhealthy(false);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        // Continue loading
      }
    }, 7000);

    const checkHealth = async () => {
      const active = providerManager.getActiveProvider();
      if (!active) {
        return;
      }
      try {
        const result = await providerManager.healthCheck(
          active.provider as any,
        );
        if (isMounted) {
          setHealthUnhealthy(!result.isHealthy);
        }
      } catch {
        if (isMounted) {
          setHealthUnhealthy(true);
        }
      }
    };

    void checkHealth();

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isReady, hasAIProvider, providerManager]);

  const [showStarters, setShowStarters] = useState(() => messages.length === 0);

  useEffect(() => {
    if (messages.length === 0) {
      setShowStarters(true);
    }
  }, [messages.length]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scaffold: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        safeArea: {
          flex: 1,
        },
        content: {
          flex: 1,
          paddingHorizontal: 0,
          paddingVertical: 0,
        },
        headerContainer: {
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
          gap: 12,
        },
        headerTopRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        headerTextBlock: {
          flex: 1,
          gap: 4,
        },
        headerTitle: {
          fontSize: 28,
          fontWeight: "800",
          color: theme.colors.onBackground,
          letterSpacing: -0.5,
        },
        headerSubtitle: {
          fontSize: 13,
          color: theme.colors.onSurfaceVariant,
        },
        headerButton: {
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.surfaceVariant,
        },
        statusPill: {
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: theme.custom.spacing.xxs,
          paddingVertical: 6,
          borderRadius: 16,
          backgroundColor: theme.colors.surfaceVariant,
        },
        statusDot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: theme.colors.primary,
        },
        statusText: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 12,
          fontWeight: "500",
        },
        chatContainer: {
          flex: 1,
          marginHorizontal: 16,
          marginTop: 12,
          marginBottom: 12,
          borderRadius: 16,
          backgroundColor: theme.colors.surface,
          overflow: "hidden",
        },
        chatContent: {
          flex: 1,
          paddingHorizontal: 0,
        },
        errorBanner: {
          marginHorizontal: 16,
          marginBottom: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: theme.colors.errorContainer,
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
        },
        errorIcon: {
          width: 24,
          height: 24,
          alignItems: "center",
          justifyContent: "center",
        },
        errorText: {
          flex: 1,
          color: theme.colors.error,
          fontSize: 13,
          fontWeight: "500",
        },
        loadingState: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          paddingHorizontal: 24,
        },
        loadingText: {
          fontSize: 16,
          color: theme.colors.onBackground,
          textAlign: "center",
          fontWeight: "500",
        },
        loadingSubtext: {
          fontSize: 13,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
        },
        setupContainer: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        },
        setupCard: {
          width: "100%",
          borderRadius: 16,
          backgroundColor: theme.colors.surface,
          padding: 24,
          gap: 12,
        },
        setupTitle: {
          fontSize: 22,
          fontWeight: "700",
          color: theme.colors.onBackground,
          textAlign: "center",
        },
        setupText: {
          fontSize: 15,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          lineHeight: 22,
        },
        setupButton: {
          marginTop: 12,
        },
      }),
    [
      theme.colors.background,
      theme.colors.onBackground,
      theme.colors.onSurfaceVariant,
      theme.colors.surfaceVariant,
      theme.colors.primary,
      theme.colors.surface,
      theme.colors.errorContainer,
      theme.colors.error,
      theme.custom.spacing.xxs,
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
      if (question?.toLowerCase()?.includes("trending")) {
        // Show a simple rich card with the first trending movie as a preview
        const section = discover.sections.find(
          (s) => s.id === "trending-movies",
        );
        const item = section?.items?.[0];
        if (item) {
          const assistantCardMsg: Message = {
            id: `msg-card-${Date.now()}`,
            text: "Sure, here's a popular one right now.",
            role: "assistant",
            timestamp: new Date(),
            metadata: {
              card: {
                id: String(item.id),
                title: item.title,
                posterUrl: item.posterUrl,
                tmdbId: item.tmdbId,
                year: item.year,
                overview: item.overview,
                genres: [],
                source: item.source,
              },
            },
          };

          addMessageToStore(assistantCardMsg);
          return;
        }
      }
      await sendMessage(question);
    },
    [sendMessage, addMessageToStore, discover.sections],
  );

  type HeaderButtonProps = {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    onPress: () => void;
    accessibilityLabel?: string;
  };

  const HeaderButton: React.FC<HeaderButtonProps> = ({
    icon,
    onPress,
    accessibilityLabel,
  }) => (
    <Pressable
      style={styles.headerButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={theme.colors.onBackground}
      />
    </Pressable>
  );

  const handleNewConversation = useCallback(() => {
    const timestamp = new Date().toLocaleString();
    createNewConversation(`Chat - ${timestamp}`);
    setSnackbarMessage("New conversation created");
    setSnackbarVisible(true);
  }, [createNewConversation]);

  const handleDeleteConversation = useCallback(
    (sessionId: string) => {
      dialog.present({
        title: "Delete Conversation?",
        message:
          "This will permanently delete the conversation and all its messages. This action cannot be undone.",
        buttons: [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              deleteConversation(sessionId);
              setSnackbarMessage("Conversation deleted");
              setSnackbarVisible(true);
              setConversationDrawerVisible(false);
            },
          },
        ],
      });
    },
    [dialog, deleteConversation],
  );

  const handleLoadConversation = useCallback(
    (sessionId: string) => {
      loadConversation(sessionId);
      setConversationDrawerVisible(false);
      setSnackbarMessage("Conversation loaded");
      setSnackbarVisible(true);
    },
    [loadConversation],
  );

  const handleLongPressConversation = useCallback(
    (sessionId: string, sessionTitle: string) => {
      dialog.present({
        title: `Manage "${sessionTitle}"`,
        message: "What would you like to do with this conversation?",
        buttons: [
          {
            text: "Load",
            onPress: () => handleLoadConversation(sessionId),
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              // Show confirmation for delete
              dialog.present({
                title: "Delete Conversation?",
                message:
                  "This will permanently delete the conversation and all its messages. This action cannot be undone.",
                buttons: [
                  {
                    text: "Cancel",
                    style: "cancel",
                  },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                      deleteConversation(sessionId);
                      setSnackbarMessage("Conversation deleted");
                      setSnackbarVisible(true);
                      setConversationDrawerVisible(false);
                    },
                  },
                ],
              });
            },
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ],
      });
    },
    [dialog, handleLoadConversation, deleteConversation],
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

      return (
        <ChatMessage
          message={sourceMessage}
          onAddToRadarr={(msg) => {
            // Add to radarr flow
            void (async () => {
              const tmdbId = msg.metadata?.card?.tmdbId;
              if (!tmdbId) {
                dialog.present({
                  title: "Unable to add",
                  message:
                    "This media item doesn't contain a TMDB ID — unable to add to Radarr",
                  buttons: [{ text: "OK" }],
                });
                return;
              }

              const services = getConnectorsByType("radarr");
              if (!services || services.length === 0) {
                dialog.present({
                  title: "No Radarr configured",
                  message:
                    "You don't have any Radarr services configured. Add one in settings to add movies.",
                  buttons: [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Open Settings",
                      onPress: () =>
                        router.push("/(auth)/settings/add-service"),
                    },
                  ],
                });
                return;
              }

              // If only one Radarr service, use it directly
              const targetService =
                services.length === 1 ? services[0] : undefined;

              const addToService = async (serviceId: string) => {
                try {
                  // Use the raw connector directly for add operations
                  const connectorInstance = getConnector(serviceId)!;
                  const radarrConnector = connectorInstance as any;

                  const profiles = await radarrConnector.getQualityProfiles();
                  const roots = await radarrConnector.getRootFolders();

                  const profileId = (profiles?.[0]?.id ?? 1) as number;
                  const root = (roots?.[0]?.path ?? "/") as string;

                  await radarrConnector.add({
                    title: msg.metadata?.card?.title ?? "Untitled",
                    tmdbId,
                    year: msg.metadata?.card?.year,
                    qualityProfileId: profileId,
                    rootFolderPath: root,
                    monitored: true,
                    searchOnAdd: true,
                  });

                  setSnackbarMessage("Added to Radarr");
                  setSnackbarVisible(true);
                } catch (error) {
                  dialog.present({
                    title: "Failed to add",
                    message:
                      error instanceof Error ? error.message : String(error),
                    buttons: [{ text: "OK" }],
                  });
                }
              };

              if (targetService) {
                await addToService(targetService.config.id);
                return;
              }

              // If multiple, present choices for up to 3 services
              const buttons: {
                text: string;
                onPress?: () => void;
                style?: string;
              }[] = services.slice(0, 3).map((s) => ({
                text: s.config.name,
                onPress: () => void addToService(s.config.id),
              }));

              buttons.push({ text: "Cancel", style: "cancel" });

              dialog.present({
                title: "Choose a Radarr service",
                message: "Select a Radarr service to add this movie to.",
                buttons: buttons as any,
              });
            })();
          }}
          onShowCast={(msg) => {
            const tmdbId = msg.metadata?.card?.tmdbId;
            if (tmdbId) {
              router.push(
                NAVIGATION_ROUTES.DISCOVER_TMDB_MEDIA("movie", tmdbId),
              );
            } else {
              dialog.present({
                title: "Show cast",
                message: "No TMDB ID available for this item.",
                buttons: [{ text: "OK" }],
              });
            }
          }}
        />
      );
    },
    [
      messageLookup,
      getConnector,
      getConnectorsByType,
      dialog,
      router,
      setSnackbarMessage,
      setSnackbarVisible,
    ],
  );

  // Show setup message if no AI provider is configured
  if (!hasAIProvider) {
    return (
      <ChatErrorBoundary>
        <View style={styles.scaffold}>
          <SafeAreaView
            style={styles.safeArea}
            edges={["left", "right", "top", "bottom"]}
          >
            <View style={styles.setupContainer}>
              <View style={styles.setupCard}>
                <Text style={styles.setupTitle}>AI Not Configured</Text>
                <Text style={styles.setupText}>
                  Configure a provider to unlock Media AI. You can point UniArr
                  at your preferred AI vendor under Bring Your Own Key settings.
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
            </View>
          </SafeAreaView>
        </View>
      </ChatErrorBoundary>
    );
  }

  // Show setup message if no conversational AI provider/model is selected
  if (!hasValidConversationalAIConfig) {
    return (
      <ChatErrorBoundary>
        <View style={styles.scaffold}>
          <SafeAreaView
            style={styles.safeArea}
            edges={["left", "right", "top", "bottom"]}
          >
            <View style={styles.setupContainer}>
              <View style={styles.setupCard}>
                <Text style={styles.setupTitle}>Select a Model for Chat</Text>
                <Text style={styles.setupText}>
                  You have AI providers configured, but haven't selected which
                  one to use for conversational AI. Choose your preferred
                  provider and model.
                </Text>
                <Button
                  mode="contained"
                  onPress={() => {
                    router.push("/(auth)/+modal/select-provider-model");
                  }}
                  style={styles.setupButton}
                >
                  Select Model for Chat
                </Button>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </ChatErrorBoundary>
    );
  }

  if (!isReady) {
    if (healthUnhealthy) {
      return (
        <ChatErrorBoundary>
          <View style={styles.scaffold}>
            <SafeAreaView
              style={styles.safeArea}
              edges={["left", "right", "top", "bottom"]}
            >
              <View style={styles.setupContainer}>
                <View style={styles.setupCard}>
                  <Text style={styles.setupTitle}>AI Provider Not Ready</Text>
                  <Text style={styles.setupText}>
                    The configured provider looks offline or misconfigured.
                    Review your API keys and region, then try again.
                  </Text>
                  <Button
                    mode="contained"
                    onPress={() => {
                      router.push("/(auth)/settings/byok/ai-settings");
                    }}
                    style={styles.setupButton}
                  >
                    Review setup
                  </Button>
                </View>
              </View>
            </SafeAreaView>
          </View>
        </ChatErrorBoundary>
      );
    }

    return (
      <ChatErrorBoundary>
        <View style={styles.scaffold}>
          <SafeAreaView
            style={styles.safeArea}
            edges={["left", "right", "top", "bottom"]}
          >
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Preparing Media AI…</Text>
              <Text style={styles.loadingSubtext}>
                Checking provider health and restoring your latest conversation.
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </ChatErrorBoundary>
    );
  }

  return (
    <ChatErrorBoundary>
      <View style={styles.scaffold}>
        <SafeAreaView style={styles.safeArea} edges={["left", "right", "top"]}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
          >
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.headerContainer}>
                <View style={styles.headerTopRow}>
                  <View style={styles.headerTextBlock}>
                    <Text style={styles.headerTitle}>Media AI</Text>
                    <Text style={styles.headerSubtitle}>
                      Ask about your library
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <HeaderButton
                      icon="plus"
                      onPress={handleNewConversation}
                      accessibilityLabel="Start new conversation"
                    />

                    {activeSessions.length > 0 ? (
                      <HeaderButton
                        icon="history"
                        onPress={() => setConversationDrawerVisible(true)}
                        accessibilityLabel="Open conversation history"
                      />
                    ) : null}

                    <HeaderButton
                      icon="cog"
                      onPress={() =>
                        router.push("/(auth)/settings/byok/ai-settings")
                      }
                      accessibilityLabel="Configure AI provider"
                    />
                  </View>
                </View>

                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>
                    {isStreaming
                      ? "Responding…"
                      : isLoading
                        ? "Thinking…"
                        : "Online"}
                  </Text>
                  <View style={{ width: 12 }} />
                  <Text style={[styles.statusText, { marginRight: 8 }]}>
                    Stream
                  </Text>
                  <Switch
                    value={Boolean(enableStreamingPref)}
                    onValueChange={() =>
                      updateConversationalConfig({
                        enableStreaming: !enableStreamingPref,
                      })
                    }
                    color={theme.colors.primary}
                  />
                </View>
              </View>

              {/* Error Banner */}
              {error ? (
                <View style={styles.errorBanner}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={20}
                    color={theme.colors.error}
                  />
                  <Text style={styles.errorText}>{error.message}</Text>
                </View>
              ) : null}

              {/* Chat Container */}
              <View style={styles.chatContainer}>
                <View style={styles.chatContent}>
                  {messages.length === 0 && showStarters ? (
                    <StarterQuestions
                      questions={starterQuestions}
                      onSelectQuestion={handleSelectStarter}
                      title="Media AI"
                    />
                  ) : (
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
                      scrollToBottomComponent={() => null}
                      messagesContainerStyle={{
                        backgroundColor: "transparent",
                      }}
                      listViewProps={{
                        contentContainerStyle: {
                          paddingVertical: 8,
                          paddingBottom: 8,
                        },
                      }}
                    />
                  )}
                </View>
              </View>

              {/* Chat Input */}
              <ChatInput
                onSendMessage={(text) => {
                  void handleSendMessage(text);
                }}
                isLoading={isLoading}
                isStreaming={isStreaming}
                placeholder="Ask about movies, shows."
              />

              <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={2000}
              >
                {snackbarMessage}
              </Snackbar>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>

      {/* Conversation History Drawer */}
      <BottomDrawer
        visible={conversationDrawerVisible}
        onDismiss={() => setConversationDrawerVisible(false)}
        title="Conversation History"
        maxHeight="70%"
      >
        {activeSessions.map((session, index) => (
          <View key={session.id}>
            <Pressable
              onPress={() => handleLoadConversation(session.id)}
              onLongPress={() =>
                handleLongPressConversation(session.id, session.title)
              }
              delayLongPress={500}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  minHeight: 56,
                }}
              >
                <MaterialCommunityIcons
                  name="chat"
                  size={24}
                  color={theme.colors.onSurface}
                  style={{ marginRight: 16 }}
                />
                <Text
                  variant="bodyLarge"
                  style={{
                    flex: 1,
                    color: theme.colors.onSurface,
                    fontWeight: currentSessionId === session.id ? "600" : "400",
                  }}
                >
                  {session.title}
                </Text>
                {currentSessionId === session.id && (
                  <MaterialCommunityIcons
                    name="check"
                    size={20}
                    color={theme.colors.primary}
                  />
                )}
              </View>
            </Pressable>
            {index < activeSessions.length - 1 && <Divider />}
          </View>
        ))}
        {activeSessions.length > 0 && <Divider style={{ marginVertical: 8 }} />}
        <DrawerItem
          icon="delete"
          label="Delete Current Conversation"
          destructive
          onPress={() => {
            const currentSession =
              activeSessions.find((s) => s.id === currentSessionId) ||
              activeSessions[0];
            if (currentSession) {
              handleDeleteConversation(currentSession.id);
            }
          }}
        />
      </BottomDrawer>
    </ChatErrorBoundary>
  );
};

export default ConversationalAIScreen;
