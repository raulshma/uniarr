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

import { Card } from '@/components/common/Card';
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
          backgroundColor: theme.colors.elevation.level1,
          borderRadius: 12,
        },
        header: {
          marginBottom: spacing.md,
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
          marginBottom: spacing.md,
        },
        searchInput: {
          backgroundColor: theme.colors.surface,
          borderRadius: 8,
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
          gap: spacing.sm,
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
        <Card key={item.id} variant="custom" style={styles.resultCard}>
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
              labelStyle={{
                fontSize: theme.custom.typography.labelLarge.fontSize,
                fontFamily: theme.custom.typography.labelLarge.fontFamily,
              }}
            >
              {item.serviceType === 'jellyseerr' ? 'View in Jellyseerr' : `Add via ${serviceTypeLabels[item.serviceType] ?? 'Service'}`}
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
    <Card variant="custom" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Unified Search</Text>
      </View>
      <View style={styles.searchRow}>
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
          <Button
            compact
            mode="text"
            onPress={clearServiceFilters}
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
