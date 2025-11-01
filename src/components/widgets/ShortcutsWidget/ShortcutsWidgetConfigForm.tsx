import React, { useState, useEffect } from "react";
import { StyleSheet, View, ScrollView, Alert } from "react-native";
import {
  Text,
  TextInput,
  Button,
  Switch,
  Card,
  IconButton,
  Menu,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { Widget } from "@/services/widgets/WidgetService";
import { widgetService } from "@/services/widgets/WidgetService";
import type { Shortcut, ShortcutsWidgetConfig } from "./ShortcutsWidget.types";
import { DEFAULT_SHORTCUTS, OPTIONAL_SHORTCUTS } from "./ShortcutsWidget.types";
import { NAVIGATION_ROUTES } from "@/utils/navigation.utils";
import { spacing } from "@/theme/spacing";
import { SkeletonPlaceholder } from "@/components/common/Skeleton";

type ShortcutsWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

// Available icons for shortcuts
const AVAILABLE_ICONS = [
  "home",
  "magnify",
  "calendar",
  "play-circle",
  "server",
  "download",
  "clock",
  "cog",
  "plus",
  "star",
  "heart",
  "bookmark",
  "settings",
  "account",
  "bell",
  "camera",
  "chart-line",
  "database",
  "earth",
  "file",
  "folder",
  "gamepad",
  "headphones",
  "image",
  "keyboard",
  "lightbulb",
  "mail",
  "map",
  "microphone",
  "monitor",
  "movie",
  "music",
  "newspaper",
  "palette",
  "phone",
  "pin",
  "printer",
  "radio",
  "rocket",
  "school",
  "shield",
  "shopping",
  "tag",
  "television",
  "thermometer",
  "tool",
  "umbrella",
  "video",
  "wallet",
  "water",
  "wifi",
  "wrench",
  "youtube",
];

// Function to discover routes from NAVIGATION_ROUTES
const getRouteSuggestions = (): { label: string; route: string }[] => {
  const suggestions: { label: string; route: string }[] = [];

  // Static routes (string values)
  Object.entries(NAVIGATION_ROUTES).forEach(([key, value]) => {
    if (typeof value === "string") {
      // Convert key to readable label
      const label = key
        .replace(/([A-Z])/g, " $1") // Add spaces before capital letters
        .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
        .replace(/With Date$/, "") // Remove "With Date" suffix
        .trim();

      suggestions.push({
        label,
        route: value,
      });
    }
  });

  // Sort by label for better UX
  return suggestions.sort((a, b) => a.label.localeCompare(b.label));
};

const ShortcutsWidgetConfigForm: React.FC<ShortcutsWidgetConfigFormProps> = ({
  widget,
  onSaved,
}) => {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [iconMenuVisible, setIconMenuVisible] = useState(false);
  const [routeMenuVisible, setRouteMenuVisible] = useState(false);

  // Load existing shortcuts
  useEffect(() => {
    const loadShortcuts = async () => {
      try {
        await widgetService.initialize();
        const widgetConfig = await widgetService.getWidget(widget.id);

        if (widgetConfig?.config?.shortcuts) {
          setShortcuts(widgetConfig.config.shortcuts);
        } else {
          // Start with default shortcuts
          setShortcuts([...DEFAULT_SHORTCUTS, ...OPTIONAL_SHORTCUTS]);
        }
      } catch (error) {
        console.error("Failed to load shortcuts configuration:", error);
        setShortcuts([...DEFAULT_SHORTCUTS, ...OPTIONAL_SHORTCUTS]);
      } finally {
        setLoading(false);
      }
    };

    loadShortcuts();
  }, [widget.id]);

  const validateRoute = (route: string): boolean => {
    // Basic validation - routes should start with "/" and contain "(auth)" for protected routes
    if (!route.startsWith("/")) {
      return false;
    }

    // For protected routes, they should include "(auth)"
    if (
      route.includes("/auth/") ||
      route.includes("/settings/") ||
      route.includes("/services/")
    ) {
      return route.includes("(auth)");
    }

    return true;
  };

  const saveShortcuts = async () => {
    setSaving(true);
    try {
      const config: ShortcutsWidgetConfig = { shortcuts };
      await widgetService.updateWidget(widget.id, { config });
      onSaved();
    } catch (error) {
      console.error("Failed to save shortcuts:", error);
      Alert.alert("Error", "Failed to save shortcuts configuration.");
    } finally {
      setSaving(false);
    }
  };

  const addShortcut = () => {
    const newShortcut: Shortcut = {
      id: `shortcut_${Date.now()}`,
      label: "",
      icon: "star",
      route: "",
      enabled: true,
    };
    setEditingShortcut(newShortcut);
    setShowAddForm(true);
  };

  const editShortcut = (shortcut: Shortcut) => {
    setEditingShortcut({ ...shortcut });
    setShowAddForm(true);
  };

  const deleteShortcut = (shortcutId: string) => {
    Alert.alert(
      "Delete Shortcut",
      "Are you sure you want to delete this shortcut?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setShortcuts(shortcuts.filter((s) => s.id !== shortcutId));
          },
        },
      ],
    );
  };

  const toggleShortcutEnabled = (shortcutId: string) => {
    setShortcuts(
      shortcuts.map((s) =>
        s.id === shortcutId ? { ...s, enabled: !s.enabled } : s,
      ),
    );
  };

  const saveEditingShortcut = () => {
    if (!editingShortcut) return;

    // Validate required fields
    if (!editingShortcut.label.trim()) {
      Alert.alert("Error", "Shortcut label is required.");
      return;
    }

    if (!editingShortcut.route.trim()) {
      Alert.alert("Error", "Shortcut route is required.");
      return;
    }

    if (!validateRoute(editingShortcut.route)) {
      Alert.alert(
        "Error",
        "Invalid route format. Routes should start with '/' and include '(auth)' for protected routes.",
      );
      return;
    }

    const isNew = !shortcuts.find((s) => s.id === editingShortcut.id);
    if (isNew) {
      setShortcuts([...shortcuts, editingShortcut]);
    } else {
      setShortcuts(
        shortcuts.map((s) =>
          s.id === editingShortcut.id ? editingShortcut : s,
        ),
      );
    }

    setEditingShortcut(null);
    setShowAddForm(false);
  };

  const cancelEditing = () => {
    setEditingShortcut(null);
    setShowAddForm(false);
  };

  if (loading) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <SkeletonPlaceholder
          width="60%"
          height={28}
          borderRadius={8}
          style={{ marginBottom: spacing.md }}
        />
        <SkeletonPlaceholder
          width="80%"
          height={20}
          borderRadius={4}
          style={{ marginBottom: spacing.lg }}
        />

        <SkeletonPlaceholder
          width="100%"
          height={48}
          borderRadius={12}
          style={{ marginBottom: spacing.sm }}
        />

        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} style={styles.skeletonShortcutCard}>
            <Card.Content style={styles.skeletonShortcutContent}>
              <View style={styles.skeletonShortcutHeader}>
                <View style={styles.skeletonShortcutInfo}>
                  <SkeletonPlaceholder
                    width={32}
                    height={32}
                    borderRadius={16}
                  />
                  <View style={styles.skeletonShortcutText}>
                    <SkeletonPlaceholder
                      width="40%"
                      height={20}
                      borderRadius={4}
                    />
                    <SkeletonPlaceholder
                      width="60%"
                      height={16}
                      borderRadius={4}
                    />
                  </View>
                </View>
                <SkeletonPlaceholder width={48} height={24} borderRadius={12} />
              </View>
            </Card.Content>
          </Card>
        ))}

        <SkeletonPlaceholder
          width="100%"
          height={48}
          borderRadius={12}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <Text variant="titleMedium" style={styles.title}>
        {widget.title} Configuration
      </Text>

      <Text variant="bodyMedium" style={styles.description}>
        Configure shortcuts for quick navigation to different app sections.
      </Text>

      {/* Add New Shortcut Button */}
      <Button
        mode="outlined"
        onPress={addShortcut}
        icon="plus"
        style={styles.addButton}
      >
        Add Shortcut
      </Button>

      {/* Shortcuts List */}
      <View style={styles.shortcutsList}>
        {shortcuts.map((shortcut) => (
          <Card key={shortcut.id} style={styles.shortcutCard}>
            <Card.Content style={styles.shortcutContent}>
              <View style={styles.shortcutHeader}>
                <View style={styles.shortcutInfo}>
                  <MaterialCommunityIcons
                    name={shortcut.icon as any}
                    size={24}
                    color={shortcut.enabled ? "#666" : "#ccc"}
                  />
                  <View style={styles.shortcutText}>
                    <Text
                      variant="titleSmall"
                      style={!shortcut.enabled && styles.disabledText}
                    >
                      {shortcut.label}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={!shortcut.enabled && styles.disabledText}
                    >
                      {shortcut.route}
                    </Text>
                  </View>
                </View>
                <View style={styles.shortcutActions}>
                  <Switch
                    value={shortcut.enabled}
                    onValueChange={() => toggleShortcutEnabled(shortcut.id)}
                  />
                  <IconButton
                    icon="pencil"
                    size={20}
                    onPress={() => editShortcut(shortcut)}
                  />
                  <IconButton
                    icon="delete"
                    size={20}
                    onPress={() => deleteShortcut(shortcut.id)}
                  />
                </View>
              </View>
            </Card.Content>
          </Card>
        ))}
      </View>

      {/* Add/Edit Form Modal */}
      {showAddForm && editingShortcut && (
        <Card style={styles.formCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.formTitle}>
              {shortcuts.find((s) => s.id === editingShortcut.id)
                ? "Edit Shortcut"
                : "Add Shortcut"}
            </Text>

            <TextInput
              label="Label"
              value={editingShortcut.label}
              onChangeText={(text) =>
                setEditingShortcut({ ...editingShortcut, label: text })
              }
              style={styles.input}
              mode="outlined"
            />

            <View style={styles.iconSelector}>
              <Text variant="bodyMedium">Icon</Text>
              <Menu
                visible={iconMenuVisible}
                onDismiss={() => setIconMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setIconMenuVisible(true)}
                    icon={() => (
                      <MaterialCommunityIcons
                        name={editingShortcut.icon as any}
                        size={20}
                        color="#666"
                      />
                    )}
                  >
                    {editingShortcut.icon}
                  </Button>
                }
              >
                <ScrollView style={styles.iconMenu}>
                  {AVAILABLE_ICONS.map((icon) => (
                    <Menu.Item
                      key={icon}
                      onPress={() => {
                        setEditingShortcut({ ...editingShortcut, icon });
                        setIconMenuVisible(false);
                      }}
                      leadingIcon={icon as any}
                      title={icon}
                    />
                  ))}
                </ScrollView>
              </Menu>
            </View>

            <View style={styles.routeSelector}>
              <Text variant="bodyMedium">Route</Text>
              <Menu
                visible={routeMenuVisible}
                onDismiss={() => setRouteMenuVisible(false)}
                anchor={
                  <TextInput
                    value={editingShortcut.route}
                    onChangeText={(text) =>
                      setEditingShortcut({ ...editingShortcut, route: text })
                    }
                    style={styles.input}
                    mode="outlined"
                    placeholder="/(auth)/dashboard"
                    right={
                      <TextInput.Icon
                        icon="menu-down"
                        onPress={() => setRouteMenuVisible(true)}
                      />
                    }
                  />
                }
              >
                {getRouteSuggestions().map((suggestion) => (
                  <Menu.Item
                    key={suggestion.route}
                    onPress={() => {
                      setEditingShortcut({
                        ...editingShortcut,
                        route: suggestion.route,
                      });
                      setRouteMenuVisible(false);
                    }}
                    title={suggestion.label}
                    titleStyle={styles.routeMenuItem}
                  />
                ))}
              </Menu>
            </View>

            <View style={styles.formActions}>
              <Button onPress={cancelEditing} style={styles.cancelButton}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={saveEditingShortcut}
                loading={saving}
                disabled={saving}
              >
                Save
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Save All Changes Button */}
      <Button
        mode="contained"
        onPress={saveShortcuts}
        loading={saving}
        disabled={saving}
        style={styles.saveButton}
      >
        Save Configuration
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.md,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontWeight: "600",
  },
  description: {
    opacity: 0.8,
  },
  addButton: {
    marginTop: spacing.sm,
  },
  shortcutsList: {
    gap: spacing.sm,
  },
  shortcutCard: {
    marginVertical: spacing.xs,
  },
  shortcutContent: {
    padding: spacing.sm,
  },
  shortcutHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shortcutInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  shortcutText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  shortcutActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  disabledText: {
    opacity: 0.5,
  },
  formCard: {
    marginTop: spacing.md,
  },
  formTitle: {
    marginBottom: spacing.md,
  },
  input: {
    marginBottom: spacing.sm,
  },
  iconSelector: {
    marginBottom: spacing.sm,
  },
  routeSelector: {
    marginBottom: spacing.sm,
  },
  routeMenuItem: {
    fontSize: 12,
  },
  iconMenu: {
    maxHeight: 300,
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
  skeletonShortcutCard: {
    marginVertical: spacing.xs,
  },
  skeletonShortcutContent: {
    padding: spacing.sm,
  },
  skeletonShortcutHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skeletonShortcutInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  skeletonShortcutText: {
    marginLeft: spacing.sm,
    flex: 1,
    gap: spacing.xs,
  },
});

export default ShortcutsWidgetConfigForm;
