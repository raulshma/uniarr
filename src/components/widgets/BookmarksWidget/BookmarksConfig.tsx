import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  Switch,
} from "react-native";
import {
  Text,
  useTheme,
  Modal,
  Button,
  Divider,
  Chip,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";
import type { Widget } from "@/services/widgets/WidgetService";
import { widgetService } from "@/services/widgets/WidgetService";
import type { Bookmark, HealthCheckConfig } from "./BookmarksWidget.types";
import {
  DEFAULT_HEALTH_CHECK_CONFIG,
  COMMON_HEALTH_CODES,
} from "./BookmarksWidget.types";
import IconPicker from "./IconPicker";

interface BookmarksConfigProps {
  visible?: boolean;
  onDismiss?: () => void;
  widget: Widget;
  onSave: (config: any) => void;
  isScreenMode?: boolean;
}

interface BookmarkEditState {
  id: string;
  label: string;
  url: string;
  icon: {
    type: "material-icon" | "cdn-icon" | "image-url";
    value: string;
    backgroundColor?: string;
    textColor?: string;
  };
  enabled: boolean;
  healthCheck: HealthCheckConfig;
}

const BookmarksConfig: React.FC<BookmarksConfigProps> = ({
  visible = true,
  onDismiss,
  widget,
  onSave,
  isScreenMode = false,
}) => {
  const theme = useTheme<AppTheme>();
  const { onPress: hapticPress } = useHaptics();

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingBookmark, setEditingBookmark] =
    useState<BookmarkEditState | null>(null);
  const [iconPickerVisible, setIconPickerVisible] = useState(false);
  const [showHealthCodePresets, setShowHealthCodePresets] = useState(false);

  // Load current bookmarks configuration when modal opens
  useEffect(() => {
    if (!visible) return;

    const loadCurrentBookmarks = async () => {
      try {
        await widgetService.initialize();
        const widgetConfig = await widgetService.getWidget(widget.id);

        if (widgetConfig?.config?.bookmarks) {
          setBookmarks(widgetConfig.config.bookmarks);
        } else {
          setBookmarks([]);
        }
      } catch (error) {
        console.error("Failed to load bookmarks configuration:", error);
        setBookmarks([]);
      }
    };

    loadCurrentBookmarks();
  }, [visible, widget.id]);

  const handleAddBookmark = () => {
    hapticPress();
    setEditingBookmark({
      id: `bookmark-${Date.now()}`,
      label: "",
      url: "",
      icon: {
        type: "material-icon",
        value: "link",
        backgroundColor: undefined,
        textColor: undefined,
      },
      enabled: true,
      healthCheck: { ...DEFAULT_HEALTH_CHECK_CONFIG },
    });
  };

  const handleEditBookmark = (bookmark: Bookmark) => {
    hapticPress();
    setEditingBookmark({
      id: bookmark.id,
      label: bookmark.label,
      url: bookmark.url,
      icon: { ...bookmark.icon },
      enabled: bookmark.enabled,
      healthCheck: bookmark.healthCheck || { ...DEFAULT_HEALTH_CHECK_CONFIG },
    });
  };

  const handleSaveBookmark = () => {
    if (!editingBookmark) return;

    if (!editingBookmark.label.trim() || !editingBookmark.url.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    hapticPress();

    // Add or update bookmark
    const existingIndex = bookmarks.findIndex(
      (b) => b.id === editingBookmark.id,
    );
    if (existingIndex >= 0) {
      const updated = [...bookmarks];
      updated[existingIndex] = {
        id: editingBookmark.id,
        label: editingBookmark.label,
        url: editingBookmark.url,
        icon: editingBookmark.icon,
        enabled: editingBookmark.enabled,
        healthCheck: editingBookmark.healthCheck,
      };
      setBookmarks(updated);
    } else {
      setBookmarks([
        ...bookmarks,
        {
          id: editingBookmark.id,
          label: editingBookmark.label,
          url: editingBookmark.url,
          icon: editingBookmark.icon,
          enabled: editingBookmark.enabled,
          healthCheck: editingBookmark.healthCheck,
        },
      ]);
    }

    setEditingBookmark(null);
  };

  const handleDeleteBookmark = (bookmarkId: string) => {
    hapticPress();
    setBookmarks(bookmarks.filter((b) => b.id !== bookmarkId));
    if (editingBookmark?.id === bookmarkId) {
      setEditingBookmark(null);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const config = { bookmarks };
      await widgetService.updateWidget(widget.id, { config });
      onSave(config);
      if (!isScreenMode && onDismiss) {
        onDismiss();
      }
    } catch (error) {
      console.error("Failed to save bookmarks configuration:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleIconSelect = (icon: { type: string; value: string }) => {
    if (!editingBookmark) return;

    setEditingBookmark({
      ...editingBookmark,
      icon: {
        type: icon.type as any,
        value: icon.value,
        backgroundColor: editingBookmark.icon.backgroundColor,
        textColor: editingBookmark.icon.textColor,
      },
    });
    setIconPickerVisible(false);
  };

  const toggleHealthCode = (code: number) => {
    if (!editingBookmark?.healthCheck) return;

    const codes = editingBookmark.healthCheck.healthyCodes;
    const newCodes = codes.includes(code)
      ? codes.filter((c) => c !== code)
      : [...codes, code].sort((a, b) => a - b);

    setEditingBookmark({
      ...editingBookmark,
      healthCheck: {
        ...editingBookmark.healthCheck,
        healthyCodes: newCodes,
      },
    });
  };

  const setHealthCodePreset = (preset: number[]) => {
    if (!editingBookmark?.healthCheck) return;

    setEditingBookmark({
      ...editingBookmark,
      healthCheck: {
        ...editingBookmark.healthCheck,
        healthyCodes: preset,
      },
    });
    setShowHealthCodePresets(false);
  };

  if (editingBookmark) {
    const content = (
      <>
        <ScrollView
          style={styles.editModalContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={() => setEditingBookmark(null)}>
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={theme.colors.onSurface}
              />
            </TouchableOpacity>
            <Text variant="headlineSmall">
              {bookmarks.find((b) => b.id === editingBookmark.id)
                ? "Edit Bookmark"
                : "Add Bookmark"}
            </Text>
            <Button
              mode="text"
              onPress={handleSaveBookmark}
              disabled={loading}
              textColor={theme.colors.primary}
              labelStyle={{ fontWeight: "600" }}
            >
              Save
            </Button>
          </View>

          <Divider />

          {/* Basic Information */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Basic Information
            </Text>

            <View style={styles.formGroup}>
              <Text variant="labelMedium" style={styles.label}>
                Label *
              </Text>
              <RNTextInput
                style={[
                  styles.input,
                  {
                    color: theme.colors.onSurface,
                    borderColor: theme.colors.outline,
                    backgroundColor: theme.colors.surfaceVariant,
                  },
                ]}
                placeholder="e.g., My Dashboard"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={editingBookmark.label}
                onChangeText={(text) =>
                  setEditingBookmark({ ...editingBookmark, label: text })
                }
              />
            </View>

            <View style={styles.formGroup}>
              <Text variant="labelMedium" style={styles.label}>
                URL *
              </Text>
              <RNTextInput
                style={[
                  styles.input,
                  {
                    color: theme.colors.onSurface,
                    borderColor: theme.colors.outline,
                    backgroundColor: theme.colors.surfaceVariant,
                  },
                ]}
                placeholder="https://example.com"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={editingBookmark.url}
                onChangeText={(text) =>
                  setEditingBookmark({ ...editingBookmark, url: text })
                }
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.formGroup}>
              <Text variant="labelMedium" style={styles.label}>
                Enabled
              </Text>
              <Switch
                value={editingBookmark.enabled}
                onValueChange={(value) =>
                  setEditingBookmark({ ...editingBookmark, enabled: value })
                }
              />
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Icon Configuration */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Icon Configuration
            </Text>

            <Button
              mode="outlined"
              onPress={() => setIconPickerVisible(true)}
              icon="image"
              style={styles.pickIconButton}
            >
              Select Icon
            </Button>

            <Text variant="labelSmall" style={styles.selectedIconInfo}>
              Type: {editingBookmark.icon.type}
              {editingBookmark.icon.value && ` - ${editingBookmark.icon.value}`}
            </Text>
          </View>

          <Divider style={styles.divider} />

          {/* Health Check Configuration */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Health Check Configuration
            </Text>

            <View style={styles.formGroup}>
              <View style={styles.healthCheckHeaderRow}>
                <Text variant="labelMedium">Enable Health Check</Text>
                <Switch
                  value={editingBookmark.healthCheck.enabled}
                  onValueChange={(value) =>
                    setEditingBookmark({
                      ...editingBookmark,
                      healthCheck: {
                        ...editingBookmark.healthCheck,
                        enabled: value,
                      },
                    })
                  }
                />
              </View>
            </View>

            {editingBookmark.healthCheck.enabled && (
              <>
                <View style={styles.formGroup}>
                  <Text variant="labelMedium" style={styles.label}>
                    Check Interval (seconds)
                  </Text>
                  <RNTextInput
                    style={[
                      styles.input,
                      {
                        color: theme.colors.onSurface,
                        borderColor: theme.colors.outline,
                        backgroundColor: theme.colors.surfaceVariant,
                      },
                    ]}
                    placeholder="300"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    value={String(editingBookmark.healthCheck.interval)}
                    onChangeText={(text) =>
                      setEditingBookmark({
                        ...editingBookmark,
                        healthCheck: {
                          ...editingBookmark.healthCheck,
                          interval: parseInt(text, 10) || 300,
                        },
                      })
                    }
                    keyboardType="number-pad"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text variant="labelMedium" style={styles.label}>
                    Timeout (milliseconds)
                  </Text>
                  <RNTextInput
                    style={[
                      styles.input,
                      {
                        color: theme.colors.onSurface,
                        borderColor: theme.colors.outline,
                        backgroundColor: theme.colors.surfaceVariant,
                      },
                    ]}
                    placeholder="5000"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    value={String(editingBookmark.healthCheck.timeout)}
                    onChangeText={(text) =>
                      setEditingBookmark({
                        ...editingBookmark,
                        healthCheck: {
                          ...editingBookmark.healthCheck,
                          timeout: parseInt(text, 10) || 5000,
                        },
                      })
                    }
                    keyboardType="number-pad"
                  />
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.healthCheckHeaderRow}>
                    <Text variant="labelMedium">Healthy HTTP Status Codes</Text>
                    <TouchableOpacity
                      onPress={() =>
                        setShowHealthCodePresets(!showHealthCodePresets)
                      }
                    >
                      <MaterialCommunityIcons
                        name={
                          showHealthCodePresets ? "chevron-up" : "chevron-down"
                        }
                        size={20}
                        color={theme.colors.primary}
                      />
                    </TouchableOpacity>
                  </View>

                  {showHealthCodePresets && (
                    <View style={styles.presetsContainer}>
                      <Chip
                        mode={
                          JSON.stringify(
                            editingBookmark.healthCheck.healthyCodes,
                          ) === JSON.stringify(COMMON_HEALTH_CODES.ALL)
                            ? "flat"
                            : "outlined"
                        }
                        onPress={() =>
                          setHealthCodePreset(COMMON_HEALTH_CODES.ALL)
                        }
                        style={styles.presetChip}
                      >
                        All
                      </Chip>
                      <Chip
                        mode={
                          JSON.stringify(
                            editingBookmark.healthCheck.healthyCodes,
                          ) === JSON.stringify(COMMON_HEALTH_CODES.WEB)
                            ? "flat"
                            : "outlined"
                        }
                        onPress={() =>
                          setHealthCodePreset(COMMON_HEALTH_CODES.WEB)
                        }
                        style={styles.presetChip}
                      >
                        Web
                      </Chip>
                      <Chip
                        mode={
                          JSON.stringify(
                            editingBookmark.healthCheck.healthyCodes,
                          ) === JSON.stringify(COMMON_HEALTH_CODES.API)
                            ? "flat"
                            : "outlined"
                        }
                        onPress={() =>
                          setHealthCodePreset(COMMON_HEALTH_CODES.API)
                        }
                        style={styles.presetChip}
                      >
                        API
                      </Chip>
                      <Chip
                        mode={
                          JSON.stringify(
                            editingBookmark.healthCheck.healthyCodes,
                          ) === JSON.stringify(COMMON_HEALTH_CODES.LENIENT)
                            ? "flat"
                            : "outlined"
                        }
                        onPress={() =>
                          setHealthCodePreset(COMMON_HEALTH_CODES.LENIENT)
                        }
                        style={styles.presetChip}
                      >
                        Lenient
                      </Chip>
                    </View>
                  )}

                  <View style={styles.codesContainer}>
                    {[
                      200, 201, 204, 301, 302, 307, 308, 400, 401, 403, 404,
                      500, 502, 503,
                    ].map((code) => (
                      <Chip
                        key={code}
                        mode={
                          editingBookmark.healthCheck.healthyCodes.includes(
                            code,
                          )
                            ? "flat"
                            : "outlined"
                        }
                        onPress={() => toggleHealthCode(code)}
                        style={styles.codeChip}
                      >
                        {code}
                      </Chip>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Delete Button */}
          {bookmarks.find((b) => b.id === editingBookmark.id) && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.deleteSection}>
                <Button
                  mode="outlined"
                  textColor={theme.colors.error}
                  onPress={() => {
                    handleDeleteBookmark(editingBookmark.id);
                    setEditingBookmark(null);
                  }}
                >
                  Delete Bookmark
                </Button>
              </View>
            </>
          )}

          <View style={{ height: spacing.xl }} />
        </ScrollView>

        <IconPicker
          visible={iconPickerVisible}
          onDismiss={() => setIconPickerVisible(false)}
          onIconSelect={handleIconSelect}
        />
      </>
    );

    if (isScreenMode) {
      return content;
    }

    return (
      <Modal
        visible={visible && !!editingBookmark}
        onDismiss={() => {
          setEditingBookmark(null);
          if (onDismiss) onDismiss();
        }}
        contentContainerStyle={[
          styles.modal,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        {content}
      </Modal>
    );
  }

  // Main bookmarks list view
  const content = (
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <Text variant="headlineSmall">Configure Bookmarks</Text>
        <MaterialCommunityIcons
          name="close"
          size={24}
          color={theme.colors.onSurface}
          onPress={() => onDismiss && onDismiss()}
        />
      </View>

      <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
        {bookmarks.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="link-box"
              size={48}
              color={theme.colors.onSurfaceVariant}
            />
            <Text variant="bodySmall" style={styles.emptyText}>
              No bookmarks yet. Add one to get started!
            </Text>
          </View>
        ) : (
          <View style={styles.bookmarksList}>
            {bookmarks.map((bookmark) => (
              <TouchableOpacity
                key={bookmark.id}
                style={[
                  styles.bookmarkListItem,
                  {
                    borderBottomColor: theme.colors.outline,
                    backgroundColor: bookmark.enabled
                      ? theme.colors.surfaceVariant
                      : "rgba(0,0,0,0.02)",
                  },
                ]}
                onPress={() => handleEditBookmark(bookmark)}
              >
                <View style={styles.bookmarkItemContent}>
                  <Text
                    variant="labelLarge"
                    numberOfLines={1}
                    style={{ fontWeight: "600" }}
                  >
                    {bookmark.label}
                  </Text>
                  <Text
                    variant="labelSmall"
                    numberOfLines={1}
                    style={{ opacity: 0.7 }}
                  >
                    {bookmark.url}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={theme.colors.onSurfaceVariant}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Divider />

      <View style={styles.modalActions}>
        <Button
          mode="contained"
          onPress={handleAddBookmark}
          icon="plus"
          style={styles.addButton}
        >
          Add Bookmark
        </Button>

        <View style={styles.primaryActions}>
          <Button
            mode="text"
            onPress={() => onDismiss && onDismiss()}
            disabled={loading}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
          >
            Save
          </Button>
        </View>
      </View>
    </View>
  );

  if (isScreenMode) {
    return content;
  }

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={[
        styles.modal,
        { backgroundColor: theme.colors.surface },
      ]}
    >
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: spacing.lg,
    borderRadius: 16,
    maxHeight: "90%",
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  modalBody: {
    flex: 1,
  },
  editModalContent: {
    flex: 1,
  },
  editModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  pickIconButton: {
    marginBottom: spacing.md,
  },
  selectedIconInfo: {
    opacity: 0.7,
    fontStyle: "italic",
  },
  healthCheckHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  presetsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  presetChip: {
    marginRight: spacing.sm,
  },
  codesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  codeChip: {
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  deleteSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: {
    marginVertical: 0,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  emptyText: {
    marginTop: spacing.md,
    textAlign: "center",
    opacity: 0.7,
  },
  bookmarksList: {
    paddingVertical: spacing.sm,
  },
  bookmarkListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  bookmarkItemContent: {
    flex: 1,
  },
  modalActions: {
    flexDirection: "column",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  addButton: {
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

export default BookmarksConfig;
