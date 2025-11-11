import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView, Linking } from "react-native";
import {
  Text,
  useTheme,
  Divider,
  RadioButton,
  Switch,
  Button,
  ActivityIndicator,
  Searchbar,
} from "react-native-paper";
import BottomDrawer from "@/components/common/BottomDrawer";
import { alert } from "@/services/dialogService";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { queryKeys } from "@/hooks/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { logger } from "@/services/logger/LoggerService";
import { spacing } from "@/theme/spacing";
import type { DetailedSonarrQueueItem } from "@/models/queue.types";
import type { AppTheme } from "@/constants/theme";
import type { components } from "@/connectors/client-schemas/sonarr-openapi";

// Type for manual import items from API
type ManualImportResource = components["schemas"]["ManualImportResource"];

interface SonarrQueueDrawerProps {
  visible: boolean;
  onDismiss: () => void;
  selectedItem: DetailedSonarrQueueItem | null;
  serviceId: string;
  onManualImport: (
    item: DetailedSonarrQueueItem,
    importItem: ManualImportResource,
  ) => Promise<void>;
  onRemoveItem: (
    item: DetailedSonarrQueueItem,
    options: {
      blocklist?: boolean;
      removeFromClient?: boolean;
      skipRedownload?: boolean;
      changeCategory?: boolean;
    },
  ) => Promise<void>;
  isRemoving: boolean;
}

