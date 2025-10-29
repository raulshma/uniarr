import { useCallback, useEffect, useState, useMemo } from "react";
import { StyleSheet, View, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Text,
  useTheme,
  Button,
  IconButton,
  Searchbar,
  SegmentedButtons,
  Checkbox,
} from "react-native-paper";
import { FlashList } from "@shopify/flash-list";

import { TabHeader } from "@/components/common/TabHeader";
import {
  SettingsGroup,
  SettingsListItem,
  AnimatedScrollView,
} from "@/components/common";
import ImageViewer from "@/components/cache/ImageViewer";
import { alert } from "@/services/dialogService";
import { logger } from "@/services/logger/LoggerService";
import {
  ImageCacheService,
  imageCacheService,
  type CacheFileInfo,
  type CacheAnalysis,
  type CacheSortField,
  type CacheFilterOptions,
} from "@/services/image/ImageCacheService";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import { shouldAnimateLayout } from "@/utils/animations.utils";

const CacheViewerScreen = () => {
  const theme = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<CacheAnalysis | null>(null);
  const [files, setFiles] = useState<CacheFileInfo[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<CacheFileInfo[]>([]);

  // UI state
  const [viewMode, setViewMode] = useState<"overview" | "files">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<CacheSortField>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [filterOptions, setFilterOptions] = useState<CacheFilterOptions>({});

  // Image preview state
  const [previewImage, setPreviewImage] = useState<{
    uri: string;
    fileName: string;
    fileSize: string;
    dimensions?: { width: number; height: number };
  } | null>(null);

  const isBusy = loading || refreshing;
  const animationsEnabled = shouldAnimateLayout(isBusy, false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
          paddingTop: insets?.top || 0,
        },
        scrollContainer: {
          flex: 1,
          paddingHorizontal: spacing.xs,
          gap: spacing.sm,
        },
        section: {
          marginTop: spacing.md,
        },
        sectionTitle: {
          color: theme.colors.onBackground,
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          lineHeight: theme.custom.typography.titleMedium.lineHeight,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.xs,
        },
        overviewGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          paddingHorizontal: spacing.xs,
          gap: spacing.sm,
          marginBottom: spacing.md,
        },
        overviewCard: {
          backgroundColor: theme.colors.elevation.level1,
          borderRadius: borderRadius.xxl,
          padding: spacing.md,
          width: "48%",
          marginBottom: spacing.sm,
        },
        overviewCardTitle: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.labelSmall.fontSize,
          fontFamily: theme.custom.typography.labelSmall.fontFamily,
          marginBottom: spacing.xs,
        },
        overviewCardValue: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.headlineSmall.fontSize,
          fontFamily: theme.custom.typography.headlineSmall.fontFamily,
          fontWeight: "bold",
        },
        searchContainer: {
          marginHorizontal: spacing.xs,
          marginBottom: spacing.sm,
        },
        filterContainer: {
          marginHorizontal: spacing.xs,
          marginBottom: spacing.sm,
        },
        filterChip: {
          marginRight: spacing.xs,
          marginBottom: spacing.xs,
        },
        sortContainer: {
          flexDirection: "column",
          alignItems: "flex-start",
          paddingHorizontal: spacing.xs,
          marginBottom: spacing.sm,
          gap: spacing.xs,
        },
        sortLabel: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.bodyMedium.fontSize,
        },
        fileItem: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.xs,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outlineVariant,
        },
        fileCheckbox: {
          marginRight: spacing.sm,
        },
        fileInfo: {
          flex: 1,
        },
        fileName: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          fontWeight: "500",
          marginBottom: 2,
        },
        fileDetails: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodySmall.fontSize,
          fontFamily: theme.custom.typography.bodySmall.fontFamily,
        },
        fileSize: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodySmall.fontSize,
          fontFamily: theme.custom.typography.bodySmall.fontFamily,
          textAlign: "right",
        },
        emptyContainer: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.xl,
        },
        emptyTitle: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.titleLarge.fontSize,
          fontFamily: theme.custom.typography.titleLarge.fontFamily,
          marginBottom: spacing.sm,
          textAlign: "center",
        },
        emptyDescription: {
          color: theme.colors.onSurfaceVariant,
          fontSize: theme.custom.typography.bodyMedium.fontSize,
          fontFamily: theme.custom.typography.bodyMedium.fontFamily,
          textAlign: "center",
        },
        fabContainer: {
          position: "absolute",
          bottom: spacing.xl,
          right: spacing.md,
        },
        fab: {
          borderRadius: borderRadius.xxl,
        },
      }),
    [theme, insets],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [analysisData, filesData] = await Promise.all([
        imageCacheService.getCacheAnalysis(),
        imageCacheService.getDetailedCacheInfo(
          filterOptions,
          sortField,
          sortOrder,
        ),
      ]);

      setAnalysis(analysisData);
      setFiles(filesData);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load cache data";
      void logger.error("CacheViewer: failed to load data", { error: message });
      alert("Error", message);
    } finally {
      setLoading(false);
    }
  }, [filterOptions, sortField, sortOrder]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Apply search filter
  useEffect(() => {
    let filtered = files;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (file) =>
          file.path.toLowerCase().includes(query) ||
          file.service?.toLowerCase().includes(query) ||
          file.type.toLowerCase().includes(query) ||
          file.format.toLowerCase().includes(query),
      );
    }

    setFilteredFiles(filtered);
  }, [files, searchQuery]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const handleSort = useCallback(
    (field: CacheSortField) => {
      if (field === sortField) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortOrder("desc");
      }
    },
    [sortField],
  );

  const handleFileSelection = useCallback(
    (filePath: string, selected: boolean) => {
      setSelectedFiles((prev) => {
        const newSet = new Set(prev);
        if (selected) {
          newSet.add(filePath);
        } else {
          newSet.delete(filePath);
        }
        return newSet;
      });
    },
    [],
  );

  const handleSelectAll = useCallback(() => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map((f) => f.path)));
    }
  }, [selectedFiles.size, filteredFiles]);

  const handleClearSelected = useCallback(async () => {
    if (selectedFiles.size === 0) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      alert(
        "Clear Selected Files",
        `Are you sure you want to delete ${selectedFiles.size} cached file${selectedFiles.size !== 1 ? "s" : ""}?`,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => resolve(true),
          },
        ],
      );
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      const result = await imageCacheService.clearSelectedFiles(
        Array.from(selectedFiles),
      );

      if (result.failed > 0) {
        alert(
          "Partial Success",
          `Successfully deleted ${result.success} file${result.success !== 1 ? "s" : ""}, but ${result.failed} file${result.failed !== 1 ? "s" : ""} could not be deleted.`,
        );
      } else {
        alert(
          "Success",
          `Successfully deleted ${result.success} file${result.success !== 1 ? "s" : ""}.`,
        );
      }

      setSelectedFiles(new Set());
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to clear selected files";
      alert("Error", message);
    } finally {
      setLoading(false);
    }
  }, [selectedFiles, loadData]);

  const handleClearAll = useCallback(async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      alert(
        "Clear All Cache",
        "Are you sure you want to delete all cached images? This will free up space but images will need to be downloaded again.",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Clear All",
            style: "destructive",
            onPress: () => resolve(true),
          },
        ],
      );
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      await imageCacheService.clearCache();
      alert("Success", "All cache has been cleared.");
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to clear cache";
      alert("Error", message);
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  const isImageFile = useCallback((format: string) => {
    const imageFormats = ["JPG", "JPEG", "PNG", "WEBP", "GIF", "BMP", "IMG"];
    return imageFormats.includes(format.toUpperCase());
  }, []);

  const handleImagePreview = useCallback(
    async (file: CacheFileInfo) => {
      if (!isImageFile(file.format)) return;

      // Try to get image dimensions
      let dimensions: { width: number; height: number } | undefined;
      // Use the file.path as the primary URI, fallback to file.uri
      const imageUri = file.path || file.uri;

      setPreviewImage({
        uri: imageUri,
        fileName: file.path.split("/").pop() || file.path,
        fileSize: file.formattedSize,
        dimensions,
      });
    },
    [isImageFile],
  );

  const renderOverview = useMemo(() => {
    if (!analysis) return null;

    return (
      <View style={styles.overviewGrid}>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewCardTitle}>Total Size</Text>
          <Text style={styles.overviewCardValue}>{analysis.formattedSize}</Text>
        </View>

        <View style={styles.overviewCard}>
          <Text style={styles.overviewCardTitle}>File Count</Text>
          <Text style={styles.overviewCardValue}>
            {analysis.fileCount.toLocaleString()}
          </Text>
        </View>

        <View style={styles.overviewCard}>
          <Text style={styles.overviewCardTitle}>Avg File Size</Text>
          <Text style={styles.overviewCardValue}>
            {ImageCacheService.formatBytes(analysis.averageFileSize)}
          </Text>
        </View>

        <View style={styles.overviewCard}>
          <Text style={styles.overviewCardTitle}>Hit Rate</Text>
          <Text style={styles.overviewCardValue}>
            {imageCacheService.getCacheStats().hitRate.toFixed(1)}%
          </Text>
        </View>
      </View>
    );
  }, [analysis, styles]);

  const renderFileItem = useCallback(
    ({ item }: { item: CacheFileInfo; index: number }) => (
      <View style={styles.fileItem}>
        <Checkbox
          status={selectedFiles.has(item.path) ? "checked" : "unchecked"}
          onPress={() =>
            handleFileSelection(item.path, !selectedFiles.has(item.path))
          }
        />

        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {item.path.split("/").pop() || item.path}
          </Text>
          <Text style={styles.fileDetails}>
            {item.service || "Unknown"} • {item.type} • {item.format} •{" "}
            {item.ageFormatted}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
          }}
        >
          {isImageFile(item.format) && (
            <IconButton
              icon="eye"
              size={20}
              iconColor={theme.colors.primary}
              onPress={() => handleImagePreview(item)}
            />
          )}
          <Text style={styles.fileSize}>{item.formattedSize}</Text>
        </View>
      </View>
    ),
    [
      selectedFiles,
      handleFileSelection,
      isImageFile,
      handleImagePreview,
      theme,
      styles,
    ],
  );

  const renderContent = useMemo(() => {
    if (viewMode === "overview") {
      return (
        <AnimatedScrollView
          contentContainerStyle={styles.scrollContainer}
          animated={animationsEnabled}
        >
          <TabHeader title="Cache Manager" />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <SettingsGroup>
              <SettingsListItem
                title="View Detailed Files"
                subtitle="Browse and manage individual cache files"
                left={{ iconName: "file-multiple" }}
                trailing={
                  <IconButton
                    icon="chevron-right"
                    size={16}
                    iconColor={theme.colors.outline}
                  />
                }
                onPress={() => setViewMode("files")}
                groupPosition="top"
              />

              <SettingsListItem
                title="Clear All Cache"
                subtitle="Delete all cached images to free up space"
                left={{ iconName: "delete-sweep" }}
                trailing={
                  <Button
                    mode="contained-tonal"
                    compact
                    onPress={handleClearAll}
                    loading={loading}
                    disabled={loading || !analysis || analysis.fileCount === 0}
                    style={{ height: 32 }}
                  >
                    Clear
                  </Button>
                }
                groupPosition="bottom"
              />
            </SettingsGroup>
          </View>

          {renderOverview}

          {analysis && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cache Breakdown</Text>
              <SettingsGroup>
                {Object.entries(analysis.byType).map(
                  ([type, data], index, array) => (
                    <SettingsListItem
                      key={type}
                      title={`${type.charAt(0).toUpperCase() + type.slice(1)} Images`}
                      subtitle={`${data.count} files • ${ImageCacheService.formatBytes(data.size)}`}
                      left={{
                        iconName:
                          type === "poster"
                            ? "image"
                            : type === "fanart"
                              ? "image-area"
                              : "image-filter-center-focus",
                      }}
                      trailing={
                        <Text style={{ color: theme.colors.onSurfaceVariant }}>
                          {data.percentage.toFixed(1)}%
                        </Text>
                      }
                      groupPosition={
                        index === 0
                          ? "top"
                          : index === array.length - 1
                            ? "bottom"
                            : "middle"
                      }
                    />
                  ),
                )}
              </SettingsGroup>
            </View>
          )}
        </AnimatedScrollView>
      );
    }

    // Files view
    return (
      <View style={styles.scrollContainer}>
        <TabHeader title="Cache Files" />

        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search files..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            mode="bar"
          />
        </View>

        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Sort:</Text>
          <SegmentedButtons
            value={sortField}
            onValueChange={(value) => handleSort(value as CacheSortField)}
            buttons={[
              { value: "date", label: "Date" },
              { value: "size", label: "Size" },
              { value: "name", label: "Name" },
              { value: "type", label: "Type" },
            ]}
            density="small"
          />
        </View>

        {filteredFiles.length > 0 && (
          <View
            style={{ paddingHorizontal: spacing.xs, marginBottom: spacing.sm }}
          >
            <Button mode="outlined" onPress={handleSelectAll} compact>
              {selectedFiles.size === filteredFiles.length
                ? "Deselect All"
                : "Select All"}
            </Button>
          </View>
        )}

        {filteredFiles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Cache Files Found</Text>
            <Text style={styles.emptyDescription}>
              {searchQuery.trim()
                ? "Try adjusting your search terms"
                : "The cache is currently empty"}
            </Text>
          </View>
        ) : (
          <FlashList
            data={filteredFiles}
            renderItem={renderFileItem}
            estimatedItemSize={80}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
            keyExtractor={(item: CacheFileInfo) => item.path}
          />
        )}

        {selectedFiles.size > 0 && (
          <View style={styles.fabContainer}>
            <Button
              mode="elevated"
              onPress={handleClearSelected}
              icon="delete"
              style={styles.fab}
            >
              Clear ({selectedFiles.size})
            </Button>
          </View>
        )}
      </View>
    );
  }, [
    viewMode,
    analysis,
    renderOverview,
    searchQuery,
    sortField,
    filteredFiles,
    selectedFiles,
    refreshing,
    loading,
    handleRefresh,
    handleClearAll,
    handleSort,
    handleSelectAll,
    handleClearSelected,
    renderFileItem,
    theme,
    animationsEnabled,
    styles,
  ]);

  return (
    <View style={styles.container}>
      {renderContent}

      {previewImage && (
        <ImageViewer
          visible={!!previewImage}
          imageUri={previewImage.uri}
          fileName={previewImage.fileName}
          fileSize={previewImage.fileSize}
          imageDimensions={previewImage.dimensions}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </View>
  );
};

export default CacheViewerScreen;
