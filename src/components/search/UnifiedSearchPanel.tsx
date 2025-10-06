import React, { JSX, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  HelperText,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useRouter } from 'expo-router';

import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import type { SearchHistoryEntry, UnifiedSearchMediaType, UnifiedSearchResult } from '@/models/search.types';

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

  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilters, setServiceFilters] = useState<string[]>([]);
  const [mediaFilters, setMediaFilters] = useState<UnifiedSearchMediaType[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);

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
          padding: spacing.md,
          borderRadius: 16,
          backgroundColor: theme.colors.elevation.level2,
        },
        header: {
          marginBottom: spacing.sm,
        },
        headerTitle: {
          color: theme.colors.onSurface,
          fontSize: theme.custom.typography.titleMedium.fontSize,
          fontFamily: theme.custom.typography.titleMedium.fontFamily,
          lineHeight: theme.custom.typography.titleMedium.lineHeight,
          letterSpacing: theme.custom.typography.titleMedium.letterSpacing,
          fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
        },
        searchRow: {
          marginBottom: spacing.sm,
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
          marginBottom: spacing.sm,
        },
        resultContainer: {
          gap: spacing.sm,
        },
        resultCard: {
          borderRadius: 12,
          backgroundColor: theme.colors.elevation.level3,
          padding: spacing.md,
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
      const params: Record<string, string> = {
        serviceId: item.serviceId,
      };

      if (item.externalIds?.tmdbId) {
        params.tmdbId = String(item.externalIds.tmdbId);
      }
      if (item.externalIds?.tvdbId) {
        params.tvdbId = String(item.externalIds.tvdbId);
      }

      params.query = item.title;

      switch (item.serviceType) {
        case 'sonarr':
          router.push({ pathname: '/(auth)/sonarr/[serviceId]/add', params });
          break;
        case 'radarr':
          router.push({ pathname: '/(auth)/radarr/[serviceId]/add', params });
          break;
        case 'jellyseerr':
          router.push({ pathname: '/(auth)/jellyseerr/[serviceId]', params });
          break;
        default:
          break;
      }

      await recordSearch(item.title, {
        serviceIds: [item.serviceId],
        mediaTypes: [item.mediaType],
      });
    },
    [recordSearch, router],
  );

  const handleOpenService = useCallback(
    (item: UnifiedSearchResult) => {
      switch (item.serviceType) {
        case 'sonarr':
          router.push({ pathname: '/(auth)/sonarr/[serviceId]', params: { serviceId: item.serviceId } });
          break;
        case 'radarr':
          router.push({ pathname: '/(auth)/radarr/[serviceId]', params: { serviceId: item.serviceId } });
          break;
        case 'jellyseerr':
          router.push({ pathname: '/(auth)/jellyseerr/[serviceId]', params: { serviceId: item.serviceId } });
          break;
        default:
          break;
      }
    },
    [router],
  );

  const renderResult = useCallback(
    (item: UnifiedSearchResult) => {
      const serviceLabel = `${serviceTypeLabels[item.serviceType] ?? item.serviceType}: ${item.serviceName}`;
      const releaseLabel = buildReleaseLabel(item);
      const statusChips: JSX.Element[] = [];

      if (item.isInLibrary) {
        statusChips.push(
          <Chip key="library" compact icon="check" elevated>
            In Library
          </Chip>,
        );
      }

      if (item.isRequested) {
        statusChips.push(
          <Chip key="requested" compact icon="ticket-confirmation">
            Requested
          </Chip>,
        );
      }

      if (item.isAvailable) {
        statusChips.push(
          <Chip key="available" compact icon="check-decagram">
            Available
          </Chip>,
        );
      }

      return (
        <View key={item.id} style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Chip compact>{serviceLabel}</Chip>
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
            <Button mode="contained" onPress={() => handlePrimaryAction(item)}>
              {item.serviceType === 'jellyseerr' ? 'View in Jellyseerr' : `Add via ${serviceTypeLabels[item.serviceType] ?? 'Service'}`}
            </Button>
            <IconButton
              icon="open-in-new"
              accessibilityLabel="Open service"
              onPress={() => handleOpenService(item)}
            />
          </View>
        </View>
      );
    },
    [handleOpenService, handlePrimaryAction, styles, theme.colors.onSurfaceVariant],
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Unified Search</Text>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          mode="outlined"
          placeholder="Search across Sonarr, Radarr, Jellyseerr"
          value={searchTerm}
          onChangeText={setSearchTerm}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          right={
            searchTerm ? <TextInput.Icon icon="close" onPress={() => setSearchTerm('')} /> : undefined
          }
        />
        {searchTerm.trim().length < minSearchLength ? (
          <HelperText type="info">
            Enter at least {minSearchLength} characters to search all services.
          </HelperText>
        ) : null}
      </View>

      <View style={styles.helperRow}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>Services</Text>
        {serviceFilters.length ? (
          <Button compact onPress={clearServiceFilters}>
            Clear
          </Button>
        ) : null}
      </View>
      <View style={styles.chipRow}>
        <Chip selected={serviceFilters.length === 0} onPress={clearServiceFilters} compact>
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
            >
              {service.serviceName}
            </Chip>
          ))
        )}
      </View>

      <View style={styles.helperRow}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>Media types</Text>
        {mediaFilters.length ? (
          <Button compact onPress={clearMediaFilters}>
            Clear
          </Button>
        ) : null}
      </View>
      <View style={styles.chipRow}>
        <Chip selected={mediaFilters.length === 0} onPress={clearMediaFilters} compact>
          All media
        </Chip>
        {mediaFilterOptions.map((option) => (
          <Chip
            key={option}
            compact
            selected={mediaFilters.includes(option)}
            onPress={() => toggleMedia(option)}
          >
            {mediaTypeLabels[option]}
          </Chip>
        ))}
      </View>

      {hasActiveQuery ? (
        <View style={styles.resultContainer}>
          {isBusy ? <ActivityIndicator animating /> : null}
          {renderErrorHelper}
          {!isBusy && results.length === 0 ? (
            <HelperText type="info">No results found. Try adjusting filters or a different term.</HelperText>
          ) : null}
          {results.map(renderResult)}
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
              <Button compact onPress={clearHistory}>
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
                  onPress={() => handleHistorySelect(entry)}
                  onClose={() => removeHistoryEntry(entry)}
                  closeIcon="close"
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
    </View>
  );
};
