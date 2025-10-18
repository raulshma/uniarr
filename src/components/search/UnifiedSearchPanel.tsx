import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Chip,
  HelperText,
  IconButton,
  Portal,
  Modal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useRouter, useLocalSearchParams } from "expo-router";

// Card and AnimatedSection intentionally omitted — not used in this file
import { Button } from "@/components/common/Button";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { useUnifiedSearch } from "@/hooks/useUnifiedSearch";
import type {
  SearchHistoryEntry,
  UnifiedSearchMediaType,
  UnifiedSearchResult,
} from "@/models/search.types";
import {
  useConnectorsStore,
  selectGetConnector,
} from "@/store/connectorsStore";
import DownloadButton from "@/components/downloads/DownloadButton";

const mediaTypeLabels: Record<UnifiedSearchMediaType, string> = {
  series: "Series",
  movie: "Movies",
  music: "Music",
  request: "Watchlist",
  unknown: "Other",
};

const serviceTypeLabels: Record<string, string> = {
  sonarr: "Sonarr",
  radarr: "Radarr",
  jellyseerr: "Jellyseerr",
  jellyfin: "Jellyfin",
  qbittorrent: "qBittorrent",
  prowlarr: "Prowlarr",
};

const minSearchLength = 2;

const mediaFilterOptions: UnifiedSearchMediaType[] = [
  "series",
  "movie",
  "request",
];

