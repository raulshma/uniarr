import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { JellyfinConnector } from '@/connectors/implementations/JellyfinConnector';
import { useConnectorsStore, selectGetConnector } from '@/store/connectorsStore';
import type { IConnector } from '@/connectors/base/IConnector';
import { queryKeys } from '@/hooks/queryKeys';
import type { JellyfinResumeItem, JellyfinSession } from '@/models/jellyfin.types';

interface UseJellyfinResumeOptions {
  readonly serviceId?: string;
  readonly limit?: number;
  readonly includeTypes?: string[];
}

const ensureConnector = (getConnector: (id: string) => IConnector | undefined, serviceId: string): JellyfinConnector => {
  const connector = getConnector(serviceId);

  if (!connector || connector.config.type !== 'jellyfin') {
    throw new Error(`Jellyfin connector not registered for service ${serviceId}.`);
  }

  return connector as JellyfinConnector;
};

export const useJellyfinResume = ({ serviceId, limit = 20, includeTypes }: UseJellyfinResumeOptions) => {
  const getConnector = useConnectorsStore(selectGetConnector);

  return useQuery<JellyfinResumeItem[]>({
    queryKey: serviceId
      ? queryKeys.jellyfin.resume(serviceId, { limit, includeTypes })
      : queryKeys.jellyfin.base,
    enabled: Boolean(serviceId),
    queryFn: async () => {
      if (!serviceId) {
        return [];
      }

      const connector = ensureConnector(getConnector, serviceId);
      
      // Get resume items
      const resumeItems = await connector.getResumeItems(limit, includeTypes);
      
      // Get currently playing sessions
      const sessions = await connector.getNowPlayingSessions();
      
      // Filter sessions to those with progress and matching types
      const playingItems: JellyfinResumeItem[] = sessions
        .filter(session => {
          const item = session.NowPlayingItem || session.NowViewingItem;
          if (!item) return false;
          
          // Check if item type matches
          const itemTypes = includeTypes || ['Movie', 'Episode'];
          if (!itemTypes.includes(item.Type || '')) return false;
          
          // Check if there's progress
          const position = session.PlayState?.PositionTicks;
          const runtime = item.RunTimeTicks;
          if (!position || !runtime || position < 600000000) return false; // Less than 1 minute
          
          return true;
        })
        .map(session => {
          const item = (session.NowPlayingItem || session.NowViewingItem)!;
          // Add playback position to UserData if not present
          const userData = item.UserData ? { ...item.UserData } : {};
          if (session.PlayState?.PositionTicks && !userData.PlaybackPositionTicks) {
            userData.PlaybackPositionTicks = session.PlayState.PositionTicks;
          }
          return {
            ...item,
            UserData: userData,
          };
        });
      
      // Combine and deduplicate by Id
      const allItems = [...resumeItems];
      const existingIds = new Set(resumeItems.map(item => item.Id));
      
      for (const playingItem of playingItems) {
        if (!existingIds.has(playingItem.Id)) {
          allItems.push(playingItem);
        }
      }
      
      // Sort by last played date or something, but for now just limit
      const result = allItems.slice(0, limit);
      return result;
    },
  });
};
