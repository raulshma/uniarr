import React, { useState } from "react";
import { View, ScrollView, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import {
  Card,
  Text,
  Switch,
  Button,
  Chip,
  List,
  Portal,
  Dialog,
  TextInput,
  SegmentedButtons,
  IconButton,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useVoiceAssistant from "../../../src/hooks/useVoiceAssistant";
import type { VoiceShortcut } from "../../../src/services/voice/VoiceAssistantService";

const VoiceAssistantScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    config,
    isEnabled,
    isLoading,
    platformCapabilities,
    shortcuts,
    availableCommands,
    addShortcut,
    removeShortcut,
    updateShortcut,
    setEnabled,
  } = useVoiceAssistant();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newShortcut, setNewShortcut] = useState<Partial<VoiceShortcut>>({
    title: "",
    subtitle: "",
    phrase: "",
    action: "",
    platform: Platform.OS === "ios" ? "ios" : "android",
  });

  const handleEnableToggle = async (enabled: boolean) => {
    try {
      await setEnabled(enabled);
    } catch (error) {
      Alert.alert("Error", "Failed to update voice assistant settings");
    }
  };

  const handleAddShortcut = async () => {
    if (!newShortcut.title || !newShortcut.phrase || !newShortcut.action) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    try {
      await addShortcut(newShortcut as Omit<VoiceShortcut, "id">);
      setShowAddDialog(false);
      setNewShortcut({
        title: "",
        subtitle: "",
        phrase: "",
        action: "",
        platform: Platform.OS === "ios" ? "ios" : "android",
      });
    } catch (error) {
      Alert.alert("Error", "Failed to add voice shortcut");
    }
  };

  const handleRemoveShortcut = (id: string) => {
    Alert.alert(
      "Remove Shortcut",
      "Are you sure you want to remove this voice shortcut?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeShortcut(id),
        },
      ]
    );
  };

  const handleToggleShortcut = async (id: string, enabled: boolean) => {
    try {
      await updateShortcut(id, { enabled });
    } catch (error) {
      Alert.alert("Error", "Failed to update shortcut");
    }
  };

  const getActionDescription = (action: string): string => {
    const command = availableCommands.find((cmd) => cmd.action === action);
    return command?.description || action;
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "ios":
        return "apple";
      case "android":
        return "android";
      default:
        return "cellphone";
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case "ios":
        return "iOS (Siri)";
      case "android":
        return "Android (Assistant)";
      default:
        return "Both Platforms";
    }
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text variant="headlineMedium" style={{ marginBottom: 8 }}>
            Voice Assistant
          </Text>
          <Text variant="bodyLarge" style={{ opacity: 0.7 }}>
            Manage voice commands and shortcuts for Siri and Google Assistant
          </Text>
        </View>

        {/* Enable/Disable Toggle */}
        <Card style={{ marginBottom: 16 }}>
          <Card.Content>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium">Enable Voice Assistant</Text>
                <Text variant="bodyMedium" style={{ opacity: 0.7 }}>
                  Allow voice commands and shortcuts
                </Text>
              </View>
              <Switch
                value={isEnabled}
                onValueChange={handleEnableToggle}
                disabled={isLoading}
              />
            </View>
          </Card.Content>
        </Card>

        {/* Platform Capabilities */}
        <Card style={{ marginBottom: 16 }}>
          <Card.Title title="Platform Support" />
          <Card.Content>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip
                icon={platformCapabilities.siriShortcuts ? "check" : "close"}
                mode={platformCapabilities.siriShortcuts ? "flat" : "outlined"}
              >
                Siri Shortcuts
              </Chip>
              <Chip
                icon={platformCapabilities.googleAssistant ? "check" : "close"}
                mode={
                  platformCapabilities.googleAssistant ? "flat" : "outlined"
                }
              >
                Google Assistant
              </Chip>
              <Chip
                icon={platformCapabilities.voiceRecognition ? "check" : "close"}
                mode={
                  platformCapabilities.voiceRecognition ? "flat" : "outlined"
                }
              >
                Voice Recognition
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* Available Commands */}
        <Card style={{ marginBottom: 16 }}>
          <Card.Title title="Available Commands" />
          <Card.Content>
            {availableCommands.map((command, index) => (
              <List.Item
                key={index}
                title={command.phrase}
                description={command.description}
                left={(props) => <List.Icon {...props} icon="microphone" />}
              />
            ))}
          </Card.Content>
        </Card>

        {/* Custom Shortcuts */}
        <Card style={{ marginBottom: 16 }}>
          <Card.Title
            title="Custom Shortcuts"
            right={(props) => (
              <IconButton
                {...props}
                icon="plus"
                onPress={() => setShowAddDialog(true)}
              />
            )}
          />
          <Card.Content>
            {shortcuts.length === 0 ? (
              <Text
                variant="bodyMedium"
                style={{ textAlign: "center", opacity: 0.7 }}
              >
                No custom shortcuts configured
              </Text>
            ) : (
              shortcuts.map((shortcut) => (
                <List.Item
                  key={shortcut.id}
                  title={shortcut.title}
                  description={`${shortcut.phrase} • ${getActionDescription(
                    shortcut.action
                  )}`}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon={getPlatformIcon(shortcut.platform)}
                    />
                  )}
                  right={(props) => (
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Text variant="bodySmall" style={{ marginRight: 8 }}>
                        {getPlatformName(shortcut.platform)}
                      </Text>
                      <Switch
                        value={shortcut.enabled}
                        onValueChange={(enabled) =>
                          handleToggleShortcut(shortcut.id, enabled)
                        }
                      />
                      <IconButton
                        {...props}
                        icon="delete"
                        onPress={() => handleRemoveShortcut(shortcut.id)}
                      />
                    </View>
                  )}
                />
              ))
            )}
          </Card.Content>
        </Card>

        {/* Settings */}
        <Card style={{ marginBottom: 16 }}>
          <Card.Title title="Settings" />
          <Card.Content>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <View>
                <Text variant="titleMedium">Natural Language Processing</Text>
                <Text variant="bodyMedium" style={{ opacity: 0.7 }}>
                  Enable smart command interpretation
                </Text>
              </View>
              <Switch
                value={config.naturalLanguageEnabled}
                onValueChange={(enabled) => {
                  // This would update the config in the service
                  console.log("NLP setting:", enabled);
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View>
                <Text variant="titleMedium">Voice Feedback</Text>
                <Text variant="bodyMedium" style={{ opacity: 0.7 }}>
                  Provide audio confirmation for commands
                </Text>
              </View>
              <Switch
                value={config.voiceFeedback}
                onValueChange={(enabled) => {
                  // This would update the config in the service
                  console.log("Voice feedback setting:", enabled);
                }}
              />
            </View>
          </Card.Content>
        </Card>

        {/* Implementation Notes */}
        <Card style={{ marginBottom: 16 }}>
          <Card.Title title="Implementation Notes" />
          <Card.Content>
            <Text variant="bodyMedium" style={{ opacity: 0.7 }}>
              • Siri Shortcuts require iOS 12+ and may need native iOS code for
              full functionality{"\n"}• Google Assistant integration requires
              Android App Actions configuration{"\n"}• Voice recognition may
              require additional native modules for real-time processing{"\n"}•
              Custom shortcuts are registered with the platform when enabled
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Add Shortcut Dialog */}
      <Portal>
        <Dialog
          visible={showAddDialog}
          onDismiss={() => setShowAddDialog(false)}
        >
          <Dialog.Title>Add Custom Shortcut</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Title"
              value={newShortcut.title}
              onChangeText={(text) =>
                setNewShortcut((prev: Partial<VoiceShortcut>) => ({
                  ...prev,
                  title: text,
                }))
              }
              style={{ marginBottom: 16 }}
            />
            <TextInput
              label="Subtitle (Optional)"
              value={newShortcut.subtitle}
              onChangeText={(text) =>
                setNewShortcut((prev: Partial<VoiceShortcut>) => ({
                  ...prev,
                  subtitle: text,
                }))
              }
              style={{ marginBottom: 16 }}
            />
            <TextInput
              label="Voice Phrase"
              value={newShortcut.phrase}
              onChangeText={(text) =>
                setNewShortcut((prev: Partial<VoiceShortcut>) => ({
                  ...prev,
                  phrase: text,
                }))
              }
              placeholder="e.g., 'Search for Breaking Bad'"
              style={{ marginBottom: 16 }}
            />

            <SegmentedButtons
              value={newShortcut.platform || "both"}
              onValueChange={(value) =>
                setNewShortcut((prev: Partial<VoiceShortcut>) => ({
                  ...prev,
                  platform: value as any,
                }))
              }
              buttons={[
                { value: "ios", label: "iOS" },
                { value: "android", label: "Android" },
                { value: "both", label: "Both" },
              ]}
              style={{ marginBottom: 16 }}
            />

            <Text variant="bodySmall" style={{ opacity: 0.7, marginBottom: 8 }}>
              Select Action:
            </Text>
            {availableCommands.map((command) => (
              <Button
                key={command.action}
                mode={
                  newShortcut.action === command.action
                    ? "contained"
                    : "outlined"
                }
                onPress={() =>
                  setNewShortcut((prev: Partial<VoiceShortcut>) => ({
                    ...prev,
                    action: command.action,
                  }))
                }
                style={{ marginBottom: 8 }}
              >
                {command.phrase}
              </Button>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onPress={handleAddShortcut}>Add</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

export default VoiceAssistantScreen;