const SonarrQueueDrawer: React.FC<SonarrQueueDrawerProps> = ({
  visible,
  onDismiss,
  selectedItem,
  serviceId,
  onManualImport,
  onRemoveItem,
  isRemoving,
}) => {
  const theme = useTheme<AppTheme>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // State for showing manual import episode selection
  const [showManualImportView, setShowManualImportView] = useState(false);
  const [selectedImportItem, setSelectedImportItem] =
    useState<ManualImportResource | null>(null);

  // State for removal options
  const [blocklistEnabled, setBlocklistEnabled] = useState(true);
  const [removeFromClient, setRemoveFromClient] = useState(true);
  const [skipRedownload, setSkipRedownload] = useState(false);
  const [changeCategory, setChangeCategory] = useState(false);

  // State for search
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch manual import items when import mode is active
  const { data: importItems, isLoading: isLoadingImportItems } = useQuery({
    queryKey: queryKeys.sonarr.manualImport(
      serviceId,
      selectedItem?.downloadId || undefined,
    ),
    queryFn: async () => {
      if (!selectedItem?.downloadId || !serviceId) return [];

      try {
        const manager = ConnectorManager.getInstance();
        const connector = manager.getConnector(serviceId);

        if (!connector) {
          throw new Error(`Service with ID ${serviceId} not found`);
        }

        const response = await (connector as any).client.get(
          "/api/v3/manualimport",
          {
            params: {
              downloadId: selectedItem.downloadId,
            },
          },
        );

        return response.data as ManualImportResource[];
      } catch (error) {
        logger.error("Failed to fetch import items", { error });
        throw error;
      }
    },
    enabled: !!selectedItem?.downloadId && !!serviceId && showManualImportView,
  });

  // Filter episodes based on search query
  const filteredImportItems = useMemo(() => {
    if (!importItems || !searchQuery.trim()) return importItems;

    const query = searchQuery.toLowerCase();
    return importItems.filter(
      (episode) =>
        episode.name?.toLowerCase().includes(query) ||
        episode.relativePath?.toLowerCase().includes(query) ||
        episode.path?.toLowerCase().includes(query) ||
        episode.quality?.quality?.name?.toLowerCase().includes(query),
    );
  }, [importItems, searchQuery]);

  const handleManualImport = useCallback(async () => {
    if (!selectedItem) return;

    // Switch to manual import view
    setShowManualImportView(true);
  }, [selectedItem]);

  const handleSelectImportItem = useCallback((item: ManualImportResource) => {
    setSelectedImportItem(item);
  }, []);

  const handleImportSelected = useCallback(async () => {
    if (!selectedItem || !selectedImportItem) return;

    try {
      // Delegate building the correct payload to the hook using the
      // selected manual import item, mirroring Sonarr Web behavior.
      await onManualImport(selectedItem, selectedImportItem);
      onDismiss();
    } catch (error) {
      console.error("Failed to manually import item:", error);
      alert(
        "Import Failed",
        "Failed to import the selected episode. Please check your service configuration.",
      );

      // Reset view on error
      setShowManualImportView(false);
      setSelectedImportItem(null);
    }
  }, [selectedItem, selectedImportItem, onManualImport, onDismiss]);

  const handleBackToActions = useCallback(() => {
    setShowManualImportView(false);
    setSelectedImportItem(null);
  }, []);

  const handleRemoveItem = useCallback(
    async (blocklist: boolean) => {
      if (!selectedItem) return;

      const options = {
        blocklist,
        removeFromClient,
        skipRedownload,
        changeCategory,
      };

      try {
        await onRemoveItem(selectedItem, options);
        onDismiss();
      } catch (error) {
        console.error("Failed to remove item:", error);
        alert("Removal Failed", "Failed to remove the item. Please try again.");
      }
    },
    [
      selectedItem,
      onRemoveItem,
      onDismiss,
      removeFromClient,
      skipRedownload,
      changeCategory,
    ],
  );

  const showRemovalConfirmation = useCallback(
    (blocklist: boolean) => {
      const actionMessage = blocklist
        ? `Block and remove "${selectedItem?.episodeTitle}" from the queue? This will add it to the blocklist.`
        : `Remove "${selectedItem?.episodeTitle}" from the queue?`;

      alert("Confirm Action", actionMessage, [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: blocklist ? "Block and Remove" : "Remove",
          style: "destructive",
          onPress: () => handleRemoveItem(blocklist),
        },
      ]);
    },
    [selectedItem, handleRemoveItem],
  );

  if (!selectedItem) return null;

  return (
    <BottomDrawer
      visible={visible}
      onDismiss={onDismiss}
      title="Queue Actions"
      maxHeight="80%"
    >
      <View style={styles.contentContainer}>
        <View style={styles.itemInfo}>
          <Text variant="titleMedium" style={styles.seriesTitle}>
            {selectedItem.seriesTitle}
          </Text>
          <Text variant="bodyMedium" style={styles.episodeInfo}>
            {selectedItem.seasonNumber && selectedItem.episodeNumber
              ? `S${String(selectedItem.seasonNumber).padStart(2, "0")}E${String(selectedItem.episodeNumber).padStart(2, "0")}`
              : ""}
            {" - "}
            {selectedItem.episodeTitle}
          </Text>
          <Text variant="bodySmall" style={styles.statusText}>
            Status: {selectedItem.trackedDownloadState || selectedItem.status}
          </Text>
          {/* Status messages from Sonarr queue (statusMessages field) */}
          {selectedItem.statusMessages &&
            selectedItem.statusMessages.length > 0 && (
              <View style={styles.statusMessagesContainer}>
                {selectedItem.statusMessages.map((msg, index) => (
                  <Text
                    key={`${msg.title ?? index}-${index}`}
                    variant="bodySmall"
                    style={styles.statusMessage}
                  >
                    {msg.messages?.join(" ") || msg.title || ""}
                  </Text>
                ))}
              </View>
            )}
        </View>

        <Divider style={styles.divider} />

        {/* Manual Import Option - only for import pending items */}
        {selectedItem.trackedDownloadState === "importPending" &&
          !showManualImportView && (
            <View style={styles.actionSection}>
              <Button
                mode="contained"
                onPress={handleManualImport}
                disabled={isRemoving}
                style={styles.actionButton}
                icon="import"
              >
                Manually Import
              </Button>
              <Text variant="bodySmall" style={styles.actionDescription}>
                Import this episode directly, bypassing automatic import process
              </Text>
            </View>
          )}

        {/* Manual Import Episodes View */}
        {showManualImportView && (
          <View style={styles.actionSection}>
            {isLoadingImportItems ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator animating={true} size="small" />
                <Text variant="bodyMedium" style={styles.loadingText}>
                  Loading episodes...
                </Text>
              </View>
            ) : importItems && importItems.length > 0 ? (
              <>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Select Episode to Import
                </Text>

                <Searchbar
                  placeholder="Search episodes..."
                  onChangeText={setSearchQuery}
                  value={searchQuery}
                  style={styles.searchBar}
                  icon="magnify"
                />
                <ScrollView style={styles.episodesList}>
                  {filteredImportItems?.length ? (
                    filteredImportItems.map((episode) => (
                      <View key={episode.id} style={styles.episodeItem}>
                        <View style={styles.episodeHeader}>
                          <Text
                            variant="titleSmall"
                            style={styles.episodeTitle}
                          >
                            {episode.name}
                          </Text>
                          {episode.quality?.quality?.name && (
                            <Text
                              variant="labelSmall"
                              style={styles.episodeQuality}
                            >
                              {episode.quality.quality.name}
                            </Text>
                          )}
                        </View>

                        <View style={styles.episodeDetails}>
                          <Text variant="bodyMedium">
                            {episode.relativePath || episode.path}
                          </Text>
                          {episode.size && (
                            <Text
                              variant="bodySmall"
                              style={styles.episodeSize}
                            >
                              {Math.round(episode.size / (1024 * 1024))} MB
                            </Text>
                          )}
                        </View>

                        <RadioButton
                          value={episode.id?.toString() || ""}
                          status={
                            episode.id === selectedImportItem?.id
                              ? "checked"
                              : "unchecked"
                          }
                          onPress={() => handleSelectImportItem(episode)}
                        />
                      </View>
                    ))
                  ) : (
                    <View style={styles.noResultsContainer}>
                      <Text variant="bodyMedium" style={styles.noResultsText}>
                        No episodes found matching "{searchQuery}"
                      </Text>
                    </View>
                  )}
                </ScrollView>

                <Button
                  mode="contained"
                  onPress={handleImportSelected}
                  disabled={!selectedImportItem || isRemoving}
                  style={styles.importButton}
                  icon="import"
                >
                  Import Selected Episode
                </Button>
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text variant="bodyMedium">
                  No episodes available for import
                </Text>
                <Button
                  mode="outlined"
                  onPress={handleBackToActions}
                  style={styles.backButton}
                >
                  Back to Actions
                </Button>
              </View>
            )}

            <Button
              mode="outlined"
              onPress={handleBackToActions}
              style={styles.backButton}
            >
              Back to Actions
            </Button>
          </View>
        )}

        {/* Removal Options */}
        <View style={styles.optionsSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Removal Options
          </Text>

          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Text variant="bodyLarge">View Blocklist</Text>
              <Text variant="bodySmall" style={styles.optionDescription}>
                Open blocklist in Sonarr web interface
              </Text>
            </View>
            <Button
              mode="outlined"
              onPress={async () => {
                // Open Sonarr web interface
                if (selectedItem && serviceId) {
                  try {
                    const manager = ConnectorManager.getInstance();
                    const connector = manager.getConnector(serviceId);
                    if (
                      connector &&
                      "config" in connector &&
                      "url" in connector.config
                    ) {
                      const sonarrUrl = connector.config.url as string;
                      // Open web browser to Sonarr blocklist page
                      const blocklistUrl = `${sonarrUrl.replace(
                        /\/$/,
                        "",
                      )}/blocklist`;
                      await Linking.openURL(blocklistUrl);
                    } else {
                      throw new Error("Connector configuration not found");
                    }
                  } catch {
                    alert(
                      "Could Not Open URL",
                      "Unable to open the Sonarr web interface. Please check your service configuration.",
                    );
                  }
                }
              }}
              icon="open-in-new"
            >
              View
            </Button>
          </View>

          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Text variant="bodyLarge">Blocklist Release</Text>
              <Text variant="bodySmall" style={styles.optionDescription}>
                Add this release to the blocklist to prevent future downloads
              </Text>
            </View>
            <Switch
              value={blocklistEnabled}
              onValueChange={setBlocklistEnabled}
            />
          </View>

          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Text variant="bodyLarge">Remove from Download Client</Text>
              <Text variant="bodySmall" style={styles.optionDescription}>
                Also remove from the download client (e.g., qBittorrent)
              </Text>
            </View>
            <Switch
              value={removeFromClient}
              onValueChange={setRemoveFromClient}
            />
          </View>

          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Text variant="bodyLarge">Skip Redownload</Text>
              <Text variant="bodySmall" style={styles.optionDescription}>
                Don't automatically search for a different release
              </Text>
            </View>
            <Switch value={skipRedownload} onValueChange={setSkipRedownload} />
          </View>

          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Text variant="bodyLarge">Change Download Category</Text>
              <Text variant="bodySmall" style={styles.optionDescription}>
                Change the download client category for this item
              </Text>
            </View>
            <Switch value={changeCategory} onValueChange={setChangeCategory} />
          </View>
        </View>

        <Divider style={styles.divider} />

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <Button
            mode="contained"
            onPress={() => showRemovalConfirmation(blocklistEnabled)}
            disabled={isRemoving}
            style={styles.removeButton}
            buttonColor={theme.colors.error}
            textColor={theme.colors.onError}
            loading={isRemoving}
          >
            {blocklistEnabled
              ? `Block${removeFromClient ? " + remove" : ""}${skipRedownload ? " + skip" : ""}${changeCategory ? " + change" : ""}`
              : `Remove${removeFromClient ? " from client" : ""}${skipRedownload ? " + skip" : ""}${changeCategory ? " + change" : ""}`}
          </Button>
        </View>
      </View>
    </BottomDrawer>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    contentContainer: {
      paddingBottom: spacing.xl,
    },
    itemInfo: {
      padding: spacing.md,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 12,
    },
    seriesTitle: {
      fontWeight: "600",
      marginBottom: spacing.xs,
    },
    episodeInfo: {
      marginBottom: spacing.xs,
    },
    statusText: {
      color: theme.colors.onSurfaceVariant,
    },
    divider: {
      marginVertical: spacing.md,
    },
    actionSection: {
      marginVertical: spacing.md,
      gap: spacing.sm,
    },
    actionButton: {
      paddingVertical: spacing.sm,
    },
    removeButton: {
      marginVertical: spacing.md,
    },
    importButton: {
      marginVertical: spacing.md,
    },
    backButton: {
      marginVertical: spacing.sm,
    },
    actionDescription: {
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      paddingHorizontal: spacing.md,
    },
    sectionTitle: {
      fontWeight: "600",
      marginBottom: spacing.md,
    },
    optionsSection: {
      marginVertical: spacing.md,
    },
    optionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    optionLeft: {
      flex: 1,
      paddingRight: spacing.md,
    },
    optionDescription: {
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
    statusMessagesContainer: {
      marginTop: spacing.xs,
      gap: 2,
    },
    statusMessage: {
      color: theme.colors.onSurfaceVariant,
    },
    episodesList: {
      maxHeight: 300,
    },
    episodeItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
      gap: spacing.md,
    },
    episodeHeader: {
      flex: 1,
    },
    episodeTitle: {
      fontWeight: "500",
    },
    episodeQuality: {
      marginLeft: spacing.sm,
    },
    episodeDetails: {
      flex: 2,
    },
    episodeSize: {
      color: theme.colors.onSurfaceVariant,
    },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
      gap: spacing.md,
    },
    loadingText: {
      color: theme.colors.onSurfaceVariant,
    },
    emptyState: {
      alignItems: "center",
      padding: spacing.lg,
      gap: spacing.md,
    },
    searchBar: {
      marginBottom: spacing.md,
    },
    noResultsContainer: {
      alignItems: "center",
      padding: spacing.xl,
    },
    noResultsText: {
      color: theme.colors.onSurfaceVariant,
    },
  });

export default SonarrQueueDrawer;