const formatRuntime = (minutes?: number): string => {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const buildIdentifier = (entry: SearchHistoryEntry): string => {
  const suffix: string[] = [];
  if (entry.serviceIds?.length) {
    suffix.push(entry.serviceIds.join(","));
  }
  if (entry.mediaTypes?.length) {
    suffix.push(entry.mediaTypes.join(","));
  }
  return suffix.length ? `${entry.term}-${suffix.join("-")}` : entry.term;
};

export const UnifiedSearchPanel: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const getConnector = useConnectorsStore(selectGetConnector);
  const params = useLocalSearchParams<{
    query?: string;
    tmdbId?: string;
    tvdbId?: string;
    serviceId?: string;
    mediaType?: string;
  }>();

  const [searchTerm, setSearchTerm] = useState("");
  const [serviceFilters, setServiceFilters] = useState<string[]>([]);
  const [mediaFilters, setMediaFilters] = useState<UnifiedSearchMediaType[]>(
    [],
  );
  const [qualityFilter, setQualityFilter] = useState<string>("Any");
  const [releaseTypeFilter, setReleaseTypeFilter] = useState<string>("Any");
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const {
    results,
    errors,
    durationMs,
    isLoading,
    isFetching,
    history,
    isHistoryLoading,
    searchableServices,
    recordSearch,
    removeHistoryEntry,
    clearHistory,
  } = useUnifiedSearch(searchTerm, {
    serviceIds: serviceFilters,
    mediaTypes: mediaFilters,
  });

  const serviceNameById = useMemo(() => {
    const entries = new Map<string, string>();
    for (const service of searchableServices) {
      entries.set(service.serviceId, service.serviceName);
    }
    return entries;
  }, [searchableServices]);

  const hasActiveQuery = searchTerm.trim().length >= minSearchLength;
  const isBusy = isLoading || isFetching;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        searchContainer: {
          paddingHorizontal: spacing.sm,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xs,
        },
        searchInput: {
          height: 52,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 26,
          fontSize: 16,
          paddingHorizontal: spacing.lg,
        },
        filtersContainer: {
          paddingHorizontal: spacing.sm,
          marginBottom: spacing.sm,
        },
        mainFiltersContainer: {
          marginBottom: spacing.sm,
        },
        mainFilterTitle: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 14,
          fontWeight: "500",
          marginBottom: spacing.xs,
        },
        mainFilterRow: {
          flexDirection: "row",
          gap: spacing.xs,
          alignItems: "center",
        },
        mainFilterPill: {
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 20,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          minWidth: 80,
          alignItems: "center",
          justifyContent: "center",
        },
        mainFilterPillActive: {
          backgroundColor: theme.colors.primary,
        },
        mainFilterText: {
          fontSize: 14,
          fontWeight: "500",
          color: theme.colors.onSurfaceVariant,
        },
        mainFilterTextActive: {
          color: theme.colors.onPrimary,
        },
        serviceFiltersContainer: {
          marginBottom: spacing.sm,
        },
        serviceFilterTitle: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 14,
          fontWeight: "500",
          marginBottom: spacing.xs,
        },
        serviceFilterRow: {
          flexDirection: "row",
          gap: spacing.xs,
          alignItems: "center",
        },
        serviceFilterPill: {
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 20,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          minWidth: 70,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: spacing.xs,
        },
        serviceFilterPillActive: {
          backgroundColor: theme.colors.primary,
        },
        serviceFilterText: {
          fontSize: 14,
          fontWeight: "500",
          color: theme.colors.onSurfaceVariant,
        },
        serviceFilterTextActive: {
          color: theme.colors.onPrimary,
        },
        moreFiltersButton: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
        moreFiltersText: {
          fontSize: 14,
          fontWeight: "500",
          color: theme.colors.primary,
        },
        advancedFiltersContainer: {
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 12,
          marginHorizontal: spacing.sm,
          marginBottom: spacing.sm,
          padding: spacing.sm,
        },
        advancedFilterSection: {
          marginBottom: spacing.sm,
        },
        advancedFilterTitle: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 14,
          fontWeight: "500",
          marginBottom: spacing.xs,
        },
        resultContainer: {
          flex: 1,
          paddingHorizontal: spacing.sm,
        },
        resultCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          marginBottom: spacing.sm,
          elevation: 2,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        resultContent: {
          flexDirection: "row",
          padding: spacing.sm,
        },
        posterContainer: {
          width: 68,
          height: 102,
          borderRadius: 10,
          backgroundColor: theme.colors.surfaceVariant,
          marginRight: spacing.sm,
          overflow: "hidden",
        },
        posterImage: {
          width: "100%",
          height: "100%",
          resizeMode: "cover",
        },
        posterFallback: {
          width: "100%",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.colors.surfaceVariant,
        },
        resultInfo: {
          flex: 1,
          justifyContent: "space-between",
        },
        resultTitle: {
          color: theme.colors.onSurface,
          fontSize: 16,
          fontWeight: "600",
          marginBottom: spacing.xs,
          lineHeight: 22,
        },
        resultSubtitle: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 14,
          marginBottom: spacing.sm,
        },
        genreContainer: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.xs,
          marginBottom: spacing.sm,
        },
        genreChip: {
          height: 28,
          paddingHorizontal: spacing.sm,
        },
        resultActions: {
          flexDirection: "row",
          gap: spacing.sm,
          alignItems: "center",
        },
        actionButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          justifyContent: "center",
          alignItems: "center",
        },
        downloadButtonContainer: {
          width: 40,
          height: 40,
          borderRadius: 20,
          justifyContent: "center",
          alignItems: "center",
        },
        historyContainer: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
        },
        historyHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.sm,
        },
        historyChips: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.sm,
        },
        footerRow: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        errorText: {
          color: theme.colors.error,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
        loadingContainer: {
          padding: spacing.md,
          alignItems: "center",
        },
        emptyState: {
          padding: spacing.lg,
          alignItems: "center",
        },
        emptyStateText: {
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          marginTop: spacing.sm,
        },
        filterDrawer: {
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 0,
          margin: 0,
        },
        filterDrawerHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outlineVariant,
        },
        filterDrawerTitle: {
          fontSize: 20,
          fontWeight: "600",
          color: theme.colors.onSurface,
        },
        filterDrawerContent: {
          flex: 1,
          paddingHorizontal: spacing.md,
        },
        filterDrawerSection: {
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outlineVariant,
        },
        filterDrawerFooter: {
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: theme.colors.outlineVariant,
          flexDirection: "row",
          gap: spacing.sm,
        },
        filterSummaryRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: spacing.sm,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 8,
          marginBottom: spacing.sm,
        },
        filterSummaryText: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
        },
        filterSummaryBadges: {
          flexDirection: "row",
          gap: spacing.xs,
        },
        filterBadge: {
          backgroundColor: theme.colors.primary,
          borderRadius: 10,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
        filterBadgeText: {
          fontSize: 12,
          color: theme.colors.onPrimary,
          fontWeight: "500",
        },
        emptyFilterSection: {
          alignItems: "center",
          paddingVertical: spacing.lg,
        },
        emptyFilterText: {
          fontSize: 16,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          marginBottom: spacing.xs,
        },
        emptyFilterSubtext: {
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          opacity: 0.7,
        },
        filterNoteText: {
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          fontStyle: "italic",
          opacity: 0.6,
          marginTop: spacing.sm,
        },
      }),
    [theme],
  );

  const toggleService = useCallback((serviceId: string) => {
    setServiceFilters((current) => {
      const next = new Set(current);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return Array.from(next);
    });
  }, []);

  const toggleMedia = useCallback((mediaType: UnifiedSearchMediaType) => {
    setMediaFilters((current) => {
      const next = new Set(current);
      if (next.has(mediaType)) {
        next.delete(mediaType);
      } else {
        next.add(mediaType);
      }
      return Array.from(next) as UnifiedSearchMediaType[];
    });
  }, []);

  const clearServiceFilters = useCallback(() => {
    setServiceFilters([]);
  }, []);

  const clearMediaFilters = useCallback(() => {
    setMediaFilters([]);
  }, []);

  const clearAdvancedFilters = useCallback(() => {
    setQualityFilter("Any");
    setReleaseTypeFilter("Any");
  }, []);

  const hasAdvancedFilters =
    qualityFilter !== "Any" || releaseTypeFilter !== "Any";

  // If the route provides search params (e.g. from Discover card), prefill the search
  useEffect(() => {
    if (params.query && params.query !== searchTerm) {
      setSearchTerm(params.query as string);
    }

    if (params.serviceId) {
      setServiceFilters([params.serviceId as string]);
    }

    if (
      params.mediaType &&
      mediaFilterOptions.includes(params.mediaType as UnifiedSearchMediaType)
    ) {
      setMediaFilters([params.mediaType as UnifiedSearchMediaType]);
    }
  }, [params.query, params.serviceId, params.mediaType, searchTerm]);

  const handleHistorySelect = useCallback((entry: SearchHistoryEntry) => {
    setSearchTerm(entry.term);
    setServiceFilters(entry.serviceIds ?? []);
    setMediaFilters(entry.mediaTypes ?? []);
  }, []);

  const handlePrimaryAction = useCallback(
    async (item: UnifiedSearchResult) => {
      if (item.serviceType === "jellyseerr") {
        // Main button: open Jellyseerr media detail page in-app
        const mediaType = item.mediaType === "series" ? "series" : "movie";
        const mediaId =
          item.externalIds?.tmdbId ?? item.externalIds?.serviceNativeId;
        if (mediaId) {
          router.push({
            pathname: "/(auth)/jellyseerr/[serviceId]/[mediaType]/[mediaId]",
            params: {
              serviceId: item.serviceId,
              mediaType,
              mediaId: String(mediaId),
            },
          });
        } else {
          router.push({
            pathname: "/(auth)/jellyseerr/[serviceId]",
            params: { serviceId: item.serviceId },
          });
        }
      } else if (item.serviceType === "jellyfin") {
        // Open Jellyfin media detail page
        const itemId = item.externalIds?.serviceNativeId;
        if (itemId) {
          router.push({
            pathname: "/(auth)/jellyfin/[serviceId]/details/[itemId]",
            params: {
              serviceId: item.serviceId,
              itemId: String(itemId),
            },
          });
        } else {
          router.push({
            pathname: "/(auth)/jellyfin/[serviceId]",
            params: { serviceId: item.serviceId },
          });
        }
      } else {
        const params: Record<string, string> = { serviceId: item.serviceId };
        if (item.externalIds?.tmdbId)
          params.tmdbId = String(item.externalIds.tmdbId);
        if (item.externalIds?.tvdbId)
          params.tvdbId = String(item.externalIds.tvdbId);
        params.query = item.title;

        switch (item.serviceType) {
          case "sonarr":
            router.push({ pathname: "/(auth)/sonarr/[serviceId]/add", params });
            break;
          case "radarr":
            router.push({ pathname: "/(auth)/radarr/[serviceId]/add", params });
            break;
          default:
            break;
        }
      }

      await recordSearch(item.title, {
        serviceIds: [item.serviceId],
        mediaTypes: [item.mediaType],
      });
    },
    [recordSearch, router],
  );

  const renderResult = useCallback(
    (item: UnifiedSearchResult) => {
      const subtitleInfo = [];
      if (item.year) subtitleInfo.push(String(item.year));
      if (item.runtime) subtitleInfo.push(formatRuntime(item.runtime));

      const genreInfo = [];
      if (item.mediaType) genreInfo.push(mediaTypeLabels[item.mediaType]);
      if (item.isInLibrary) genreInfo.push("In Library");
      if (item.isRequested) genreInfo.push("Requested");
      if (item.isAvailable) genreInfo.push("Available");

      const renderPoster = () => {
        if (item.posterUrl) {
          return (
            <Image
              source={{ uri: item.posterUrl }}
              style={styles.posterImage}
              onError={() => {
                // Handle image load error gracefully
              }}
            />
          );
        }
        return (
          <View style={styles.posterFallback}>
            <IconButton
              icon="image"
              size={32}
              iconColor={theme.colors.onSurfaceVariant}
            />
          </View>
        );
      };

      return (
        <View style={styles.resultCard}>
          <View style={styles.resultContent}>
            <View style={styles.posterContainer}>{renderPoster()}</View>

            <View style={styles.resultInfo}>
              <View>
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.resultSubtitle}>
                  {subtitleInfo.join(" • ")}
                </Text>
              </View>

              <View>
                {genreInfo.length > 0 && (
                  <View style={styles.genreContainer}>
                    {genreInfo.map((genre, index) => (
                      <Chip
                        key={index}
                        compact
                        mode="outlined"
                        style={styles.genreChip}
                        textStyle={{ fontSize: 12 }}
                      >
                        {genre}
                      </Chip>
                    ))}
                  </View>
                )}

                <View style={styles.resultActions}>
                  <View
                    style={[
                      styles.actionButton,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    <IconButton
                      icon="eye"
                      size={20}
                      iconColor={theme.colors.onPrimary}
                      onPress={() => handlePrimaryAction(item)}
                    />
                  </View>

                  {item.serviceId && getConnector(item.serviceId)?.config && (
                    <View style={styles.downloadButtonContainer}>
                      <DownloadButton
                        serviceConfig={getConnector(item.serviceId)!.config}
                        contentId={item.id}
                        size="small"
                        variant="icon"
                        onDownloadStart={(downloadId) => {
                          console.log(`Download started: ${downloadId}`);
                        }}
                        onDownloadError={(error) => {
                          console.error(`Download failed: ${error}`);
                        }}
                      />
                    </View>
                  )}

                  <View
                    style={[
                      styles.actionButton,
                      { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                  >
                    <IconButton
                      icon="dots-vertical"
                      size={20}
                      iconColor={theme.colors.onSurfaceVariant}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      );
    },
    [handlePrimaryAction, styles, theme, getConnector],
  );

  const renderErrorHelper = useMemo(() => {
    if (!errors.length) {
      return null;
    }

    const errorMessages = errors.map((error) => {
      const label =
        serviceNameById.get(error.serviceId) ??
        serviceTypeLabels[error.serviceType] ??
        error.serviceType;
      return `${label}: ${error.message}`;
    });

    return (
      <HelperText type="error" style={styles.errorText}>
        Some services did not respond: {errorMessages.join(" • ")}
      </HelperText>
    );
  }, [errors, serviceNameById, styles.errorText]);

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          mode="flat"
          placeholder="Search"
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={searchTerm}
          onChangeText={setSearchTerm}
          style={styles.searchInput}
          contentStyle={{
            backgroundColor: "transparent",
            paddingLeft: spacing.lg - spacing.sm, // Account for icon
          }}
          underlineStyle={{ display: "none" }}
          left={<TextInput.Icon icon="magnify" size={20} />}
          right={
            <TextInput.Icon
              icon="filter-variant"
              onPress={() => setShowFilterDrawer(true)}
              size={20}
            />
          }
        />
      </View>

      {/* Filter Summary */}
      {(mediaFilters.length > 0 ||
        serviceFilters.length > 0 ||
        hasAdvancedFilters) && (
        <View style={styles.filterSummaryRow}>
          <Text style={styles.filterSummaryText}>Active filters:</Text>
          <View style={styles.filterSummaryBadges}>
            {mediaFilters.length > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {mediaFilters.map((f) => mediaTypeLabels[f]).join(", ")}
                </Text>
              </View>
            )}
            {serviceFilters.length > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {serviceFilters.length} service
                  {serviceFilters.length > 1 ? "s" : ""}
                </Text>
              </View>
            )}
            {hasAdvancedFilters && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  Quality: {qualityFilter}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Filter Drawer */}
      <Portal>
        <Modal
          visible={showFilterDrawer}
          onDismiss={() => setShowFilterDrawer(false)}
          contentContainerStyle={styles.filterDrawer}
          style={{ justifyContent: "flex-end", margin: 0 }}
        >
          <View style={{ minHeight: "75%", flexDirection: "column" }}>
            {/* Drawer Header */}
            <View style={styles.filterDrawerHeader}>
              <Text style={styles.filterDrawerTitle}>Advanced Filters</Text>
              <IconButton
                icon="close"
                onPress={() => setShowFilterDrawer(false)}
                size={24}
              />
            </View>

            {/* Drawer Content */}
            <ScrollView
              style={[styles.filterDrawerContent, { flex: 1 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* Source Filters */}
              <View style={styles.filterDrawerSection}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: spacing.sm,
                  }}
                >
                  <Text style={styles.advancedFilterTitle}>Source</Text>
                </View>
                <View style={[styles.mainFilterRow, { flexWrap: "wrap" }]}>
                  <TouchableOpacity
                    style={[
                      styles.mainFilterPill,
                      serviceFilters.length === 0 &&
                        styles.mainFilterPillActive,
                    ]}
                    onPress={clearServiceFilters}
                  >
                    <Text
                      style={[
                        styles.mainFilterText,
                        serviceFilters.length === 0 &&
                          styles.mainFilterTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>

                  {searchableServices.map((service) => (
                    <TouchableOpacity
                      key={service.serviceId}
                      style={[
                        styles.mainFilterPill,
                        serviceFilters.includes(service.serviceId) &&
                          styles.mainFilterPillActive,
                      ]}
                      onPress={() => toggleService(service.serviceId)}
                    >
                      <Text
                        style={[
                          styles.mainFilterText,
                          serviceFilters.includes(service.serviceId) &&
                            styles.mainFilterTextActive,
                        ]}
                      >
                        {service.serviceName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Media Type Filters */}
              <View style={styles.filterDrawerSection}>
                <Text style={styles.advancedFilterTitle}>Media Type</Text>
                <View style={[styles.mainFilterRow, { flexWrap: "wrap" }]}>
                  {mediaFilterOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.mainFilterPill,
                        mediaFilters.includes(option) &&
                          styles.mainFilterPillActive,
                      ]}
                      onPress={() => toggleMedia(option)}
                    >
                      <Text
                        style={[
                          styles.mainFilterText,
                          mediaFilters.includes(option) &&
                            styles.mainFilterTextActive,
                        ]}
                      >
                        {mediaTypeLabels[option]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Status Filters */}
              <View style={styles.filterDrawerSection}>
                <Text style={styles.advancedFilterTitle}>Status</Text>
                <View style={[styles.mainFilterRow, { flexWrap: "wrap" }]}>
                  {[
                    "Owned",
                    "Monitored",
                    "Missing",
                    "Requested",
                    "Available",
                  ].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[styles.mainFilterPill]}
                      onPress={() => {
                        // TODO: Implement status filtering
                      }}
                    >
                      <Text style={styles.mainFilterText}>{status}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Genres Filters */}
              <View style={styles.filterDrawerSection}>
                <Text style={styles.advancedFilterTitle}>Genres</Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    mode="flat"
                    placeholder="Search genres..."
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    style={styles.searchInput}
                    contentStyle={{
                      backgroundColor: "transparent",
                      paddingLeft: spacing.lg - spacing.sm,
                    }}
                    underlineStyle={{ display: "none" }}
                    left={<TextInput.Icon icon="magnify" size={20} />}
                    right={<TextInput.Icon icon="chevron-down" size={20} />}
                  />
                </View>
                <View
                  style={[
                    styles.mainFilterRow,
                    { flexWrap: "wrap", marginTop: spacing.sm },
                  ]}
                >
                  {["Action", "Sci-Fi"].map((genre) => (
                    <View
                      key={genre}
                      style={[
                        styles.mainFilterPill,
                        styles.mainFilterPillActive,
                        { flexDirection: "row", gap: spacing.xs },
                      ]}
                    >
                      <Text style={styles.mainFilterTextActive}>{genre}</Text>
                      <IconButton
                        icon="close"
                        size={16}
                        iconColor={theme.colors.onPrimary}
                        style={{ margin: 0, padding: 0 }}
                      />
                    </View>
                  ))}
                </View>
              </View>

              {/* Release Year Filters */}
              <View
                style={[styles.filterDrawerSection, { borderBottomWidth: 0 }]}
              >
                <Text style={styles.advancedFilterTitle}>Release Year</Text>
                <View
                  style={{ marginTop: spacing.md, marginBottom: spacing.md }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: spacing.sm,
                    }}
                  >
                    <Text style={styles.mainFilterText}>1990</Text>
                    <Text style={styles.mainFilterText}>2024</Text>
                  </View>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: theme.colors.surfaceVariant,
                      borderRadius: 3,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        backgroundColor: theme.colors.primary,
                        borderRadius: 3,
                        marginLeft: "30%",
                        marginRight: "5%",
                      }}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Drawer Footer */}
            <View style={styles.filterDrawerFooter}>
              <Button
                mode="outlined"
                onPress={() => {
                  clearMediaFilters();
                  clearServiceFilters();
                  clearAdvancedFilters();
                }}
                style={{ flex: 1 }}
              >
                Clear All
              </Button>
              <Button
                mode="contained"
                onPress={() => setShowFilterDrawer(false)}
                style={{ flex: 1 }}
              >
                Apply Filters
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Results or History */}
      {hasActiveQuery ? (
        <View style={styles.resultContainer}>
          {isBusy && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator animating size="large" />
            </View>
          )}

          {!isBusy && results.length === 0 ? (
            <View style={styles.emptyState}>
              <IconButton
                icon="movie-search"
                size={48}
                iconColor={theme.colors.onSurfaceVariant}
              />
              <Text style={styles.emptyStateText}>
                No results found. Try adjusting filters or a different term.
              </Text>
            </View>
          ) : null}

          <FlatList
            data={results}
            renderItem={({ item }) => renderResult(item)}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={renderErrorHelper}
          />

          {results.length > 0 && (
            <View style={styles.footerRow}>
              <Text
                style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}
              >
                {results.length} result{results.length === 1 ? "" : "s"} •{" "}
                {Math.max(durationMs, 0)} ms
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Text
              style={{
                color: theme.colors.onSurface,
                fontSize: 18,
                fontWeight: "600",
              }}
            >
              Recent searches
            </Text>
            {history.length ? (
              <Button
                mode="text"
                onPress={clearHistory}
                textColor={theme.colors.primary}
                compact
              >
                Clear all
              </Button>
            ) : null}
          </View>

          {isHistoryLoading ? (
            <ActivityIndicator animating />
          ) : history.length ? (
            <View style={styles.historyChips}>
              {history.map((entry) => (
                <Chip
                  key={buildIdentifier(entry)}
                  mode="outlined"
                  onPress={() => handleHistorySelect(entry)}
                  onClose={() => removeHistoryEntry(entry)}
                  closeIcon="close"
                  textStyle={{ fontSize: 14 }}
                >
                  {entry.term}
                </Chip>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <IconButton
                icon="movie-search"
                size={48}
                iconColor={theme.colors.onSurfaceVariant}
              />
              <Text style={styles.emptyStateText}>
                Search for a show or movie to get started.
              </Text>
            </View>
          )}
        </View>
      )}

      {renderErrorHelper}
    </View>
  );
};
