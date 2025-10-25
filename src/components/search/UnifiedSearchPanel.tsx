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
import { AnimatedListItem } from "@/components/common/AnimatedComponents";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { getComponentElevation } from "@/constants/elevation";
import { borderRadius } from "@/constants/sizes";
import { useUnifiedSearch } from "@/hooks/useUnifiedSearch";
import useDebouncedValueHook from "@/hooks/useDebouncedValue";
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

  // Elevation styles
  const cardElevationStyle = getComponentElevation("mediaCard", theme);
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
  const [statusFilter, setStatusFilter] = useState<string>("Any");
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Debounce the user's input to avoid issuing a search request on every keystroke.
  // This follows best-practice for search inputs on mobile to reduce network
  // traffic and improve perceived performance. 350ms is a reasonable default.
  const debouncedTerm = useDebouncedValueHook(searchTerm, 350);

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
  } = useUnifiedSearch(debouncedTerm, {
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
          height: theme.custom.sizes.touchSizes.md,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: borderRadius.round,
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
          minWidth: 0,
          maxWidth: 240,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        mainFilterPillActive: {
          backgroundColor: theme.colors.primary,
        },
        mainFilterText: {
          fontSize: 14,
          fontWeight: "500",
          color: theme.colors.onSurfaceVariant,
          flexShrink: 1,
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
          minWidth: 0,
          maxWidth: 220,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
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
          flexShrink: 1,
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
          borderRadius: borderRadius.lg,
          marginBottom: spacing.xs,
          padding: 0,
          overflow: "hidden",
        },
        resultContent: {
          flexDirection: "row",
          paddingVertical: spacing.xs,
          paddingRight: spacing.sm,
          paddingLeft: spacing.xs,
          alignItems: "center",
        },
        posterContainer: {
          width: theme.custom.sizes.posterSizes.sm - 8,
          height: theme.custom.sizes.posterSizes.sm * 1.4 - 8,
          borderRadius: borderRadius.md,
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
          justifyContent: "center",
        },
        resultTitle: {
          color: theme.colors.onSurface,
          fontSize: 14,
          fontWeight: "600",
          marginBottom: spacing.xs / 2,
          lineHeight: 18,
        },
        resultSubtitle: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 12,
          marginBottom: 0,
        },
        genreContainer: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.xs,
          marginBottom: 0,
        },
        genreChip: {
          height: 22,
          paddingHorizontal: spacing.xs,
          marginRight: spacing.xs,
        },
        resultActions: {
          flexDirection: "row",
          gap: spacing.xs,
          alignItems: "center",
        },
        actionButton: {
          width: theme.custom.sizes.touchSizes.sm,
          height: theme.custom.sizes.touchSizes.sm,
          borderRadius: borderRadius.round,
          justifyContent: "center",
          alignItems: "center",
        },
        downloadButtonContainer: {
          width: theme.custom.sizes.touchSizes.sm,
          height: theme.custom.sizes.touchSizes.sm,
          borderRadius: borderRadius.round,
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
        /* Compact card helper styles */
        resultHeaderRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        },
        titleColumn: {
          flex: 1,
          paddingRight: spacing.sm,
        },
        rightColumn: {
          alignItems: "flex-end",
        },
        serviceBadge: {
          backgroundColor: theme.colors.surfaceVariant,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
        },
        serviceBadgeText: {
          fontSize: 11,
          color: theme.colors.onSurfaceVariant,
        },
        spacerSmall: {
          height: spacing.sm,
        },
        iconCompact: {
          margin: 0,
          padding: 4,
        },
        iconWithBg: {
          margin: 0,
          padding: 4,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: borderRadius.round,
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
    setStatusFilter("Any");
  }, []);

  const hasAdvancedFilters =
    qualityFilter !== "Any" ||
    releaseTypeFilter !== "Any" ||
    statusFilter !== "Any";

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

  const handleViewAction = useCallback(
    (item: UnifiedSearchResult) => {
      // Navigate to the appropriate detail screen for each service when possible
      if (item.serviceType === "jellyseerr") {
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
          return;
        }
        router.push({
          pathname: "/(auth)/jellyseerr/[serviceId]",
          params: { serviceId: item.serviceId },
        });
        return;
      }

      if (item.serviceType === "jellyfin") {
        const itemId = item.externalIds?.serviceNativeId;
        if (itemId) {
          router.push({
            pathname: "/(auth)/jellyfin/[serviceId]/details/[itemId]",
            params: { serviceId: item.serviceId, itemId: String(itemId) },
          });
          return;
        }
        router.push({
          pathname: "/(auth)/jellyfin/[serviceId]",
          params: { serviceId: item.serviceId },
        });
        return;
      }

      // Sonarr series detail
      if (item.serviceType === "sonarr") {
        const nativeId = item.externalIds?.serviceNativeId;
        const tvdbId = item.externalIds?.tvdbId;
        // Only navigate to series detail when we have a valid non-zero id
        if (nativeId && String(nativeId) !== "0") {
          router.push({
            pathname: "/(auth)/sonarr/[serviceId]/series/[id]",
            params: { serviceId: item.serviceId, id: String(nativeId) },
          });
          return;
        }
        if (tvdbId && String(tvdbId) !== "0") {
          router.push({
            pathname: "/(auth)/sonarr/[serviceId]/series/[id]",
            params: { serviceId: item.serviceId, id: String(tvdbId) },
          });
          return;
        }
        // Fallback to service index if no usable id
        router.push({
          pathname: "/(auth)/sonarr/[serviceId]",
          params: { serviceId: item.serviceId },
        });
        return;
      }

      // Radarr movie detail
      if (item.serviceType === "radarr") {
        const nativeId = item.externalIds?.serviceNativeId;
        const tmdbId = item.externalIds?.tmdbId;
        if (nativeId && String(nativeId) !== "0") {
          router.push({
            pathname: "/(auth)/radarr/[serviceId]/movies/[id]",
            params: { serviceId: item.serviceId, id: String(nativeId) },
          });
          return;
        }
        if (tmdbId && String(tmdbId) !== "0") {
          router.push({
            pathname: "/(auth)/radarr/[serviceId]/movies/[id]",
            params: { serviceId: item.serviceId, id: String(tmdbId) },
          });
          return;
        }
        // Fallback to service index if no usable id
        router.push({
          pathname: "/(auth)/radarr/[serviceId]",
          params: { serviceId: item.serviceId },
        });
        return;
      }

      // Default: fall back to primary action
      handlePrimaryAction(item);
    },
    [router, handlePrimaryAction],
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
              size={theme.custom.sizes.iconSizes.xxl}
              iconColor={theme.colors.onSurfaceVariant}
            />
          </View>
        );
      };

      const serviceLabel =
        serviceNameById.get(item.serviceId) ??
        serviceTypeLabels[item.serviceType] ??
        item.serviceType;

      return (
        <TouchableOpacity
          onPress={() => handlePrimaryAction(item)}
          activeOpacity={0.8}
          style={[styles.resultCard, cardElevationStyle]}
        >
          <View style={styles.resultContent}>
            <View style={styles.posterContainer}>{renderPoster()}</View>

            <View style={styles.resultInfo}>
              <View style={styles.resultHeaderRow}>
                <View style={styles.titleColumn}>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.resultSubtitle} numberOfLines={1}>
                    {subtitleInfo.join(" • ")}
                  </Text>

                  {genreInfo.length > 0 && (
                    <View style={styles.genreContainer}>
                      {genreInfo.slice(0, 3).map((genre, index) => (
                        <Chip
                          key={index}
                          compact
                          mode="outlined"
                          style={styles.genreChip}
                          textStyle={{ fontSize: 11 }}
                        >
                          {genre}
                        </Chip>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.rightColumn}>
                  <View style={styles.serviceBadge}>
                    <Text style={styles.serviceBadgeText}>{serviceLabel}</Text>
                  </View>

                  <View style={styles.spacerSmall} />

                  <View style={styles.resultActions}>
                    <IconButton
                      icon="eye"
                      size={18}
                      iconColor={theme.colors.primary}
                      onPress={() => handleViewAction(item)}
                      style={styles.iconCompact}
                    />

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

                    <IconButton
                      icon="dots-vertical"
                      size={18}
                      iconColor={theme.colors.onSurfaceVariant}
                      style={styles.iconWithBg}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [
      handlePrimaryAction,
      styles,
      theme,
      getConnector,
      cardElevationStyle,
      serviceNameById,
      handleViewAction,
    ],
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
              <>
                {qualityFilter !== "Any" && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>
                      Quality: {qualityFilter}
                    </Text>
                  </View>
                )}
                {statusFilter !== "Any" && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>
                      Status: {statusFilter}
                    </Text>
                  </View>
                )}
              </>
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
                      numberOfLines={1}
                      ellipsizeMode="tail"
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
                        numberOfLines={1}
                        ellipsizeMode="tail"
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
                        numberOfLines={1}
                        ellipsizeMode="tail"
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
                    "Any",
                    "Owned",
                    "Monitored",
                    "Missing",
                    "Requested",
                    "Available",
                  ].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.mainFilterPill,
                        statusFilter === status && styles.mainFilterPillActive,
                      ]}
                      onPress={() => {
                        setStatusFilter(status);
                      }}
                    >
                      <Text
                        style={[
                          styles.mainFilterText,
                          statusFilter === status &&
                            styles.mainFilterTextActive,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {status}
                      </Text>
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
                      <Text
                        style={styles.mainFilterTextActive}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {genre}
                      </Text>
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
                    <Text
                      style={styles.mainFilterText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      1990
                    </Text>
                    <Text
                      style={styles.mainFilterText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      2024
                    </Text>
                  </View>
                  <View
                    style={{
                      height: theme.custom.sizes.controlSizes.slider.height,
                      backgroundColor: theme.colors.surfaceVariant,
                      borderRadius:
                        theme.custom.sizes.controlSizes.slider.borderRadius,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        backgroundColor: theme.colors.primary,
                        borderRadius:
                          theme.custom.sizes.controlSizes.slider.borderRadius,
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
                size={theme.custom.sizes.iconSizes.xxxl}
                iconColor={theme.colors.onSurfaceVariant}
              />
              <Text style={styles.emptyStateText}>
                No results found. Try adjusting filters or a different term.
              </Text>
            </View>
          ) : null}

          <FlatList
            data={results}
            renderItem={({ item, index }) => (
              <AnimatedListItem index={index} totalItems={results.length}>
                {renderResult(item)}
              </AnimatedListItem>
            )}
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
                  <Text numberOfLines={1} ellipsizeMode="tail">
                    {entry.term}
                  </Text>
                </Chip>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <IconButton
                icon="movie-search"
                size={theme.custom.sizes.iconSizes.xxxl}
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
