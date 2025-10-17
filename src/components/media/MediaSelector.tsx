import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import { alert } from "@/services/dialogService";
import { IconButton, Menu, Snackbar, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import type { AppTheme } from "@/constants/theme";
import type { Series } from "@/models/media.types";
import type { Movie } from "@/models/movie.types";
import { spacing } from "@/theme/spacing";
import {
  useConnectorsStore,
  selectGetConnector,
} from "@/store/connectorsStore";

export type SelectableMediaItem = Series | Movie;

interface MediaSelectorContextValue {
  selectedItems: SelectableMediaItem[];
  isSelectionMode: boolean;
  toggleSelection: (item: SelectableMediaItem) => void;
  clearSelection: () => void;
  selectAll: (items: SelectableMediaItem[]) => void;
  isItemSelected: (item: SelectableMediaItem) => boolean;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
}

const MediaSelectorContext = createContext<MediaSelectorContextValue | null>(
  null,
);

export const useMediaSelector = (): MediaSelectorContextValue => {
  const context = useContext(MediaSelectorContext);
  if (!context) {
    throw new Error(
      "useMediaSelector must be used within a MediaSelectorProvider",
    );
  }
  return context;
};

interface MediaSelectorProviderProps {
  children: React.ReactNode;
  onBulkActions?: (selectedItems: SelectableMediaItem[]) => void;
}

export const MediaSelectorProvider: React.FC<MediaSelectorProviderProps> = ({
  children,
  onBulkActions,
}) => {
  const [selectedItems, setSelectedItems] = useState<SelectableMediaItem[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleSelection = useCallback((item: SelectableMediaItem) => {
    setSelectedItems((prev) => {
      const isSelected = prev.some((selected) => selected.id === item.id);
      if (isSelected) {
        return prev.filter((selected) => selected.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems([]);
  }, []);

  const selectAll = useCallback((items: SelectableMediaItem[]) => {
    setSelectedItems(items);
  }, []);

  const isItemSelected = useCallback(
    (item: SelectableMediaItem) => {
      return selectedItems.some((selected) => selected.id === item.id);
    },
    [selectedItems],
  );

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    clearSelection();
  }, [clearSelection]);

  const contextValue = useMemo(
    () => ({
      selectedItems,
      isSelectionMode,
      toggleSelection,
      clearSelection,
      selectAll,
      isItemSelected,
      enterSelectionMode,
      exitSelectionMode,
    }),
    [
      selectedItems,
      isSelectionMode,
      toggleSelection,
      clearSelection,
      selectAll,
      isItemSelected,
      enterSelectionMode,
      exitSelectionMode,
    ],
  );

  return (
    <MediaSelectorContext.Provider value={contextValue}>
      {children}
    </MediaSelectorContext.Provider>
  );
};

interface MediaSelectorActionsProps {
  serviceId: string;
  onRefresh?: () => void;
}

export const MediaSelectorActions: React.FC<MediaSelectorActionsProps> = ({
  serviceId,
  onRefresh,
}) => {
  const theme = useTheme<AppTheme>();
  const getConnector = useConnectorsStore(selectGetConnector);
  const { selectedItems, isSelectionMode, exitSelectionMode } =
    useMediaSelector();
  const [menuVisible, setMenuVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const handleBulkDelete = useCallback(async () => {
    if (selectedItems.length === 0) return;

    alert(
      "Delete Media",
      `Are you sure you want to delete ${selectedItems.length} item(s)? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const connector = getConnector(serviceId);
              if (!connector) return;

              if (connector.config.type === "sonarr") {
                await Promise.all(
                  selectedItems.map((item) =>
                    (connector as any).deleteSeries(item.id, {
                      deleteFiles: true,
                    }),
                  ),
                );
              } else if (connector.config.type === "radarr") {
                await Promise.all(
                  selectedItems.map((item) =>
                    (connector as any).deleteMovie(item.id, {
                      deleteFiles: true,
                    }),
                  ),
                );
              }

              setSnackbarMessage(`Deleted ${selectedItems.length} item(s)`);
              setSnackbarVisible(true);
              exitSelectionMode();
              onRefresh?.();
            } catch (error) {
              console.error("Bulk delete failed:", error);
              alert("Error", "Failed to delete selected items.");
            }
          },
        },
      ],
    );
  }, [selectedItems, serviceId, exitSelectionMode, onRefresh, getConnector]);

  const handleBulkMonitorToggle = useCallback(
    async (monitored: boolean) => {
      if (selectedItems.length === 0) return;

      try {
        const connector = getConnector(serviceId);
        if (!connector) return;

        if (connector.config.type === "sonarr") {
          await (connector as any).bulkUpdateSeries({
            seriesIds: selectedItems.map((item) => item.id),
            monitored,
          });
        } else if (connector.config.type === "radarr") {
          await (connector as any).bulkUpdateMovies({
            movieIds: selectedItems.map((item) => item.id),
            monitored,
          });
        }

        setSnackbarMessage(
          `${monitored ? "Monitored" : "Unmonitored"} ${selectedItems.length} item(s)`,
        );
        setSnackbarVisible(true);
        exitSelectionMode();
        onRefresh?.();
      } catch (error) {
        console.error("Bulk monitor toggle failed:", error);
        alert(
          "Error",
          `Failed to ${monitored ? "monitor" : "unmonitor"} selected items.`,
        );
      }
    },
    [selectedItems, serviceId, exitSelectionMode, onRefresh, getConnector],
  );

  const handleBulkSearch = useCallback(async () => {
    if (selectedItems.length === 0) return;

    try {
      const connector = getConnector(serviceId);
      if (!connector) return;

      if (connector.config.type === "sonarr") {
        await Promise.all(
          selectedItems.map((item) =>
            (connector as any).triggerSearch(item.id),
          ),
        );
      } else if (connector.config.type === "radarr") {
        await Promise.all(
          selectedItems.map((item) =>
            (connector as any).triggerSearch(item.id),
          ),
        );
      }

      setSnackbarMessage(`Started search for ${selectedItems.length} item(s)`);
      setSnackbarVisible(true);
      exitSelectionMode();
    } catch (error) {
      console.error("Bulk search failed:", error);
      alert("Error", "Failed to start search for selected items.");
    }
  }, [selectedItems, serviceId, exitSelectionMode, getConnector]);

  const styles = StyleSheet.create({
    selectionBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: theme.colors.primaryContainer,
    },
    selectionInfo: {
      flex: 1,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    fab: {
      position: "absolute",
      margin: spacing.lg,
      right: 0,
      bottom: 0,
    },
  });

  if (!isSelectionMode || selectedItems.length === 0) {
    return null;
  }

  return (
    <>
      <SafeAreaView style={styles.selectionBar} edges={["bottom"]}>
        <View style={styles.selectionInfo}>
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.onPrimaryContainer }}
          >
            {selectedItems.length} selected
          </Text>
        </View>
        <View style={styles.actions}>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                iconColor={theme.colors.onPrimaryContainer}
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item
              title="Monitor All"
              onPress={() => {
                setMenuVisible(false);
                handleBulkMonitorToggle(true);
              }}
            />
            <Menu.Item
              title="Unmonitor All"
              onPress={() => {
                setMenuVisible(false);
                handleBulkMonitorToggle(false);
              }}
            />
            <Menu.Item
              title="Search All"
              onPress={() => {
                setMenuVisible(false);
                handleBulkSearch();
              }}
            />
            <Menu.Item
              title="Delete All"
              onPress={() => {
                setMenuVisible(false);
                handleBulkDelete();
              }}
            />
          </Menu>
          <IconButton
            icon="close"
            iconColor={theme.colors.onPrimaryContainer}
            onPress={exitSelectionMode}
          />
        </View>
      </SafeAreaView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </>
  );
};

interface MediaSelectableItemProps {
  item: SelectableMediaItem;
  onPress: (item: SelectableMediaItem) => void;
  onLongPress?: (item: SelectableMediaItem) => void;
  children: React.ReactNode;
  onPressSeries?: (item: Series) => void;
  onPressMovie?: (item: Movie) => void;
}

export const MediaSelectableItem: React.FC<MediaSelectableItemProps> = ({
  item,
  onPress,
  onLongPress,
  children,
  onPressSeries,
  onPressMovie,
}) => {
  const { isSelectionMode, isItemSelected, toggleSelection } =
    useMediaSelector();

  const handlePress = useCallback(() => {
    if (isSelectionMode) {
      toggleSelection(item);
    } else {
      // Call specific handlers if provided, otherwise use general handler
      if ("status" in item && typeof item.status === "string") {
        // This is a Series (status is SeriesStatus which is a string)
        if (onPressSeries) {
          onPressSeries(item as Series);
        } else {
          onPress(item);
        }
      } else {
        // This is a Movie (status might be undefined or different type)
        if (onPressMovie) {
          onPressMovie(item as Movie);
        } else {
          onPress(item);
        }
      }
    }
  }, [
    isSelectionMode,
    toggleSelection,
    item,
    onPress,
    onPressSeries,
    onPressMovie,
  ]);

  const handleLongPress = useCallback(() => {
    if (!isSelectionMode) {
      toggleSelection(item);
    }
    onLongPress?.(item);
  }, [isSelectionMode, toggleSelection, item, onLongPress]);

  return (
    <View>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, {
            onPress: handlePress,
            onLongPress: handleLongPress,
          })
        : children}
      {isSelectionMode && (
        <View
          style={{
            position: "absolute",
            top: spacing.sm,
            right: spacing.sm,
            backgroundColor: isItemSelected(item) ? "#6200EE" : "transparent",
            borderRadius: 12,
            width: 24,
            height: 24,
            borderWidth: 2,
            borderColor: "#6200EE",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isItemSelected(item) && (
            <IconButton icon="check" size={16} iconColor="white" />
          )}
        </View>
      )}
    </View>
  );
};
