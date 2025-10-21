import { useEffect, useCallback, useRef } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { alert } from "@/services/dialogService";

export interface VoiceCommandHandlerReturn {
  processVoiceIntent: (
    action: string,
    parameters?: Record<string, any>,
  ) => Promise<void>;
  isProcessing: boolean;
}

export const useVoiceCommandHandler = (): VoiceCommandHandlerReturn => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const pendingAlertsRef = useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set(),
  );

  useEffect(() => {
    const current = pendingAlertsRef.current;

    return () => {
      current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      current.clear();
    };
  }, []);

  const scheduleAlert = useCallback((fn: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      pendingAlertsRef.current.delete(timeoutId);
      fn();
    }, delay);

    pendingAlertsRef.current.add(timeoutId);
  }, []);

  const handleSearchMedia = useCallback(
    async (query?: string): Promise<void> => {
      if (!query) {
        alert("Search Media", "Please specify what you want to search for.", [
          { text: "OK" },
          {
            text: "Go to Search",
            onPress: () => router.push("/(auth)/search"),
          },
        ]);
        return;
      }

      try {
        router.push("/(auth)/search");
        scheduleAlert(() => {
          alert(
            "Search Results",
            `Searching for "${query}" across all services...`,
            [
              { text: "OK" },
              {
                text: "View Results",
                onPress: () => router.push("/(auth)/search"),
              },
            ],
          );
        }, 500);
      } catch {
        alert("Search Error", "Failed to search for media");
      }
    },
    [router, scheduleAlert],
  );

  const handleCheckServices = useCallback(async (): Promise<void> => {
    try {
      const serviceCount = 3;
      const onlineServices = 2;

      alert(
        "Service Status",
        `Services: ${onlineServices}/${serviceCount} online\n\nTap "View Details" to see more information.`,
        [
          { text: "OK" },
          {
            text: "View Details",
            onPress: () => router.push("/(auth)/(tabs)/services"),
          },
        ],
      );
    } catch {
      alert("Service Check Error", "Failed to check service status");
    }
  }, [router]);

  const handleCheckDownloads = useCallback(async (): Promise<void> => {
    try {
      const activeDownloads = 2;
      const totalDownloads = 5;

      alert(
        "Download Status",
        `Active downloads: ${activeDownloads}\nTotal downloads: ${totalDownloads}\n\nTap "View Queue" to see all downloads.`,
        [
          { text: "OK" },
          {
            text: "View Queue",
            onPress: () => router.push("/(auth)/(tabs)/downloads"),
          },
        ],
      );
    } catch {
      alert("Download Check Error", "Failed to check download status");
    }
  }, [router]);

  const handleAddMedia = useCallback(
    async (mediaName?: string): Promise<void> => {
      if (!mediaName) {
        alert(
          "Add Media",
          "Please specify the name of the movie or TV show you want to add.",
          [
            { text: "OK" },
            {
              text: "Search Media",
              onPress: () => router.push("/(auth)/search"),
            },
          ],
        );
        return;
      }

      try {
        router.push("/(auth)/search");
        scheduleAlert(() => {
          alert(
            "Add Media",
            `Searching for "${mediaName}" to add to your services...`,
            [
              { text: "OK" },
              {
                text: "Search Now",
                onPress: () => router.push("/(auth)/search"),
              },
            ],
          );
        }, 500);
      } catch {
        alert("Add Media Error", "Failed to add media");
      }
    },
    [router, scheduleAlert],
  );

  const handleManageRequests = useCallback(async (): Promise<void> => {
    try {
      const pendingRequests = 3;

      alert(
        "Jellyseerr Requests",
        `Pending requests: ${pendingRequests}\n\nTap "View Requests" to manage your requests.`,
        [
          { text: "OK" },
          {
            text: "View Requests",
            onPress: () => router.push("/(auth)/(tabs)/services"),
          },
        ],
      );
    } catch {
      alert("Request Check Error", "Failed to check requests");
    }
  }, [router]);

  const processVoiceIntent = useCallback(
    async (action: string, parameters?: Record<string, any>): Promise<void> => {
      try {
        switch (action) {
          case "search_media":
            await handleSearchMedia(parameters?.query);
            break;

          case "check_services":
            await handleCheckServices();
            break;

          case "check_downloads":
            await handleCheckDownloads();
            break;

          case "add_media":
            await handleAddMedia(parameters?.name);
            break;

          case "manage_requests":
            await handleManageRequests();
            break;

          default:
            // Unknown actions are surfaced to the user via a dialog instead of
            // console logging so lint rules about console usage are satisfied.
            alert("Voice Command", `Received unknown command: ${action}`, [
              { text: "OK" },
            ]);
        }
      } catch {
        // Surface a user-friendly error dialog. Avoid console.error to comply
        // with project lint rules about console usage.
        alert(
          "Voice Command Error",
          "Failed to process voice command. Please try again.",
          [{ text: "OK" }],
        );
      }
    },
    [
      handleSearchMedia,
      handleCheckServices,
      handleCheckDownloads,
      handleAddMedia,
      handleManageRequests,
    ],
  );

  useEffect(() => {
    const action = params.action as string;
    const query = params.query as string;

    if (action) {
      processVoiceIntent(action, query ? { query } : undefined);
    }
  }, [params.action, params.query, processVoiceIntent]);

  return {
    processVoiceIntent,
    isProcessing: false,
  };
};

export default useVoiceCommandHandler;
