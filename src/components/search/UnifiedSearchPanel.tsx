import React, { JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Chip,
  HelperText,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { Card } from '@/components/common/Card';
import { AnimatedSection } from '@/components/common/AnimatedComponents';
import { Button } from '@/components/common/Button';
import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import type { SearchHistoryEntry, UnifiedSearchMediaType, UnifiedSearchResult } from '@/models/search.types';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import type { JellyseerrConnector } from '@/connectors/implementations/JellyseerrConnector';

const mediaTypeLabels: Record<UnifiedSearchMediaType, string> = {
  series: 'Series',
  movie: 'Movies',
  music: 'Music',
  request: 'Requests',
  unknown: 'Other',
};

const serviceTypeLabels: Record<string, string> = {
  sonarr: 'Sonarr',
  radarr: 'Radarr',
  jellyseerr: 'Jellyseerr',
  jellyfin: 'Jellyfin',
  qbittorrent: 'qBittorrent',
  prowlarr: 'Prowlarr',
};

const minSearchLength = 2;

const mediaFilterOptions: UnifiedSearchMediaType[] = ['series', 'movie'];

const buildReleaseLabel = (result: UnifiedSearchResult): string | undefined => {
  const segments: string[] = [];

  if (result.year) {
    segments.push(String(result.year));
  }

  const mediaLabel = mediaTypeLabels[result.mediaType];
  if (mediaLabel && !segments.includes(mediaLabel)) {
    segments.push(mediaLabel);
  }

  if (result.isInLibrary) {
    segments.push('In Library');
  }

  return segments.length > 0 ? segments.join(' • ') : undefined;
};

const buildIdentifier = (entry: SearchHistoryEntry): string => {
  const suffix: string[] = [];
  if (entry.serviceIds?.length) {
    suffix.push(entry.serviceIds.join(','));
  }
  if (entry.mediaTypes?.length) {
    suffix.push(entry.mediaTypes.join(','));
  }
  return suffix.length ? `${entry.term}-${suffix.join('-')}` : entry.term;
};

export const UnifiedSearchPanel: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const connectorManager = useMemo(() => ConnectorManager.getInstance(), []);
  const params = useLocalSearchParams<{
    query?: string;
    tmdbId?: string;
    tvdbId?: string;
    serviceId?: string;
    mediaType?: string;
  }>();

  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilters, setServiceFilters] = useState<string[]>([]);
  const [mediaFilters, setMediaFilters] = useState<UnifiedSearchMediaType[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    results,
    errors,
    durationMs,
    isLoading,
    isFetching,
    history,
    isHistoryLoading,
    searchableServices,
    areServicesLoading,
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
          padding: spacing.xs,
          backgroundColor: theme.colors.elevation.level1,
          borderRadius: 12,
        },
        searchRow: {
          marginBottom: spacing.sm,
        },
        searchInputContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        searchInput: {
          flex: 1,
          backgroundColor: theme.colors.surface,
          borderRadius: 8,
        },
        expandButton: {
          margin: 0,
        },
        helperRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.xs,
        },
        chipRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          marginBottom: spacing.md,
        },
        resultContainer: {
          flex: 1,
        },
        resultCard: {
          borderRadius: 8,
          backgroundColor: theme.colors.surfaceVariant,
          padding: spacing.md,
          marginBottom: spacing.xs,
        },
        resultHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.xs,
        },
        resultTitle: {
          flex: 1,
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          lineHeight: theme.custom.typography.titleMedium.lineHeight,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
          marginRight: spacing.sm,
        },
        resultSubtitle: {
          color: theme.colors.onSurfaceVariant,
          marginBottom: spacing.xs,
        },
        resultActions: {
          flexDirection: 'row',
          gap: spacing.xs,
          flexWrap: 'wrap',
          marginTop: spacing.sm,
        },
        historyContainer: {
          gap: spacing.sm,
        },
        historyHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        historyChips: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
        },
        footerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: spacing.sm,
        },
        errorText: {
          color: theme.colors.error,
        },
        filtersSection: {
          marginTop: spacing.xs,
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

  // Attempt to open a specific Jellyseerr media detail page in the browser
  const openJellyseerrMediaDetail = useCallback(async (item: UnifiedSearchResult): Promise<boolean> => {
    try {
      // Validate basics
      if (item.serviceType !== 'jellyseerr') return false;
      const connector = connectorManager.getConnector(item.serviceId) as JellyseerrConnector | undefined;
      if (!connector || connector.config.type !== 'jellyseerr') return false;

      // Prefer TMDB id for Jellyseerr routes; fallback to service native id
      const tmdbId = item.externalIds?.tmdbId ?? item.externalIds?.serviceNativeId;
      if (!tmdbId) return false;

      const mediaPathType: 'movie' | 'tv' = item.mediaType === 'series' ? 'tv' : 'movie';
      const path = connector.getMediaDetailUrl(Number(tmdbId), mediaPathType);
      if (!path) return false;

      // Join base URL and path safely
      const base = connector.config.url.replace(/\/$/, '');
      const fullUrl = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
      await Linking.openURL(fullUrl);
      return true;
    } catch {
      return false;
    }
  }, [connectorManager]);

  // If the route provides search params (e.g. from Discover card), prefill the search
  useEffect(() => {
    if (params.query && params.query !== searchTerm) {
      setSearchTerm(params.query as string);
    }

    if (params.serviceId) {
      setServiceFilters([params.serviceId as string]);
    }

    if (params.mediaType && mediaFilterOptions.includes(params.mediaType as UnifiedSearchMediaType)) {
      setMediaFilters([params.mediaType as UnifiedSearchMediaType]);
    }
  }, [params.query, params.serviceId, params.mediaType]);

  const handleHistorySelect = useCallback(
    (entry: SearchHistoryEntry) => {
      setSearchTerm(entry.term);
      setServiceFilters(entry.serviceIds ?? []);
      setMediaFilters(entry.mediaTypes ?? []);
      setIsInputFocused(false);
    },
    [],
  );

  const handlePrimaryAction = useCallback(
    async (item: UnifiedSearchResult) => {
      if (item.serviceType === 'jellyseerr') {
        // Main button: open Jellyseerr media detail page in-app
        const mediaType = item.mediaType === 'series' ? 'series' : 'movie';
        const mediaId = item.externalIds?.tmdbId ?? item.externalIds?.serviceNativeId;
        if (mediaId) {
          router.push({
            pathname: '/(auth)/jellyseerr/[serviceId]/[mediaType]/[mediaId]',
            params: {
              serviceId: item.serviceId,
              mediaType,
              mediaId: String(mediaId),
            },
          });
        } else {
          router.push({ pathname: '/(auth)/jellyseerr/[serviceId]', params: { serviceId: item.serviceId } });
        }
      } else {
        const params: Record<string, string> = { serviceId: item.serviceId };
        if (item.externalIds?.tmdbId) params.tmdbId = String(item.externalIds.tmdbId);
        if (item.externalIds?.tvdbId) params.tvdbId = String(item.externalIds.tvdbId);
        params.query = item.title;

        switch (item.serviceType) {
          case 'sonarr':
            router.push({ pathname: '/(auth)/sonarr/[serviceId]/add', params });
            break;
          case 'radarr':
            router.push({ pathname: '/(auth)/radarr/[serviceId]/add', params });
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
    [openJellyseerrMediaDetail, recordSearch, router],
  );

  const handleOpenService = useCallback(
    (item: UnifiedSearchResult) => {
      if (item.serviceType === 'jellyseerr') {
        // Icon button: open Jellyseerr media detail page in browser (web app)
        void openJellyseerrMediaDetail(item);
        return;
      }

      switch (item.serviceType) {
        case 'sonarr':
          router.push({ pathname: '/(auth)/sonarr/[serviceId]', params: { serviceId: item.serviceId } });
          break;
        case 'radarr':
          router.push({ pathname: '/(auth)/radarr/[serviceId]', params: { serviceId: item.serviceId } });
          break;
        default:
          break;
      }
    },
    [openJellyseerrMediaDetail, router],
  );

  const renderResult = useCallback(
    (item: UnifiedSearchResult) => {
      const serviceLabel = `${serviceTypeLabels[item.serviceType] ?? item.serviceType}: ${item.serviceName}`;
      const releaseLabel = buildReleaseLabel(item);
      const statusChips: JSX.Element[] = [];

      if (item.isInLibrary) {
        statusChips.push(
          <Chip
            key="library"
            compact
            mode="outlined"
            icon="check"
            textStyle={{
              fontSize: theme.custom.typography.labelSmall.fontSize,
              fontFamily: theme.custom.typography.labelSmall.fontFamily,
            }}
          >
            In Library
          </Chip>,
        );
      }

      if (item.isRequested) {
        statusChips.push(
          <Chip
            key="requested"
            compact
            mode="outlined"
            icon="ticket-confirmation"
            textStyle={{
              fontSize: theme.custom.typography.labelSmall.fontSize,
              fontFamily: theme.custom.typography.labelSmall.fontFamily,
            }}
          >
            Requested
          </Chip>,
        );
      }

      if (item.isAvailable) {
        statusChips.push(
          <Chip
            key="available"
            compact
            mode="outlined"
            icon="check-decagram"
            textStyle={{
              fontSize: theme.custom.typography.labelSmall.fontSize,
              fontFamily: theme.custom.typography.labelSmall.fontFamily,
            }}
          >
            Available
          </Chip>,
        );
      }

      return (
        <Card variant="custom" style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Chip
              compact
              mode="outlined"
              textStyle={{
                fontSize: theme.custom.typography.labelSmall.fontSize,
                fontFamily: theme.custom.typography.labelSmall.fontFamily,
              }}
            >
              {serviceLabel}
            </Chip>
          </View>
          {releaseLabel ? (
            <Text style={styles.resultSubtitle}>{releaseLabel}</Text>
          ) : null}
          {item.overview ? (
            <Text numberOfLines={4} style={{ color: theme.colors.onSurfaceVariant }}>
              {item.overview}
            </Text>
          ) : null}
          {statusChips.length ? (
            <View style={[styles.resultActions, { marginTop: spacing.sm }]}>{statusChips}</View>
          ) : null}
          <View style={styles.resultActions}>
            <Button
              mode="contained"
              onPress={() => handlePrimaryAction(item)}
              align="left"
              labelStyle={{
                fontSize: theme.custom.typography.labelLarge.fontSize,
                fontFamily: theme.custom.typography.labelLarge.fontFamily,
              }}
            >
              {item.serviceType === 'jellyseerr' ? 'View' : `Add via ${serviceTypeLabels[item.serviceType] ?? 'Service'}`}
            </Button>
            <IconButton
              icon="open-in-new"
              accessibilityLabel="Open service"
              onPress={() => handleOpenService(item)}
              size={20}
            />
          </View>
        </Card>
      );
    },
    [handleOpenService, handlePrimaryAction, styles, theme.colors.onSurfaceVariant, theme.custom.typography],
  );

  const renderErrorHelper = useMemo(() => {
    if (!errors.length) {
      return null;
    }

    const errorMessages = errors.map((error) => {
      const label = serviceNameById.get(error.serviceId) ?? serviceTypeLabels[error.serviceType] ?? error.serviceType;
      return `${label}: ${error.message}`;
    });

    return (
      <HelperText type="error" style={styles.errorText}>
        Some services did not respond: {errorMessages.join(' • ')}
      </HelperText>
    );
  }, [errors, serviceNameById, styles.errorText]);

  return (
  <Card variant="custom" style={styles.container} contentStyle={{ flex: 1 }}>
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <TextInput
            mode="flat"
            placeholder="Search across Sonarr, Radarr, Jellyseerr"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={searchTerm}
            onChangeText={setSearchTerm}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            style={styles.searchInput}
            contentStyle={{ backgroundColor: 'transparent' }}
            underlineColor={theme.colors.outline}
            activeUnderlineColor={theme.colors.primary}
            left={<TextInput.Icon icon="magnify" />}
            right={
              searchTerm ? <TextInput.Icon icon="close" onPress={() => setSearchTerm('')} /> : undefined
            }
          />
          <IconButton
            icon={isExpanded ? 'chevron-up' : 'tune'}
            size={24}
            mode="contained-tonal"
            onPress={() => setIsExpanded(!isExpanded)}
            style={styles.expandButton}
            accessibilityLabel={isExpanded ? 'Collapse filters' : 'Expand filters'}
          />
        </View>
        {searchTerm.trim().length < minSearchLength && searchTerm.trim().length > 0 ? (
          <HelperText type="info">
            Enter at least {minSearchLength} characters to search all services.
          </HelperText>
        ) : null}
      </View>

      {isExpanded && (
        <AnimatedSection style={styles.filtersSection}>
          <View style={styles.helperRow}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>Services</Text>
            {serviceFilters.length ? (
              <Button
                compact
                mode="text"
                onPress={clearServiceFilters}
                align="left"
                textColor={theme.colors.primary}
                labelStyle={{
                  fontSize: theme.custom.typography.labelMedium.fontSize,
                  fontFamily: theme.custom.typography.labelMedium.fontFamily,
                }}
              >
                Clear
              </Button>
            ) : null}
          </View>
          <View style={styles.chipRow}>
            <Chip
              selected={serviceFilters.length === 0}
              onPress={clearServiceFilters}
              compact
              mode={serviceFilters.length === 0 ? "flat" : "outlined"}
              textStyle={{
                fontSize: theme.custom.typography.labelMedium.fontSize,
                fontFamily: theme.custom.typography.labelMedium.fontFamily,
              }}
            >
              All services
            </Chip>
            {areServicesLoading ? (
              <ActivityIndicator animating size="small" />
            ) : (
              searchableServices.map((service) => (
                <Chip
                  key={service.serviceId}
                  compact
                  selected={serviceFilters.includes(service.serviceId)}
                  onPress={() => toggleService(service.serviceId)}
                  mode={serviceFilters.includes(service.serviceId) ? "flat" : "outlined"}
                  textStyle={{
                    fontSize: theme.custom.typography.labelMedium.fontSize,
                    fontFamily: theme.custom.typography.labelMedium.fontFamily,
                  }}
                >
                  {service.serviceName}
                </Chip>
              ))
            )}
          </View>

          <View style={styles.helperRow}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>Media types</Text>
            {mediaFilters.length ? (
              <Button
                compact
                mode="text"
                onPress={clearMediaFilters}
                align="left"
                textColor={theme.colors.primary}
                labelStyle={{
                  fontSize: theme.custom.typography.labelMedium.fontSize,
                  fontFamily: theme.custom.typography.labelMedium.fontFamily,
                }}
              >
                Clear
              </Button>
            ) : null}
          </View>
          <View style={styles.chipRow}>
            <Chip
              selected={mediaFilters.length === 0}
              onPress={clearMediaFilters}
              compact
              mode={mediaFilters.length === 0 ? "flat" : "outlined"}
              textStyle={{
                fontSize: theme.custom.typography.labelMedium.fontSize,
                fontFamily: theme.custom.typography.labelMedium.fontFamily,
              }}
            >
              All media
            </Chip>
            {mediaFilterOptions.map((option) => (
              <Chip
                key={option}
                compact
                selected={mediaFilters.includes(option)}
                onPress={() => toggleMedia(option)}
                mode={mediaFilters.includes(option) ? "flat" : "outlined"}
                textStyle={{
                  fontSize: theme.custom.typography.labelMedium.fontSize,
                  fontFamily: theme.custom.typography.labelMedium.fontFamily,
                }}
              >
                {mediaTypeLabels[option]}
              </Chip>
            ))}
          </View>
        </AnimatedSection>
      )}

      {hasActiveQuery ? (
        <View style={styles.resultContainer}>
          {!isBusy && results.length === 0 ? (
            <HelperText type="info">No results found. Try adjusting filters or a different term.</HelperText>
          ) : null}
          <FlatList
            data={results}
            renderItem={({ item }) => renderResult(item)}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: spacing.sm }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={!isBusy ? <HelperText type="info">No results found. Try adjusting filters or a different term.</HelperText> : null}
            ListHeaderComponent={
              <>
                {isBusy ? <ActivityIndicator animating /> : null}
                {renderErrorHelper}
              </>
            }
            // footer moved out of FlatList into outer card
          />
          {results.length > 0 ? (
            <View style={styles.footerRow}>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>
                {results.length} result{results.length === 1 ? '' : 's'} • {Math.max(durationMs, 0)} ms
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>Recent searches</Text>
            {history.length ? (
              <Button
                compact
                mode="text"
                onPress={clearHistory}
                textColor={theme.colors.primary}
                labelStyle={{
                  fontSize: theme.custom.typography.labelMedium.fontSize,
                  fontFamily: theme.custom.typography.labelMedium.fontFamily,
                }}
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
                  compact
                  mode="outlined"
                  onPress={() => handleHistorySelect(entry)}
                  onClose={() => removeHistoryEntry(entry)}
                  closeIcon="close"
                  textStyle={{
                    fontSize: theme.custom.typography.labelMedium.fontSize,
                    fontFamily: theme.custom.typography.labelMedium.fontFamily,
                  }}
                >
                  {entry.term}
                </Chip>
              ))}
            </View>
          ) : (
            <HelperText type="info">Search for a show or movie to get started.</HelperText>
          )}
        </View>
      )}
    </Card>
  );
};
