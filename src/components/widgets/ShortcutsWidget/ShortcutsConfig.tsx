import React, { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import {
  Text,
  useTheme,
  Portal,
  Modal,
  Button,
  Switch,
  Divider,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";
import type { Widget } from "@/services/widgets/WidgetService";
import { widgetService } from "@/services/widgets/WidgetService";
import type { Shortcut } from "./ShortcutsWidget.types";
import { DEFAULT_SHORTCUTS, OPTIONAL_SHORTCUTS } from "./ShortcutsWidget.types";

interface ShortcutsConfigProps {
  visible: boolean;
  onDismiss: () => void;
  widget: Widget;
  onSave: (config: any) => void;
}

const ShortcutsConfig: React.FC<ShortcutsConfigProps> = ({
  visible,
  onDismiss,
  widget,
  onSave,
}) => {
  const theme = useTheme<AppTheme>();
  const { onPress: hapticPress } = useHaptics();

  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(false);

  // Load current shortcuts configuration when modal opens
  React.useEffect(() => {
    if (visible) {
      loadCurrentShortcuts();
    }
  }, [visible, widget.id]);

  const loadCurrentShortcuts = async () => {
    try {
      await widgetService.initialize();
      const widgetConfig = await widgetService.getWidget(widget.id);

      if (widgetConfig?.config?.shortcuts) {
        setShortcuts(widgetConfig.config.shortcuts);
      } else {
        // Initialize with default shortcuts
        setShortcuts([...DEFAULT_SHORTCUTS, ...OPTIONAL_SHORTCUTS]);
      }
    } catch (error) {
      console.error("Failed to load shortcuts configuration:", error);
      setShortcuts([...DEFAULT_SHORTCUTS, ...OPTIONAL_SHORTCUTS]);
    }
  };

  const handleToggleShortcut = (shortcutId: string) => {
    hapticPress();
    setShortcuts((prev) =>
      prev.map((shortcut) =>
        shortcut.id === shortcutId
          ? { ...shortcut, enabled: !shortcut.enabled }
          : shortcut,
      ),
    );
  };

  const handleMoveShortcut = (shortcutId: string, direction: "up" | "down") => {
    hapticPress();
    setShortcuts((prev) => {
      const index = prev.findIndex((s) => s.id === shortcutId);
      if (index === -1) return prev;

      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const newShortcuts = [...prev];
      const shortcut = newShortcuts[index];
      const targetShortcut = newShortcuts[newIndex];

      if (shortcut && targetShortcut) {
        newShortcuts[index] = targetShortcut;
        newShortcuts[newIndex] = shortcut;
      }

      return newShortcuts;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const config = { shortcuts };
      await widgetService.updateWidget(widget.id, { config });
      onSave(config);
      onDismiss();
    } catch (error) {
      console.error("Failed to save shortcuts configuration:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    hapticPress();
    setShortcuts([...DEFAULT_SHORTCUTS, ...OPTIONAL_SHORTCUTS]);
  };

  const enabledShortcuts = shortcuts.filter((s) => s.enabled);
  const disabledShortcuts = shortcuts.filter((s) => !s.enabled);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modal,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text variant="headlineMedium">Configure Shortcuts</Text>
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={theme.colors.onSurface}
              onPress={onDismiss}
            />
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Enabled Shortcuts ({enabledShortcuts.length})
              </Text>
              <Text variant="bodySmall" style={styles.sectionDescription}>
                These shortcuts will appear on your widget. Drag to reorder.
              </Text>

              {enabledShortcuts.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons
                    name="gesture-tap"
                    size={32}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text variant="bodySmall" style={styles.emptyText}>
                    No shortcuts enabled. Enable some below to customize your
                    widget.
                  </Text>
                </View>
              ) : (
                enabledShortcuts.map((shortcut, index) => (
                  <View key={shortcut.id} style={styles.shortcutItem}>
                    <View style={styles.shortcutInfo}>
                      <MaterialCommunityIcons
                        name={shortcut.icon as any}
                        size={20}
                        color={theme.colors.primary}
                        style={styles.shortcutIcon}
                      />
                      <Text variant="bodyMedium">{shortcut.label}</Text>
                    </View>

                    <View style={styles.shortcutControls}>
                      <View style={styles.orderControls}>
                        <TouchableOpacity
                          style={[
                            styles.orderButton,
                            index === 0 && styles.orderButtonDisabled,
                          ]}
                          onPress={() => handleMoveShortcut(shortcut.id, "up")}
                          disabled={index === 0}
                        >
                          <MaterialCommunityIcons
                            name="chevron-up"
                            size={16}
                            color={
                              index === 0
                                ? theme.colors.onSurfaceDisabled
                                : theme.colors.onSurface
                            }
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.orderButton,
                            index === enabledShortcuts.length - 1 &&
                              styles.orderButtonDisabled,
                          ]}
                          onPress={() =>
                            handleMoveShortcut(shortcut.id, "down")
                          }
                          disabled={index === enabledShortcuts.length - 1}
                        >
                          <MaterialCommunityIcons
                            name="chevron-down"
                            size={16}
                            color={
                              index === enabledShortcuts.length - 1
                                ? theme.colors.onSurfaceDisabled
                                : theme.colors.onSurface
                            }
                          />
                        </TouchableOpacity>
                      </View>

                      <Switch
                        value={shortcut.enabled}
                        onValueChange={() => handleToggleShortcut(shortcut.id)}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>

            <Divider style={styles.divider} />

            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Available Shortcuts ({disabledShortcuts.length})
              </Text>
              <Text variant="bodySmall" style={styles.sectionDescription}>
                These shortcuts are available but currently hidden.
              </Text>

              {disabledShortcuts.map((shortcut) => (
                <View key={shortcut.id} style={styles.shortcutItem}>
                  <View style={styles.shortcutInfo}>
                    <MaterialCommunityIcons
                      name={shortcut.icon as any}
                      size={20}
                      color={theme.colors.onSurfaceVariant}
                      style={styles.shortcutIcon}
                    />
                    <Text variant="bodyMedium">{shortcut.label}</Text>
                  </View>

                  <Switch
                    value={shortcut.enabled}
                    onValueChange={() => handleToggleShortcut(shortcut.id)}
                  />
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={handleReset}
              disabled={loading}
              style={styles.resetButton}
            >
              Reset to Default
            </Button>

            <View style={styles.primaryActions}>
              <Button
                mode="text"
                onPress={onDismiss}
                disabled={loading}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                loading={loading}
                disabled={loading || enabledShortcuts.length === 0}
              >
                Save
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: spacing.lg,
    borderRadius: 16,
    maxHeight: "80%",
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.md,
  },
  modalBody: {
    flex: 1,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    opacity: 0.7,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  emptyText: {
    marginTop: spacing.sm,
    textAlign: "center",
    opacity: 0.7,
  },
  shortcutItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  shortcutInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  shortcutIcon: {
    marginRight: spacing.md,
  },
  shortcutControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  orderControls: {
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  orderButton: {
    padding: spacing.xs,
  },
  orderButtonDisabled: {
    opacity: 0.3,
  },
  divider: {
    marginVertical: spacing.md,
  },
  modalActions: {
    flexDirection: "column",
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  resetButton: {
    alignSelf: "flex-start",
  },
  primaryActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
  },
  cancelButton: {
    marginRight: "auto",
  },
});

export default ShortcutsConfig;
