import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput as RNTextInput,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Text, useTheme, Portal, Button } from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { spacing } from "@/theme/spacing";

export interface IconPickerProps {
  visible: boolean;
  onDismiss: () => void;
  onIconSelect: (icon: { type: string; value: string }) => void;
}

// A curated list of friendly names — we'll further filter these at runtime
// against the MaterialIcons glyph map exported by the vector-icons package
// to avoid invalid icon name warnings. Note: duplicate 'book' removed here.
const MATERIAL_ICONS = [
  "home",
  "settings",
  "link",
  "open_in_new",
  "web",
  "cloud",
  "server",
  "database",
  "folder",
  "download",
  "upload",
  "calendar",
  "clock",
  "search",
  "heart",
  "star",
  "warning",
  "check",
  "close",
  "edit",
  "delete",
  "content_copy",
  "share",
  "menu",
  "book",
  "play",
  "pause",
  "stop",
];

// GitHub API endpoint for dashboard-icons repository
const GITHUB_API_URL =
  "https://api.github.com/repos/homarr-labs/dashboard-icons/contents/svg";

interface CDNIcon {
  name: string;
  path: string;
}

const IconPicker: React.FC<IconPickerProps> = ({
  visible,
  onDismiss,
  onIconSelect,
}) => {
  const theme = useTheme<AppTheme>();
  const { onPress: hapticPress } = useHaptics();

  const [tab, setTab] = useState<"material" | "cdn">("material");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [allCdnIcons, setAllCdnIcons] = useState<CDNIcon[]>([]);
  const [loading, setCdnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all available icons from GitHub API
  const fetchAllIcons = async () => {
    try {
      const response = await fetch(GITHUB_API_URL);
      if (!response.ok) {
        throw new Error(`GitHub API responded with ${response.status}`);
      }

      const data: any[] = await response.json();
      const svgIcons = data
        .filter((file) => file.name.endsWith(".svg"))
        .map((file) => ({
          name: file.name.replace(/\.svg$/i, ""),
          path: file.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setAllCdnIcons(svgIcons);
      setError(null);
    } catch (err: any) {
      logger.error("[IconPicker] Failed to fetch icons from GitHub", err);
      setError("Failed to load icons from repository");
      setAllCdnIcons([]);
    }
  };

  // Load CDN icons when modal opens or tab changes
  const loadCdnIcons = useCallback(async () => {
    if (allCdnIcons.length === 0) {
      setCdnLoading(true);
      await fetchAllIcons();
      setCdnLoading(false);
    }
  }, [allCdnIcons.length]);

  useEffect(() => {
    if (!visible || tab !== "cdn") return;
    loadCdnIcons();
  }, [visible, tab, loadCdnIcons]);

  // Build a runtime-validated list of material icons by checking the glyph map
  // exported by the vector-icons MaterialIcons component. This avoids passing
  // invalid names to the native icon renderer which logs warnings.
  const [validMaterialIcons, setValidMaterialIcons] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    try {
      // MaterialIcons.getRawGlyphMap exists in react-native-vector-icons
      // (expo/vector-icons re-exports it). Fallback gracefully if absent.
      const anyIcons = MaterialIcons as any;
      const glyphMap: Record<string, number> =
        anyIcons.getRawGlyphMap?.() ?? anyIcons.glyphMap ?? {};

      const validated = MATERIAL_ICONS.filter((name) =>
        Boolean(glyphMap && glyphMap[name]),
      );

      if (isMounted) setValidMaterialIcons(validated);
    } catch {
      // If anything goes wrong, fall back to the original list but avoid
      // crashing. The renderer will still warn for invalid names in this case.
      if (isMounted) setValidMaterialIcons(MATERIAL_ICONS);
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounce search input for smoother filtering
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filteredMaterialIcons = validMaterialIcons.filter((icon) =>
    icon.toLowerCase().includes(debouncedSearch.toLowerCase()),
  );

  // Filter and search CDN icons from all available icons
  const filteredCdnIcons = allCdnIcons.filter((icon) =>
    icon.name.toLowerCase().includes(debouncedSearch.toLowerCase()),
  );

  const handleMaterialIconSelect = (icon: string) => {
    hapticPress();
    onIconSelect({ type: "material-icon", value: icon });
    onDismiss();
  };

  const handleCdnIconSelect = (icon: CDNIcon) => {
    hapticPress();
    onIconSelect({ type: "cdn-icon", value: icon.name });
    onDismiss();
  };

  return (
    <Portal>
      {visible && (
        <View style={styles.portalContainer} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={onDismiss}>
            <View style={styles.portalBackdrop} />
          </TouchableWithoutFeedback>

          <View
            style={[
              styles.portalCard,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall">Select Icon</Text>
              <TouchableOpacity onPress={onDismiss}>
                <MaterialIcons
                  name="close"
                  size={24}
                  color={theme.colors.onSurface}
                />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View
              style={[
                styles.searchContainer,
                { borderColor: theme.colors.outline },
              ]}
            >
              <MaterialIcons
                name="search"
                size={20}
                color={theme.colors.onSurfaceVariant}
                style={styles.searchIcon}
              />
              <RNTextInput
                style={[styles.searchInput, { color: theme.colors.onSurface }]}
                placeholder="Search icons..."
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {/* Tabs */}
            <View
              style={[
                styles.tabsContainer,
                { borderBottomColor: theme.colors.outline },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  tab === "material" && {
                    borderBottomColor: theme.colors.primary,
                    borderBottomWidth: 2,
                  },
                ]}
                onPress={() => setTab("material")}
              >
                <Text
                  variant="labelLarge"
                  style={{
                    color:
                      tab === "material"
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant,
                  }}
                >
                  Material Icons
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  tab === "cdn" && {
                    borderBottomColor: theme.colors.primary,
                    borderBottomWidth: 2,
                  },
                ]}
                onPress={() => setTab("cdn")}
              >
                <Text
                  variant="labelLarge"
                  style={{
                    color:
                      tab === "cdn"
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant,
                  }}
                >
                  Dashboard Icons
                </Text>
              </TouchableOpacity>
            </View>

            {/* Content (same as before) */}
            {tab === "material" ? (
              <ScrollView
                style={styles.iconsContainer}
                contentContainerStyle={styles.iconsContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.iconGrid}>
                  {filteredMaterialIcons.length === 0 ? (
                    <View style={styles.noResults}>
                      <Text variant="bodySmall">No icons found</Text>
                    </View>
                  ) : (
                    filteredMaterialIcons.map((icon) => (
                      <TouchableOpacity
                        key={icon}
                        style={[
                          styles.iconItem,
                          {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.outline,
                            borderWidth: 1,
                            elevation: 2,
                          },
                        ]}
                        onPress={() => handleMaterialIconSelect(icon)}
                      >
                        <MaterialIcons
                          name={icon as any}
                          size={32}
                          color={theme.colors.primary}
                        />
                        <Text variant="labelSmall" style={styles.iconLabel}>
                          {icon}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.iconsContainer}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator
                      size="large"
                      color={theme.colors.primary}
                    />
                    <Text variant="bodySmall" style={styles.loadingText}>
                      Loading icons...
                    </Text>
                  </View>
                ) : error ? (
                  <View style={styles.errorContainer}>
                    <MaterialIcons
                      name="error"
                      size={48}
                      color={theme.colors.error}
                    />
                    <Text variant="bodySmall" style={styles.errorText}>
                      {error}
                    </Text>
                    <View style={{ marginTop: spacing.md }}>
                      <Button mode="contained" onPress={loadCdnIcons}>
                        Retry
                      </Button>
                    </View>
                  </View>
                ) : filteredCdnIcons.length === 0 ? (
                  <View style={styles.noResults}>
                    <Text variant="bodySmall">No icons found</Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredCdnIcons}
                    keyExtractor={(item) => item.name}
                    numColumns={4}
                    columnWrapperStyle={styles.cdnIconRow}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.cdnIconItem,
                          {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.outline,
                            borderWidth: 1,
                            elevation: 2,
                          },
                        ]}
                        onPress={() => handleCdnIconSelect(item)}
                      >
                        <CdnIconImage name={item.name} themeDark={theme.dark} />
                        <Text
                          variant="labelSmall"
                          style={styles.iconLabel}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    )}
                    scrollEnabled
                  />
                )}
              </View>
            )}

            {/* Actions */}
            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={onDismiss}>
                Cancel
              </Button>
            </View>
          </View>
        </View>
      )}
    </Portal>
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
    flexDirection: "column",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: spacing.md,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  iconsContainer: {
    // allow container to size to content and screen; remove fixed minHeight
    flex: 0,
    maxHeight: "60%",
    minHeight: 120,
  },
  portalContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  portalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  portalCard: {
    width: "94%",
    maxWidth: 720,
    maxHeight: "92%",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 6,
  },
  iconsContent: {
    padding: spacing.md,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "flex-start",
  },
  iconItem: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  iconLabel: {
    marginTop: spacing.xs,
    textAlign: "center",
  },
  cdnIconRow: {
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cdnIconItem: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.sm,
  },
  cdnImage: {
    width: "80%",
    height: "80%",
  },
  noResults: {
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    marginTop: spacing.md,
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
});

export default IconPicker;

// Simple logger for error handling
const logger = {
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data),
};

// Small component to render CDN SVG icons with fallbacks to PNG
const CdnIconImage: React.FC<{ name: string; themeDark?: boolean }> = ({
  name,
  themeDark = false,
}) => {
  const getUrlPriority = useCallback((iconName: string): string[] => {
    return [
      `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/${iconName}.png`,
      `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${iconName}.svg`,
      `https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/png/${iconName}.png`,
      `https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/svg/${iconName}.svg`,
    ];
  }, []);

  const initialUrl = getUrlPriority(name)[0] || "";
  const [src, setSrc] = useState<string>(initialUrl);
  const [urlIndex, setUrlIndex] = useState(0);

  useEffect(() => {
    setUrlIndex(0);
    const urls = getUrlPriority(name);
    setSrc(urls[0] || "");
  }, [name, getUrlPriority]);

  const handleError = () => {
    const urls = getUrlPriority(name);
    const nextIndex = urlIndex + 1;
    if (nextIndex < urls.length) {
      setUrlIndex(nextIndex);
      setSrc(urls[nextIndex] || "");
    }
  };

  return (
    <Image
      source={{ uri: src }}
      style={styles.cdnImage}
      resizeMode="contain"
      onError={handleError}
    />
  );
};
