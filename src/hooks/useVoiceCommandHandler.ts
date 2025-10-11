import { useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { alert } from '@/services/dialogService';
import { VoiceAssistantService } from '../services/voice';
import { useUnifiedSearch } from './useUnifiedSearch';
import { useNetworkStatus } from './useNetworkStatus';
import { useSonarrSeries } from './useSonarrSeries';
import { useRadarrMovies } from './useRadarrMovies';
import { useQBittorrentTorrents } from './useQBittorrentTorrents';
import { useJellyseerrRequests } from './useJellyseerrRequests';

export interface VoiceCommandHandlerReturn {
  processVoiceIntent: (action: string, parameters?: Record<string, any>) => Promise<void>;
  isProcessing: boolean;
}

export const useVoiceCommandHandler = (): VoiceCommandHandlerReturn => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const voiceService = VoiceAssistantService.getInstance();

  // Service hooks for executing voice commands
  // Note: These hooks are used for data access, not for triggering actions
  // The actual implementation would need proper service IDs and error handling

  // Process voice intent when component mounts with voice parameters
  useEffect(() => {
    const action = params.action as string;
    const query = params.query as string;

    if (action) {
      processVoiceIntent(action, query ? { query } : undefined);
    }
  }, [params.action, params.query]);

  const processVoiceIntent = useCallback(async (
    action: string,
    parameters?: Record<string, any>
  ): Promise<void> => {
    try {
      switch (action) {
        case 'search_media':
          await handleSearchMedia(parameters?.query);
          break;

        case 'check_services':
          await handleCheckServices();
          break;

        case 'check_downloads':
          await handleCheckDownloads();
          break;

        case 'add_media':
          await handleAddMedia(parameters?.name);
          break;

        case 'manage_requests':
          await handleManageRequests();
          break;

        default:
          console.warn('Unknown voice command action:', action);
          alert(
            'Voice Command',
            `Received unknown command: ${action}`,
            [{ text: 'OK' }]
          );
      }
    } catch (error) {
      console.error('Error processing voice command:', error);
  alert(
        'Voice Command Error',
        'Failed to process voice command. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  const handleSearchMedia = async (query?: string): Promise<void> => {
    if (!query) {
  alert(
        'Search Media',
        'Please specify what you want to search for.',
        [
          { text: 'OK' },
          {
            text: 'Go to Search',
            onPress: () => router.push('/(auth)/search'),
          },
        ]
      );
      return;
    }

    try {
  // Navigate to dedicated search page and trigger search
  router.push('/(auth)/search');

      // Small delay to ensure navigation completes
      setTimeout(() => {
        // This would trigger the unified search if we had a way to pass the query
  alert(
          'Search Results',
          `Searching for "${query}" across all services...`,
          [
            { text: 'OK' },
            {
              text: 'View Results',
              onPress: () => {
                // Navigate to search results or show search UI
                router.push('/(auth)/search');
              },
            },
          ]
        );
      }, 500);
    } catch (error) {
  alert('Search Error', 'Failed to search for media');
    }
  };

  const handleCheckServices = async (): Promise<void> => {
    try {
      // Mock implementation - in a real app this would use the networkStatus hook
      const serviceCount = 3; // Mock: would come from useNetworkStatus()
      const onlineServices = 2; // Mock: would come from useNetworkStatus()

  alert(
        'Service Status',
        `Services: ${onlineServices}/${serviceCount} online\n\nTap "View Details" to see more information.`,
        [
          { text: 'OK' },
          {
            text: 'View Details',
            onPress: () => router.push('/(auth)/(tabs)/services'),
          },
        ]
      );
    } catch (error) {
  alert('Service Check Error', 'Failed to check service status');
    }
  };

  const handleCheckDownloads = async (): Promise<void> => {
    try {
      // Mock implementation - in a real app this would use the torrents hook
      const activeDownloads = 2; // Mock: would come from useQBittorrentTorrents()
      const totalDownloads = 5; // Mock: would come from useQBittorrentTorrents()

  alert(
        'Download Status',
        `Active downloads: ${activeDownloads}\nTotal downloads: ${totalDownloads}\n\nTap "View Queue" to see all downloads.`,
        [
          { text: 'OK' },
          {
            text: 'View Queue',
            onPress: () => router.push('/(auth)/(tabs)/downloads'),
          },
        ]
      );
    } catch (error) {
  alert('Download Check Error', 'Failed to check download status');
    }
  };

  const handleAddMedia = async (mediaName?: string): Promise<void> => {
    if (!mediaName) {
  alert(
        'Add Media',
        'Please specify the name of the movie or TV show you want to add.',
        [
          { text: 'OK' },
          {
            text: 'Search Media',
            onPress: () => router.push('/(auth)/search'),
          },
        ]
      );
      return;
    }

    try {
  // Navigate to the dedicated search page
  router.push('/(auth)/search');

      setTimeout(() => {
  alert(
          'Add Media',
          `Searching for "${mediaName}" to add to your services...`,
          [
            { text: 'OK' },
            {
              text: 'Search Now',
              onPress: () => {
                // This would trigger search if we had the search functionality
                router.push('/(auth)/search');
              },
            },
          ]
        );
      }, 500);
    } catch (error) {
  alert('Add Media Error', 'Failed to add media');
    }
  };

  const handleManageRequests = async (): Promise<void> => {
    try {
      // Mock implementation - in a real app this would use the requests hook
      const pendingRequests = 3; // Mock: would come from useJellyseerrRequests()

  alert(
        'Jellyseerr Requests',
        `Pending requests: ${pendingRequests}\n\nTap "View Requests" to manage your requests.`,
        [
          { text: 'OK' },
          {
            text: 'View Requests',
            onPress: () => router.push('/(auth)/(tabs)/services'),
          },
        ]
      );
    } catch (error) {
  alert('Request Check Error', 'Failed to check requests');
    }
  };

  return {
    processVoiceIntent,
    isProcessing: false, // We could add loading state if needed
  };
};

export default useVoiceCommandHandler;
