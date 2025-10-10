import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { MediaPoster } from '@/components/media/MediaPoster';
import { EmptyState } from '@/components/common/EmptyState';
import { useTheme, Text, ActivityIndicator } from 'react-native-paper';
import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';
import { useJellyseerrMediaDetails } from '@/hooks/useJellyseerrMediaDetails';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import type { JellyseerrConnector } from '@/connectors/implementations/JellyseerrConnector';
import { Linking } from 'react-native';

const JellyseerrMediaDetailScreen: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const { serviceId: rawServiceId, mediaType: rawMediaType, mediaId: rawMediaId } = useLocalSearchParams<{
    serviceId?: string;
    mediaType?: string;
    mediaId?: string;
  }>();

  const serviceId = typeof rawServiceId === 'string' ? rawServiceId : '';
  const mediaType = (rawMediaType === 'movie' || rawMediaType === 'tv') ? rawMediaType : undefined;
  const mediaId = Number.parseInt(typeof rawMediaId === 'string' ? rawMediaId : '', 10);

  const { data, isLoading, isError, refetch } = useJellyseerrMediaDetails(serviceId, mediaType ?? 'movie', mediaId);

  const connector = useMemo(() => {
    const c = ConnectorManager.getInstance().getConnector(serviceId) as JellyseerrConnector | undefined;
    return c && c.config.type === 'jellyseerr' ? c : undefined;
  }, [serviceId]);

  const openInJellyseerr = async () => {
    if (!connector || !mediaType || !mediaId) return;
    const path = connector.getMediaDetailUrl(mediaId, mediaType);
    const base = connector.config.url.replace(/\/$/, '');
    await Linking.openURL(`${base}${path}`);
  };

  if (!serviceId || !mediaType || !Number.isFinite(mediaId)) {
    return (
      <EmptyState
        title="Invalid media reference"
        description="Missing or invalid service, media type, or media id."
        actionLabel="Go back"
        onActionPress={() => router.back()}
      />
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator animating />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Failed to load media"
        description="We couldn't load details from Jellyseerr."
        actionLabel="Retry"
        onActionPress={() => void refetch()}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
      <Card contentPadding="md" style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <MediaPoster uri={data.posterUrl} size="large" borderRadius={12} />
          <View style={{ flex: 1 }}>
            <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
              {data.title ?? 'Unknown Title'}
            </Text>
            {data.overview ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: spacing.sm }}>
                {data.overview}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              {data.releaseDate ? (
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Release: {data.releaseDate}</Text>
              ) : null}
              {data.firstAirDate ? (
                <Text style={{ color: theme.colors.onSurfaceVariant }}>First Air: {data.firstAirDate}</Text>
              ) : null}
              {data.runtime ? (
                <Text style={{ color: theme.colors.onSurfaceVariant }}>{data.runtime} min</Text>
              ) : null}
            </View>
            {data.genres?.length ? (
              <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: spacing.xs }}>
                Genres: {data.genres.join(', ')}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button mode="contained" onPress={openInJellyseerr}>Open in Jellyseerr</Button>
          <Button mode="outlined" onPress={() => router.back()}>Back</Button>
        </View>
      </Card>
    </ScrollView>
  );
};

export default JellyseerrMediaDetailScreen;
