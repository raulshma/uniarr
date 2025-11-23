import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { GiftedChat, type IMessage } from "react-native-gifted-chat";
import {
  ActivityIndicator,
  Text,
  Button,
  Switch,
  SegmentedButtons,
  Divider,
  Snackbar,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ChatErrorBoundary } from "@/components/chat/ChatErrorBoundary";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatBackground } from "@/components/chat/ChatBackground";
import { StarterQuestions } from "@/components/chat/StarterQuestions";
import { ProviderModelDisplay } from "@/components/chat/ProviderModelDisplay";
import { useDialog } from "@/components/common";
import BottomDrawer, { DrawerItem } from "@/components/common/BottomDrawer";
import { useConversationalAI } from "@/hooks/useConversationalAI";
import { useAIChat } from "@/hooks/useAIChat";
import { useUnifiedDiscover } from "@/hooks/useUnifiedDiscover";
import type { Message, AssistantConfig } from "@/models/chat.types";
import { AIProviderManager } from "@/services/ai/core/AIProviderManager";
import { getToolRegistry } from "@/services/ai/tools";
import { logger } from "@/services/logger/LoggerService";
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
  selectConversationalAIProvider,
  selectConversationalAIModel,
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

  // Get selected provider and model for display
  const selectedProvider = useConversationalAIConfigStore(
    selectConversationalAIProvider,
  );
  const selectedModel = useConversationalAIConfigStore(
    selectConversationalAIModel,
  );

  // Dialog states
  const [conversationDrawerVisible, setConversationDrawerVisible] =
    useState(false);
  const [toolsDrawerVisible, setToolsDrawerVisible] = useState(false);
  const [settingsDrawerVisible, setSettingsDrawerVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // Use separate selector calls to avoid infinite loops
  // Get sessions Map and derive active sessions to avoid array creation issues
  const allSessions = useConversationalAIStore(selectSessions);
  const currentSessionId = useConversationalAIStore(selectCurrentSessionId);

  const activeSessions = useMemo(() => {
    return Array.from(allSessions.values())
      .filter((session) => !session.archived)
      .sort((a, b) => {
        const aTime = a.updatedAt?.getTime() ?? 0;
        const bTime = b.updatedAt?.getTime() ?? 0;
        return bTime - aTime;
      });
  }, [allSessions]);

  // Get current session title for header display
  const currentSessionTitle = useMemo(() => {
    if (!currentSessionId) return null;
    const session = allSessions.get(currentSessionId);
    return session?.title ?? null;
  }, [currentSessionId, allSessions]);

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

  // New AI chat hook with tool support
  const aiChatWithTools = useAIChat({
    onToolCall: (toolName, args) => {
      void logger.info("Tool called from UI", { toolName, args });
    },
    onToolResult: (toolName, result) => {
      void logger.info("Tool result from UI", { toolName, result });
    },
  });

  const getConnector = useConnectorsStore(selectGetConnector);
  const getConnectorsByType = useConnectorsStore(selectGetConnectorsByType);
  // (radarr services will be looked up lazily when performing add operations)

  const discover = useUnifiedDiscover();
  const addMessageToStore = useConversationalAIStore((s) => s.addMessage);
  const enableStreamingPref = useConversationalAIStore(
    (s) => s.config.enableStreaming,
  );

  const streamingMethodPref = useConversationalAIStore(
    (s) => s.config.streamingMethod || "sse",
  );

  const showTokenCountPref = useConversationalAIStore(
    (s) => s.config.showTokenCount,
  );

  const chatTextSizePref = useConversationalAIStore(
    (s) => s.config.chatTextSize,
  );

  const enableToolsPref = useConversationalAIStore((s) => s.config.enableTools);

  const selectedToolsPref = useConversationalAIStore(
    (s) => s.config.selectedTools ?? [],
  );

  const updateConversationalConfig = useConversationalAIStore(
    (s) => s.updateConfig,
  );

  // Get available tools from registry
  const availableTools = useMemo(() => {
    const registry = getToolRegistry();
    return registry.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }, []);

  // Handler to toggle tool selection
  const handleToggleTool = useCallback(
    (toolName: string) => {
      const currentSelected = selectedToolsPref;
      const isSelected = currentSelected.includes(toolName);

      const newSelected = isSelected
        ? currentSelected.filter((name) => name !== toolName)
        : [...currentSelected, toolName];

      updateConversationalConfig({ selectedTools: newSelected });

      setSnackbarMessage(
        isSelected ? `${toolName} disabled` : `${toolName} enabled`,
      );
      setSnackbarVisible(true);
    },
    [selectedToolsPref, updateConversationalConfig],
  );

  // Handler to select all tools
  const handleSelectAllTools = useCallback(() => {
    const allToolNames = availableTools.map((tool) => tool.name);
    updateConversationalConfig({ selectedTools: allToolNames });
    setSnackbarMessage("All tools enabled");
    setSnackbarVisible(true);
  }, [availableTools, updateConversationalConfig]);

  // Handler to deselect all tools
  const handleDeselectAllTools = useCallback(() => {
    updateConversationalConfig({ selectedTools: [] });
    setSnackbarMessage("All tools disabled");
    setSnackbarVisible(true);
  }, [updateConversationalConfig]);

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
          paddingTop: 8,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        headerTitle: {
          fontSize: 20,
          fontWeight: "700",
          color: theme.colors.onBackground,
        },
        headerSubtitle: {
          fontSize: 13,
          fontWeight: "400",
          color: theme.colors.onSurfaceVariant,
          marginTop: 2,
        },
        headerButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.surfaceVariant,
        },

        chatContainer: {
          flex: 1,
          marginHorizontal: theme.custom.spacing.xs,
          marginTop: 12,
          marginBottom: 12,
          borderRadius: theme.roundness,
          backgroundColor: "transparent",
          overflow: "hidden",
        },
        chatContent: {
          flex: 1,
          paddingHorizontal: 0,
        },
        errorBanner: {
          marginHorizontal: 16,
          marginBottom: 12,
          paddingHorizontal: theme.custom.spacing.xs,
          paddingVertical: 12,
          borderRadius: theme.roundness,
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
    [theme],
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
      .sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return bTime - aTime;
      });
  }, [messages]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        return;
      }

      setShowStarters(false);

      // Use the new AI chat hook with tools if enabled, otherwise use the existing hook
      if (enableToolsPref) {
        await aiChatWithTools.sendMessage(text);
      } else {
        await sendMessage(text);
      }
    },
    [sendMessage, enableToolsPref, aiChatWithTools],
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

  // Animated button press feedback
  const buttonScale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      transform: [{ scale: buttonScale.value }],
    };
  }, []);

  const handleButtonPressIn = useCallback(() => {
    "worklet";
    buttonScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  }, [buttonScale]);

  const handleButtonPressOut = useCallback(() => {
    "worklet";
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [buttonScale]);

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
              // Close the drawer first before showing confirmation
              setConversationDrawerVisible(false);

              // Use setTimeout to ensure drawer closes before showing confirmation
              setTimeout(() => {
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
                      },
                    },
                  ],
                });
              }, 300);
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
      <ChatBackground style={styles.scaffold}>
        <SafeAreaView style={styles.safeArea} edges={["left", "right", "top"]}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
          >
            <View style={styles.content}>
              {/* Minimal Header */}
              <View style={styles.headerContainer}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.headerTitle}>Media AI</Text>
                  {currentSessionTitle && (
                    <Text
                      style={styles.headerSubtitle}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {currentSessionTitle}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Animated.View style={animatedButtonStyle}>
                    <Pressable
                      style={styles.headerButton}
                      onPress={() => setConversationDrawerVisible(true)}
                      onPressIn={handleButtonPressIn}
                      onPressOut={handleButtonPressOut}
                      accessibilityRole="button"
                      accessibilityLabel="Conversation history"
                    >
                      <MaterialCommunityIcons
                        name="history"
                        size={22}
                        color={theme.colors.onBackground}
                      />
                    </Pressable>
                  </Animated.View>
                  <Animated.View style={animatedButtonStyle}>
                    <Pressable
                      style={styles.headerButton}
                      onPress={() => setSettingsDrawerVisible(true)}
                      onPressIn={handleButtonPressIn}
                      onPressOut={handleButtonPressOut}
                      accessibilityRole="button"
                      accessibilityLabel="Open settings"
                    >
                      <MaterialCommunityIcons
                        name="cog-outline"
                        size={22}
                        color={theme.colors.onBackground}
                      />
                    </Pressable>
                  </Animated.View>
                </View>
              </View>

              {/* Error Banner */}
              {error ? (
                <Animated.View
                  entering={FadeInDown.duration(300).springify()}
                  exiting={FadeOut.duration(200)}
                  style={styles.errorBanner}
                >
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={20}
                    color={theme.colors.error}
                  />
                  <Text style={styles.errorText}>{error.message}</Text>
                </Animated.View>
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

              {/* Provider-Model Display and Chat Input Container */}
              <View>
                <ProviderModelDisplay
                  provider={selectedProvider}
                  model={selectedModel}
                />
                <ChatInput
                  onSendMessage={(text) => {
                    void handleSendMessage(text);
                  }}
                  isLoading={isLoading}
                  isStreaming={isStreaming}
                  placeholder="Ask about movies, shows."
                  onNewConversation={handleNewConversation}
                />
              </View>

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
      </ChatBackground>

      {/* Conversation History Drawer */}
      <BottomDrawer
        visible={conversationDrawerVisible}
        onDismiss={() => setConversationDrawerVisible(false)}
        title="Conversation History"
        maxHeight="70%"
      >
        {activeSessions.map((session, index) => (
          <Animated.View
            key={session.id}
            entering={FadeInDown.delay(index * 50)
              .duration(300)
              .springify()}
          >
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
          </Animated.View>
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

      {/* Tools Management Drawer */}
      <BottomDrawer
        visible={toolsDrawerVisible}
        onDismiss={() => setToolsDrawerVisible(false)}
        title="Manage AI Tools"
        maxHeight="70%"
      >
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text
            variant="bodyMedium"
            style={{
              color: theme.colors.onSurfaceVariant,
              marginBottom: 12,
            }}
          >
            Select which tools the AI can use to interact with your services.{" "}
            {selectedToolsPref.length > 0
              ? `${selectedToolsPref.length} of ${availableTools.length} enabled`
              : "No tools enabled"}
          </Text>
        </View>

        {availableTools.map((tool, index) => {
          const isSelected = selectedToolsPref.includes(tool.name);
          return (
            <Animated.View
              key={tool.name}
              entering={FadeInDown.delay(index * 50)
                .duration(300)
                .springify()}
            >
              <Pressable
                onPress={() => handleToggleTool(tool.name)}
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
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    minHeight: 64,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text
                      variant="bodyLarge"
                      style={{
                        color: theme.colors.onSurface,
                        fontWeight: isSelected ? "600" : "400",
                        marginBottom: 4,
                      }}
                    >
                      {tool.name}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                      }}
                    >
                      {tool.description}
                    </Text>
                  </View>
                  <Switch
                    value={isSelected}
                    onValueChange={() => handleToggleTool(tool.name)}
                    color={theme.colors.primary}
                  />
                </View>
              </Pressable>
              {index < availableTools.length - 1 && <Divider />}
            </Animated.View>
          );
        })}

        {availableTools.length > 0 && (
          <>
            <Divider style={{ marginVertical: 8 }} />
            <DrawerItem
              icon="check-all"
              label="Enable All Tools"
              onPress={handleSelectAllTools}
            />
            <DrawerItem
              icon="close-box-multiple"
              label="Disable All Tools"
              onPress={handleDeselectAllTools}
            />
          </>
        )}
      </BottomDrawer>

      {/* Settings Drawer */}
      <BottomDrawer
        visible={settingsDrawerVisible}
        onDismiss={() => setSettingsDrawerVisible(false)}
        title="Settings"
        maxHeight="80%"
      >
        {/* Conversations Section */}
        <View style={{ marginBottom: 24 }}>
          <Text
            variant="titleMedium"
            style={{
              color: theme.colors.onSurface,
              fontWeight: "600",
              marginBottom: 12,
            }}
          >
            Conversations
          </Text>
          <DrawerItem
            icon="plus"
            label="New Conversation"
            onPress={() => {
              handleNewConversation();
              setSettingsDrawerVisible(false);
            }}
          />
          {activeSessions.length > 0 && (
            <DrawerItem
              icon="history"
              label="Conversation History"
              onPress={() => {
                setSettingsDrawerVisible(false);
                setConversationDrawerVisible(true);
              }}
            />
          )}
        </View>

        <Divider style={{ marginVertical: 16 }} />

        {/* Model Configuration Section */}
        <View style={{ marginBottom: 24 }}>
          <Text
            variant="titleMedium"
            style={{
              color: theme.colors.onSurface,
              fontWeight: "600",
              marginBottom: 12,
            }}
          >
            Model Configuration
          </Text>
          <DrawerItem
            icon="robot"
            label="Select Chat Model"
            onPress={() => {
              setSettingsDrawerVisible(false);
              router.push("/(auth)/+modal/select-provider-model");
            }}
          />
          <DrawerItem
            icon="format-title"
            label="Select Title Model"
            onPress={() => {
              setSettingsDrawerVisible(false);
              router.push("/(auth)/+modal/select-provider-model?target=title");
            }}
          />
          <DrawerItem
            icon="key"
            label="AI Provider Settings"
            onPress={() => {
              setSettingsDrawerVisible(false);
              router.push("/(auth)/settings/byok/ai-settings");
            }}
          />
        </View>

        <Divider style={{ marginVertical: 16 }} />

        {/* Chat Preferences Section */}
        <View style={{ marginBottom: 24 }}>
          <Text
            variant="titleMedium"
            style={{
              color: theme.colors.onSurface,
              fontWeight: "600",
              marginBottom: 12,
            }}
          >
            Chat Preferences
          </Text>

          {/* Streaming Toggle */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 12,
              paddingHorizontal: 16,
            }}
          >
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text
                variant="bodyLarge"
                style={{
                  color: theme.colors.onSurface,
                  marginBottom: 4,
                }}
              >
                Enable Streaming
              </Text>
              <Text
                variant="bodySmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                Stream responses as they're generated
              </Text>
            </View>
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

          {/* Debug Info Card */}
          {__DEV__ && enableStreamingPref && (
            <View
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: theme.colors.surfaceVariant,
                marginHorizontal: 16,
                marginVertical: 8,
                borderRadius: 8,
              }}
            >
              <Text
                variant="labelSmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginBottom: 8,
                  fontWeight: "bold",
                }}
              >
                🐛 DEBUG INFO
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Streaming: {enableStreamingPref ? "✅ ON" : "❌ OFF"}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Method: {streamingMethodPref}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Tools: {enableToolsPref ? "✅ ON" : "❌ OFF"}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Selected Tools: {selectedToolsPref.length}
              </Text>
            </View>
          )}

          {/* Streaming Method Selector */}
          {enableStreamingPref && (
            <View
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}
            >
              <Text
                variant="bodyLarge"
                style={{
                  color: theme.colors.onSurface,
                  marginBottom: 4,
                }}
              >
                Streaming Method
              </Text>
              <Text
                variant="bodySmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginBottom: 12,
                }}
              >
                Choose between SSE (Server-Sent Events) or Fetch
                (ReadableStream)
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <Button
                  mode={
                    streamingMethodPref === "sse" ? "contained" : "outlined"
                  }
                  onPress={() => {
                    updateConversationalConfig({
                      streamingMethod: "sse",
                    });
                  }}
                  style={{ flex: 1 }}
                >
                  SSE
                </Button>
                <Button
                  mode={
                    streamingMethodPref === "fetch" ? "contained" : "outlined"
                  }
                  onPress={() => {
                    updateConversationalConfig({
                      streamingMethod: "fetch",
                    });
                  }}
                  style={{ flex: 1 }}
                >
                  Fetch
                </Button>
              </View>
              <Text
                variant="bodySmall"
                style={{
                  color: theme.colors.primary,
                  marginTop: 8,
                  fontWeight: "bold",
                }}
              >
                Current: {streamingMethodPref.toUpperCase()}
              </Text>
            </View>
          )}

          {/* Token Count Toggle */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 12,
              paddingHorizontal: 16,
            }}
          >
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text
                variant="bodyLarge"
                style={{
                  color: theme.colors.onSurface,
                  marginBottom: 4,
                }}
              >
                Show Token Count
              </Text>
              <Text
                variant="bodySmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                Display metadata about messages
              </Text>
            </View>
            <Switch
              value={Boolean(showTokenCountPref)}
              onValueChange={() =>
                updateConversationalConfig({
                  showTokenCount: !showTokenCountPref,
                })
              }
              color={theme.colors.primary}
            />
          </View>

          {/* Text Size Selector */}
          <View
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
            }}
          >
            <Text
              variant="bodyLarge"
              style={{
                color: theme.colors.onSurface,
                marginBottom: 12,
              }}
            >
              Text Size
            </Text>
            <SegmentedButtons
              value={chatTextSizePref ?? "medium"}
              onValueChange={(next) =>
                updateConversationalConfig({
                  chatTextSize: next as AssistantConfig["chatTextSize"],
                })
              }
              buttons={[
                {
                  value: "small",
                  label: "Small",
                  icon: "format-size",
                },
                {
                  value: "medium",
                  label: "Medium",
                  icon: "format-size",
                },
                {
                  value: "large",
                  label: "Large",
                  icon: "format-size",
                },
              ]}
              density="regular"
            />
          </View>
        </View>

        <Divider style={{ marginVertical: 16 }} />

        {/* AI Tools Section */}
        <View style={{ marginBottom: 24 }}>
          <Text
            variant="titleMedium"
            style={{
              color: theme.colors.onSurface,
              fontWeight: "600",
              marginBottom: 12,
            }}
          >
            AI Tools
          </Text>

          {/* Tools Toggle */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 12,
              paddingHorizontal: 16,
            }}
          >
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text
                variant="bodyLarge"
                style={{
                  color: theme.colors.onSurface,
                  marginBottom: 4,
                }}
              >
                Enable AI Tools
              </Text>
              <Text
                variant="bodySmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                Allow AI to interact with your services
              </Text>
            </View>
            <Switch
              value={Boolean(enableToolsPref)}
              onValueChange={() =>
                updateConversationalConfig({
                  enableTools: !enableToolsPref,
                })
              }
              color={theme.colors.primary}
            />
          </View>

          {enableToolsPref && (
            <DrawerItem
              icon="tools"
              label={`Manage Tools (${selectedToolsPref.length}/${availableTools.length})`}
              onPress={() => {
                setSettingsDrawerVisible(false);
                setToolsDrawerVisible(true);
              }}
            />
          )}
        </View>
      </BottomDrawer>
    </ChatErrorBoundary>
  );
};

export default ConversationalAIScreen;
